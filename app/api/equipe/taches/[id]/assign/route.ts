import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canReassignTask } from "@/lib/tasks/permissions";
import { invalidateTeamMetrics } from "@/lib/tasks/cache";

const schema = z.object({
  toAssigneeId: z.string().min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;

  const task = await db.task.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!task) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!canReassignTask(ctx, task)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  const newAssigneeId = parsed.data.toAssigneeId;
  if (newAssigneeId === task.assigneeId) {
    return NextResponse.json({ error: "Déjà assigné à cet utilisateur" }, { status: 400 });
  }

  // Verify new assignee is in the same team (cf. RBAC E).
  const tm = await db.teamMember.findFirst({
    where: { teamId: task.teamId, userId: newAssigneeId },
  });
  if (!tm) {
    return NextResponse.json({ error: "Le nouvel assigné doit être membre de l'équipe" }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    await tx.taskEvent.create({
      data: {
        taskId: task.id,
        eventType: "REASSIGNMENT",
        fromAssigneeId: task.assigneeId,
        toAssigneeId: newAssigneeId,
        byUserId: ctx.userId,
      },
    });
    await tx.task.update({ where: { id: task.id }, data: { assigneeId: newAssigneeId } });
    await tx.taskNotification.create({
      data: {
        organizationId: ctx.orgId,
        recipientId: newAssigneeId,
        taskId: task.id,
        type: "TASK_ASSIGNED",
        message: `Une tâche vous a été réassignée : ${task.title}`,
      },
    });
  });

  await invalidateTeamMetrics(ctx.orgId, task.teamId);
  return NextResponse.json({ ok: true });
}
