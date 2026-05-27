# OmniGestion — Flow Mot de passe oublié (Design)

**Date :** 2026-05-06
**Statut :** Spec validée, en attente de plan d'implémentation
**Cible :** OmniGestion (Next.js 15 + Prisma + NextAuth v5 credentials)

---

## 1. Vue d'ensemble

### Objectif

Permettre à un utilisateur ayant oublié son mot de passe de le réinitialiser de manière sécurisée via un lien envoyé par email, en suivant les standards OWASP : single-use token, account enumeration protection, session invalidation après reset.

### Périmètre fonctionnel

- 2 nouvelles pages : `/auth/forgot-password` et `/auth/reset-password?token=...`
- 2 nouvelles API routes : `POST /api/auth/forgot-password` et `POST /api/auth/reset-password`
- 1 nouveau modèle Prisma : `PasswordResetToken`
- 1 nouveau champ sur `User` : `passwordChangedAt`
- 1 customisation du callback JWT NextAuth (invalide les sessions antérieures à un reset)
- Lien "Mot de passe oublié ?" ajouté sur la page `/auth/login`
- Service email : Resend (free tier 3 000 mails/mois)

### Hors scope MVP

- Multi-langue (français uniquement)
- Reset par SMS / 2FA recovery codes
- Politique de password strength stricte (on garde min 6 caractères, cohérent avec login)
- Rate limiting par IP (uniquement par email)
- Magic link / passwordless
- Lockout après N tentatives échouées

---

## 2. Modèle de données

### Nouveau modèle `PasswordResetToken`

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

**Décisions clés :**
- `token` : string aléatoire crypto-secure (32 bytes hex = 64 chars), unique
- `expiresAt` : `now + 1h`
- `usedAt` : `null` tant que pas utilisé. Marqué quand consommé. Permet single-use et audit.
- `onDelete: Cascade` : si user supprimé, ses tokens partent avec
- Index sur `(userId)` pour rate limit check, sur `(token)` pour lookup

### Modification du modèle `User`

```prisma
model User {
  // ... champs existants ...
  passwordChangedAt DateTime?

  resetTokens       PasswordResetToken[]
}
```

`passwordChangedAt` est `null` pour les comptes n'ayant jamais reset. Utilisé par le callback JWT NextAuth pour invalider les sessions issues avant un reset.

### Migration

Une seule migration Prisma :
- `CREATE TABLE password_reset_tokens` avec FK + 2 indexes
- `ALTER TABLE users ADD COLUMN passwordChangedAt TIMESTAMP(3)` (nullable)

---

## 3. Architecture & flux techniques

### Arborescence

```
app/auth/
├── forgot-password/page.tsx        # NEW — saisie email
└── reset-password/page.tsx         # NEW — nouveau mot de passe

app/api/auth/
├── forgot-password/route.ts        # NEW — POST créer token + envoyer mail
└── reset-password/route.ts         # NEW — POST valider token + update password

lib/
├── auth.ts                         # MODIFIED — JWT callback check passwordChangedAt
└── email.ts                        # NEW — wrapper Resend
```

### Flux 1 — Forgot password

`POST /api/auth/forgot-password`

```
1. Body { email: string } → zod validate
2. Toujours retourner 200 { ok: true } pour anti-enumeration
3. user = db.user.findUnique({ where: { email } })
   Si null → log "user not found for email" (sans exposer) + return 200
4. Rate limit check :
   count = db.passwordResetToken.count({
     where: { userId: user.id, createdAt: { gt: now - 1h }, usedAt: null }
   })
   Si count >= 3 → return 200 (silently rate-limited, log côté serveur)
5. Invalider tokens précédents :
   db.passwordResetToken.updateMany({
     where: { userId: user.id, usedAt: null },
     data: { usedAt: now }
   })
6. Générer token : crypto.randomBytes(32).toString('hex')
7. Créer PasswordResetToken { userId, token, expiresAt: now + 1h }
8. Envoyer email via lib/email.ts avec lien:
   ${NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}
9. Try/catch autour de l'envoi : si Resend throw, log mais ne propage pas
10. Return 200 { ok: true }
```

