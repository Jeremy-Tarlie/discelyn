#!/usr/bin/env node
/**
 * Release gate — points 2→7 de docs/RELEASE.md (automatisés autant que possible).
 *
 * Usage :
 *   npm run release:gate
 *   node --env-file=.env scripts/release-gate.mjs
 *   node --env-file=.env scripts/release-gate.mjs --skip-build
 *   node --env-file=.env scripts/release-gate.mjs --skip-e2e
 *
 * Ne lit jamais le contenu des secrets pour les afficher.
 * Exit 0 si tout OK, 1 sinon.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const skipBuild = process.argv.includes("--skip-build");
const skipE2e = process.argv.includes("--skip-e2e");
const skipBackup = process.argv.includes("--skip-backup");
const isWin = process.platform === "win32";

const steps = [];
let failed = false;

function log(msg) {
  console.log(`[release-gate] ${msg}`);
}

function run(label, command, args, opts = {}) {
  log(`→ ${label}`);
  const r = spawnSync(command, args, {
    encoding: "utf8",
    shell: isWin,
    stdio: "inherit",
    env: { ...process.env, ...opts.env },
  });
  const ok = r.status === 0;
  steps.push({ label, ok });
  if (!ok) {
    failed = true;
    log(`ÉCHEC: ${label}`);
  }
  return ok;
}

function check(label, ok, detail = "") {
  steps.push({ label, ok });
  if (ok) log(`✓ ${label}${detail ? ` — ${detail}` : ""}`);
  else {
    failed = true;
    log(`ÉCHEC: ${label}${detail ? ` — ${detail}` : ""}`);
  }
  return ok;
}

log("=== 2. Base de données (migrate) ===");
if (!process.env.DATABASE_URL) {
  check("DATABASE_URL", false, "manquant (utilise --env-file=.env)");
} else {
  run("prisma migrate deploy", "npx", ["prisma", "migrate", "deploy"]);
}

log("=== 3. Preflight secrets / TRUST_PROXY ===");
if (!existsSync(join(process.cwd(), ".env"))) {
  check(".env présent", false, "fichier .env requis pour preflight");
} else {
  // APP_ENV vient du .env chargé par npm run release:gate
  run("preflight:prod", "node", ["scripts/preflight-prod.mjs"]);
}

const tlsFile = join(process.cwd(), "docker-compose.tls.yml");
check(
  "docker-compose.tls.yml",
  existsSync(tlsFile),
  "overlay TLS obligatoire en prod"
);

log("=== 4. Qualité + money path e2e + builds ===");
run("typecheck", "npm", ["run", "typecheck"]);
run("typecheck:runtime", "npm", ["run", "typecheck:runtime"]);
run("lint", "npm", ["run", "lint"]);
run("test", "npm", ["test"]);

if (!skipE2e) {
  run("test:db (money path)", "npm", ["run", "test:db"]);
} else {
  log("skip test:db (--skip-e2e)");
}

if (!skipBuild) {
  run("build web", "npm", ["run", "build"], {
    env: { NODE_ENV: "production" },
  });
  run("build runtime", "npm", ["--prefix", "bot-runtime", "run", "build"]);
} else {
  log("skip builds (--skip-build)");
}

log("=== 5. Chemin deploy TLS ===");
check(
  "script deploy:prod",
  existsSync(join(process.cwd(), "scripts", "deploy-prod.mjs"))
);
if (process.env.APP_ENV === "production" && process.env.TRUST_PROXY !== "1") {
  check(
    "TRUST_PROXY=1 en production",
    false,
    "requis derrière reverse-proxy (overlay TLS le force)"
  );
} else if (process.env.APP_ENV === "production") {
  check("TRUST_PROXY", process.env.TRUST_PROXY === "1");
}

log("=== 6. Backup DB ===");
if (skipBackup) {
  log("skip backup (--skip-backup)");
} else if (!process.env.DATABASE_URL) {
  check("backup:db", false, "DATABASE_URL manquant");
} else {
  run("backup:db", "node", ["scripts/backup-postgres.mjs"]);
}

log("=== 7. Money path ===");
check(
  "suite DB money-path présente",
  existsSync(join(process.cwd(), "lib", "money-path.db.test.ts"))
);
if (!skipE2e && steps.some((s) => s.label.includes("test:db") && s.ok)) {
  check(
    "preuve money path automatisée",
    true,
    "checkout → grant → revoke (Discord mocké, pas E2E live)"
  );
}
log(
  "Reste manuel post-deploy : 1 paiement Stripe test réel + claim OAuth Discord (RELEASE §5)."
);

console.log("");
log("Résumé:");
for (const s of steps) {
  console.log(`  ${s.ok ? "OK" : "FAIL"}  ${s.label}`);
}

if (failed) {
  log("RELEASE GATE ÉCHOUÉ");
  process.exit(1);
}

log("RELEASE GATE OK — tu peux enchaîner: npm run deploy:prod");
process.exit(0);
