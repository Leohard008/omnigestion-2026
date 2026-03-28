import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().min(0),
  unit: z.string().default("unité"),
  taxRate: z.number().min(0).max(100),
  category: z.string().optional(),
  sku: z.string().optional(),
  stock: z.number().int().nullable().optional(),
});

async function getOrgMembership(userId: string) {
  return db.organizationMember.findFirst({
    where: { userId, isActive: true },
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const membership = await getOrgMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });

  const produits = await db.product.findMany({
    where: { organizationId: membership.organizationId, isActive: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(produits);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const membership = await getOrgMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides", details: parsed.error.issues }, { status: 400 });

  const produit = await db.product.create({
    data: {
      organizationId: membership.organizationId,
      ...parsed.data,
      stock: parsed.data.stock ?? null,
    },
  });
  return NextResponse.json(produit, { status: 201 });
}
