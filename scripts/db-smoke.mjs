#!/usr/bin/env node
/**
 * Smoke DB : vérifie que le schéma Postgres est joignable (CI / local).
 * Usage: node scripts/db-smoke.mjs
 */
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("[db-smoke] DATABASE_URL manquant");
  process.exit(1);
}

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  const { rows } = await client.query(
    'SELECT COUNT(*)::int AS n FROM "User"'
  );
  console.log(`[db-smoke] ok — users=${rows[0]?.n ?? 0}`);
} catch (err) {
  console.error(
    "[db-smoke] échec:",
    err instanceof Error ? err.message : err
  );
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}
