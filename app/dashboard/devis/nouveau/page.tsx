"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { QuickAddClient } from "@/components/forms/quick-add-client";

const itemSchema = z.object({
  description: z.string().min(1, "Description requise"),
  quantity: z.coerce.number().min(0.01),
  unitPrice: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100),
});

const schema = z.object({
  customerId: z.string().min(1, "Client requis"),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Au moins une ligne requise"),
});

type FormData = z.infer<typeof schema>;

export default function NouveauDevisPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then(setClients).catch(console.error);
  }, []);

  const handleClientAdded = (newClient: { id: string; name: string }) => {
    setClients((prev) => [...prev, newClient]);
    setValue("customerId", newClient.id);
  };

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { items: [{ description: "", quantity: 1, unitPrice: 0, taxRate: 19 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = watch("items");

  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
  const taxAmount = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice) * Number(item.taxRate) / 100), 0);
  const total = subtotal + taxAmount;

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/devis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const result = await res.json();
        setError(result.error ?? "Erreur");
      } else {
        router.push("/dashboard/devis");
        router.refresh();
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/devis"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold text-slate-900">Nouveau devis</h1>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">{error}</div>}
        <Card>
          <CardHeader><CardTitle>Informations générales</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <div className="flex gap-2">
                <select {...register("customerId")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Sélectionner un client</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <QuickAddClient onClientAdded={handleClientAdded} />
              </div>
              {errors.customerId && <p className="text-sm text-red-500">{errors.customerId.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Valide jusqu&apos;au</Label>
              <Input type="date" {...register("validUntil")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Lignes du devis</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ description: "", quantity: 1, unitPrice: 0, taxRate: 19 })}>
              <Plus className="h-4 w-4 mr-1" />Ajouter une ligne
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5 space-y-1">
                  {index === 0 && <Label className="text-xs">Description</Label>}
                  <Input {...register(`items.${index}.description`)} placeholder="Description..." />
                </div>
                <div className="col-span-2 space-y-1">
                  {index === 0 && <Label className="text-xs">Qté</Label>}
                  <Input type="number" step="0.01" {...register(`items.${index}.quantity`)} />
                </div>
                <div className="col-span-2 space-y-1">
                  {index === 0 && <Label className="text-xs">Prix HT</Label>}
                  <Input type="number" step="0.01" {...register(`items.${index}.unitPrice`)} />
                </div>
                <div className="col-span-2 space-y-1">
                  {index === 0 && <Label className="text-xs">TVA %</Label>}
                  <Input type="number" step="0.01" {...register(`items.${index}.taxRate`)} />
                </div>
                <div className="col-span-1">
                  {fields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <div className="border-t pt-4 space-y-1 text-right text-sm">
              <p className="text-slate-600">Sous-total HT : <span className="font-medium">{subtotal.toFixed(2)}</span></p>
              <p className="text-slate-600">TVA : <span className="font-medium">{taxAmount.toFixed(2)}</span></p>
              <p className="text-lg font-bold text-slate-900">Total TTC : {total.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input {...register("notes")} placeholder="Conditions, remarques..." />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={isLoading}>{isLoading ? "Création..." : "Créer le devis"}</Button>
          <Link href="/dashboard/devis"><Button variant="outline" type="button">Annuler</Button></Link>
        </div>
      </form>
    </div>
  );
}
