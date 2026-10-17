import { isEmailConfigured, sendEmail } from "@/lib/email";

export function isAuthMailConfigured(): boolean {
  return isEmailConfigured();
}

/** Base URL pour liens des mails auth (verify / reset). */
export function authEmailBaseUrl(): string {
  const override = process.env.AUTH_EMAIL_BASE_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  const authUrl =
    process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (authUrl) return authUrl.replace(/\/$/, "");
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (publicUrl) return publicUrl.replace(/\/$/, "");
  return "http://localhost:3000";
}

const SIMPLE_EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function isSimpleEmailAddress(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 254) return false;
  // Refuse CRLF / headers injectés dans le destinataire.
  if (/[\r\n\0]/.test(trimmed)) return false;
  return SIMPLE_EMAIL_RE.test(trimmed);
}

export async function sendAuthMail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const to = input.to.trim();
  if (!isSimpleEmailAddress(to)) {
    return { ok: false, error: "auth_mail_invalid_recipient" };
  }

  if (!isEmailConfigured()) {
    return { ok: false, error: "auth_mail_not_configured" };
  }

  const result = await sendEmail({
    to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  if (!result.ok) {
    console.error("[auth-mail] send failed", result.error.slice(0, 200));
    return { ok: false, error: "auth_mail_send_failed" };
  }
  return { ok: true };
}
