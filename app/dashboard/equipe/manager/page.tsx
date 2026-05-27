import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { ManagerDashboard } from "@/components/equipe/ManagerDashboard";
import { EquipeNavTabs } from "@/components/equipe/EquipeNavTabs";

export default async function ManagerPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/auth/login");
  if (ctx.orgRole === "VIEWER") redirect("/dashboard");

  const isAdmin = ctx.orgRole === "OWNER" || ctx.orgRole === "ADMIN";
  const managerTeamIds = Array.from(ctx.teamRoles.entries())
    .filter(([, r]) => r === "MANAGER")
    .map(([t]) => t);

  if (!isAdmin && managerTeamIds.length === 0) redirect("/dashboard/equipe");

  const visibleTeams = await db.team.findMany({
    where: isAdmin
      ? { organizationId: ctx.orgId }
      : { id: { in: managerTeamIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <EquipeNavTabs ctx={ctx} current="manager" />
      <h1 className="text-2xl font-semibold">Tableau d&apos;équipe</h1>
      <ManagerDashboard teams={visibleTeams} isAdmin={isAdmin} />
      <footer className="pt-6 mt-6 border-t text-xs text-slate-500">
        <Link href="/dashboard/equipe/comment-ca-marche" className="hover:underline">
          ℹ Comment fonctionne ce module
        </Link>
      </footer>
    </div>
  );
}
