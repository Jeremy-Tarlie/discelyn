/**
 * Chiffre les secrets Stripe formation (OrgStripeConfig) encore en clair.
 *
 * Usage :
 *   node --env-file=.env scripts/seal-org-stripe.mjs
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

function needsSeal(value) {
  if (!value || value.startsWith(PREFIX)) return false;
  return (
    value.startsWith("sk_") ||
    value.startsWith("whsec_") ||
    value.startsWith("rk_")
  );
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const encryptionKey = requireEnv("TOKEN_ENCRYPTION_KEY");
  const key = createHash("sha256").update(encryptionKey, "utf8").digest();

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows } = await client.query(
      `SELECT id, "webhookSecret", "stripeSecretKey"
       FROM "OrgStripeConfig"`
    );

    let updated = 0;
    for (const row of rows) {
      const nextWhsec = needsSeal(row.webhookSecret)
        ? seal(row.webhookSecret, key)
        : row.webhookSecret;
      const nextSk = needsSeal(row.stripeSecretKey)
        ? seal(row.stripeSecretKey, key)
        : row.stripeSecretKey;

      if (
        nextWhsec === row.webhookSecret &&
        nextSk === row.stripeSecretKey
      ) {
        continue;
      }

      await client.query(
        `UPDATE "OrgStripeConfig"
         SET "webhookSecret" = $1, "stripeSecretKey" = $2, "updatedAt" = NOW()
         WHERE id = $3`,
        [nextWhsec, nextSk, row.id]
      );
      updated += 1;
    }

    console.log(
      `[seal-org-stripe] configs=${rows.length} sealed_or_updated=${updated}`
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
