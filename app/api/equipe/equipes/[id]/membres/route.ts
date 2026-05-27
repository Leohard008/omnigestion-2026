import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canManageTeamMembers } from "@/lib/tasks/permissions";

const addSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["MANAGER", "MEMBER"]).default("MEMBER"),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const team = await db.team.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!team) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const members = await db.teamMember.findMany({
    where: { teamId: id },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { joinedAt: "asc" },
  });
  return NextResponse.json(members);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  if (!canManageTeamMembers(ctx, id)) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  if (parsed.data.role === "MANAGER" && ctx.orgRole !== "OWNER" && ctx.orgRole !== "ADMIN") {
    return NextResponse.json(
      { error: "Seuls OWNER/ADMIN peuvent désigner un manager" },
      { status: 403 }
    );
  }

  // Verify team belongs to current org
  const team = await db.team.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!team) return NextResponse.json({ error: "Équipe introuvable" }, { status: 404 });

  // Verify user belongs to same org
  const targetMembership = await db.organizationMember.findFirst({
    where: { userId: parsed.data.userId, organizationId: ctx.orgId, isActive: true },
  });
  if (!targetMembership) {
    return NextResponse.json({ error: "Utilisateur introuvable dans l'organisation" }, { status: 404 });
  }

  try {
    const tm = await db.teamMember.create({
      data: { teamId: id, userId: parsed.data.userId, role: parsed.data.role },
    });
    return NextResponse.json(tm, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Membre déjà dans l'équipe" }, { status: 409 });
    }
    throw e;
  }
}
