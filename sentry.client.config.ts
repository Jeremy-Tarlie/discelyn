import * as Sentry from "@sentry/nextjs";
import { CONSENT_COOKIE } from "@/i18n/config";

function readConsent(): "necessary" | "all" | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.split("=")[1] ?? "");
  if (value === "necessary" || value === "all") return value;
  return null;
}

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

/** Sentry navigateur uniquement si consentement cookies = all. */
if (dsn && readConsent() === "all") {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.05,
    replaysSessionSampleRate: 0,
  });
}
