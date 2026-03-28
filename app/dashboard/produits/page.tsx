import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Package } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default async function ProduitsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const membership = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: { organization: true },
  });
  if (!membership) redirect("/auth/login");

  const currency = membership.organization.currency as "DZD" | "EUR";

  const produits = await db.product.findMany({
    where: { organizationId: membership.organizationId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produits & Services</h1>
          <p className="text-slate-500">{produits.length} produit(s)</p>
        </div>
        <Link href="/dashboard/produits/nouveau">
          <Button><Plus className="h-4 w-4 mr-2" />Nouveau produit</Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {produits.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Package className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p className="font-medium">Aucun produit</p>
            <p className="text-sm">Ajoutez vos produits et services</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Produit</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Catégorie</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Prix HT</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">TVA</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Stock</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {produits.map((produit) => (
                <tr key={produit.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{produit.name}</p>
                      {produit.sku && <p className="text-xs text-slate-400">SKU: {produit.sku}</p>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {produit.category ? <Badge variant="outline">{produit.category}</Badge> : "-"}
                  </td>
                  <td className="px-6 py-4 font-medium">{formatCurrency(produit.price, currency)}</td>
                  <td className="px-6 py-4 text-slate-600">{produit.taxRate}%</td>
                  <td className="px-6 py-4">
                    {produit.stock !== null ? (
                      <Badge variant={produit.stock > 0 ? "default" : "destructive"}>
                        {produit.stock} unités
                      </Badge>
                    ) : (
                      <span className="text-slate-400">Service</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/dashboard/produits/${produit.id}`}>
                      <Button variant="ghost" size="sm">Voir</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
