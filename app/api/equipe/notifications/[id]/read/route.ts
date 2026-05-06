import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const result = await db.taskNotification.updateMany({
    where: { id, organizationId: ctx.orgId, recipientId: ctx.userId },
    data: { readAt: new Date() },
  });
  if (result.count === 0) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
