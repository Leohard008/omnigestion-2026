import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileCheck } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Brouillon", variant: "secondary" },
  SENT: { label: "Envoyé", variant: "default" },
  ACCEPTED: { label: "Accepté", variant: "default" },
  REJECTED: { label: "Refusé", variant: "destructive" },
  EXPIRED: { label: "Expiré", variant: "outline" },
};

export default async function DevisPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const membership = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: { organization: true },
  });
  if (!membership) redirect("/auth/login");

  const currency = membership.organization.currency as "DZD" | "EUR";

  const devisList = await db.quote.findMany({
    where: { organizationId: membership.organizationId },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Devis</h1>
          <p className="text-slate-500">{devisList.length} devis</p>
        </div>
        <Link href="/dashboard/devis/nouveau">
          <Button><Plus className="h-4 w-4 mr-2" />Nouveau devis</Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {devisList.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileCheck className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p className="font-medium">Aucun devis</p>
            <p className="text-sm">Créez votre premier devis</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Numéro</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Client</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Validité</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Montant TTC</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Statut</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {devisList.map((devis) => {
                const status = statusLabels[devis.status] ?? { label: devis.status, variant: "outline" as const };
                return (
                  <tr key={devis.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono font-medium text-purple-600">{devis.number}</td>
                    <td className="px-6 py-4 font-medium">{devis.customer.name}</td>
                    <td className="px-6 py-4 text-slate-600">{formatDate(devis.issueDate)}</td>
                    <td className="px-6 py-4 text-slate-600">{devis.validUntil ? formatDate(devis.validUntil) : "-"}</td>
                    <td className="px-6 py-4 font-semibold">{formatCurrency(devis.total, currency)}</td>
                    <td className="px-6 py-4"><Badge variant={status.variant}>{status.label}</Badge></td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/dashboard/devis/${devis.id}`}>
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
