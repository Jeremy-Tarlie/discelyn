/**
 * Chiffre les jetons OAuth Discord encore en clair (préfixe enc:v1:).
 *
 * Usage :
 *   node --env-file=.env scripts/seal-oauth-tokens.mjs
 *
 * Nécessite TOKEN_ENCRYPTION_KEY + DATABASE_URL.
 */
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import pg from "pg";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} manquant`);
  return value;
}

function seal(value, key) {
  if (!value || value.startsWith(PREFIX)) return value;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString("base64url");
  return `${PREFIX}${payload}`;
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const encryptionKey = requireEnv("TOKEN_ENCRYPTION_KEY");
  const key = createHash("sha256").update(encryptionKey, "utf8").digest();

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows } = await client.query(
      `SELECT id, access_token, refresh_token, id_token
       FROM "Account"
       WHERE provider = 'discord'`
    );

    let updated = 0;
    for (const row of rows) {
      const nextAccess = seal(row.access_token, key);
      const nextRefresh = seal(row.refresh_token, key);
      const nextIdToken = seal(row.id_token, key);

      if (
        nextAccess === row.access_token &&
        nextRefresh === row.refresh_token &&
        nextIdToken === row.id_token
      ) {
        continue;
      }

      await client.query(
        `UPDATE "Account"
         SET access_token = $1, refresh_token = $2, id_token = $3
         WHERE id = $4`,
        [nextAccess, nextRefresh, nextIdToken, row.id]
      );
      updated += 1;
    }

    console.log(
      `[seal-oauth] accounts=${rows.length} sealed_or_updated=${updated}`
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
