"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface SalesChartProps {
  data: Array<{ month: string; ventes: number; depenses: number }>;
  currency: string;
}

const formatValue = (value: number, currency: string) => {
  if (currency === "EUR") return `${(value / 1000).toFixed(1)}k€`;
  return `${(value / 1000).toFixed(0)}k DZD`;
};

export function SalesChart({ data, currency }: SalesChartProps) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="font-semibold text-slate-900 mb-4">Ventes vs Dépenses (6 derniers mois)</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatValue(v, currency)} />
          <Tooltip
            formatter={(value, name) => [formatValue(Number(value ?? 0), currency), name === "ventes" ? "Ventes" : "Dépenses"]}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
          />
          <Legend formatter={(value) => value === "ventes" ? "Ventes" : "Dépenses"} />
          <Bar dataKey="ventes" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="depenses" fill="#F59E0B" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
