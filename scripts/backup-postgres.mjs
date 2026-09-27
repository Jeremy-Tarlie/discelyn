/**
 * Backup Postgres logique (pg_dump).
 *
 * Usage :
 *   node --env-file=.env scripts/backup-postgres.mjs
 *   node --env-file=.env scripts/backup-postgres.mjs --out ./backups
 *
 * Essaie dans l’ordre :
 * 1. `pg_dump` local
 * 2. `docker compose exec -T db pg_dump` (si stack compose locale)
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const isWin = process.platform === "win32";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} manquant`);
    process.exit(1);
  }
  return v;
}

function parseDbName(databaseUrl) {
  try {
    const u = new URL(databaseUrl);
    return (u.pathname || "/botly").replace(/^\//, "") || "botly";
  } catch {
    return "botly";
  }
}

const databaseUrl = requireEnv("DATABASE_URL");
const outIdx = process.argv.indexOf("--out");
const outDir =
  outIdx >= 0 && process.argv[outIdx + 1]
    ? process.argv[outIdx + 1]
    : join(process.cwd(), "backups");

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dbName = parseDbName(databaseUrl);

function tryLocalPgDump() {
  const dump = spawnSync(
    "pg_dump",
    [databaseUrl, "--no-owner", "--no-acl", "--clean", "--if-exists"],
    { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 }
  );
  if (dump.status === 0 && dump.stdout?.length) {
    return dump.stdout;
  }
  return null;
}

function tryDockerPgDump() {
  const user = process.env.POSTGRES_USER || "botly";
  const candidates = [
    ["compose", "-f", "docker-compose.yml", "exec", "-T", "db"],
    ["compose", "-f", "docker-compose.test.yml", "exec", "-T", "test-db"],
    ["exec", "-T", "botly-test-pg"],
    ["exec", "-T", "mydiscordbot-db-1"],
  ];

  for (const prefix of candidates) {
    const dump = spawnSync(
      "docker",
      [
        ...prefix,
        "pg_dump",
        "-U",
        user,
        "-d",
        dbName.split("?")[0],
        "--no-owner",
        "--no-acl",
        "--clean",
        "--if-exists",
      ],
      {
        encoding: "buffer",
        maxBuffer: 256 * 1024 * 1024,
        shell: isWin,
      }
    );
    if (dump.status === 0 && dump.stdout?.length) {
      return dump.stdout;
    }
  }
  console.error(
    "[backup] docker pg_dump a échoué sur tous les conteneurs candidats"
  );
  return null;
}

let sql = tryLocalPgDump();
if (!sql) {
  console.warn("[backup] pg_dump local indisponible — tentative via Docker…");
  sql = tryDockerPgDump();
}

if (!sql) {
  console.error(
    "[backup] Impossible de dumper. Installe les client Postgres, ou démarre Docker (service db)."
  );
  process.exit(1);
}

const gzip = spawnSync("gzip", ["-c"], {
  input: sql,
  encoding: "buffer",
  maxBuffer: 256 * 1024 * 1024,
});

if (gzip.status !== 0) {
  const plain = join(outDir, `botly-${stamp}.sql`);
  writeFileSync(plain, sql);
  console.log(`[backup] écrit (sans gzip): ${plain}`);
  process.exit(0);
}

const file = join(outDir, `botly-${stamp}.sql.gz`);
writeFileSync(file, gzip.stdout);
console.log(`[backup] écrit: ${file}`);
