"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, X, Loader2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(2, "Nom requis"),
  type: z.enum(["INDIVIDUAL", "COMPANY"]),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface QuickAddClientProps {
  onClientAdded: (client: { id: string; name: string }) => void;
}

export function QuickAddClient({ onClientAdded }: QuickAddClientProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "COMPANY" },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const result = await res.json();
        setError(result.error ?? "Erreur");
        return;
      }
      const newClient = await res.json();
      onClientAdded({ id: newClient.id, name: newClient.name });
      reset();
      setOpen(false);
    } catch {
      setError("Erreur réseau");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="flex-shrink-0 h-10 w-10 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400"
        onClick={() => setOpen(true)}
        title="Ajouter un nouveau client"
      >
        <UserPlus className="h-4 w-4" />
      </Button>

      {/* Modal Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl border w-full max-w-md mx-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <UserPlus className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="font-semibold text-slate-900">Nouveau client</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Type</Label>
                <select
                  {...register("type")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="COMPANY">Entreprise</option>
                  <option value="INDIVIDUAL">Particulier</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Nom / Raison sociale *</Label>
                <Input {...register("name")} placeholder="Ex: SARL Tech Solutions" autoFocus />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" {...register("email")} placeholder="contact@..." />
                  {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <Input {...register("phone")} placeholder="+213 ..." />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Création...</>
                  ) : (
                    <><UserPlus className="h-4 w-4 mr-2" />Créer et sélectionner</>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
