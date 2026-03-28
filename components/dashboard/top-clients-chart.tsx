"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444"];

interface TopClientsChartProps {
  data: Array<{ name: string; value: number }>;
  currency: string;
}

export function TopClientsChart({ data, currency }: TopClientsChartProps) {
  const formatValue = (value: number) => {
    if (currency === "EUR") return `${(value / 1000).toFixed(1)}k€`;
    return `${(value / 1000).toFixed(0)}k DZD`;
  };

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Top 5 Clients</h2>
        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Aucune donnée</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="font-semibold text-slate-900 mb-4">Top 5 Clients</h2>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [formatValue(value), name]}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
          />
          <Legend iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs text-slate-600">{value}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
