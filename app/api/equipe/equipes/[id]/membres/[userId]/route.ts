import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canManageTeamMembers } from "@/lib/tasks/permissions";

const patchSchema = z.object({
  role: z.enum(["MANAGER", "MEMBER"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id, userId } = await params;
  if (!canManageTeamMembers(ctx, id)) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }
  // Only OWNER/ADMIN can modify role.
  if (ctx.orgRole !== "OWNER" && ctx.orgRole !== "ADMIN") {
    return NextResponse.json({ error: "Seuls OWNER/ADMIN peuvent changer le rôle" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const tm = await db.teamMember.findFirst({
    where: { teamId: id, userId, team: { organizationId: ctx.orgId } },
  });
  if (!tm) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const updated = await db.teamMember.update({
    where: { id: tm.id },
    data: { role: parsed.data.role },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id, userId } = await params;
  if (!canManageTeamMembers(ctx, id)) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const tm = await db.teamMember.findFirst({
    where: { teamId: id, userId, team: { organizationId: ctx.orgId } },
  });
  if (!tm) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Refuse if user has active tasks assigned in this team.
  const activeTasks = await db.task.count({
    where: { teamId: id, assigneeId: userId, status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } },
  });
  if (activeTasks > 0) {
    return NextResponse.json(
      { error: `Réassignez d'abord les ${activeTasks} tâche(s) actives de ce membre` },
      { status: 409 }
    );
  }

  await db.teamMember.delete({ where: { id: tm.id } });
  return NextResponse.json({ ok: true });
}
