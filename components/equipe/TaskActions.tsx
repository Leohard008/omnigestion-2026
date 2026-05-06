"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { TaskStatus } from "@prisma/client";

interface Member {
  id: string;
  name: string | null;
}
interface Props {
  task: {
    id: string;
    teamId: string;
    status: TaskStatus;
    assigneeId: string;
  };
  ctxUserId: string;
  canEdit: boolean;
  canDelete: boolean;
}

export function TaskActions({ task, ctxUserId, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [reassignTo, setReassignTo] = useState<string>("");

  useEffect(() => {
    if (!canEdit) return;
    fetch(`/api/equipe/equipes/${task.teamId}/membres`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { user: Member }[]) => setMembers(rows.map((r) => r.user)));
  }, [canEdit, task.teamId]);

  const isAssignee = task.assigneeId === ctxUserId;
  const canTransition = isAssignee || canEdit;

  async function transition(toStatus: TaskStatus, askReason = false) {
    setBusy(true);
    let reason: string | undefined;
    if (askReason) {
      const r = window.prompt("Raison (optionnel) :") ?? undefined;
      reason = r?.trim() || undefined;
    }
    const res = await fetch(`/api/equipe/taches/${task.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus, reason }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Erreur");
    }
  }

  async function reassign() {
    if (!reassignTo || reassignTo === task.assigneeId) return;
    setBusy(true);
    const res = await fetch(`/api/equipe/taches/${task.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toAssigneeId: reassignTo }),
    });
    setBusy(false);
    if (res.ok) {
      setReassignTo("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Erreur");
    }
  }

  async function remove() {
    if (!window.confirm("Supprimer définitivement cette tâche ?")) return;
    setBusy(true);
    const res = await fetch(`/api/equipe/taches/${task.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.push("/dashboard/equipe");
    else alert("Erreur");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {task.status === "TODO" && canTransition && (
        <Button onClick={() => transition("IN_PROGRESS")} disabled={busy}>
          ▶ Démarrer
        </Button>
      )}
      {task.status === "IN_PROGRESS" && canTransition && (
        <>
          <Button variant="outline" onClick={() => transition("BLOCKED", true)} disabled={busy}>
            ⏸ Bloquer
          </Button>
          <Button onClick={() => transition("DONE")} disabled={busy}>
            ✓ Terminer
          </Button>
        </>
      )}
      {task.status === "BLOCKED" && canTransition && (
        <Button onClick={() => transition("IN_PROGRESS")} disabled={busy}>
          ▶ Reprendre
        </Button>
      )}
      {canEdit && task.status !== "DONE" && task.status !== "CANCELLED" && (
        <Button variant="outline" onClick={() => transition("CANCELLED", true)} disabled={busy}>
          ✕ Annuler
        </Button>
      )}
      {canEdit && members.length > 0 && (
        <div className="flex items-center gap-1 ml-auto">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={reassignTo}
            onChange={(e) => setReassignTo(e.target.value)}
          >
            <option value="">Réassigner à…</option>
            {members.filter((m) => m.id !== task.assigneeId).map((m) => (
              <option key={m.id} value={m.id}>{m.name ?? m.id}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={reassign} disabled={!reassignTo || busy}>
            OK
          </Button>
        </div>
      )}
      {canDelete && (
        <Button variant="destructive" size="sm" onClick={remove} disabled={busy}>
          🗑 Supprimer
        </Button>
      )}
    </div>
  );
}
