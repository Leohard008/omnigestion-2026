import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]).optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
});

async function getOrgAndQuote(userId: string, quoteId: string) {
  const membership = await db.organizationMember.findFirst({
    where: { userId, isActive: true },
  });
  if (!membership) return null;

  const quote = await db.quote.findFirst({
    where: { id: quoteId, organizationId: membership.organizationId },
    include: { customer: true, items: true },
  });
  return quote ? { membership, quote } : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const result = await getOrgAndQuote(session.user.id, id);
  if (!result) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });

  return NextResponse.json(result.quote);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const result = await getOrgAndQuote(session.user.id, id);
  if (!result) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.validUntil) {
    data.validUntil = new Date(parsed.data.validUntil);
  }

  const updated = await db.quote.update({ where: { id }, data });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const result = await getOrgAndQuote(session.user.id, id);
  if (!result) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });

  if (result.quote.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Seuls les devis Brouillon peuvent être supprimés" },
      { status: 400 }
    );
  }

  await db.quote.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
