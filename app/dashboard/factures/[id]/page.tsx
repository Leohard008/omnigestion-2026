import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusButtons, DeleteInvoiceButton } from "./status-buttons";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Brouillon", variant: "secondary" },
  SENT: { label: "Envoyée", variant: "default" },
  PAID: { label: "Payée", variant: "default" },
  OVERDUE: { label: "En retard", variant: "destructive" },
  CANCELLED: { label: "Annulée", variant: "outline" },
};

export default async function FactureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const { id } = await params;

  const membership = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: { organization: { include: { settings: true } } },
  });
  if (!membership) redirect("/auth/login");

  const facture = await db.invoice.findFirst({
    where: { id, organizationId: membership.organizationId },
    include: { customer: true, items: true },
  });
  if (!facture) notFound();

  const currency = membership.organization.currency as "DZD" | "EUR";
  const status = statusLabels[facture.status] ?? { label: facture.status, variant: "outline" as const };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/dashboard/factures">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Factures
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 font-mono">{facture.number}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-slate-500 text-sm">{facture.customer.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusButtons invoiceId={facture.id} currentStatus={facture.status} />
          {(facture.status === "DRAFT" || facture.status === "CANCELLED") && (
            <DeleteInvoiceButton invoiceId={facture.id} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-400 block text-xs">{"Date d'émission"}</span>
              <span className="font-medium">{formatDate(facture.issueDate)}</span>
            </div>
            {facture.dueDate && (
              <div>
                <span className="text-slate-400 block text-xs">Échéance</span>
                <span className="font-medium">{formatDate(facture.dueDate)}</span>
              </div>
            )}
            {facture.paidAt && (
              <div>
                <span className="text-slate-400 block text-xs">Date de paiement</span>
                <span className="font-medium text-green-600">{formatDate(facture.paidAt)}</span>
              </div>
            )}
            <div>
              <span className="text-slate-400 block text-xs">Client</span>
              <Link href={`/dashboard/clients/${facture.customerId}`} className="font-medium text-blue-600 hover:underline">
                {facture.customer.name}
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Lignes</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-t">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase">Description</th>
                    <th className="text-right px-4 py-2 text-xs text-slate-500 uppercase">Qté</th>
                    <th className="text-right px-4 py-2 text-xs text-slate-500 uppercase">PU HT</th>
                    <th className="text-right px-4 py-2 text-xs text-slate-500 uppercase">TVA</th>
                    <th className="text-right px-4 py-2 text-xs text-slate-500 uppercase">Total TTC</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {facture.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">{item.description}</td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.unitPrice, currency)}</td>
                      <td className="px-4 py-3 text-right">{item.taxRate}%</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.total, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {facture.notes && (
            <div>
              <span className="text-xs text-slate-400 block">Notes</span>
              <p className="text-slate-600 text-sm">{facture.notes}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-3">
          <h3 className="font-semibold text-slate-900">Récapitulatif</h3>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Sous-total HT</span>
            <span>{formatCurrency(facture.subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">TVA</span>
            <span>{formatCurrency(facture.taxAmount, currency)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-3">
            <span>Total TTC</span>
            <span>{formatCurrency(facture.total, currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
