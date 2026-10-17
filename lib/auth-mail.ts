import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let transporter: Transporter | null | undefined;

function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_FROM?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
}

export function isAuthMailConfigured(): boolean {
  return smtpConfigured();
}

function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass || !process.env.SMTP_FROM?.trim()) {
    return null;
  }
  if (transporter !== undefined) return transporter;

  const port = Number(process.env.SMTP_PORT || "587");
  const secure =
    process.env.SMTP_SECURE === "1" ||
    process.env.SMTP_SECURE === "true" ||
    port === 465;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // Mitige accès fichier/URL (CVE nodemailer 7.x). Remonter nodemailer
    // dès que next-auth élargit son peer au-delà de ^7.0.7.
    disableFileAccess: true,
    disableUrlAccess: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

/** Base URL pour liens des mails auth (verify / reset). */
export function authEmailBaseUrl(): string {
  const override = process.env.AUTH_EMAIL_BASE_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  const nextAuth = process.env.NEXTAUTH_URL?.trim();
  if (nextAuth) return nextAuth.replace(/\/$/, "");
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
  const from = process.env.SMTP_FROM?.trim();
  if (!from) {
    return { ok: false, error: "auth_mail_not_configured" };
  }

  const to = input.to.trim();
  if (!isSimpleEmailAddress(to)) {
    return { ok: false, error: "auth_mail_invalid_recipient" };
  }

  const transport = getTransporter();
  if (!transport) {
    return { ok: false, error: "auth_mail_not_configured" };
  }

  try {
    await transport.sendMail({
      from,
      to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "auth_mail_send_failed";
    console.error("[auth-mail] send failed", message.slice(0, 200));
    return { ok: false, error: "auth_mail_send_failed" };
  }
}

/** Reset transporter (tests). */
export function resetAuthMailTransporterForTests(): void {
  transporter = undefined;
}
