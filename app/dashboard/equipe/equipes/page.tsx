import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canManageTeam } from "@/lib/tasks/permissions";
import { TeamForm } from "@/components/equipe/TeamForm";
import { EquipeNavTabs } from "@/components/equipe/EquipeNavTabs";

export default async function TeamsAdminPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/auth/login");
  if (ctx.orgRole === "VIEWER") redirect("/dashboard");
  if (!canManageTeam(ctx)) redirect("/dashboard/equipe");

  const teams = await db.team.findMany({
    where: { organizationId: ctx.orgId },
    include: { _count: { select: { members: true, tasks: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <EquipeNavTabs ctx={ctx} current="teams" />
      <header>
        <h1 className="text-2xl font-semibold">Équipes</h1>
        <p className="text-sm text-slate-500">Créer et organiser les équipes de votre organisation.</p>
      </header>

      <TeamForm />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {teams.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune équipe pour le moment.</p>
        ) : (
          teams.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/equipe/equipes/${t.id}`}
              className="block rounded-lg border bg-white p-4 hover:border-slate-300"
            >
              <div className="font-medium">{t.name}</div>
              {t.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{t.description}</p>}
              <div className="text-xs text-slate-500 mt-2">
                {t._count.members} membre(s) · {t._count.tasks} tâche(s)
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
