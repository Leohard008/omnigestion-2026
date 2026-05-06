"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface SessionEdit {
  id: string;
  oldDurationSec: number | null;
  newDurationSec: number | null;
  reason: string | null;
  editedAt: string;
  editedBy: { id: string; name: string | null };
}

interface Session {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  isEdited: boolean;
  editLockedAt: string | null;
  edits: SessionEdit[];
}

interface Props {
  taskId: string;
  sessions: Session[];
}

function toLocalDT(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtHM(seconds: number | null): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

export function SessionsEditor({ taskId, sessions }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (sessions.length === 0) {
    return <p className="text-sm text-slate-500">Aucune session enregistrée.</p>;
  }

  async function save(sessionId: string, form: HTMLFormElement) {
    setBusy(true);
    const fd = new FormData(form);
    const body: Record<string, unknown> = {};
    const startedAt = String(fd.get("startedAt") ?? "");
    const endedAt = String(fd.get("endedAt") ?? "");
    const reason = String(fd.get("reason") ?? "").trim();
    if (startedAt) body.newStartedAt = new Date(startedAt).toISOString();
    if (endedAt) body.newEndedAt = new Date(endedAt).toISOString();
    if (reason) body.reason = reason;

    const res = await fetch(`/api/equipe/taches/${taskId}/timer/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) {
      setEditingId(null);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Erreur");
    }
  }

  return (
    <div className="space-y-3">
      {sessions.map((s) => {
        const locked = s.editLockedAt ? new Date(s.editLockedAt) < new Date() : false;
        const editing = editingId === s.id;
        return (
          <div key={s.id} className="rounded border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm">
                <div>
                  ⏱ {new Date(s.startedAt).toLocaleString("fr-FR")} →{" "}
                  {s.endedAt ? new Date(s.endedAt).toLocaleString("fr-FR") : <em>en cours</em>}
                </div>
                <div className="text-slate-500">
                  Durée : {fmtHM(s.durationSeconds)}
                  {s.isEdited && <span className="ml-2 text-blue-600">✏ éditée</span>}
                </div>
              </div>
              {!editing && s.endedAt && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={locked}
                  onClick={() => setEditingId(s.id)}
                  title={locked ? "Verrouillée — contactez votre manager" : ""}
                >
                  Éditer
                </Button>
              )}
            </div>

            {editing && s.endedAt && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  save(s.id, e.currentTarget);
                }}
                className="mt-2 space-y-2"
              >
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs">
                    Début
                    <input
                      type="datetime-local"
                      name="startedAt"
                      defaultValue={toLocalDT(s.startedAt)}
                      className="w-full border rounded px-2 py-1"
                    />
                  </label>
                  <label className="text-xs">
                    Fin
                    <input
                      type="datetime-local"
                      name="endedAt"
                      defaultValue={toLocalDT(s.endedAt)}
                      className="w-full border rounded px-2 py-1"
                    />
                  </label>
                </div>
                <label className="text-xs block">
                  Raison
                  <input name="reason" maxLength={500} className="w-full border rounded px-2 py-1" />
                </label>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={busy}>
                    Sauvegarder
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                    Annuler
                  </Button>
                </div>
              </form>
            )}

            {s.edits.length > 0 && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-slate-500">
                  Historique d&apos;édition ({s.edits.length})
                </summary>
                <ul className="mt-1 space-y-1">
                  {s.edits.map((ed) => (
                    <li key={ed.id}>
                      {new Date(ed.editedAt).toLocaleString("fr-FR")} — {ed.editedBy.name ?? "—"} :{" "}
                      {fmtHM(ed.oldDurationSec)} → {fmtHM(ed.newDurationSec)}
                      {ed.reason && <em className="ml-1">({ed.reason})</em>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
