"use client";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

interface RevenueChartProps {
  data: Array<{ month: string; ventes: number }>;
  currency: string;
}

const formatValue = (value: number, currency: string) => {
  if (currency === "EUR") return `${(value / 1000).toFixed(1)}k€`;
  return `${(value / 1000).toFixed(0)}k`;
};

export function RevenueChart({ data, currency }: RevenueChartProps) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="font-semibold text-slate-900 mb-4">Évolution du chiffre d&apos;affaires</h2>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatValue(v, currency)} />
          <Tooltip
            formatter={(value: number) => [formatValue(value, currency), "CA"]}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
          />
          <Area type="monotone" dataKey="ventes" stroke="#3B82F6" strokeWidth={2} fill="url(#caGradient)" dot={{ fill: "#3B82F6", r: 3 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
