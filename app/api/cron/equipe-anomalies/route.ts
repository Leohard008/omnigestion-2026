import { NextResponse } from "next/server";
import { runAnomalyJob } from "@/lib/tasks/anomaly-job";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const result = await runAnomalyJob();
  return NextResponse.json(result);
}
