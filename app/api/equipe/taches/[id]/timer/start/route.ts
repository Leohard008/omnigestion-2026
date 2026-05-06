import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { transitionStatus, TransitionError } from "@/lib/tasks/transitions";
import { redis } from "@/lib/redis";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const task = await db.task.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!task) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (task.status === "IN_PROGRESS") return NextResponse.json({ ok: true, alreadyActive: true });

  try {
    await transitionStatus(ctx, task, "IN_PROGRESS");
  } catch (e) {
    if (e instanceof TransitionError) {
      const code = e.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: e.message }, { status: code });
    }
    throw e;
  }

  await redis.del(`metrics:org:${ctx.orgId}:team:${task.teamId}`);
  return NextResponse.json({ ok: true });
}
