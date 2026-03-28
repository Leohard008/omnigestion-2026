import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Brouillon", variant: "secondary" },
  SENT: { label: "Envoyée", variant: "default" },
  PAID: { label: "Payée", variant: "default" },
  OVERDUE: { label: "En retard", variant: "destructive" },
  CANCELLED: { label: "Annulée", variant: "outline" },
};

export default async function FacturesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const membership = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: { organization: true },
  });
  if (!membership) redirect("/auth/login");

  const currency = membership.organization.currency as "DZD" | "EUR";

  const factures = await db.invoice.findMany({
    where: { organizationId: membership.organizationId },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Factures</h1>
          <p className="text-slate-500">{factures.length} facture(s)</p>
        </div>
        <Link href="/dashboard/factures/nouvelle">
          <Button><Plus className="h-4 w-4 mr-2" />Nouvelle facture</Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {factures.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p className="font-medium">Aucune facture</p>
            <p className="text-sm">Créez votre première facture</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Numéro</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Client</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Échéance</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Montant TTC</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Statut</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {factures.map((facture) => {
                const status = statusLabels[facture.status] ?? { label: facture.status, variant: "outline" as const };
                return (
                  <tr key={facture.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono font-medium text-blue-600">{facture.number}</td>
                    <td className="px-6 py-4 font-medium">{facture.customer.name}</td>
                    <td className="px-6 py-4 text-slate-600">{formatDate(facture.issueDate)}</td>
                    <td className="px-6 py-4 text-slate-600">{facture.dueDate ? formatDate(facture.dueDate) : "-"}</td>
                    <td className="px-6 py-4 font-semibold">{formatCurrency(facture.total, currency)}</td>
                    <td className="px-6 py-4">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/dashboard/factures/${facture.id}`}>
                        <Button variant="ghost" size="sm">Voir</Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
