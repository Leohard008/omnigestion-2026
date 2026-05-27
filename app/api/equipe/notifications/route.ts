import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";

export async function GET(request: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const url = new URL(request.url);
  const onlyUnread = url.searchParams.get("unread") === "1";

  const where: any = { organizationId: ctx.orgId, recipientId: ctx.userId };
  if (onlyUnread) where.readAt = null;

  const [notifications, unreadCount] = await Promise.all([
    db.taskNotification.findMany({
      where,
      include: { task: { select: { id: true, title: true, teamId: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.taskNotification.count({
      where: { organizationId: ctx.orgId, recipientId: ctx.userId, readAt: null },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
