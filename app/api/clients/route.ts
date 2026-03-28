import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2),
  type: z.enum(["INDIVIDUAL", "COMPANY"]),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  taxNumber: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const membership = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
  });
  if (!membership) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });

  const clients = await db.customer.findMany({
    where: { organizationId: membership.organizationId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(clients);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const membership = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
  });
  if (!membership) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const { name, type, email, phone, taxNumber, notes } = parsed.data;

  const client = await db.customer.create({
    data: {
      organizationId: membership.organizationId,
      name,
      type,
      email: email || null,
      phone: phone || null,
      taxNumber: taxNumber || null,
      notes: notes || null,
    },
  });

  return NextResponse.json(client, { status: 201 });
}
