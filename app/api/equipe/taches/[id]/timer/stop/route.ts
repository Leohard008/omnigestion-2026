import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { transitionStatus, TransitionError } from "@/lib/tasks/transitions";
import { invalidateTeamMetrics } from "@/lib/tasks/cache";

const schema = z.object({
  outcome: z.enum(["BLOCKED", "DONE"]),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const task = await db.task.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!task) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  try {
    await transitionStatus(ctx, task, parsed.data.outcome, parsed.data.reason);
  } catch (e) {
    if (e instanceof TransitionError) {
      const code = e.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: e.message }, { status: code });
    }
    throw e;
  }

  await invalidateTeamMetrics(ctx.orgId, task.teamId);
  return NextResponse.json({ ok: true });
}
