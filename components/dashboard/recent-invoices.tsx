"use client";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

interface Invoice {
  id: string;
  number: string;
  customer: string;
  total: number;
  status: string;
  issueDate: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Brouillon", className: "bg-slate-100 text-slate-600" },
  SENT: { label: "Envoyée", className: "bg-blue-100 text-blue-700" },
  PAID: { label: "Payée", className: "bg-green-100 text-green-700" },
  OVERDUE: { label: "En retard", className: "bg-red-100 text-red-700" },
  CANCELLED: { label: "Annulée", className: "bg-slate-100 text-slate-500" },
};

interface RecentInvoicesProps {
  invoices: Invoice[];
  currency: string;
}

export function RecentInvoices({ invoices, currency }: RecentInvoicesProps) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Dernières Factures</h2>
        <Link href="/dashboard/factures" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          Voir tout <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {invoices.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">Aucune facture</p>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const status = statusConfig[inv.status] ?? { label: inv.status, className: "bg-slate-100 text-slate-600" };
            return (
              <Link key={inv.id} href={`/dashboard/factures/${inv.id}`}>
                <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded px-2 -mx-2 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{inv.number}</p>
                    <p className="text-xs text-slate-500">{inv.customer} · {formatDate(inv.issueDate)}</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.className}`}>
                      {status.label}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(inv.total, currency as "DZD" | "EUR")}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
