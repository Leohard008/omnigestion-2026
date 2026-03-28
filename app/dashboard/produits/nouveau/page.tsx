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
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Prix invalide"),
  unit: z.string().default("unité"),
  taxRate: z.coerce.number().min(0).max(100),
  category: z.string().optional(),
  sku: z.string().optional(),
  stock: z.coerce.number().int().optional().nullable(),
});

type FormData = z.infer<typeof schema>;

export default function NouveauProduitPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isService, setIsService] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { taxRate: 19, unit: "unité" },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = { ...data, stock: isService ? null : data.stock };
      const res = await fetch("/api/produits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const result = await res.json();
        setError(result.error ?? "Erreur");
      } else {
        router.push("/dashboard/produits");
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
        <Link href="/dashboard/produits"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold text-slate-900">Nouveau produit</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Informations produit</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">{error}</div>}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <input type="checkbox" id="isService" checked={isService} onChange={(e) => setIsService(e.target.checked)} className="h-4 w-4" />
              <Label htmlFor="isService">C&apos;est un service (pas de gestion de stock)</Label>
            </div>
            <div className="space-y-2">
              <Label>Nom du produit / service *</Label>
              <Input {...register("name")} placeholder="Ex: Prestation conseil" />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input {...register("description")} placeholder="Description..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prix HT *</Label>
                <Input type="number" step="0.01" {...register("price")} placeholder="0.00" />
                {errors.price && <p className="text-sm text-red-500">{errors.price.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Unité</Label>
                <Input {...register("unit")} placeholder="unité, heure, kg..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Taux TVA (%)</Label>
                <Input type="number" step="0.01" {...register("taxRate")} />
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Input {...register("category")} placeholder="Informatique, Conseil..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SKU / Référence</Label>
                <Input {...register("sku")} placeholder="REF-001" />
              </div>
              {!isService && (
                <div className="space-y-2">
                  <Label>Stock initial</Label>
                  <Input type="number" {...register("stock")} placeholder="0" />
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isLoading}>{isLoading ? "Enregistrement..." : "Créer le produit"}</Button>
              <Link href="/dashboard/produits"><Button variant="outline" type="button">Annuler</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