### Flux 2 — Reset password

`POST /api/auth/reset-password`

```
1. Body { token: string, newPassword: string (min 6) } → zod validate
2. record = db.passwordResetToken.findUnique({ where: { token } })
3. Validations en cascade :
   - Si null → 400 { error: "Lien invalide" }
   - Si record.usedAt !== null → 400 { error: "Lien déjà utilisé" }
   - Si record.expiresAt < now → 400 { error: "Lien expiré" }
4. Transaction Prisma :
   - hash = bcrypt.hash(newPassword, 10)
   - db.user.update({
       where: { id: record.userId },
       data: { password: hash, passwordChangedAt: now }
     })
   - db.passwordResetToken.update({
       where: { id: record.id },
       data: { usedAt: now }
     })
5. Return 200 { ok: true }
```

### Flux 3 — Envoi email (`lib/email.ts`)

Wrapper minimal autour du SDK Resend :

```ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: "Réinitialisation de votre mot de passe OmniGestion",
    html: buildHtml(resetUrl),
  });
}

function buildHtml(resetUrl: string): string {
  // template HTML inline (cf. Section 4)
}
```

Si Resend throw (clé invalide, quota dépassé, domaine non vérifié) → caller (route handler) catch et log mais ne propage pas l'erreur. Cohérence avec anti-enumeration : le user voit toujours `{ ok: true }`.

### Flux 4 — Invalidation des sessions (`lib/auth.ts`)

Customiser le callback `jwt` de NextAuth :

```ts
async jwt({ token, user }) {
  // Initial sign-in : capter iat et user.id
  if (user) {
    token.id = user.id;
    token.iat = Math.floor(Date.now() / 1000);
  }

  // Sur chaque request authentifiée : check si password a changé après émission du JWT
  if (token.id && token.iat) {
    const dbUser = await db.user.findUnique({
      where: { id: token.id as string },
      select: { passwordChangedAt: true },
    });
    if (dbUser?.passwordChangedAt) {
      const changedTs = Math.floor(dbUser.passwordChangedAt.getTime() / 1000);
      if (changedTs > (token.iat as number)) {
        return null;  // NextAuth invalide ce JWT, force re-login
      }
    }
  }

  return token;
}
```

**Trade-off perf** : 1 query DB par requête authentifiée. Acceptable pour MVP (PK + select unique = sub-millisecond). Mitigation possible plus tard : cache Redis avec TTL court.

---

## 4. Template email

**Format** : HTML inline (un seul template, pas besoin de React Email).

**Métadonnées** :
- **From** : `OmniGestion <noreply@${verified-domain}>` (en dev : `onboarding@resend.dev`)
- **Subject** : `Réinitialisation de votre mot de passe OmniGestion`

**Body HTML** :

```html
<!DOCTYPE html>
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
              <a href="{{RESET_URL}}"
                 style="display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
                Réinitialiser mon mot de passe
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px 32px;color:#64748b;font-size:13px;line-height:1.6">
              <p>
                Ce lien est valide <strong>1 heure</strong>. Au-delà, vous devrez refaire une demande.
              </p>
              <p>
                Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email — votre mot de passe restera inchangé.
              </p>
              <p style="font-size:12px;color:#94a3b8;word-break:break-all">
                Si le bouton ne fonctionne pas, copiez ce lien :<br />
                {{RESET_URL}}
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
</html>
```

**Variables substituées** : `{{RESET_URL}}` → `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`

**Version texte** : auto-générée par Resend depuis le HTML, pas de duplication.

---

## 5. Sécurité — récap des garde-fous

