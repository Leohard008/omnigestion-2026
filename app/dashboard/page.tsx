import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { KPICard } from "@/components/dashboard/kpi-cards";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { TopClientsChart } from "@/components/dashboard/top-clients-chart";
import { ExchangeRatesWidget } from "@/components/dashboard/exchange-rates-widget";
import { AlertsWidget } from "@/components/dashboard/alerts-widget";
import { RecentInvoices } from "@/components/dashboard/recent-invoices";
import { TrendingUp, FileText, Users, FileCheck } from "lucide-react";

async function getDashboardData(orgId: string) {
  const now = new Date();

  const [
    totalPaid,
    totalInvoiced,
    totalOverdue,
    pendingInvoices,
    customerCount,
    activeQuotes,
    lowStockProducts,
    overdueInvoicesList,
    expiredQuotesList,
    monthlyData,
    topClients,
    recentInvoices,
  ] = await Promise.all([
    db.invoice.aggregate({ where: { organizationId: orgId, status: "PAID" }, _sum: { total: true } }),
    db.invoice.aggregate({ where: { organizationId: orgId, status: { not: "CANCELLED" } }, _sum: { total: true } }),
    db.invoice.aggregate({ where: { organizationId: orgId, status: "OVERDUE" }, _sum: { total: true } }),
    db.invoice.count({ where: { organizationId: orgId, status: { in: ["SENT", "OVERDUE"] } } }),
    db.customer.count({ where: { organizationId: orgId, isActive: true } }),
    db.quote.count({ where: { organizationId: orgId, status: { in: ["DRAFT", "SENT"] } } }),
    db.product.findMany({ where: { organizationId: orgId, isActive: true, stock: { lte: 5, not: null } }, select: { id: true, name: true, stock: true }, take: 5 }),
    db.invoice.findMany({ where: { organizationId: orgId, status: "OVERDUE" }, include: { customer: { select: { name: true } } }, orderBy: { dueDate: "asc" }, take: 5 }),
    db.quote.findMany({ where: { organizationId: orgId, status: "SENT", validUntil: { lt: now } }, include: { customer: { select: { name: true } } }, take: 5 }),
    // Monthly data (6 months)
    Promise.all(
      Array.from({ length: 6 }, async (_, i) => {
        const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        const start = new Date(date.getFullYear(), date.getMonth(), 1);
        const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
        const label = date.toLocaleDateString("fr-FR", { month: "short" });
        const [inv, exp] = await Promise.all([
          db.invoice.aggregate({ where: { organizationId: orgId, status: "PAID", paidAt: { gte: start, lte: end } }, _sum: { total: true } }),
          db.expense.aggregate({ where: { organizationId: orgId, date: { gte: start, lte: end } }, _sum: { amount: true } }),
        ]);
        return { month: label, ventes: inv._sum.total ?? 0, depenses: exp._sum.amount ?? 0 };
      })
    ),
    // Top clients
    db.invoice.groupBy({
      by: ["customerId"],
      where: { organizationId: orgId, status: "PAID" },
      _sum: { total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 5,
    }).then(async (items) =>
      Promise.all(items.map(async (item) => {
        const c = await db.customer.findUnique({ where: { id: item.customerId }, select: { name: true } });
        return { name: c?.name ?? "Inconnu", value: item._sum.total ?? 0 };
      }))
    ),
    db.invoice.findMany({ where: { organizationId: orgId }, include: { customer: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const totalPaidVal = totalPaid._sum.total ?? 0;
  const totalInvoicedVal = totalInvoiced._sum.total ?? 0;
  const totalOverdueVal = totalOverdue._sum.total ?? 0;
  const currentCreances = totalInvoicedVal - totalPaidVal - totalOverdueVal;
  const recoveryRate = totalInvoicedVal > 0 ? Math.round((totalPaidVal / totalInvoicedVal) * 100) : 0;

  return {
    kpis: { totalPaidVal, totalInvoicedVal, totalOverdueVal, currentCreances, recoveryRate, pendingInvoices, customerCount, activeQuotes },
    alerts: {
      lowStockProducts,
      overdueInvoices: overdueInvoicesList.map(i => ({ id: i.id, number: i.number, customer: i.customer.name, total: i.total, dueDate: i.dueDate?.toISOString() ?? null })),
      expiredQuotes: expiredQuotesList.map(q => ({ id: q.id, number: q.number, customer: q.customer.name })),
    },
    monthlyData,
    topClients,
    recentInvoices: recentInvoices.map(i => ({ id: i.id, number: i.number, customer: i.customer.name, total: i.total, status: i.status, issueDate: i.issueDate.toISOString() })),
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const membership = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: { organization: true },
  });
  if (!membership) redirect("/auth/login");

  const currency = membership.organization.currency as "DZD" | "EUR";
  const data = await getDashboardData(membership.organizationId);
  const { kpis, alerts, monthlyData, topClients, recentInvoices } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
        <p className="text-slate-500 text-sm">Bonjour {session.user?.name} — {membership.organization.name}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Chiffre d'affaires"
          value={formatCurrency(kpis.totalPaidVal, currency)}
          description="Factures encaissées"
          icon={TrendingUp}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <KPICard
          title="Factures en attente"
          value={kpis.pendingInvoices.toString()}
          description="À encaisser"
          icon={FileText}
          color="text-orange-600"
          bgColor="bg-orange-50"
        />
        <KPICard
          title="Clients actifs"
          value={kpis.customerCount.toString()}
          description="Total clients"
          icon={Users}
          color="text-green-600"
          bgColor="bg-green-50"
        />
        <KPICard
          title="Devis en cours"
          value={kpis.activeQuotes.toString()}
          description="En attente de réponse"
          icon={FileCheck}
          color="text-purple-600"
          bgColor="bg-purple-50"
        />
      </div>

      {/* Financial Overview */}
      <StatsOverview
        totalInvoiced={kpis.totalInvoicedVal}
        totalPaid={kpis.totalPaidVal}
        totalOverdue={kpis.totalOverdueVal}
        currentCreances={kpis.currentCreances}
        recoveryRate={kpis.recoveryRate}
        currency={currency}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SalesChart data={monthlyData} currency={currency} />
        </div>
        <ExchangeRatesWidget />
      </div>

      {/* Revenue + Top Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={monthlyData} currency={currency} />
        <TopClientsChart data={topClients} currency={currency} />
      </div>

      {/* Recent + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentInvoices invoices={recentInvoices} currency={currency} />
        <AlertsWidget
          overdueInvoices={alerts.overdueInvoices}
          lowStockProducts={alerts.lowStockProducts}
          expiredQuotes={alerts.expiredQuotes}
          currency={currency}
        />
      </div>
    </div>
  );
}
