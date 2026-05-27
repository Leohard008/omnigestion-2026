import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { editTimerSession, TimerError } from "@/lib/tasks/timer";
import { invalidateTeamMetrics } from "@/lib/tasks/cache";

const schema = z.object({
  newStartedAt: z.string().datetime().optional(),
  newEndedAt: z.string().datetime().optional(),
  reason: z.string().max(500).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id, sessionId } = await params;
  const task = await db.task.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!task) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  try {
    await editTimerSession(ctx, sessionId, task, {
      newStartedAt: parsed.data.newStartedAt ? new Date(parsed.data.newStartedAt) : undefined,
      newEndedAt: parsed.data.newEndedAt ? new Date(parsed.data.newEndedAt) : undefined,
      reason: parsed.data.reason,
    });
  } catch (e) {
    if (e instanceof TimerError) {
      const code = e.code === "FORBIDDEN" ? 403 : e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: e.message }, { status: code });
    }
    throw e;
  }

  await invalidateTeamMetrics(ctx.orgId, task.teamId);
  return NextResponse.json({ ok: true });
}
