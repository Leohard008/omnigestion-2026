"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface Metrics {
  leadTimeMedianSec: number | null;
  cycleTimeMedianSec: number | null;
  throughput: number;
  trend: { weekStart: string; cycleMedianSec: number | null; throughput: number }[];
}

function fmtH(s: number | null) {
  if (s == null) return "—";
  return `${(s / 3600).toFixed(1)}h`;
}

export function CollabMetrics({ userId }: { userId: string }) {
  const [data, setData] = useState<Metrics | null>(null);
  useEffect(() => {
    fetch(`/api/equipe/metrics/member/${userId}?days=30`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, [userId]);

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="rounded border p-3">
        <div className="text-xs text-slate-500">Temps avant démarrage médian</div>
        <div className="text-xl font-semibold">{fmtH(data.leadTimeMedianSec)}</div>
      </div>
      <div className="rounded border p-3">
        <div className="text-xs text-slate-500">Temps d&apos;exécution médian</div>
        <div className="text-xl font-semibold">{fmtH(data.cycleTimeMedianSec)}</div>
      </div>
      <div className="rounded border p-3">
        <div className="text-xs text-slate-500">Tâches terminées (30j)</div>
        <div className="text-xl font-semibold">{data.throughput}</div>
      </div>
      <div className="rounded border p-3 col-span-1 md:col-span-1">
        <div className="text-xs text-slate-500">Tendance 4 semaines</div>
        <div className="h-12">
          <ResponsiveContainer>
            <LineChart data={data.trend}>
              <Line type="monotone" dataKey="throughput" dot={false} stroke="#0ea5e9" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
