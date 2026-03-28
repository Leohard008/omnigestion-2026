"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const schema = z.object({
  name: z.string().min(2, "Nom requis"),
  type: z.enum(["INDIVIDUAL", "COMPANY"]),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
  taxNumber: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NouveauClientPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
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
      } else {
        router.push("/dashboard/clients");
        router.refresh();
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/clients"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold text-slate-900">Nouveau client</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Informations client</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">{error}</div>}
            <div className="space-y-2">
              <Label>Type de client</Label>
              <select {...register("type")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="COMPANY">Entreprise</option>
                <option value="INDIVIDUAL">Particulier</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Nom / Raison sociale *</Label>
              <Input {...register("name")} placeholder="Nom du client" />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" {...register("email")} placeholder="email@exemple.com" />
                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input {...register("phone")} placeholder="+213 ..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>NIF / SIRET</Label>
              <Input {...register("taxNumber")} placeholder="Numéro fiscal" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input {...register("notes")} placeholder="Notes internes..." />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isLoading}>{isLoading ? "Enregistrement..." : "Créer le client"}</Button>
              <Link href="/dashboard/clients"><Button variant="outline" type="button">Annuler</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
