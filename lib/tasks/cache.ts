import { redis } from "@/lib/redis";
import { METRICS_CACHE_TTL_SECONDS } from "@/lib/tasks/constants";

export function teamMetricsKey(orgId: string, teamId: string, period: string) {
  return `metrics:org:${orgId}:team:${teamId}:${period}`;
}

export async function getCachedMetrics<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCachedMetrics(key: string, data: unknown): Promise<void> {
  await redis.setex(key, METRICS_CACHE_TTL_SECONDS, JSON.stringify(data));
}

export async function invalidateTeamMetrics(orgId: string, teamId: string): Promise<void> {
  // Delete all period variants.
  for (const p of ["7d", "30d", "90d", "12m"]) {
    await redis.del(teamMetricsKey(orgId, teamId, p));
  }
}
