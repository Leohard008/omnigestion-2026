import { db } from "@/lib/db";
import type { Period, MemberMetrics, TeamMetrics, AnomalyFlag } from "@/lib/tasks/types";
import { PERIOD_TO_DAYS, WIP_ALERT_THRESHOLD } from "@/lib/tasks/constants";

// WIP_ALERT_THRESHOLD is referenced by the cron job in Phase 7.
void WIP_ALERT_THRESHOLD;

export function computeP50(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  if (sorted.length % 2 === 1) return sorted[Math.floor(mid)];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeP75(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * 0.75;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

export function periodToDate(period: Period, now = new Date()): Date {
  const days = PERIOD_TO_DAYS[period] ?? 30;
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export async function computeTeamMetrics(
  orgId: string,
  teamId: string,
  period: Period
): Promise<TeamMetrics> {
  const since = periodToDate(period);

  const doneTasks = await db.task.findMany({
    where: {
      organizationId: orgId,
      teamId,
      status: "DONE",
      completedAt: { gte: since },
    },
    select: {
      id: true,
      assigneeId: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  });

  const startedTasks = await db.task.findMany({
    where: {
      organizationId: orgId,
      teamId,
      startedAt: { gte: since, not: null },
      status: { not: "CANCELLED" },
    },
    select: { assigneeId: true, createdAt: true, startedAt: true },
  });

  const activeTasks = await db.task.findMany({
    where: {
      organizationId: orgId,
      teamId,
      status: { in: ["IN_PROGRESS", "BLOCKED"] },
    },
    select: { assigneeId: true },
  });

  const sessionsByTask = await db.timerSession.groupBy({
    by: ["taskId"],
    where: {
      taskId: { in: doneTasks.map((t) => t.id) },
      endedAt: { not: null },
    },
    _sum: { durationSeconds: true },
  });
  const sessionSumByTask = new Map(
    sessionsByTask.map((r) => [r.taskId, r._sum.durationSeconds ?? 0])
  );

  const byAssignee = new Map<string, MemberMetrics>();
  function ensure(uid: string): MemberMetrics {
    if (!byAssignee.has(uid)) {
      byAssignee.set(uid, {
        userId: uid,
        cycleTimeMedianSec: null,
        cycleTimeP75Sec: null,
        leadTimeMedianSec: null,
        leadTimeP75Sec: null,
        throughput: 0,
        wipCount: 0,
        flowEfficiencyAvg: null,
      });
    }
    return byAssignee.get(uid)!;
  }

  const cycleByUser: Record<string, number[]> = {};
  const leadByUser: Record<string, number[]> = {};
  const flowByUser: Record<string, number[]> = {};

  for (const t of doneTasks) {
    if (!t.startedAt || !t.completedAt) continue;
    const cycle = (t.completedAt.getTime() - t.startedAt.getTime()) / 1000;
    (cycleByUser[t.assigneeId] ??= []).push(cycle);
    ensure(t.assigneeId).throughput += 1;

    const sessionSum = sessionSumByTask.get(t.id) ?? 0;
    if (cycle > 0) {
      const flow = Math.min(1, sessionSum / cycle);
      (flowByUser[t.assigneeId] ??= []).push(flow);
    }
  }

  for (const t of startedTasks) {
    if (!t.startedAt) continue;
    const lead = (t.startedAt.getTime() - t.createdAt.getTime()) / 1000;
    (leadByUser[t.assigneeId] ??= []).push(lead);
  }

  for (const t of activeTasks) {
    ensure(t.assigneeId).wipCount += 1;
  }

  for (const [uid, arr] of Object.entries(cycleByUser)) {
    const m = ensure(uid);
    m.cycleTimeMedianSec = computeP50(arr);
    m.cycleTimeP75Sec = computeP75(arr);
  }
  for (const [uid, arr] of Object.entries(leadByUser)) {
    const m = ensure(uid);
    m.leadTimeMedianSec = computeP50(arr);
    m.leadTimeP75Sec = computeP75(arr);
  }
  for (const [uid, arr] of Object.entries(flowByUser)) {
    const m = ensure(uid);
    m.flowEfficiencyAvg = arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  const allCycle: number[] = Object.values(cycleByUser).flat();
  const allLead: number[] = Object.values(leadByUser).flat();
  const overdue = await db.task.count({
    where: {
      organizationId: orgId,
      teamId,
      dueDate: { lt: new Date() },
      status: { notIn: ["DONE", "CANCELLED"] },
    },
  });

  return {
    teamId,
    period,
    memberMetrics: Array.from(byAssignee.values()),
    teamCycleTimeMedianSec: computeP50(allCycle),
    teamLeadTimeMedianSec: computeP50(allLead),
    totalActive: activeTasks.length,
    totalDone: doneTasks.length,
    totalOverdue: overdue,
  };
}

export async function detectAnomalies(
  orgId: string,
  teamId: string
): Promise<AnomalyFlag[]> {
  const flags: AnomalyFlag[] = [];

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const doneTasks = await db.task.findMany({
    where: {
      organizationId: orgId,
      teamId,
      status: "DONE",
      completedAt: { gte: since },
      startedAt: { not: null },
    },
    select: { id: true, startedAt: true, completedAt: true, title: true },
  });
  if (doneTasks.length === 0) return flags;

  const taskIds = doneTasks.map((t) => t.id);

  const sums = await db.timerSession.groupBy({
    by: ["taskId"],
    where: { taskId: { in: taskIds }, endedAt: { not: null } },
    _sum: { durationSeconds: true },
  });
  const sessionSumByTask = new Map(
    sums.map((r) => [r.taskId, r._sum.durationSeconds ?? 0])
  );

  const events = await db.taskEvent.findMany({
    where: { taskId: { in: taskIds }, eventType: "STATUS_CHANGE" },
    orderBy: { at: "asc" },
    select: { taskId: true, fromStatus: true, toStatus: true, at: true },
  });
  const eventsByTask = new Map<string, typeof events>();
  for (const e of events) {
    if (!eventsByTask.has(e.taskId)) eventsByTask.set(e.taskId, []);
    eventsByTask.get(e.taskId)!.push(e);
  }

  for (const t of doneTasks) {
    if (!t.startedAt || !t.completedAt) continue;
    const cycleSec =
      (t.completedAt.getTime() - t.startedAt.getTime()) / 1000;
    if (cycleSec <= 0) continue;

    // Rule 1: INCONSISTENT_TIMER
    const sum = sessionSumByTask.get(t.id) ?? 0;
    if (cycleSec > 8 * 3600 && sum < 2 * 3600) {
      flags.push({
        taskId: t.id,
        type: "INCONSISTENT_TIMER",
        message: `Tâche "${t.title}" — temps actif (${Math.round(sum / 3600)}h) très inférieur au cycle (${Math.round(cycleSec / 3600)}h). Session non clôturée ?`,
      });
    }

    // Rule 2: EXCESSIVE_BLOCKED_RATIO
    const taskEvents = eventsByTask.get(t.id) ?? [];
    let blockedSec = 0;
    let blockedSince: Date | null = null;
    for (const e of taskEvents) {
      if (e.toStatus === "BLOCKED") {
        blockedSince = e.at;
      } else if (blockedSince && e.fromStatus === "BLOCKED") {
        blockedSec += (e.at.getTime() - blockedSince.getTime()) / 1000;
        blockedSince = null;
      }
    }
    if (blockedSince && t.completedAt) {
      blockedSec +=
        (t.completedAt.getTime() - blockedSince.getTime()) / 1000;
    }
    if (blockedSec / cycleSec > 0.5) {
      flags.push({
        taskId: t.id,
        type: "EXCESSIVE_BLOCKED_RATIO",
        message: `Tâche "${t.title}" — ${Math.round((blockedSec / cycleSec) * 100)}% du cycle passé en BLOCKED. Cause externe à investiguer ?`,
      });
    }
  }

  return flags;
}
