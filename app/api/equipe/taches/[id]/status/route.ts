import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { transitionStatus, TransitionError } from "@/lib/tasks/transitions";
import { redis } from "@/lib/redis";

const schema = z.object({
  toStatus: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]),
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
    await transitionStatus(ctx, task, parsed.data.toStatus, parsed.data.reason);
  } catch (e) {
    if (e instanceof TransitionError) {
      const status = e.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    throw e;
  }

  await redis.del(`metrics:org:${ctx.orgId}:team:${task.teamId}`);
  return NextResponse.json({ ok: true });
}
