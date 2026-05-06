import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canManageTeam } from "@/lib/tasks/permissions";

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
});

async function loadTeam(orgId: string, teamId: string) {
  return db.team.findFirst({
    where: { id: teamId, organizationId: orgId },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const team = await loadTeam(ctx.orgId, id);
  if (!team) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(team);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!canManageTeam(ctx)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;
  const team = await db.team.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!team) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const updated = await db.team.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!canManageTeam(ctx)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;
  const team = await db.team.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!team) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // For MVP: refuse delete if any task still references this team.
  const tasksCount = await db.task.count({ where: { teamId: id } });
  if (tasksCount > 0) {
    return NextResponse.json(
      { error: "Supprimez ou réassignez les tâches avant de supprimer l'équipe" },
      { status: 409 }
    );
  }

  await db.team.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
