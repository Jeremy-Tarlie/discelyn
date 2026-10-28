import * as Sentry from "@sentry/nextjs";
import { CONSENT_COOKIE } from "@/i18n/config";
import {
  allowsSentry,
  parseConsentPreferences,
} from "@/lib/consent";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const TOKEN_RE =
  /\b(?:sk_live_|sk_test_|whsec_|Bearer\s+)[A-Za-z0-9_\-./+=]{8,}/gi;
const CLAIM_URL_RE = /https?:\/\/[^\s"'<>]*\/(?:claim|c)\/[A-Za-z0-9_-]+/gi;
const DISCORD_ID_RE = /\b\d{17,20}\b/g;

function scrubString(value: string): string {
  return value
    .replace(EMAIL_RE, "[email]")
    .replace(TOKEN_RE, "[token]")
    .replace(CLAIM_URL_RE, "[claim_url]")
    .replace(DISCORD_ID_RE, "[discord_id]");
}

function readSentryConsent(): boolean {
  if (typeof document === "undefined") return false;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return false;
  const value = decodeURIComponent(match.split("=")[1] ?? "");
  return allowsSentry(parseConsentPreferences(value));
}

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

/** Sentry navigateur uniquement si catégorie cookies « sentry » consentie. */
if (dsn && readSentryConsent()) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.05,
    replaysSessionSampleRate: 0,
    environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV,
    beforeSend(event) {
      if (event.message) {
        event.message = scrubString(event.message);
      }
      if (typeof event.request?.url === "string") {
        event.request.url = scrubString(event.request.url);
      }
      return event;
    },
  });
}
