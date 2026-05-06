import { db } from "@/lib/db";
import { BLOCKED_LONG_HOURS, WIP_ALERT_THRESHOLD } from "@/lib/tasks/constants";

interface NotifyInsert {
  organizationId: string;
  recipientId: string;
  taskId: string;
  type: "TASK_OVERDUE" | "TASK_BLOCKED_LONG" | "TASK_ANOMALY";
  message: string;
}

async function getManagersOfTeam(teamId: string): Promise<string[]> {
  const rows = await db.teamMember.findMany({
    where: { teamId, role: "MANAGER" },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

async function getOrgAdmins(orgId: string): Promise<string[]> {
  const rows = await db.organizationMember.findMany({
    where: { organizationId: orgId, isActive: true, role: { in: ["OWNER", "ADMIN"] } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

async function notifyIfNotRecent(
  notif: NotifyInsert,
  windowHours = 24
): Promise<void> {
  const since = new Date(Date.now() - windowHours * 3600 * 1000);
  const existing = await db.taskNotification.findFirst({
    where: {
      organizationId: notif.organizationId,
      recipientId: notif.recipientId,
      taskId: notif.taskId,
      type: notif.type,
      createdAt: { gte: since },
    },
  });
  if (!existing) {
    await db.taskNotification.create({ data: notif });
  }
}

export async function runAnomalyJob(): Promise<{ processed: number }> {
  let processed = 0;

  // 1. TASK_OVERDUE — assignee + managers + admins of org
  const overdue = await db.task.findMany({
    where: {
      dueDate: { lt: new Date() },
      status: { notIn: ["DONE", "CANCELLED"] },
    },
    select: { id: true, organizationId: true, teamId: true, assigneeId: true, title: true },
  });
  for (const t of overdue) {
    const recipients = new Set<string>([t.assigneeId]);
    (await getManagersOfTeam(t.teamId)).forEach((u) => recipients.add(u));
    (await getOrgAdmins(t.organizationId)).forEach((u) => recipients.add(u));
    for (const r of recipients) {
      await notifyIfNotRecent({
        organizationId: t.organizationId,
        recipientId: r,
        taskId: t.id,
        type: "TASK_OVERDUE",
        message: `Tâche en retard : ${t.title}`,
      });
      processed += 1;
    }
  }

  // 2. TASK_BLOCKED_LONG — last STATUS_CHANGE → BLOCKED older than 48h
  const blockedTasks = await db.task.findMany({
    where: { status: "BLOCKED" },
    select: { id: true, organizationId: true, teamId: true, assigneeId: true, title: true },
  });
  for (const t of blockedTasks) {
    const lastBlocked = await db.taskEvent.findFirst({
      where: { taskId: t.id, eventType: "STATUS_CHANGE", toStatus: "BLOCKED" },
      orderBy: { at: "desc" },
    });
    if (!lastBlocked) continue;
    const hoursSince = (Date.now() - lastBlocked.at.getTime()) / 3600 / 1000;
    if (hoursSince < BLOCKED_LONG_HOURS) continue;

    const recipients = new Set<string>([t.assigneeId]);
    (await getManagersOfTeam(t.teamId)).forEach((u) => recipients.add(u));
    for (const r of recipients) {
      await notifyIfNotRecent({
        organizationId: t.organizationId,
        recipientId: r,
        taskId: t.id,
        type: "TASK_BLOCKED_LONG",
        message: `Tâche bloquée depuis plus de 48h : ${t.title}`,
      });
      processed += 1;
    }
  }

  // 3. WIP_EXCESS — group active tasks by assignee per team
  const groups = await db.task.groupBy({
    by: ["organizationId", "teamId", "assigneeId"],
    where: { status: { in: ["IN_PROGRESS", "BLOCKED"] } },
    _count: { _all: true },
  });
  for (const g of groups) {
    if ((g._count?._all ?? 0) <= WIP_ALERT_THRESHOLD) continue;
    const managers = await getManagersOfTeam(g.teamId);
    // Pick most recent task to anchor the notification
    const anyTask = await db.task.findFirst({
      where: {
        organizationId: g.organizationId,
        teamId: g.teamId,
        assigneeId: g.assigneeId,
        status: { in: ["IN_PROGRESS", "BLOCKED"] },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (!anyTask) continue;
    for (const m of managers) {
      await notifyIfNotRecent({
        organizationId: g.organizationId,
        recipientId: m,
        taskId: anyTask.id,
        type: "TASK_ANOMALY",
        message: `Un membre a ${g._count?._all} tâches actives (alerte > ${WIP_ALERT_THRESHOLD}).`,
      });
      processed += 1;
    }
  }

  return { processed };
}
