import type { TaskEvent, TimerSession, TimerSessionEdit, TaskStatus } from "@prisma/client";

interface Props {
  events: (TaskEvent & { byUser: { id: string; name: string | null } })[];
  sessions: (TimerSession & {
    edits: (TimerSessionEdit & { editedBy: { id: string; name: string | null } })[];
  })[];
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  BLOCKED: "Bloquée",
  DONE: "Terminée",
  CANCELLED: "Annulée",
};

function fmt(d: Date | string) {
  return new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}
function durHM(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

export function TaskTimeline({ events, sessions }: Props) {
  type Item = { at: Date; render: () => React.ReactNode };
  const items: Item[] = [];

  for (const e of events) {
    items.push({
      at: new Date(e.at),
      render: () => {
        if (e.eventType === "STATUS_CHANGE") {
          return (
            <div>
              {fmt(e.at)} — {e.fromStatus ? `${STATUS_LABEL[e.fromStatus]} → ` : "Création — "}
              <strong>{e.toStatus ? STATUS_LABEL[e.toStatus] : ""}</strong> par {e.byUser.name ?? "—"}
              {e.reason && <em className="ml-2 text-slate-500">({e.reason})</em>}
            </div>
          );
        }
        if (e.eventType === "REASSIGNMENT") {
          return (
            <div>
              🔄 {fmt(e.at)} — Réassignée par {e.byUser.name ?? "—"}
            </div>
          );
        }
        return (
          <div>
            ✏ {fmt(e.at)} — Champ <code>{e.fieldName}</code> modifié par {e.byUser.name ?? "—"}{" "}
            <span className="text-slate-500">({e.oldValue ?? "∅"} → {e.newValue ?? "∅"})</span>
          </div>
        );
      },
    });
  }

  for (const s of sessions) {
    items.push({
      at: new Date(s.startedAt),
      render: () => (
        <div className="ml-4 text-slate-600">
          ⏱ Session {fmt(s.startedAt)} → {s.endedAt ? fmt(s.endedAt) : "en cours"}
          {s.durationSeconds && <span> ({durHM(s.durationSeconds)})</span>}
          {s.isEdited && <span className="ml-2 text-blue-600">✏ éditée</span>}
          {s.edits.length > 0 && (
            <ul className="ml-6 mt-1 text-xs">
              {s.edits.map((ed) => (
                <li key={ed.id}>
                  ↳ Modifiée par {ed.editedBy.name ?? "—"} le {fmt(ed.editedAt)}
                  {ed.oldDurationSec != null && ed.newDurationSec != null && (
                    <> — {durHM(ed.oldDurationSec)} → {durHM(ed.newDurationSec)}</>
                  )}
                  {ed.reason && <em className="ml-1">({ed.reason})</em>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ),
    });
  }

  items.sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <ol className="space-y-1 text-sm">
      {items.map((it, i) => (
        <li key={i}>{it.render()}</li>
      ))}
    </ol>
  );
}
