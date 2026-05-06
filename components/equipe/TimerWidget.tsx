"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pause, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActiveTimer {
  id: string;
  startedAt: string;
  taskId: string;
  task: { id: string; title: string };
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`;
}

export function TimerWidget() {
  const [active, setActive] = useState<ActiveTimer | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const r = await fetch("/api/equipe/timer/active");
      if (!cancelled && r.ok) {
        const data: ActiveTimer | null = await r.json();
        setActive(data);
        if (data) setElapsed(Math.floor((Date.now() - new Date(data.startedAt).getTime()) / 1000));
      }
    }
    load();
    const poll = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const tick = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(tick);
  }, [active]);

  if (!active) return null;

  async function action(outcome: "BLOCKED" | "DONE") {
    if (!active) return;
    let reason: string | undefined;
    if (outcome === "BLOCKED") {
      reason = window.prompt("Raison du blocage (optionnel) :") ?? undefined;
    }
    const r = await fetch(`/api/equipe/taches/${active.taskId}/timer/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome, reason }),
    });
    if (r.ok) {
      setActive(null);
      router.refresh();
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg border bg-white shadow-lg p-3 w-72">
      <Link href={`/dashboard/equipe/taches/${active.taskId}`} className="block text-sm font-medium truncate hover:underline">
        ▶ {active.task.title}
      </Link>
      <div className="mt-1 text-xs text-slate-500">⏱ {formatElapsed(elapsed)}</div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => action("BLOCKED")}>
          <Pause className="h-3 w-3 mr-1" /> Bloquer
        </Button>
        <Button size="sm" onClick={() => action("DONE")}>
          <CheckCircle className="h-3 w-3 mr-1" /> Terminer
        </Button>
      </div>
    </div>
  );
}
