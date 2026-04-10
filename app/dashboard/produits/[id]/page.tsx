import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ProductEditForm } from "./edit-form";

export default async function ProduitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const { id } = await params;

  const membership = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: { organization: true },
  });
  if (!membership) redirect("/auth/login");

  const produit = await db.product.findFirst({
    where: { id, organizationId: membership.organizationId, isActive: true },
  });
  if (!produit) notFound();

  const currency = membership.organization.currency as "DZD" | "EUR";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/produits">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Produits
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{produit.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-semibold text-blue-600">{formatCurrency(produit.price, currency)}</span>
            <span className="text-slate-400 text-sm">/ {produit.unit}</span>
            {produit.category && <Badge variant="outline">{produit.category}</Badge>}
            {produit.stock !== null && (
              <Badge variant={produit.stock <= 5 ? "destructive" : "secondary"}>
                Stock : {produit.stock}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Modifier le produit</h2>
        <ProductEditForm product={produit} />
      </div>
    </div>
  );
}
