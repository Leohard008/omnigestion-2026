import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { TenantContext } from "@/lib/tasks/types";

export async function getTenantContext(): Promise<TenantContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
  });
  if (!membership) return null;

  const teamMemberships = await db.teamMember.findMany({
    where: {
      userId: session.user.id,
      team: { organizationId: membership.organizationId },
    },
    select: { teamId: true, role: true },
  });

  return {
    userId: session.user.id,
    orgId: membership.organizationId,
    orgRole: membership.role,
    teamRoles: new Map(teamMemberships.map((tm) => [tm.teamId, tm.role])),
  };
}

export async function requireTenantContext(): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!ctx) throw new Error("UNAUTHENTICATED");
  return ctx;
}
