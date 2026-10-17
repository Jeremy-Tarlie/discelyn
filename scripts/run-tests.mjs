#!/usr/bin/env node
/**
 * Garantit un Postgres de test joignable, applique les migrations,
 * puis lance Vitest avec DATABASE_URL — aucun skip possible.
 *
 * Sur Windows : Vitest tourne dans Docker Linux (évite le binaire natif
 * Rollup win32). Linux / CI : Vitest local.
 *
 * Usage:
 *   node scripts/run-tests.mjs              # suite complète
 *   node scripts/run-tests.mjs --db         # money-path + fulfill/soft-delete DB
 *   node scripts/run-tests.mjs -- …args    # args passés à vitest
 *
 * Overrides:
 *   DISCELYN_TEST_VITEST_HOST=1    force Vitest local (même sur Windows)
 *   DISCELYN_TEST_VITEST_DOCKER=1  force Vitest dans Docker
 */
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { config as loadDotenv } from "dotenv";
import {
  rewriteDatabaseUrlForDocker,
  shouldRunVitestInDocker,
} from "./test-runner-pure.mjs";

loadDotenv({ path: ".env", quiet: true });

function resolveLocalTestDatabaseUrl() {
  if (process.env.DISCELYN_TEST_DATABASE_URL) {
    return process.env.DISCELYN_TEST_DATABASE_URL;
  }
  const password = process.env.POSTGRES_PASSWORD;
  if (!password) {
    throw new Error(
      "POSTGRES_PASSWORD manquant dans l’environnement / .env " +
        "(ou définis DISCELYN_TEST_DATABASE_URL)."
    );
  }
  return `postgresql://discelyn:${encodeURIComponent(password)}@127.0.0.1:5433/discelyn?schema=public`;
}

const TEST_TOKEN_KEY =
  process.env.TOKEN_ENCRYPTION_KEY ??
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const args = process.argv.slice(2);
const dbOnly = args.includes("--db") || args.includes("--e2e");
const watch = args.includes("--watch");
const passthrough = args.filter(
  (a) => a !== "--db" && a !== "--e2e" && a !== "--watch" && a !== "--"
);

function log(msg) {
  console.log(`[test-db] ${msg}`);
}

async function canConnect(url) {
  try {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    return true;
  } catch {
    return false;
  }
}

function dockerComposeUp() {
  const r = spawnSync(
    "docker",
    ["compose", "-f", "docker-compose.test.yml", "up", "-d", "--wait"],
    { encoding: "utf8", shell: process.platform === "win32" }
  );
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || "").trim();
    throw new Error(
      `Impossible de démarrer docker-compose.test.yml.\n${err}\n` +
        "Docker doit être démarré (ou définis DATABASE_URL / DISCELYN_TEST_DATABASE_URL)."
    );
  }
}

function migrate(url) {
  // Préférer le Prisma local (v7 + prisma.config.ts) — `npx prisma` peut
  // résoudre une CLI globale v6 incompatible (P1012 url manquante).
  const prismaCli = path.join(
    process.cwd(),
    "node_modules",
    "prisma",
    "build",
    "index.js"
  );
  const r = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    encoding: "utf8",
    shell: false,
    env: { ...process.env, DATABASE_URL: url },
  });
  if (r.status !== 0) {
    throw new Error(
      `prisma migrate deploy a échoué:\n${(r.stderr || r.stdout || "").trim()}`
    );
  }
}

