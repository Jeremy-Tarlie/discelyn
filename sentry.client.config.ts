import * as Sentry from "@sentry/nextjs";
import { CONSENT_COOKIE } from "@/i18n/config";
import {
  allowsSentry,
  parseConsentPreferences,
} from "@/lib/consent";

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
  });
}
