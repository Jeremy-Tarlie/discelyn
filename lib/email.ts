/**
 * Envoi email optionnel via Resend HTTP (pas de dépendance npm).
 * Actif seulement si RESEND_API_KEY + EMAIL_FROM sont définis.
 */

export function isEmailConfigured(): boolean {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  return Boolean(key && from);
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return { ok: false, error: "email_not_configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html ?? undefined,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        error: `resend_http_${response.status}:${body.slice(0, 200)}`,
      };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "email_send_failed";
    return { ok: false, error: message.slice(0, 300) };
  }
}
