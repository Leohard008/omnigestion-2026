import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().min(0.01),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).max(100),
  productId: z.string().optional(),
});

const schema = z.object({
  customerId: z.string().min(1),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const membership = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: { organization: { include: { settings: true } } },
  });
  if (!membership) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const { customerId, validUntil, notes, items } = parsed.data;
  const orgId = membership.organizationId;
  const currency = membership.organization.currency;
  const settings = membership.organization.settings;

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice * i.taxRate / 100, 0);
  const total = subtotal + taxAmount;

  const nextNum = settings?.nextQuoteNum ?? 1;
  const prefix = settings?.quotePrefix ?? "DEV";
  const number = `${prefix}-${String(nextNum).padStart(5, "0")}`;

  const devis = await db.$transaction(async (tx) => {
    const quote = await tx.quote.create({
      data: {
        organizationId: orgId,
        customerId,
        number,
        status: "DRAFT",
        validUntil: validUntil ? new Date(validUntil) : null,
        subtotal,
        taxAmount,
        total,
        notes: notes || null,
        currency,
        items: {
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            total: item.quantity * item.unitPrice * (1 + item.taxRate / 100),
            productId: item.productId || null,
          })),
        },
      },
    });

    if (settings) {
      await tx.organizationSettings.update({
        where: { organizationId: orgId },
        data: { nextQuoteNum: nextNum + 1 },
      });
    }

    return quote;
  });

  return NextResponse.json(devis, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const membership = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
  });
  if (!membership) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });

  const devis = await db.quote.findMany({
    where: { organizationId: membership.organizationId },
    include: { customer: true, items: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(devis);
}
