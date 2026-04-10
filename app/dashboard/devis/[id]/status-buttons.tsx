"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const transitions: Record<string, { label: string; next: string; color: string }[]> = {
  DRAFT: [{ label: "Marquer Envoyé", next: "SENT", color: "blue" }],
  SENT: [
    { label: "Marquer Accepté", next: "ACCEPTED", color: "green" },
    { label: "Marquer Refusé", next: "REJECTED", color: "red" },
  ],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
};

const colorClasses: Record<string, string> = {
  blue: "text-blue-600 border-blue-200 hover:bg-blue-50",
  green: "text-green-600 border-green-200 hover:bg-green-50",
  red: "text-red-600 border-red-200 hover:bg-red-50",
};

export function DevisStatusButtons({
  devisId,
  currentStatus,
}: {
  devisId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const actions = transitions[currentStatus] ?? [];

  if (actions.length === 0) return null;

  async function updateStatus(next: string) {
    setLoading(next);
    const res = await fetch(`/api/devis/${devisId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      alert("Erreur lors de la mise à jour");
    }
    setLoading(null);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.next}
          onClick={() => updateStatus(action.next)}
          disabled={loading !== null}
          className={`inline-flex items-center px-3 py-1.5 text-sm font-medium border rounded-md disabled:opacity-50 ${colorClasses[action.color]}`}
        >
          {loading === action.next ? "..." : action.label}
        </button>
      ))}
    </div>
  );
}

export function DeleteDevisButton({ devisId }: { devisId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Supprimer ce devis ?")) return;
    setLoading(true);
    const res = await fetch(`/api/devis/${devisId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard/devis");
    } else {
      const data = await res.json();
      alert(data.error || "Erreur lors de la suppression");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50"
    >
      {loading ? "Suppression..." : "Supprimer"}
    </button>
  );
}
