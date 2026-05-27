"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface User { id: string; name: string | null; email: string; image?: string | null; }
interface Member { id: string; userId: string; role: "MANAGER" | "MEMBER"; user: User; }

interface Props {
  teamId: string;
  members: Member[];
  candidateUsers: User[];
  canChangeRoles: boolean;
}

export function TeamMembersList({ teamId, members, candidateUsers, canChangeRoles }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<"MANAGER" | "MEMBER">("MEMBER");

  async function add() {
    if (!newUserId) return;
    setBusy(true);
    const r = await fetch(`/api/equipe/equipes/${teamId}/membres`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: newUserId, role: newRole }),
    });
    setBusy(false);
    if (r.ok) {
      setNewUserId("");
      setNewRole("MEMBER");
      router.refresh();
    } else {
      const data = await r.json().catch(() => ({}));
      alert(data.error ?? "Erreur");
    }
  }

  async function changeRole(userId: string, role: "MANAGER" | "MEMBER") {
    setBusy(true);
    const r = await fetch(`/api/equipe/equipes/${teamId}/membres/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setBusy(false);
    if (r.ok) router.refresh();
    else alert("Erreur");
  }

  async function remove(userId: string) {
    if (!window.confirm("Retirer ce membre de l'équipe ?")) return;
    setBusy(true);
    const r = await fetch(`/api/equipe/equipes/${teamId}/membres/${userId}`, { method: "DELETE" });
    setBusy(false);
    if (r.ok) router.refresh();
    else {
      const data = await r.json().catch(() => ({}));
      alert(data.error ?? "Erreur");
    }
  }

  return (
    <div className="space-y-3">
      <ul className="rounded border bg-white">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0">
            <div className="flex-1">
              <div className="text-sm font-medium">{m.user.name ?? m.user.email}</div>
              <div className="text-xs text-slate-500">{m.user.email}</div>
            </div>
            {canChangeRoles ? (
              <select
                value={m.role}
                onChange={(e) => changeRole(m.userId, e.target.value as "MANAGER" | "MEMBER")}
                className="border rounded px-2 py-1 text-xs"
                disabled={busy}
              >
                <option value="MEMBER">Membre</option>
                <option value="MANAGER">Manager</option>
              </select>
            ) : (
              <span className="text-xs text-slate-500">{m.role === "MANAGER" ? "Manager" : "Membre"}</span>
            )}
            <Button variant="outline" size="sm" onClick={() => remove(m.userId)} disabled={busy}>
              Retirer
            </Button>
          </li>
        ))}
      </ul>

      {candidateUsers.length > 0 && (
        <div className="rounded border bg-slate-50 p-3 flex flex-wrap items-center gap-2">
          <select
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">Ajouter un membre…</option>
            {candidateUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
            ))}
          </select>
          {canChangeRoles && (
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "MANAGER" | "MEMBER")}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="MEMBER">Membre</option>
              <option value="MANAGER">Manager</option>
            </select>
          )}
          <Button size="sm" onClick={add} disabled={!newUserId || busy}>Ajouter</Button>
        </div>
      )}
    </div>
  );
}
