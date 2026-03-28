"use client";
import { AlertCircle, Package, FileCheck, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Alert {
  id: string;
  type: "overdue" | "lowstock" | "expired";
  title: string;
  detail: string;
  href: string;
}

interface AlertsWidgetProps {
  overdueInvoices: Array<{ id: string; number: string; customer: string; total: number; dueDate: string | null }>;
  lowStockProducts: Array<{ id: string; name: string; stock: number | null }>;
  expiredQuotes: Array<{ id: string; number: string; customer: string }>;
  currency: string;
}

export function AlertsWidget({ overdueInvoices, lowStockProducts, expiredQuotes, currency }: AlertsWidgetProps) {
  const alerts: Alert[] = [
    ...overdueInvoices.map(inv => ({
      id: inv.id,
      type: "overdue" as const,
      title: `Facture ${inv.number} en retard`,
      detail: `${inv.customer} — ${inv.total.toLocaleString()} ${currency}`,
      href: `/dashboard/factures/${inv.id}`,
    })),
    ...lowStockProducts.map(p => ({
      id: p.id,
      type: "lowstock" as const,
      title: `Stock faible: ${p.name}`,
      detail: `Seulement ${p.stock ?? 0} unité(s) restante(s)`,
      href: `/dashboard/produits/${p.id}`,
    })),
    ...expiredQuotes.map(q => ({
      id: q.id,
      type: "expired" as const,
      title: `Devis ${q.number} expiré`,
      detail: q.customer,
      href: `/dashboard/devis/${q.id}`,
    })),
  ];

  const iconMap = {
    overdue: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-50", border: "border-red-100" },
    lowstock: { icon: Package, color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-100" },
    expired: { icon: FileCheck, color: "text-yellow-500", bg: "bg-yellow-50", border: "border-yellow-100" },
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Alertes</h2>
        {alerts.length > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {alerts.length}
          </span>
        )}
      </div>
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
          <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center mb-2">
            <span className="text-green-500 text-lg">✓</span>
          </div>
          <p className="text-sm font-medium text-slate-500">Aucune alerte</p>
          <p className="text-xs">Tout est en ordre</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {alerts.map((alert) => {
            const { icon: Icon, color, bg, border } = iconMap[alert.type];
            return (
              <Link key={`${alert.type}-${alert.id}`} href={alert.href}>
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${bg} ${border} hover:opacity-80 transition-opacity cursor-pointer`}>
                  <Icon className={`h-4 w-4 flex-shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{alert.title}</p>
                    <p className="text-xs text-slate-500 truncate">{alert.detail}</p>
                  </div>
                  <ChevronRight className="h-3 w-3 text-slate-400 flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
