"use client";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface StatsOverviewProps {
  totalInvoiced: number;
  totalPaid: number;
  totalOverdue: number;
  currentCreances: number;
  recoveryRate: number;
  currency: string;
}

export function StatsOverview({ totalInvoiced, totalPaid, totalOverdue, currentCreances, recoveryRate, currency }: StatsOverviewProps) {
  const cur = currency as "DZD" | "EUR";
  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Vue financière</h2>
        <span className="text-sm text-slate-500">Taux de recouvrement: <span className="font-bold text-blue-600">{recoveryRate}%</span></span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-slate-500 uppercase font-medium">Total facturé</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(totalInvoiced, cur)}</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-xs text-green-700 uppercase font-medium">Encaissé</span>
          </div>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totalPaid, cur)}</p>
        </div>
        <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-orange-600" />
            <span className="text-xs text-orange-700 uppercase font-medium">Créances</span>
          </div>
          <p className="text-xl font-bold text-orange-700">{formatCurrency(currentCreances, cur)}</p>
        </div>
        <div className="p-4 bg-red-50 rounded-lg border border-red-100">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-xs text-red-700 uppercase font-medium">En retard</span>
          </div>
          <p className="text-xl font-bold text-red-700">{formatCurrency(totalOverdue, cur)}</p>
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-4">
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.min(recoveryRate, 100)}%` }} />
          <div className="h-full bg-orange-400 transition-all" style={{ width: `${Math.min(totalInvoiced > 0 ? (currentCreances / totalInvoiced) * 100 : 0, 100)}%` }} />
          <div className="h-full bg-red-500 transition-all" style={{ width: `${Math.min(totalInvoiced > 0 ? (totalOverdue / totalInvoiced) * 100 : 0, 100)}%` }} />
        </div>
        <div className="flex gap-4 mt-2 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Payé</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />En cours</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />En retard</span>
        </div>
      </div>
    </div>
  );
}
