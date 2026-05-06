import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

const schema = z.object({
  email: z.string().email(),
});

const TOKEN_BYTES = 32;
const EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 3;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Do not leak the reason; treat invalid email as silent success.
    return NextResponse.json({ ok: true });
  }
  const { email } = parsed.data;

  // Anti-enumeration: from here on, always return 200 { ok: true }.
  try {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`[forgot-password] user not found for email`);
      return NextResponse.json({ ok: true });
    }

    // Rate limit: max 3 active requests per user per hour.
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recentCount = await db.passwordResetToken.count({
      where: {
        userId: user.id,
        createdAt: { gt: since },
        usedAt: null,
      },
    });
    if (recentCount >= RATE_LIMIT_MAX) {
      console.log(`[forgot-password] rate limit hit for user ${user.id}`);
      return NextResponse.json({ ok: true });
    }

    // Invalidate previous unused tokens (B2 from spec).
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate a fresh token and persist it.
    const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + EXPIRY_MS),
      },
    });

    // Send email — swallow errors so we never leak existence to the caller.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;
    try {
      await sendPasswordResetEmail(email, resetUrl);
    } catch (err) {
      console.error(`[forgot-password] failed to send email for user ${user.id}:`, err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[forgot-password] unexpected error:`, err);
    return NextResponse.json({ ok: true });
  }
}
