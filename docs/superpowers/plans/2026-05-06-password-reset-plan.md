# Password Reset Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement OWASP-compliant "Mot de passe oublié" flow for OmniGestion: email-based reset link, single-use DB token (1h expiry), account enumeration protection, rate limit per email, JWT session invalidation via `passwordChangedAt`.

**Architecture:** New `PasswordResetToken` table + `User.passwordChangedAt` column. Two API routes (`forgot-password`, `reset-password`) with anti-enumeration always-200 response. Resend SDK for email delivery. NextAuth `jwt` callback customization rejects JWTs issued before the latest password change.

**Tech Stack:** Next.js 15 (App Router) + TypeScript + Prisma + NextAuth v5 (JWT strategy) + bcryptjs + zod + react-hook-form + Resend SDK + Vitest (existing).

**Spec reference:** `docs/superpowers/specs/2026-05-06-password-reset-design.md`

---

## Phase 1 — Foundation

### Task 1: Add Prisma schema and run migration

**Files:**
- Modify: `prisma/schema.prisma` (add `PasswordResetToken` model + `passwordChangedAt` field on `User`)
- Run: `npx prisma migrate dev --name add_password_reset`

- [ ] **Step 1: Add `PasswordResetToken` model after the existing `VerificationToken` model**

In `prisma/schema.prisma`, locate `model VerificationToken { ... }` and add this AFTER it (still in the NEXTAUTH MODELS section):

```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@map("password_reset_tokens")
}
```

- [ ] **Step 2: Add `passwordChangedAt` field on `User`**

In the existing `User` model, add `passwordChangedAt` after the existing `password` field, and add the `resetTokens` back-relation in the Relations block. The User model should look like:

```prisma
model User {
  id                String    @id @default(cuid())
  name              String?
  email             String    @unique
  emailVerified     DateTime?
  image             String?
  password          String?
  passwordChangedAt DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  memberships         OrganizationMember[]
  accounts            Account[]
  sessions            Session[]
  teamMemberships     TeamMember[]
  assignedTasks       Task[]              @relation("TaskAssignee")
  createdTasks        Task[]              @relation("TaskCreator")
  taskEvents          TaskEvent[]
  timerSessions       TimerSession[]
  timerSessionEdits   TimerSessionEdit[]
  taskNotifications   TaskNotification[]
  resetTokens         PasswordResetToken[]

  @@map("users")
}
```

- [ ] **Step 3: Run the migration**

```bash
npx prisma migrate dev --name add_password_reset
```

Expected: migration file created, Prisma Client regenerated, no errors.

If the Supabase project is paused, the migration will fail with `ENOTFOUND` — restore the project first via the Supabase MCP or dashboard, then retry.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(auth): add PasswordResetToken model and User.passwordChangedAt"
```

---

### Task 2: Install Resend SDK and document env vars

**Files:**
- Modify: `package.json` (install `resend`)
- Modify: `.env.example` (add `RESEND_API_KEY` and `EMAIL_FROM`)

- [ ] **Step 1: Install the Resend SDK**

```bash
npm install resend
```

- [ ] **Step 2: Add env vars to `.env.example`**

Add these lines AFTER the existing `CRON_SECRET` block:

```
# Resend — required for password reset emails
# Sign up at https://resend.com to get an API key (free tier: 3000 emails/month)
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Sender address — for dev use "onboarding@resend.dev"; for prod use a verified domain
EMAIL_FROM="OmniGestion <onboarding@resend.dev>"
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore(auth): add Resend SDK and document email env vars"
```

---

### Task 3: Implement `lib/email.ts` Resend wrapper

**Files:**
- Create: `lib/email.ts`

- [ ] **Step 1: Create `lib/email.ts`**

```ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function buildResetEmailHtml(resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Réinitialisation de votre mot de passe</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden">
          <tr>
            <td style="padding:32px 32px 16px 32px">
              <h1 style="margin:0;color:#0f172a;font-size:24px">Réinitialisation de votre mot de passe</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px 32px;color:#475569;font-size:15px;line-height:1.6">
              <p>Bonjour,</p>
              <p>
                Vous avez demandé à réinitialiser le mot de passe de votre compte OmniGestion.
                Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 24px 32px">
              <a href="${resetUrl}"
                 style="display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
                Réinitialiser mon mot de passe
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px 32px;color:#64748b;font-size:13px;line-height:1.6">
              <p>Ce lien est valide <strong>1 heure</strong>. Au-delà, vous devrez refaire une demande.</p>
              <p>Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email — votre mot de passe restera inchangé.</p>
              <p style="font-size:12px;color:#94a3b8;word-break:break-all">
                Si le bouton ne fonctionne pas, copiez ce lien :<br />
                ${resetUrl}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background:#f8fafc;color:#94a3b8;font-size:12px;text-align:center">
              OmniGestion 2026 — Cet email est automatique, merci de ne pas y répondre.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM env var not set");
  }
  await resend.emails.send({
    from,
    to,
    subject: "Réinitialisation de votre mot de passe OmniGestion",
    html: buildResetEmailHtml(resetUrl),
  });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add lib/email.ts
