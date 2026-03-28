import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, User, Building2 } from "lucide-react";

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const membership = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
  });
  if (!membership) redirect("/auth/login");

  const clients = await db.customer.findMany({
    where: { organizationId: membership.organizationId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-slate-500">{clients.length} client(s)</p>
        </div>
        <Link href="/dashboard/clients/nouveau">
          <Button><Plus className="h-4 w-4 mr-2" />Nouveau client</Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {clients.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <User className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p className="font-medium">Aucun client</p>
            <p className="text-sm">Ajoutez votre premier client pour commencer</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Nom</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Email</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Téléphone</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        {client.type === "COMPANY" ? (
                          <Building2 className="h-4 w-4 text-blue-600" />
                        ) : (
                          <User className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <span className="font-medium text-slate-900">{client.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="outline">{client.type === "COMPANY" ? "Entreprise" : "Particulier"}</Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{client.email ?? "-"}</td>
                  <td className="px-6 py-4 text-slate-600">{client.phone ?? "-"}</td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/dashboard/clients/${client.id}`}>
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
