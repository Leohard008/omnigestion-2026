import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { canViewTeamDashboard } from "@/lib/tasks/permissions";
import { computeTeamMetrics, detectAnomalies } from "@/lib/tasks/metrics";
import { teamMetricsKey, getCachedMetrics, setCachedMetrics } from "@/lib/tasks/cache";
import type { Period } from "@/lib/tasks/types";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { teamId } = await params;

  const team = await db.team.findFirst({ where: { id: teamId, organizationId: ctx.orgId } });
  if (!team) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!canViewTeamDashboard(ctx, teamId)) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const url = new URL(request.url);
  const period = (url.searchParams.get("period") ?? "30d") as Period;
  if (!["7d", "30d", "90d", "12m"].includes(period)) {
    return NextResponse.json({ error: "Période invalide" }, { status: 400 });
  }

  const key = teamMetricsKey(ctx.orgId, teamId, period);
  const cached = await getCachedMetrics(key);
  if (cached) return NextResponse.json({ ...cached, cached: true });

  const metrics = await computeTeamMetrics(ctx.orgId, teamId, period);
  const anomalies = await detectAnomalies(ctx.orgId, teamId);
  const payload = { ...metrics, anomalies };
  await setCachedMetrics(key, payload);
  return NextResponse.json(payload);
}
