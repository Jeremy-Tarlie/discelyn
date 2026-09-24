/**
 * Backup Postgres logique (pg_dump).
 *
 * Usage :
 *   node --env-file=.env scripts/backup-postgres.mjs
 *   node --env-file=.env scripts/backup-postgres.mjs --out ./backups
 *
 * Nécessite `pg_dump` dans le PATH (client PostgreSQL).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} manquant`);
    process.exit(1);
  }
  return v;
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
const file = join(outDir, `botly-${stamp}.sql.gz`);

const dump = spawnSync(
  "pg_dump",
  [databaseUrl, "--no-owner", "--no-acl", "--clean", "--if-exists"],
  { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 }
);

if (dump.status !== 0) {
  console.error(
    "[backup] pg_dump a échoué:",
    dump.stderr?.toString("utf8") || dump.error
  );
  process.exit(1);
}

const gzip = spawnSync("gzip", ["-c"], {
  input: dump.stdout,
  encoding: "buffer",
  maxBuffer: 256 * 1024 * 1024,
});

if (gzip.status !== 0) {
  // Fallback sans gzip (Windows souvent sans gzip)
  const { writeFileSync } = await import("node:fs");
  const plain = join(outDir, `botly-${stamp}.sql`);
  writeFileSync(plain, dump.stdout);
  console.log(`[backup] écrit (sans gzip): ${plain}`);
  process.exit(0);
}

const { writeFileSync } = await import("node:fs");
writeFileSync(file, gzip.stdout);
console.log(`[backup] écrit: ${file}`);
