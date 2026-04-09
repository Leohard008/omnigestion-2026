"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Une erreur est survenue</h1>
        <p className="text-slate-500">{error.message || "Erreur inattendue"}</p>
        <Button onClick={reset}>Réessayer</Button>
      </div>
    </div>
  );
}
