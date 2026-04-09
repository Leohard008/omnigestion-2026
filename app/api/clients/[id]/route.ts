import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(["INDIVIDUAL", "COMPANY"]).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  taxNumber: z.string().optional(),
  notes: z.string().optional(),
});

async function getOrgAndClient(userId: string, clientId: string) {
  const membership = await db.organizationMember.findFirst({
    where: { userId, isActive: true },
  });
  if (!membership) return null;

  const client = await db.customer.findFirst({
    where: { id: clientId, organizationId: membership.organizationId, isActive: true },
  });
  return client ? { membership, client } : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const result = await getOrgAndClient(session.user.id, id);
  if (!result) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  const [invoiceCount, totalRevenue] = await Promise.all([
    db.invoice.count({ where: { customerId: id, status: "PAID" } }),
    db.invoice.aggregate({
      where: { customerId: id, status: "PAID" },
      _sum: { total: true },
    }),
  ]);

  return NextResponse.json({
    ...result.client,
    stats: {
      invoiceCount,
      totalRevenue: totalRevenue._sum.total ?? 0,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const result = await getOrgAndClient(session.user.id, id);
  if (!result) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const updated = await db.customer.update({
    where: { id },
    data: {
      ...parsed.data,
      email: parsed.data.email || null,
    },
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
  const result = await getOrgAndClient(session.user.id, id);
  if (!result) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  await db.customer.update({ where: { id }, data: { isActive: false } });

  return NextResponse.json({ success: true });
}
