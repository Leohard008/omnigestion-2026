"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  taxRate: number;
  category: string | null;
  sku: string | null;
  stock: number | null;
};

export function ProductEditForm({ product }: { product: Product }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? "",
    price: product.price,
    unit: product.unit,
    taxRate: product.taxRate,
    category: product.category ?? "",
    sku: product.sku ?? "",
    stock: product.stock ?? "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch(`/api/produits/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price: Number(form.price),
        taxRate: Number(form.taxRate),
        stock: form.stock !== "" ? Number(form.stock) : null,
      }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      setError("Erreur lors de la mise à jour");
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm("Supprimer ce produit ?")) return;
    const res = await fetch(`/api/produits/${product.id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard/produits");
    else alert("Erreur lors de la suppression");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Nom</Label>
          <Input id="name" name="name" value={form.name} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="sku">Référence (SKU)</Label>
          <Input id="sku" name="sku" value={form.sku} onChange={handleChange} />
        </div>
        <div>
          <Label htmlFor="price">Prix unitaire HT</Label>
          <Input id="price" name="price" type="number" step="0.01" min="0" value={form.price} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="taxRate">TVA (%)</Label>
          <Input id="taxRate" name="taxRate" type="number" step="0.01" min="0" max="100" value={form.taxRate} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="unit">Unité</Label>
          <Input id="unit" name="unit" value={form.unit} onChange={handleChange} />
        </div>
        <div>
          <Label htmlFor="stock">Stock</Label>
          <Input id="stock" name="stock" type="number" min="0" value={String(form.stock)} onChange={handleChange} placeholder="Non géré" />
        </div>
        <div>
          <Label htmlFor="category">Catégorie</Label>
          <Input id="category" name="category" value={form.category} onChange={handleChange} />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" value={form.description} onChange={handleChange} />
        </div>
      </div>
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleDelete}
          className="text-sm text-red-600 hover:underline"
        >
          Supprimer ce produit
        </button>
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