git commit -m "feat(auth): add Resend wrapper for password reset emails"
```

---

### Task 4: Implement `lib/password-reset/validate.ts` with TDD

The token validation logic is pure (no DB), so we TDD it. The route handler will load the record from the DB and pass it to this validator.

**Files:**
- Create: `lib/password-reset/validate.ts`
- Create: `__tests__/lib/password-reset/validate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/password-reset/validate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateResetTokenRecord } from "@/lib/password-reset/validate";

const NOW = new Date("2026-05-06T12:00:00Z");

describe("validateResetTokenRecord", () => {
  it("returns NOT_FOUND when record is null", () => {
    expect(validateResetTokenRecord(null, NOW)).toEqual({ valid: false, reason: "NOT_FOUND" });
  });

  it("returns USED when usedAt is set", () => {
    const record = {
      usedAt: new Date("2026-05-06T11:00:00Z"),
      expiresAt: new Date("2026-05-06T13:00:00Z"),
    };
    expect(validateResetTokenRecord(record, NOW)).toEqual({ valid: false, reason: "USED" });
  });

  it("returns EXPIRED when expiresAt is in the past", () => {
    const record = {
      usedAt: null,
      expiresAt: new Date("2026-05-06T11:00:00Z"),
    };
    expect(validateResetTokenRecord(record, NOW)).toEqual({ valid: false, reason: "EXPIRED" });
  });

  it("returns valid:true when token is fresh and unused", () => {
    const record = {
      usedAt: null,
      expiresAt: new Date("2026-05-06T13:00:00Z"),
    };
    expect(validateResetTokenRecord(record, NOW)).toEqual({ valid: true });
  });

  it("USED takes precedence over EXPIRED when both apply", () => {
    const record = {
      usedAt: new Date("2026-05-06T10:30:00Z"),
      expiresAt: new Date("2026-05-06T11:00:00Z"),
    };
    expect(validateResetTokenRecord(record, NOW)).toEqual({ valid: false, reason: "USED" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- validate`
Expected: FAIL — module `@/lib/password-reset/validate` not found.

- [ ] **Step 3: Implement `lib/password-reset/validate.ts`**

```ts
export type TokenValidation =
  | { valid: true }
  | { valid: false; reason: "NOT_FOUND" | "USED" | "EXPIRED" };

export interface ResetTokenRecord {
  usedAt: Date | null;
  expiresAt: Date;
}

export function validateResetTokenRecord(
  record: ResetTokenRecord | null,
  now: Date
): TokenValidation {
  if (!record) return { valid: false, reason: "NOT_FOUND" };
  if (record.usedAt !== null) return { valid: false, reason: "USED" };
  if (record.expiresAt < now) return { valid: false, reason: "EXPIRED" };
  return { valid: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- validate`
Expected: PASS — all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/password-reset/validate.ts __tests__/lib/password-reset/validate.test.ts
git commit -m "feat(auth): add password reset token validator with TDD coverage"
```

---

## Phase 2 — API routes

### Task 5: API route `POST /api/auth/forgot-password`

**Files:**
- Create: `app/api/auth/forgot-password/route.ts`

- [ ] **Step 1: Create `app/api/auth/forgot-password/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

const schema = z.object({
  email: z.string().email(),
});

const TOKEN_BYTES = 32;
const EXPIRY_MS = 60 * 60 * 1000;       // 1 hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;  // 1 hour
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/forgot-password
git commit -m "feat(auth): add forgot-password API with rate limit and anti-enumeration"
```

---

### Task 6: API route `POST /api/auth/reset-password`

**Files:**
- Create: `app/api/auth/reset-password/route.ts`

- [ ] **Step 1: Create `app/api/auth/reset-password/route.ts`**

```ts
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/reset-password
git commit -m "feat(auth): add reset-password API that updates User.password and passwordChangedAt"
```

---

## Phase 3 — JWT session invalidation

### Task 7: Modify NextAuth JWT callback to enforce `passwordChangedAt`

**Files:**
- Modify: `lib/auth.ts`

- [ ] **Step 1: Read the current `lib/auth.ts` to confirm the JWT callback structure**

Check the existing callback shape. The current `jwt` callback only sets `token.id = user.id` on initial sign-in. We need to additionally:
1. Capture `iat` (issued-at) on initial sign-in
2. On every subsequent call, check `User.passwordChangedAt` and return null if `iat < passwordChangedAt`

- [ ] **Step 2: Update `lib/auth.ts`**

Replace the existing `jwt` callback in `lib/auth.ts` with:

```ts
async jwt({ token, user }) {
  // Initial sign-in: capture user id and issued-at timestamp
  if (user) {
    token.id = user.id;
    token.iat = Math.floor(Date.now() / 1000);
  }

  // On every call, check if the user's password was changed after this JWT was issued
  if (token.id && token.iat) {
    const dbUser = await db.user.findUnique({
      where: { id: token.id as string },
      select: { passwordChangedAt: true },
    });
    if (dbUser?.passwordChangedAt) {
      const changedTs = Math.floor(dbUser.passwordChangedAt.getTime() / 1000);
      if (changedTs > (token.iat as number)) {
        // Password was changed after this JWT was issued → invalidate it
        return null;
      }
    }
  }

  return token;
},
```

The TypeScript type of NextAuth's `jwt` callback allows `JWT | null` as a return type — returning `null` causes NextAuth to treat the session as unauthenticated.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors. If `null` return type is rejected (some NextAuth v5 betas tighten this), use `return null as unknown as JWT;` as a last resort, but try the typed return first.

- [ ] **Step 4: Verify all existing tests still pass**

Run: `npm test`
Expected: all existing tests still pass (we did not touch tested code, only the auth callback).

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts
git commit -m "feat(auth): invalidate JWT in NextAuth callback when User.passwordChangedAt is more recent"
```

---

## Phase 4 — UI

### Task 8: Page `/auth/forgot-password`

**Files:**
- Create: `app/auth/forgot-password/page.tsx`

- [ ] **Step 1: Create `app/auth/forgot-password/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z.object({
  email: z.string().email("Email invalide"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      // Always show success per anti-enumeration spec
      setSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Mot de passe oublié</CardTitle>
          <CardDescription>
            {submitted
              ? "Vérifiez votre boîte mail pour le lien de réinitialisation."
              : "Entrez votre email pour recevoir un lien de réinitialisation."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="p-3 text-sm text-green-700 bg-green-50 rounded-md border border-green-200">
              Si un compte existe pour cette adresse, un email contenant un lien de réinitialisation
              vient de vous être envoyé. Le lien est valide pendant 1 heure.
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Envoi..." : "Envoyer le lien"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground text-center w-full">
            <Link href="/auth/login" className="text-primary hover:underline font-medium">
              ← Retour à la connexion
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/auth/forgot-password
git commit -m "feat(auth): add /auth/forgot-password page"
```

---

### Task 9: Page `/auth/reset-password`

**Files:**
- Create: `app/auth/reset-password/page.tsx`

- [ ] **Step 1: Create `app/auth/reset-password/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z
  .object({
    newPassword: z.string().min(6, "Mot de passe trop court (min 6 caractères)"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!token) {
      setError("Lien invalide ou manquant");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: data.newPassword }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Erreur lors de la réinitialisation");
        return;
      }
      router.push("/auth/login?reset=1");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Lien invalide</CardTitle>
            <CardDescription>Le lien de réinitialisation est manquant ou incomplet.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/auth/forgot-password" className="text-primary hover:underline text-sm">
              Demander un nouveau lien
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Nouveau mot de passe</CardTitle>
          <CardDescription>Choisissez un nouveau mot de passe pour votre compte.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <Input
                id="newPassword"
                type="password"
                {...register("newPassword")}
              />
              {errors.newPassword && (
                <p className="text-sm text-red-500">{errors.newPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Réinitialisation..." : "Réinitialiser le mot de passe"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/auth/reset-password
git commit -m "feat(auth): add /auth/reset-password page with confirm field"
```

---

### Task 10: Add "Mot de passe oublié ?" link on `/auth/login`

**Files:**
- Modify: `app/auth/login/page.tsx`

The current login page renders a button labeled "Se connecter" then a `CardFooter` with "Pas encore de compte ?". We add a small link between the password input and the submit button, AND we also add a success notice when `?reset=1` is present in the URL.

- [ ] **Step 1: Update `app/auth/login/page.tsx`**

Find the existing `useState` and import block. Add `useSearchParams` to the existing `next/navigation` import:

```ts
import { useRouter, useSearchParams } from "next/navigation";
```

Inside the component body, after `const router = useRouter();`, add:

```ts
const searchParams = useSearchParams();
const justReset = searchParams.get("reset") === "1";
```

Then in the JSX, find the existing error banner block:

```tsx
{error && (
  <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">
    {error}
  </div>
)}
```

Add this block IMMEDIATELY BEFORE it:

```tsx
{justReset && !error && (
  <div className="p-3 text-sm text-green-700 bg-green-50 rounded-md border border-green-200">
    Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe.
  </div>
)}
```

Find the password Input block (the one with `id="password"`). Below it, BEFORE the closing `</div>` of the password's space-y-2 wrapper, add a forgot-password link:

```tsx
<div className="text-right">
  <Link
    href="/auth/forgot-password"
    className="text-xs text-primary hover:underline"
  >
    Mot de passe oublié ?
  </Link>
</div>
```

The final password section should look like:

```tsx
<div className="space-y-2">
  <Label htmlFor="password">Mot de passe</Label>
  <Input
    id="password"
    type="password"
    {...register("password")}
  />
  {errors.password && (
    <p className="text-sm text-red-500">{errors.password.message}</p>
  )}
  <div className="text-right">
    <Link
      href="/auth/forgot-password"
      className="text-xs text-primary hover:underline"
    >
      Mot de passe oublié ?
    </Link>
  </div>
</div>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/auth/login/page.tsx
git commit -m "feat(auth): add 'Mot de passe oublié ?' link and post-reset success banner on login"
```

---

## Phase 5 — Smoke test

### Task 11: Manual smoke test

No automated E2E. Run through this scenario in dev (`npm run dev`) before declaring the feature complete.

- [ ] **Login form renders forgot link** — `/auth/login` shows "Mot de passe oublié ?" under the password field
- [ ] **Forgot page renders** — `/auth/forgot-password` shows the email form
- [ ] **Submit unknown email** — type `noone@example.com`, submit → success banner shown ("Si un compte existe…"), no error leak
- [ ] **Submit known email** — type a real registered user's email, submit → success banner shown
- [ ] **Email received** — check the inbox of the registered user (or Resend dashboard if using `onboarding@resend.dev`) → email with a reset link arrives
- [ ] **Click reset link** — page renders the new-password form with both inputs
- [ ] **Mismatched passwords** — type two different passwords → "Les mots de passe ne correspondent pas" error
- [ ] **Short password** — type 5 characters → "Mot de passe trop court (min 6 caractères)" error
- [ ] **Successful reset** — type matching valid passwords → redirect to `/auth/login?reset=1` with green success banner
- [ ] **Login with new password** — sign in with the new password → success, lands on `/dashboard`
- [ ] **Old session invalidated** — open another browser/incognito, log in, then trigger a reset on the same account in the original browser. Refresh the incognito window → it kicks back to `/auth/login` because the JWT was invalidated by `passwordChangedAt`
- [ ] **Reused link rejected** — click the reset link from the email a second time → "Lien déjà utilisé" error
- [ ] **Expired link rejected** — wait 1 h with an unused link, then click it → "Lien expiré" error (or fast-forward by setting `expiresAt` to a past timestamp via Prisma Studio)
- [ ] **Rate limit silently triggered** — submit 4 forgot-password requests for the same email within an hour → first 3 send emails, 4th is silently dropped (success UI shown but no email)

- [ ] **Commit smoke test results**

```bash
git commit --allow-empty -m "test(auth): password reset smoke test passed"
```

---

## Self-Review Checklist (run after writing the plan, before handing off)

- [ ] **Spec coverage** — every section of the design spec is implemented:
  - Section 1 (scope) → Task 1 (data) + Tasks 5-10 (features)
  - Section 2 (data model: PasswordResetToken + User.passwordChangedAt) → Task 1
  - Section 3 (architecture: 4 flows) → Tasks 5, 6, 3, 7
  - Section 4 (email template) → Task 3 (`buildResetEmailHtml`)
  - Section 5 (security: anti-enumeration, rate limit, single-use, expiry, session invalidation) → Tasks 5, 6, 7
  - Section 7 (env vars) → Task 2
- [ ] **Placeholder scan** — no "TBD", "TODO", "implement later" outside enum values
- [ ] **Type consistency** — `validateResetTokenRecord` signature matches between Task 4 (definition) and Task 6 (use); `sendPasswordResetEmail` signature matches between Task 3 and Task 5; `passwordChangedAt` field is `DateTime?` everywhere
