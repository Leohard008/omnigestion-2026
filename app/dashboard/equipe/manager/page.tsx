import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { ManagerDashboard } from "@/components/equipe/ManagerDashboard";

export default async function ManagerPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/auth/login");

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
      <h1 className="text-2xl font-semibold">Tableau d&apos;équipe</h1>
      <ManagerDashboard teams={visibleTeams} isAdmin={isAdmin} />
    </div>
  );
}
