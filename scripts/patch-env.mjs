#!/usr/bin/env node
/**
 * Met à jour des clés .env sans afficher les secrets.
 *
 * Usage :
 *   node scripts/patch-env.mjs --set DATABASE_URL=postgresql://discelyn:discelyn@localhost:5432/discelyn?schema=public
 *   node scripts/patch-env.mjs --set TRUST_PROXY=1 --set APP_ENV=production --set DOMAIN=x --set EMAIL=y
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const envPath = join(process.cwd(), ".env");
if (!existsSync(envPath)) {
  console.error("[patch-env] .env manquant");
  process.exit(1);
}

const sets = [];
for (let i = 0; i < process.argv.length; i += 1) {
  if (process.argv[i] === "--set" && process.argv[i + 1]) {
    const raw = process.argv[i + 1];
    const eq = raw.indexOf("=");
    if (eq <= 0) {
      console.error(`[patch-env] --set invalide: ${raw}`);
      process.exit(1);
    }
    sets.push({
      key: raw.slice(0, eq),
      value: raw.slice(eq + 1),
    });
    i += 1;
  }
}

if (sets.length === 0) {
  console.error("[patch-env] aucun --set KEY=VALUE");
  process.exit(1);
}

let text = readFileSync(envPath, "utf8");
if (!text.endsWith("\n")) text += "\n";

for (const { key, value } of sets) {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(text)) {
    text = text.replace(re, `${key}=${value}`);
  } else {
    text += `${key}=${value}\n`;
  }
  // Ne log que la clé, jamais la valeur (sauf flags non secrets).
  const safe =
    key === "TRUST_PROXY" ||
    key === "APP_ENV" ||
    key === "NEXT_PUBLIC_APP_ENV" ||
    key === "DOMAIN"
      ? value
      : "(set)";
  console.log(`[patch-env] ${key}=${safe}`);
}

writeFileSync(envPath, text, "utf8");
console.log("[patch-env] .env mis à jour");
