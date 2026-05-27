import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canViewTask, canEditTask, canDeleteTask } from "@/lib/tasks/permissions";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  estimatedHours: z.number().positive().max(9999).nullable().optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const task = await db.task.findFirst({
    where: { id, organizationId: ctx.orgId },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      createdBy: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      events: {
        include: { byUser: { select: { id: true, name: true } } },
        orderBy: { at: "asc" },
      },
      sessions: {
        include: { edits: { include: { editedBy: { select: { id: true, name: true } } }, orderBy: { editedAt: "asc" } } },
        orderBy: { startedAt: "asc" },
      },
    },
  });
  if (!task) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!canViewTask(ctx, task)) return NextResponse.json({ error: "Interdit" }, { status: 403 });
  return NextResponse.json(task);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;

  const task = await db.task.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!task) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!canEditTask(ctx, task)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const updates: Record<string, any> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updates[k] = v;
  }
  if (updates.dueDate) updates.dueDate = new Date(updates.dueDate);

  // Build FIELD_EDIT events for each changed field.
  await db.$transaction(async (tx) => {
    for (const [k, v] of Object.entries(updates)) {
      const oldVal = (task as any)[k];
      const oldStr = oldVal == null ? null : String(oldVal instanceof Date ? oldVal.toISOString() : oldVal);
      const newStr = v == null ? null : String(v instanceof Date ? v.toISOString() : v);
      if (oldStr === newStr) continue;
      await tx.taskEvent.create({
        data: {
          taskId: id,
          eventType: "FIELD_EDIT",
          fieldName: k,
          oldValue: oldStr,
          newValue: newStr,
          byUserId: ctx.userId,
        },
      });
    }
    await tx.task.update({ where: { id }, data: updates });
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const task = await db.task.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!task) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!canDeleteTask(ctx, task)) return NextResponse.json({ error: "Interdit" }, { status: 403 });
  await db.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