| Risque | Mitigation | Implémentation |
|--------|-----------|----------------|
| **Account enumeration** | Toujours 200 + message générique | Route forgot-password ne retourne jamais 404 |
| **Token guess / brute force** | 32 bytes random hex (256 bits entropy) | `crypto.randomBytes(32).toString('hex')` |
| **Token réutilisé** | Single-use via `usedAt` | Marqué dans la transaction reset |
| **Token volé d'un mail** | Expiry 1h | `expiresAt = now + 1h`, vérifié à chaque check |
| **Spam endpoint** | Rate limit 3/h par email | Count tokens créés < 1h pour user.id |
| **Session attaquant active** | Invalidation totale via `passwordChangedAt` | Callback JWT rejette si `iat < passwordChangedAt` |
| **Lien interceptable** | HTTPS-only en prod | Vercel HTTPS par défaut, `NEXT_PUBLIC_APP_URL` doit être `https://...` |
| **Email leak via erreur Resend** | Errors silencieuses | Try/catch autour `sendEmail`, log + retour 200 |
| **CSRF** | Same-origin POST + JSON body | Pas de form action cross-origin, NextAuth standard |
| **Token logué** | Ne jamais logger le token | Logs : `userId` uniquement, jamais `token` |
| **Faiblesse password** | min 6 chars (cohérent login) | Trade-off MVP, audit auth complet plus tard |

### Tests manuels post-implémentation

- Reset sur email inexistant → 200 silencieux, pas d'email envoyé
- > 3 demandes en 1h sur même email → 200 silencieux, max 1 mail (le premier valide)
- Token expiré → 400 "Lien expiré"
- Token déjà consommé → 400 "Lien déjà utilisé"
- Reset avec session active sur autre device → device se déconnecte au prochain refresh

---

## 6. Récap décisions clés

| # | Décision |
|---|----------|
| Service email | Resend (free tier 3k/mois) |
| Token strategy | DB table `PasswordResetToken` |
| Token expiry | 1 heure |
| Account enumeration | Always 200 success |
| Rate limiting | Max 3 tokens / heure / email + invalide précédents à chaque nouvelle demande |
| Langue email | Français uniquement |
| Comportement post-reset | Redirect login + message "Mot de passe modifié" |
| Invalidation sessions | `User.passwordChangedAt` + JWT callback rejette si `iat < changedAt` |
| Règles password | Min 6 caractères (cohérent avec login existant) |
| Multi-requêtes | Nouvelle demande invalide les tokens précédents non-utilisés |

## 7. Dépendances et configuration

### Nouvelles dépendances npm

| Package | Usage |
|---------|-------|
| `resend` | SDK pour envoi email |

### Variables d'environnement

| Variable | Statut | Description |
|----------|--------|-------------|
| `RESEND_API_KEY` | NEW | Clé API Resend, à générer sur https://resend.com |
| `EMAIL_FROM` | NEW | Adresse expéditeur, ex `OmniGestion <noreply@yourdomain.com>` |
| `NEXT_PUBLIC_APP_URL` | EXISTANT | Utilisé pour construire le reset URL |

### Domaine email

- **Dev** : utiliser `onboarding@resend.dev` (sender de test fourni par Resend, ne nécessite pas de DNS)
- **Prod** : configurer un domaine vérifié sur Resend (DKIM/SPF) avant le go-live

## 8. Estimation effort

| Phase | Durée | Contenu |
|-------|-------|---------|
| Setup data | 30 min | Migration Prisma : `PasswordResetToken` + `User.passwordChangedAt` |
| Lib email + token | 45 min | `lib/email.ts` Resend wrapper + token generation utils |
| API routes | 1 h | `/api/auth/forgot-password` + `/api/auth/reset-password` avec validation |
| JWT callback custom | 30 min | Modifier `lib/auth.ts`, gérer `dbUser?.passwordChangedAt` |
| Pages UI | 1 h | `/auth/forgot-password` + `/auth/reset-password` (forms simples) |
| Lien sur page login | 10 min | Ajouter `<Link>` "Mot de passe oublié ?" |
| Tests + smoke manuel | 30 min | Test parcours complet en dev |
| **Total** | **~4 h 30** | |

## 9. Hors scope (V2 si besoin)

- Multi-langue (arabe pour DZ)
- Magic link / passwordless
- 2FA recovery codes
- Politique password strength (zxcvbn-based)
- Rate limit par IP (Redis/Upstash)
- Lockout après N tentatives de reset échouées
- Email notification au user après chaque reset réussi (pour détecter une compromission)
