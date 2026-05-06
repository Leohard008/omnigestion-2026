"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface MemberRow {
  userId: string;
  name: string | null;
  wipCount: number;
  throughput: number;
  cycleTimeMedianSec: number | null;
  leadTimeMedianSec: number | null;
  flowEfficiencyAvg: number | null;
}

interface Props {
  members: MemberRow[];
}

function fmtH(seconds: number | null) {
  if (seconds == null) return "—";
  const h = seconds / 3600;
  return h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(seconds / 60)} min`;
}

export function MetricsBoard({ members }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-3 py-2 text-left">Membre</th>
            <th className="px-3 py-2 text-right">WIP</th>
            <th className="px-3 py-2 text-right">Throughput</th>
            <th className="px-3 py-2 text-right">Cycle P50</th>
            <th className="px-3 py-2 text-right">Lead P50</th>
            <th className="px-3 py-2 text-right">Flow</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId} className="border-t">
              <td className="px-3 py-2">{m.name ?? m.userId}</td>
              <td className="px-3 py-2 text-right">{m.wipCount}</td>
              <td className="px-3 py-2 text-right">{m.throughput}</td>
              <td className="px-3 py-2 text-right">{fmtH(m.cycleTimeMedianSec)}</td>
              <td className="px-3 py-2 text-right">{fmtH(m.leadTimeMedianSec)}</td>
              <td className="px-3 py-2 text-right">
                {m.flowEfficiencyAvg == null ? "—" : `${Math.round(m.flowEfficiencyAvg * 100)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
