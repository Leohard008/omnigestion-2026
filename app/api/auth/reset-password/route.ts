import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { validateResetTokenRecord } from "@/lib/password-reset/validate";

const schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6).max(200),
});

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: "Lien invalide",
  USED: "Lien déjà utilisé",
  EXPIRED: "Lien expiré",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  const { token, newPassword } = parsed.data;

  const record = await db.passwordResetToken.findUnique({
    where: { token },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });

  const now = new Date();
  const result = validateResetTokenRecord(record, now);
  if (!result.valid) {
    return NextResponse.json({ error: ERROR_MESSAGES[result.reason] }, { status: 400 });
  }
  // Type narrowing — record is non-null when result.valid === true
  if (!record) return NextResponse.json({ error: "Lien invalide" }, { status: 400 });

  const hash = await bcrypt.hash(newPassword, 10);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: { password: hash, passwordChangedAt: now },
    });
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    });
  });

  return NextResponse.json({ ok: true });
}
