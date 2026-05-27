import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canViewMemberMetrics } from "@/lib/tasks/permissions";
import { computeP50, computeP75 } from "@/lib/tasks/metrics";
import { COLLAB_VIEW_PERIOD_DAYS } from "@/lib/tasks/constants";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { userId } = await params;

  // Discover teams the target user belongs to (within the same org).
  const memberTeams = await db.teamMember.findMany({
    where: { userId, team: { organizationId: ctx.orgId } },
    select: { teamId: true },
  });
  const teamIds = memberTeams.map((m) => m.teamId);

  if (!canViewMemberMetrics(ctx, userId, { teamIds })) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? COLLAB_VIEW_PERIOD_DAYS);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const done = await db.task.findMany({
    where: { organizationId: ctx.orgId, assigneeId: userId, status: "DONE", completedAt: { gte: since } },
    select: { startedAt: true, completedAt: true },
  });
  const started = await db.task.findMany({
    where: { organizationId: ctx.orgId, assigneeId: userId, startedAt: { gte: since, not: null }, status: { not: "CANCELLED" } },
    select: { createdAt: true, startedAt: true },
  });
  const wip = await db.task.count({
    where: { organizationId: ctx.orgId, assigneeId: userId, status: { in: ["IN_PROGRESS", "BLOCKED"] } },
  });

  const cycle = done.filter((t) => t.startedAt && t.completedAt).map((t) => (t.completedAt!.getTime() - t.startedAt!.getTime()) / 1000);
  const lead = started.filter((t) => t.startedAt).map((t) => (t.startedAt!.getTime() - t.createdAt.getTime()) / 1000);

  // Trend by week (last 4 weeks)
  const trend: { weekStart: string; cycleMedianSec: number | null; throughput: number }[] = [];
  for (let w = 3; w >= 0; w--) {
    const weekStart = new Date(Date.now() - (w + 1) * 7 * 24 * 3600 * 1000);
    const weekEnd = new Date(Date.now() - w * 7 * 24 * 3600 * 1000);
    const tasksThisWeek = done.filter(
      (t) => t.completedAt && t.completedAt >= weekStart && t.completedAt < weekEnd
    );
    const arr = tasksThisWeek.filter((t) => t.startedAt && t.completedAt).map((t) => (t.completedAt!.getTime() - t.startedAt!.getTime()) / 1000);
    trend.push({
      weekStart: weekStart.toISOString(),
      cycleMedianSec: computeP50(arr),
      throughput: tasksThisWeek.length,
    });
  }

  return NextResponse.json({
    userId,
    days,
    cycleTimeMedianSec: computeP50(cycle),
    cycleTimeP75Sec: computeP75(cycle),
    leadTimeMedianSec: computeP50(lead),
    leadTimeP75Sec: computeP75(lead),
    throughput: done.length,
    wipCount: wip,
    trend,
  });
}