async function ensureDatabase() {
  // CI : le workflow fournit déjà DATABASE_URL + migrate.
  if (process.env.CI && process.env.DATABASE_URL) {
    log(`CI — utilisation de DATABASE_URL fourni`);
    return process.env.DATABASE_URL;
  }

  // Override explicite (dev avancé).
  if (process.env.DISCELYN_TEST_DATABASE_URL) {
    log(`DISCELYN_TEST_DATABASE_URL`);
    if (!(await canConnect(process.env.DISCELYN_TEST_DATABASE_URL))) {
      throw new Error("DISCELYN_TEST_DATABASE_URL injoignable");
    }
    migrate(process.env.DISCELYN_TEST_DATABASE_URL);
    return process.env.DISCELYN_TEST_DATABASE_URL;
  }

  const testDatabaseUrl = resolveLocalTestDatabaseUrl();

  if (await canConnect(testDatabaseUrl)) {
    log(`Postgres test déjà up (${testDatabaseUrl.replace(/:[^:@]+@/, ":***@")})`);
  } else {
    log("démarrage docker-compose.test.yml (port 5433)…");
    dockerComposeUp();
    for (let i = 0; i < 40; i++) {
      if (await canConnect(testDatabaseUrl)) break;
      await delay(500);
    }
    if (!(await canConnect(testDatabaseUrl))) {
      throw new Error("Postgres test (5433) toujours injoignable après démarrage");
    }
  }

  log("migrate deploy…");
  migrate(testDatabaseUrl);
  return testDatabaseUrl;
}

function buildVitestArgs() {
  if (dbOnly) {
    return [
      "run",
      "lib/money-path.db.test.ts",
      "lib/fulfill-access.db.test.ts",
      "lib/soft-delete.db.test.ts",
      ...passthrough,
    ];
  }
  if (watch) {
    return [...passthrough];
  }
  if (passthrough.length > 0) {
    return ["run", ...passthrough];
  }
  return ["run"];
}

function shellSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * Vitest dans un conteneur Linux : volume source + volume nommé pour
 * node_modules (pas de binaire Rollup win32 sur l’hôte).
 */
function spawnVitestDocker(databaseUrl, vitestArgs) {
  if (watch) {
    throw new Error(
      "--watch non supporté quand Vitest tourne en Docker (Windows). " +
        "Utilise WSL/Linux, ou DISCELYN_TEST_VITEST_HOST=1 si Rollup local fonctionne."
    );
  }

  const containerDbUrl = rewriteDatabaseUrlForDocker(databaseUrl);
  const cwd = process.cwd();
  const vitestCmd = vitestArgs.map(shellSingleQuote).join(" ");
  const bashCmd =
    "npm ci --ignore-scripts && npx prisma generate && exec npx vitest " +
    vitestCmd;

  const dockerArgs = [
    "run",
    "--rm",
    "-e",
    "DATABASE_URL",
    "-e",
    "TOKEN_ENCRYPTION_KEY",
    "-v",
    `${cwd}:/app`,
    "-v",
    "discelyn-vitest-node-modules:/app/node_modules",
    "-w",
    "/app",
    "node:22-bookworm",
    "bash",
    "-c",
    bashCmd,
  ];

  log(`vitest (docker linux) ${vitestArgs.join(" ")}`);

  const child = spawn("docker", dockerArgs, {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      DATABASE_URL: containerDbUrl,
      TOKEN_ENCRYPTION_KEY: TEST_TOKEN_KEY,
    },
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

function spawnVitestHost(databaseUrl, vitestArgs) {
  const vitestCli = path.join(
    process.cwd(),
    "node_modules",
    "vitest",
    "vitest.mjs"
  );
  const argv = [vitestCli, ...vitestArgs];
  log(`vitest ${vitestArgs.join(" ")}`);

  const child = spawn(process.execPath, argv, {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      TOKEN_ENCRYPTION_KEY: TEST_TOKEN_KEY,
    },
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

const databaseUrl = await ensureDatabase();
const vitestArgs = buildVitestArgs();
const useDocker = shouldRunVitestInDocker({
  platform: process.platform,
  ci: Boolean(process.env.CI),
  forceDocker: process.env.DISCELYN_TEST_VITEST_DOCKER === "1",
  forceHost: process.env.DISCELYN_TEST_VITEST_HOST === "1",
});

if (useDocker) {
  spawnVitestDocker(databaseUrl, vitestArgs);
} else {
  spawnVitestHost(databaseUrl, vitestArgs);
}
