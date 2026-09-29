#!/usr/bin/env node
/**
 * Déploiement production via compose + overlay TLS.
 *
 * Modes :
 *   TLS_MODE=caddy  (défaut) — Caddy dans Docker (docker-compose.tls.yml)
 *   TLS_MODE=nginx           — nginx hôte (docker-compose.host-nginx.yml)
 *                              Prérequis : deploy/bootstrap-host.sh déjà joué
 *
 * Usage :
 *   DOMAIN=… EMAIL=… npm run deploy:prod
 *   TLS_MODE=nginx DOMAIN=… EMAIL=… npm run deploy:prod
 *   node --env-file=.env scripts/deploy-prod.mjs
 *
 * Refuse de démarrer sans DOMAIN / EMAIL cohérents.
 * Ne publie pas le port 3000 publiquement (TLS only).
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
const tlsMode = (process.env.TLS_MODE || "caddy").toLowerCase();

if (!domain) {
  fail("DOMAIN manquant (ex. discelyn.example.com)");
}
if (!email) {
  fail("EMAIL manquant (Let's Encrypt)");
}
if (!existsSync(join(process.cwd(), ".env"))) {
  fail(".env manquant — ne jamais committer les secrets");
}

/** @type {string} */
let overlay;
if (tlsMode === "nginx" || tlsMode === "host-nginx") {
  overlay = "docker-compose.host-nginx.yml";
  if (!existsSync(join(process.cwd(), overlay))) {
    fail(`${overlay} manquant`);
  }
  if (!existsSync("/etc/discelyn-host-bootstrap") && process.platform !== "win32") {
    console.warn(
      "[deploy:prod] /etc/discelyn-host-bootstrap absent — as-tu lancé deploy/bootstrap-host.sh ?"
    );
  }
} else if (tlsMode === "caddy") {
  overlay = "docker-compose.tls.yml";
  if (!existsSync(join(process.cwd(), overlay))) {
    fail(`${overlay} manquant`);
  }
} else {
  fail(`TLS_MODE invalide: ${tlsMode} (caddy | nginx)`);
}

if (appEnv === "production" && process.env.TRUST_PROXY !== "1") {
  console.warn(
    "[deploy:prod] TRUST_PROXY n’est pas 1 dans .env — l’overlay TLS force TRUST_PROXY=1 sur web."
  );
}

console.log(`[deploy:prod] DOMAIN=${domain} EMAIL=${email} TLS_MODE=${tlsMode}`);
console.log(
  `[deploy:prod] docker compose -f docker-compose.yml -f ${overlay} up -d --build`
);

const r = spawnSync(
  "docker",
  [
    "compose",
    "-f",
    "docker-compose.yml",
    "-f",
    overlay,
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
      TLS_MODE: tlsMode,
    },
  }
);

if (r.status !== 0) {
  fail("docker compose a échoué — Docker démarré ? DNS/ports 80+443 OK ?");
}

console.log("");
console.log(`[deploy:prod] Vérifie : curl -fsS https://${domain}/api/health`);
console.log(
  '[deploy:prod] Attendu : HTTP 200 + "status":"ok" (503 = degraded)'
);
console.log(
  `[deploy:prod] Logs : docker compose -f docker-compose.yml -f ${overlay} logs -f web runtime access-cron`
);
process.exit(0);
