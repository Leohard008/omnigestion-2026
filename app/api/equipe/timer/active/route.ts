import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getActiveTimerForUser } from "@/lib/tasks/timer";

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const active = await getActiveTimerForUser(ctx.userId);
  return NextResponse.json(active);
}
