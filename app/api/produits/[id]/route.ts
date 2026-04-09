import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  unit: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  category: z.string().optional(),
  sku: z.string().optional(),
  stock: z.number().int().nullable().optional(),
});

async function getOrgAndProduct(userId: string, productId: string) {
  const membership = await db.organizationMember.findFirst({
    where: { userId, isActive: true },
  });
  if (!membership) return null;

  const product = await db.product.findFirst({
    where: { id: productId, organizationId: membership.organizationId, isActive: true },
  });
  return product ? { membership, product } : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const result = await getOrgAndProduct(session.user.id, id);
  if (!result) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  return NextResponse.json(result.product);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const result = await getOrgAndProduct(session.user.id, id);
  if (!result) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const updated = await db.product.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const result = await getOrgAndProduct(session.user.id, id);
  if (!result) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  await db.product.update({ where: { id }, data: { isActive: false } });

  return NextResponse.json({ success: true });
}
