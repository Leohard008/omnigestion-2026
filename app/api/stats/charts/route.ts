import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const membership = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
  });
  if (!membership) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });

  const orgId = membership.organizationId;
  const now = new Date();

  // Generate last 6 months of data
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      label: date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      start: new Date(date.getFullYear(), date.getMonth(), 1),
      end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59),
    };
  });

  const monthlyData = await Promise.all(
    months.map(async (m) => {
      const [invoices, expenses] = await Promise.all([
        db.invoice.aggregate({
          where: {
            organizationId: orgId,
            status: "PAID",
            paidAt: { gte: m.start, lte: m.end },
          },
          _sum: { total: true },
        }),
        db.expense.aggregate({
          where: {
            organizationId: orgId,
            date: { gte: m.start, lte: m.end },
          },
          _sum: { amount: true },
        }),
      ]);

      return {
        month: m.label,
        ventes: invoices._sum.total ?? 0,
        depenses: expenses._sum.amount ?? 0,
      };
    })
  );

  // Top 5 clients by revenue
  const topClientsRaw = await db.invoice.groupBy({
    by: ["customerId"],
    where: { organizationId: orgId, status: "PAID" },
    _sum: { total: true },
    orderBy: { _sum: { total: "desc" } },
    take: 5,
  });

  const topClients = await Promise.all(
    topClientsRaw.map(async (item) => {
      const customer = await db.customer.findUnique({
        where: { id: item.customerId },
        select: { name: true },
      });
      return {
        name: customer?.name ?? "Inconnu",
        value: item._sum.total ?? 0,
      };
    })
  );

  // Recent invoices
  const recentInvoices = await db.invoice.findMany({
    where: { organizationId: orgId },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return NextResponse.json({
    monthlyData,
    topClients,
    recentInvoices: recentInvoices.map(inv => ({
      id: inv.id,
      number: inv.number,
      customer: inv.customer.name,
      total: inv.total,
      status: inv.status,
      issueDate: inv.issueDate,
    })),
  });
}
