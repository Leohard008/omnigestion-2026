import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, User, Mail, Phone, FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ClientDeleteButton } from "./delete-button";

const invoiceStatusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Brouillon", variant: "secondary" },
  SENT: { label: "Envoyée", variant: "default" },
  PAID: { label: "Payée", variant: "default" },
  OVERDUE: { label: "En retard", variant: "destructive" },
  CANCELLED: { label: "Annulée", variant: "outline" },
};

export default async function ClientDetailPage({
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

  const client = await db.customer.findFirst({
    where: { id, organizationId: membership.organizationId, isActive: true },
    include: {
      invoices: {
        include: { customer: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
  if (!client) notFound();

  const currency = membership.organization.currency as "DZD" | "EUR";
  const totalRevenue = client.invoices
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/clients">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Clients
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              {client.type === "COMPANY" ? (
                <Building2 className="h-5 w-5 text-blue-600" />
              ) : (
                <User className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
              <Badge variant="outline">{client.type === "COMPANY" ? "Entreprise" : "Particulier"}</Badge>
            </div>
          </div>
        </div>
        <ClientDeleteButton clientId={id} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Informations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {client.email && (
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="h-4 w-4 text-slate-400" />
                <span>{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-4 w-4 text-slate-400" />
                <span>{client.phone}</span>
              </div>
            )}
            {client.taxNumber && (
              <div className="text-slate-600">
                <span className="text-xs text-slate-400 block">NIF / SIRET</span>
                {client.taxNumber}
              </div>
            )}
            {client.notes && (
              <div className="sm:col-span-2 text-slate-600">
                <span className="text-xs text-slate-400 block">Notes</span>
                {client.notes}
              </div>
            )}
          </div>
          <div className="text-xs text-slate-400">
            Client depuis le {formatDate(client.createdAt)}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <p className="text-sm text-slate-500">CA généré</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalRevenue, currency)}</p>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <p className="text-sm text-slate-500">Factures payées</p>
            <p className="text-2xl font-bold text-slate-900">
              {client.invoices.filter((i) => i.status === "PAID").length}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Factures</h2>
          <Link href={`/dashboard/factures/nouvelle?clientId=${client.id}`}>
            <Button size="sm" variant="outline">
              <FileText className="h-4 w-4 mr-1" />
              Nouvelle facture
            </Button>
          </Link>
        </div>
        {client.invoices.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">Aucune facture pour ce client</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Numéro</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Montant</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {client.invoices.map((inv) => {
                  const status = invoiceStatusLabels[inv.status] ?? { label: inv.status, variant: "outline" as const };
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-mono font-medium text-blue-600">{inv.number}</td>
                      <td className="px-6 py-3 text-slate-600">{formatDate(inv.issueDate)}</td>
                      <td className="px-6 py-3 font-semibold">{formatCurrency(inv.total, currency)}</td>
                      <td className="px-6 py-3">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Link href={`/dashboard/factures/${inv.id}`}>
                          <Button variant="ghost" size="sm">Voir</Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
