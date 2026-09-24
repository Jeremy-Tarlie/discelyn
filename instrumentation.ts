import * as Sentry from "@sentry/nextjs";
import { assertAuthEnv } from "@/lib/auth";
import { getAppEnvironment } from "@/lib/demo";

export async function register() {
  // Sentry Node est initialisé via sentry.server.config.ts (éviter double init).

  if (process.env.NEXT_RUNTIME === "nodejs") {
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

    // Aligné avec preflight : staging/prod exigent chiffrement + cron + runtime secret.
    if (appEnv === "production" || appEnv === "staging") {
      if (!process.env.TOKEN_ENCRYPTION_KEY) {
        missing.push("TOKEN_ENCRYPTION_KEY");
      }
      if (!process.env.CRON_SECRET) {
        missing.push("CRON_SECRET");
      }
      if (!process.env.BOT_RUNTIME_SECRET) {
        missing.push("BOT_RUNTIME_SECRET");
      }
    }

    if (appEnv === "production" && !process.env.REDIS_URL) {
      missing.push("REDIS_URL");
    }

    if (process.env.BOT_RUNTIME_URL && !process.env.BOT_RUNTIME_SECRET) {
      if (!missing.includes("BOT_RUNTIME_SECRET")) {
        missing.push("BOT_RUNTIME_SECRET");
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
      environment: process.env.APP_ENV || process.env.NODE_ENV,
    });
  }
}
