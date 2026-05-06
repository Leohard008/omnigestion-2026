"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";

interface Team { id: string; name: string; }
interface Member { id: string; name: string | null; email: string; }

export function NewTaskButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [teamId, setTeamId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/equipe/equipes")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        setTeams(list);
        if (list.length && !teamId) setTeamId(list[0].id);
      });
  }, [open]);

  useEffect(() => {
    if (!teamId) {
      setMembers([]);
      return;
    }
    fetch(`/api/equipe/equipes/${teamId}/membres`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { user: Member }[]) => {
        const ms = rows.map((r) => r.user);
        setMembers(ms);
        setAssigneeId((curr) => (ms.find((m) => m.id === curr) ? curr : userId));
      });
  }, [teamId, userId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const body: Record<string, unknown> = {
      teamId, title, assigneeId, priority,
    };
    if (description.trim()) body.description = description.trim();
    if (dueDate) body.dueDate = new Date(dueDate).toISOString();
    if (estimatedHours) body.estimatedHours = Number(estimatedHours);

    const r = await fetch("/api/equipe/taches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setError(data.error ?? "Erreur");
      return;
    }
    setOpen(false);
    setTitle("");
    setDescription("");
    setDueDate("");
    setEstimatedHours("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Nouvelle tâche</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle tâche</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs">Équipe</label>
            <select className="w-full border rounded px-2 py-1" value={teamId} onChange={(e) => setTeamId(e.target.value)} required>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs">Titre</label>
            <input className="w-full border rounded px-2 py-1" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={1} maxLength={200} />
          </div>
          <div>
            <label className="text-xs">Description (optionnel)</label>
            <textarea className="w-full border rounded px-2 py-1" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
          </div>
          <div>
            <label className="text-xs">Assigné</label>
            <select className="w-full border rounded px-2 py-1" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} required>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name ?? m.email}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs">Priorité</label>
              <select className="w-full border rounded px-2 py-1" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                <option value="LOW">Basse</option>
                <option value="MEDIUM">Normale</option>
                <option value="HIGH">Haute</option>
                <option value="URGENT">Urgente</option>
              </select>
            </div>
            <div>
              <label className="text-xs">Échéance</label>
              <input type="date" className="w-full border rounded px-2 py-1" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs">Estim. (h)</label>
              <input type="number" min={0.25} step={0.25} className="w-full border rounded px-2 py-1" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Création…" : "Créer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
