import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canManageTeam } from "@/lib/tasks/permissions";

const createSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
});

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // OWNER/ADMIN: all teams. Others: only their teams.
  const where =
    ctx.orgRole === "OWNER" || ctx.orgRole === "ADMIN"
      ? { organizationId: ctx.orgId }
      : { organizationId: ctx.orgId, members: { some: { userId: ctx.userId } } };

  const teams = await db.team.findMany({
    where,
    include: { _count: { select: { members: true, tasks: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(teams);
}

export async function POST(request: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!canManageTeam(ctx)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  try {
    const team = await db.team.create({
      data: {
        organizationId: ctx.orgId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      },
    });
    return NextResponse.json(team, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Une équipe avec ce nom existe déjà" }, { status: 409 });
    }
    throw e;
  }
}
