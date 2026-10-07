/**
 * Preflight production / staging — valide l’env avant déploiement.
 *
 * Usage :
 *   node --env-file=.env scripts/preflight-prod.mjs
 *   APP_ENV=production node --env-file=.env scripts/preflight-prod.mjs
 *
 * Exit 0 si OK, 1 si bloquant.
 * Ne lit jamais les valeurs des secrets (présence / format seulement).
 *
 * Aligné avec instrumentation.ts (boot fail-fast).
 */

const appEnv = (process.env.APP_ENV || "").toLowerCase() || "development";

const requiredAlways = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "DISCORD_BOT_TOKEN",
];

/** Même liste que le boot staging/prod (instrumentation.ts). */
const requiredStagingProd = [
  "TOKEN_ENCRYPTION_KEY",
  "CRON_SECRET",
  "BOT_RUNTIME_SECRET",
];

const requiredProd = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "REDIS_URL",
  "BOT_RUNTIME_URL",
  "WEB_INTERNAL_URL",
  "SENTRY_DSN",
];

/** Identité légale obligatoire (privacy / mentions légales / RGPD). */
const requiredLegal = [
  "NEXT_PUBLIC_LEGAL_ENTITY_NAME",
  "NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS",
  "NEXT_PUBLIC_LEGAL_ENTITY_COUNTRY",
  "NEXT_PUBLIC_SUPPORT_EMAIL",
  "NEXT_PUBLIC_HOSTING_PROVIDER",
  "NEXT_PUBLIC_HOSTING_REGION",
];

/** Prices SaaS mensuels — sans eux checkout / change-plan cassent. */
const requiredStripePricesProd = [
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_OPS",
  "STRIPE_PRICE_SCALE",
];

const recommendedStripePrices = [
  "STRIPE_PRICE_STARTER_YEARLY",
  "STRIPE_PRICE_OPS_YEARLY",
  "STRIPE_PRICE_SCALE_YEARLY",
  "STRIPE_PRICE_SETUP",
  "STRIPE_PRICE_DIAGNOSTIC",
];

const recommended = [
  "NEXT_PUBLIC_APP_ENV",
  "RESEND_API_KEY",
  "EMAIL_FROM",
];

function present(name) {
  const v = process.env[name];
  return Boolean(v && String(v).trim().length > 0);
}

function checkLength(name, min) {
  const v = process.env[name] || "";
  return v.length >= min;
}

const errors = [];
const warnings = [];

for (const name of requiredAlways) {
  if (!present(name)) errors.push(`manquant: ${name}`);
}

if (appEnv === "staging" || appEnv === "production") {
  for (const name of requiredStagingProd) {
    if (!present(name)) errors.push(`manquant (${appEnv}): ${name}`);
  }
  for (const name of requiredLegal) {
    if (!present(name)) {
      errors.push(`manquant (${appEnv}, RGPD/LCEN): ${name}`);
    }
  }
  if (present("TOKEN_ENCRYPTION_KEY") && !checkLength("TOKEN_ENCRYPTION_KEY", 16)) {
    errors.push("TOKEN_ENCRYPTION_KEY trop court (min 16)");
  }
  if (present("CRON_SECRET") && !checkLength("CRON_SECRET", 16)) {
    errors.push("CRON_SECRET trop court (min 16)");
  }
  if (present("NEXTAUTH_SECRET") && !checkLength("NEXTAUTH_SECRET", 32)) {
    errors.push("NEXTAUTH_SECRET trop court (min 32)");
  }
}

if (appEnv === "production") {
  for (const name of requiredProd) {
    if (!present(name)) errors.push(`manquant (production): ${name}`);
  }
  for (const name of requiredStripePricesProd) {
    if (!present(name)) {
      errors.push(`manquant (production): ${name} — checkout SaaS cassé sans ce price`);
    }
  }
  if (
    present("STRIPE_SECRET_KEY") &&
    !String(process.env.STRIPE_SECRET_KEY).startsWith("sk_live_")
  ) {
    warnings.push(
      "STRIPE_SECRET_KEY ne commence pas par sk_live_ (attendu en production)"
    );
  }
  if (!present("WEB_INTERNAL_URL") && !present("NEXTAUTH_URL")) {
    errors.push("WEB_INTERNAL_URL ou NEXTAUTH_URL requis pour grant-on-join");
  }
}

if (appEnv !== "production" && present("STRIPE_SECRET_KEY")) {
  if (String(process.env.STRIPE_SECRET_KEY).startsWith("sk_live_")) {
    errors.push(`sk_live_ refusée hors production (APP_ENV=${appEnv})`);
  }
}

if (present("BOT_RUNTIME_URL") && !present("BOT_RUNTIME_SECRET")) {
  errors.push("BOT_RUNTIME_SECRET requis si BOT_RUNTIME_URL est défini");
}

if (appEnv === "staging" && !present("REDIS_URL")) {
  warnings.push("recommandé (staging): REDIS_URL — obligatoire en production");
}

if (appEnv === "production") {
  if (process.env.TRUST_PROXY !== "1") {
    errors.push(
      "TRUST_PROXY=1 requis en production derrière reverse-proxy (sinon IP rate-limit spoofable / fausse)"
    );
  }
} else if (present("TRUST_PROXY") && process.env.TRUST_PROXY === "1") {
  warnings.push(
    "TRUST_PROXY=1 hors prod — OK seulement derrière un proxy de confiance"
  );
}

if (present("RESEND_API_KEY") && !present("EMAIL_FROM")) {
  errors.push("EMAIL_FROM requis si RESEND_API_KEY est défini");
}
if (present("EMAIL_FROM") && !present("RESEND_API_KEY")) {
  warnings.push("EMAIL_FROM sans RESEND_API_KEY — emails claim non envoyés");
}
if (
  appEnv === "production" &&
  (!present("RESEND_API_KEY") || !present("EMAIL_FROM"))
) {
  warnings.push(
    "prod sans RESEND_API_KEY+EMAIL_FROM — claims email-only non livrés (DM Discord / webhook orga seulement)"
  );
}

for (const name of recommendedStripePrices) {
  if (!present(name)) {
    warnings.push(`recommandé: ${name}`);
  }
}

for (const name of recommended) {
  if (!present(name)) warnings.push(`recommandé: ${name}`);
}

console.log(`[preflight] APP_ENV=${appEnv}`);
for (const w of warnings) console.warn(`[preflight:warn] ${w}`);
for (const e of errors) console.error(`[preflight:error] ${e}`);

if (errors.length > 0) {
  console.error(`[preflight] ÉCHEC — ${errors.length} erreur(s)`);
  process.exit(1);
}

console.log("[preflight] OK — env prêt pour ce APP_ENV");
process.exit(0);
