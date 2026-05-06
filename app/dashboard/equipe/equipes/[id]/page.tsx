import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canManageTeam, canManageTeamMembers } from "@/lib/tasks/permissions";
import { TeamMembersList } from "@/components/equipe/TeamMembersList";

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/auth/login");
  const { id } = await params;

  const team = await db.team.findFirst({
    where: { id, organizationId: ctx.orgId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!team) notFound();
  if (!canManageTeamMembers(ctx, team.id)) redirect("/dashboard/equipe");

  const memberIds = new Set(team.members.map((m) => m.userId));
  const orgMembers = await db.organizationMember.findMany({
    where: { organizationId: ctx.orgId, isActive: true, userId: { notIn: Array.from(memberIds) } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const candidateUsers = orgMembers.map((m) => m.user);

  const isAdmin = canManageTeam(ctx);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{team.name}</h1>
        {team.description && <p className="text-sm text-slate-500 mt-1">{team.description}</p>}
      </header>

      <section>
        <h2 className="text-lg font-medium mb-2">Membres ({team.members.length})</h2>
        <TeamMembersList
          teamId={team.id}
          members={team.members.map((m) => ({
            id: m.id,
            userId: m.userId,
            role: m.role,
            user: m.user,
          }))}
          candidateUsers={candidateUsers}
          canChangeRoles={isAdmin}
        />
      </section>
    </div>
  );
}
