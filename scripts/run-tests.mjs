#!/usr/bin/env node
/**
 * Garantit un Postgres de test joignable, applique les migrations,
 * puis lance Vitest avec DATABASE_URL — aucun skip possible.
 *
 * Usage:
 *   node scripts/run-tests.mjs              # suite complète
 *   node scripts/run-tests.mjs --db         # money-path + fulfill/soft-delete DB
 *   node scripts/run-tests.mjs -- …args    # args passés à vitest
 */
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const TEST_DATABASE_URL =
  process.env.DISCELYN_TEST_DATABASE_URL ??
  "postgresql://discelyn:discelyn@127.0.0.1:5433/discelyn?schema=public";

const TEST_TOKEN_KEY =
  process.env.TOKEN_ENCRYPTION_KEY ??
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const args = process.argv.slice(2);
const dbOnly = args.includes("--db") || args.includes("--e2e");
const watch = args.includes("--watch");
const passthrough = args.filter(
  (a) => a !== "--db" && a !== "--e2e" && a !== "--watch"
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
  const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    encoding: "utf8",
    shell: process.platform === "win32",
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

  if (await canConnect(TEST_DATABASE_URL)) {
    log(`Postgres test déjà up (${TEST_DATABASE_URL.replace(/:[^:@]+@/, ":***@")})`);
  } else {
    log("démarrage docker-compose.test.yml (port 5433)…");
    dockerComposeUp();
    for (let i = 0; i < 40; i++) {
      if (await canConnect(TEST_DATABASE_URL)) break;
      await delay(500);
    }
    if (!(await canConnect(TEST_DATABASE_URL))) {
      throw new Error("Postgres test (5433) toujours injoignable après démarrage");
    }
  }

  log("migrate deploy…");
  migrate(TEST_DATABASE_URL);
  return TEST_DATABASE_URL;
}

const databaseUrl = await ensureDatabase();

const vitestArgs = dbOnly
  ? [
      "vitest",
      "run",
      "lib/money-path.db.test.ts",
      "lib/fulfill-access.db.test.ts",
      "lib/soft-delete.db.test.ts",
      ...passthrough,
    ]
  : watch
    ? ["vitest", ...passthrough]
    : passthrough.length > 0
      ? ["vitest", "run", ...passthrough]
      : ["vitest", "run"];

log(`vitest ${vitestArgs.slice(1).join(" ")}`);

const child = spawn("npx", vitestArgs, {
  stdio: "inherit",
  shell: process.platform === "win32",
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
