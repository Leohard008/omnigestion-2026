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
