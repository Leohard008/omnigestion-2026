interface Member {
  userId: string;
  name: string | null;
  cycleTimeMedianSec: number | null;
  leadTimeMedianSec: number | null;
}

interface Props {
  members: Member[];
  teamCycleMedian: number | null;
  teamLeadMedian: number | null;
}

const QUADRANT_LABEL = {
  TL: "À débloquer",
  TR: "Surchargé ?",
  BL: "Inégal",
  BR: "Top performer",
} as const;

export function HeatmapMatrix({ members, teamCycleMedian, teamLeadMedian }: Props) {
  if (!teamCycleMedian || !teamLeadMedian) {
    return <p className="text-sm text-slate-500">Pas assez de données pour la heatmap.</p>;
  }
  const buckets = { TL: [] as Member[], TR: [] as Member[], BL: [] as Member[], BR: [] as Member[] };
  for (const m of members) {
    if (m.cycleTimeMedianSec == null || m.leadTimeMedianSec == null) continue;
    const slowExec = m.cycleTimeMedianSec > teamCycleMedian;
    const slowStart = m.leadTimeMedianSec > teamLeadMedian;
    const k = slowExec ? (slowStart ? "TL" : "TR") : slowStart ? "BL" : "BR";
    buckets[k].push(m);
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["TL", "TR", "BL", "BR"] as const).map((k) => (
        <div key={k} className="rounded border bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-700">{QUADRANT_LABEL[k]}</div>
          <ul className="mt-1 text-sm">
            {buckets[k].map((m) => (
              <li key={m.userId} className="truncate">
                {m.name ?? m.userId}
              </li>
            ))}
            {buckets[k].length === 0 && <li className="text-slate-400 italic">—</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}
