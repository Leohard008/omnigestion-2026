"use client";
import { useEffect, useState } from "react";
import { MetricsBoard } from "./MetricsBoard";
import { HeatmapMatrix } from "./HeatmapMatrix";
import type { Period } from "@/lib/tasks/types";

interface Team { id: string; name: string }
interface Props { teams: Team[]; isAdmin: boolean }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

export function ManagerDashboard({ teams, isAdmin }: Props) {
  const [period, setPeriod] = useState<Period>("30d");
  const [teamId, setTeamId] = useState<string>(teams[0]?.id ?? "");
  const [data, setData] = useState<AnyObj | null>(null);

  useEffect(() => {
    if (!teamId) return;
    fetch(`/api/equipe/metrics/team/${teamId}?period=${period}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, [teamId, period]);

  if (teams.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucune équipe accessible.{" "}
        {isAdmin ? "Créez une équipe dans /dashboard/equipe/equipes." : ""}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {(["7d", "30d", "90d", "12m"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-2 py-1 rounded ${period === p ? "bg-slate-900 text-white" : "bg-slate-100"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded border p-3">
              <div className="text-xs text-slate-500">Membres</div>
              <div className="text-xl font-semibold">{data.memberMetrics.length}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-slate-500">Tâches actives</div>
              <div className="text-xl font-semibold">{data.totalActive}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-slate-500">Tâches terminées ({period})</div>
              <div className="text-xl font-semibold">{data.totalDone}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-slate-500">En retard</div>
              <div className={`text-xl font-semibold ${data.totalOverdue > 0 ? "text-amber-600" : ""}`}>
                {data.totalOverdue}
              </div>
            </div>
          </div>

          {data.anomalies?.length > 0 && (
            <div className="rounded border bg-blue-50 p-3">
              <div className="text-sm font-medium mb-2">Anomalies ({data.anomalies.length})</div>
              <ul className="space-y-1 text-sm">
                {data.anomalies.map((a: AnyObj) => (
                  <li key={a.taskId}>🔵 {a.message}</li>
                ))}
              </ul>
            </div>
          )}

          <MetricsBoard members={data.memberMetrics} />
          <HeatmapMatrix
            members={data.memberMetrics}
            teamCycleMedian={data.teamCycleTimeMedianSec}
            teamLeadMedian={data.teamLeadTimeMedianSec}
          />
        </>
      )}
    </div>
  );
}
