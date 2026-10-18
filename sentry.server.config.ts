import * as Sentry from "@sentry/nextjs";

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

function scrubDeep(value: string | number | boolean | null | object): string | number | boolean | null | object {
  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean" ||
      item === null ||
      typeof item === "object"
        ? scrubDeep(item)
        : "[redacted]"
    );
  }
  const out: Record<string, string | number | boolean | null | object> = {};
  for (const [key, val] of Object.entries(value)) {
    if (
      typeof val === "string" ||
      typeof val === "number" ||
      typeof val === "boolean" ||
      val === null ||
      typeof val === "object"
    ) {
      out[key] = scrubDeep(val);
    } else {
      out[key] = "[redacted]";
    }
  }
  return out;
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.APP_ENV || process.env.NODE_ENV,
    beforeSend(event) {
      if (event.message) {
        event.message = scrubString(event.message);
      }
      if (event.extra) {
        event.extra = scrubDeep(event.extra) as typeof event.extra;
      }
      if (event.request) {
        if (typeof event.request.url === "string") {
          event.request.url = scrubString(event.request.url);
        }
        if (typeof event.request.query_string === "string") {
          event.request.query_string = scrubString(event.request.query_string);
        }
        if (event.request.headers) {
          event.request.headers = scrubDeep(
            event.request.headers
          ) as typeof event.request.headers;
        }
        if (typeof event.request.data === "string") {
          event.request.data = scrubString(event.request.data);
        }
      }
      return event;
    },
  });
}
