import * as Sentry from "@sentry/nextjs";
import { assertAuthEnv } from "@/lib/auth";
import { getAppEnvironment } from "@/lib/demo";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: process.env.NODE_ENV,
      });
    }

    const appEnv = getAppEnvironment();
    const required = [
      "DATABASE_URL",
      "NEXTAUTH_SECRET",
      "NEXTAUTH_URL",
      "DISCORD_CLIENT_ID",
      "DISCORD_CLIENT_SECRET",
      "DISCORD_BOT_TOKEN",
    ] as const;

    const missing: string[] = required.filter((name) => !process.env[name]);
    if (process.env.BOT_RUNTIME_URL && !process.env.BOT_RUNTIME_SECRET) {
      missing.push("BOT_RUNTIME_SECRET");
    }

    // Staging + prod : chiffrement + cron obligatoires (expiry / relances claim).
    if (appEnv === "production" || appEnv === "staging") {
      if (!process.env.TOKEN_ENCRYPTION_KEY) {
        missing.push("TOKEN_ENCRYPTION_KEY");
      }
      if (!process.env.CRON_SECRET) {
        missing.push("CRON_SECRET");
      }
    }

    // Fail-fast hors development local (production + staging).
    if (missing.length > 0 && appEnv !== "development") {
      throw new Error(
        `Variables d'environnement manquantes: ${missing.join(", ")}`
      );
    }

    try {
      assertAuthEnv();
    } catch (error) {
      if (appEnv !== "development") throw error;
      console.warn(
        `[auth] ${error instanceof Error ? error.message : "env auth incomplet"}`
      );
    }
  }

  if (process.env.NEXT_RUNTIME === "edge" && process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.05,
    });
  }
}
