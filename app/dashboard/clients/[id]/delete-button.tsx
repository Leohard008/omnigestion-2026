"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClientDeleteButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Supprimer ce client ? Cette action est irréversible.")) return;
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard/clients");
      router.refresh();
    } else {
      alert("Erreur lors de la suppression");
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
