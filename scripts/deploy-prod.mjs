#!/usr/bin/env node
/**
 * Déploiement production via compose + overlay TLS (Caddy).
 *
 * Usage :
 *   DOMAIN=discelyn.example.com EMAIL=admin@example.com npm run deploy:prod
 *   node --env-file=.env scripts/deploy-prod.mjs
 *
 * Refuse de démarrer sans DOMAIN / EMAIL / TRUST_PROXY cohérent.
 * Ne publie pas le port 3000 (TLS only).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const isWin = process.platform === "win32";

function fail(msg) {
  console.error(`[deploy:prod] ${msg}`);
  process.exit(1);
}

const domain = (process.env.DOMAIN || "").trim();
const email = (process.env.EMAIL || "").trim();
const appEnv = (process.env.APP_ENV || "").toLowerCase();

if (!domain) {
  fail("DOMAIN manquant (ex. discelyn.example.com)");
}
if (!email) {
  fail("EMAIL manquant (Let's Encrypt)");
}
if (!existsSync(join(process.cwd(), ".env"))) {
  fail(".env manquant — ne jamais committer les secrets");
}
if (!existsSync(join(process.cwd(), "docker-compose.tls.yml"))) {
  fail("docker-compose.tls.yml manquant");
}

if (appEnv === "production" && process.env.TRUST_PROXY !== "1") {
  console.warn(
    "[deploy:prod] TRUST_PROXY n’est pas 1 dans .env — l’overlay TLS force TRUST_PROXY=1 sur web."
  );
}

console.log(`[deploy:prod] DOMAIN=${domain} EMAIL=${email}`);
console.log(
  "[deploy:prod] docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build"
);

const r = spawnSync(
  "docker",
  [
    "compose",
    "-f",
    "docker-compose.yml",
    "-f",
    "docker-compose.tls.yml",
    "up",
    "-d",
    "--build",
  ],
  {
    encoding: "utf8",
    shell: isWin,
    stdio: "inherit",
    env: {
      ...process.env,
      DOMAIN: domain,
      EMAIL: email,
    },
  }
);

if (r.status !== 0) {
  fail("docker compose a échoué — Docker démarré ? DNS/ports 80+443 OK ?");
}

console.log("");
console.log(`[deploy:prod] Vérifie : curl -fsS https://${domain}/api/health`);
console.log(
  "[deploy:prod] Attendu : HTTP 200 + \"status\":\"ok\" (503 = degraded)"
);
console.log(
  "[deploy:prod] Logs : docker compose -f docker-compose.yml -f docker-compose.tls.yml logs -f web runtime access-cron"
);
process.exit(0);
