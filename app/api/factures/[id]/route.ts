import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

async function getOrgAndInvoice(userId: string, invoiceId: string) {
  const membership = await db.organizationMember.findFirst({
    where: { userId, isActive: true },
  });
  if (!membership) return null;

  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, organizationId: membership.organizationId },
    include: { customer: true, items: true },
  });
  return invoice ? { membership, invoice } : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const result = await getOrgAndInvoice(session.user.id, id);
  if (!result) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });

  return NextResponse.json(result.invoice);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const result = await getOrgAndInvoice(session.user.id, id);
  if (!result) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const data: Record<string, unknown> = { ...parsed.data };

  if (parsed.data.status === "PAID") {
    data.paidAt = new Date();
  }
  if (parsed.data.dueDate) {
    data.dueDate = new Date(parsed.data.dueDate);
  }

  const updated = await db.invoice.update({ where: { id }, data });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const result = await getOrgAndInvoice(session.user.id, id);
  if (!result) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });

  if (result.invoice.status !== "DRAFT" && result.invoice.status !== "CANCELLED") {
    return NextResponse.json(
      { error: "Seules les factures Brouillon ou Annulées peuvent être supprimées" },
      { status: 400 }
    );
  }

  await db.invoice.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
