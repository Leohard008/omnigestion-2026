import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const membership = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: { organization: true },
  });
  if (!membership) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });

  const orgId = membership.organizationId;
  const now = new Date();

  const [
    totalInvoiced,
    totalPaid,
    totalOverdue,
    pendingInvoices,
    customerCount,
    activeQuotes,
    lowStockProducts,
    overdueInvoicesList,
    expiredQuotesList,
  ] = await Promise.all([
    db.invoice.aggregate({
      where: { organizationId: orgId, status: { not: "CANCELLED" } },
      _sum: { total: true },
    }),
    db.invoice.aggregate({
      where: { organizationId: orgId, status: "PAID" },
      _sum: { total: true },
    }),
    db.invoice.aggregate({
      where: { organizationId: orgId, status: "OVERDUE" },
      _sum: { total: true },
    }),
    db.invoice.count({
      where: { organizationId: orgId, status: { in: ["SENT", "OVERDUE"] } },
    }),
    db.customer.count({ where: { organizationId: orgId, isActive: true } }),
    db.quote.count({ where: { organizationId: orgId, status: { in: ["DRAFT", "SENT"] } } }),
    db.product.findMany({
      where: { organizationId: orgId, isActive: true, stock: { lte: 5, not: null } },
      select: { id: true, name: true, stock: true },
      take: 5,
    }),
    db.invoice.findMany({
      where: { organizationId: orgId, status: "OVERDUE" },
      include: { customer: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    db.quote.findMany({
      where: { organizationId: orgId, status: "SENT", validUntil: { lt: now } },
      include: { customer: { select: { name: true } } },
      take: 5,
    }),
  ]);

  const totalInvoicedVal = totalInvoiced._sum.total ?? 0;
  const totalPaidVal = totalPaid._sum.total ?? 0;
  const totalOverdueVal = totalOverdue._sum.total ?? 0;
  const currentCreances = totalInvoicedVal - totalPaidVal - totalOverdueVal;
  const recoveryRate = totalInvoicedVal > 0 ? Math.round((totalPaidVal / totalInvoicedVal) * 100) : 0;

  return NextResponse.json({
    currency: membership.organization.currency,
    kpis: {
      totalInvoiced: totalInvoicedVal,
      totalPaid: totalPaidVal,
      totalOverdue: totalOverdueVal,
      currentCreances,
      recoveryRate,
      pendingInvoices,
      customerCount,
      activeQuotes,
    },
    alerts: {
      lowStockProducts,
      overdueInvoices: overdueInvoicesList.map(inv => ({
        id: inv.id,
        number: inv.number,
        customer: inv.customer.name,
        total: inv.total,
        dueDate: inv.dueDate,
      })),
      expiredQuotes: expiredQuotesList.map(q => ({
        id: q.id,
        number: q.number,
        customer: q.customer.name,
        total: q.total,
        validUntil: q.validUntil,
      })),
    },
  });
}
