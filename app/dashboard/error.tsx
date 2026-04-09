"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto" aria-hidden="true" />
        <h2 className="text-xl font-semibold text-slate-900">Erreur de chargement</h2>
        <p className="text-slate-500 text-sm max-w-sm">
          {error.message || "Impossible de charger cette page."}
        </p>
        <Button onClick={reset} variant="outline">Réessayer</Button>
      </div>
    </div>
  );
}
