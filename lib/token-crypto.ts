import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw || raw.trim().length === 0) return null;
  return createHash("sha256").update(raw, "utf8").digest();
}

export function isTokenEncryptionEnabled(): boolean {
  return getKey() !== null;
}

export function isSealedToken(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Chiffre un secret. No-op si TOKEN_ENCRYPTION_KEY absent. */
export function sealToken(
  value: string | null | undefined
): string | null | undefined {
  if (value == null || value === "") return value;
  if (value.startsWith(PREFIX)) return value;
  const key = getKey();
  if (!key) return value;

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

/**
 * Chiffre un secret sensible (Stripe formation, etc.).
 * Échoue si la clé manque ou si le résultat n’est pas scellé.
 */
export function requireSealToken(value: string, label = "secret"): string {
  if (!isTokenEncryptionEnabled()) {
    throw new Error(`TOKEN_ENCRYPTION_KEY requis pour stocker ${label}`);
  }
  const sealed = sealToken(value);
  if (!sealed || !isSealedToken(sealed)) {
    throw new Error(`Échec du chiffrement ${label}`);
  }
  return sealed;
}

/** Déchiffre. Accepte encore le plaintext legacy (OAuth). */
export function unsealToken(
  value: string | null | undefined
): string | null | undefined {
  if (value == null || value === "") return value;
  if (!value.startsWith(PREFIX)) return value;
  const key = getKey();
  if (!key) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY manquant pour déchiffrer un jeton OAuth"
    );
  }

  const payload = Buffer.from(value.slice(PREFIX.length), "base64url");
  if (payload.length < IV_LENGTH + 16) {
    throw new Error("Jeton OAuth chiffré invalide");
  }
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + 16);
  const data = payload.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  );
}

/**
 * Lit un secret Stripe formation : doit être scellé si la clé est configurée.
 * Refuse le clair sk_ / whsec_ dès que TOKEN_ENCRYPTION_KEY est présent.
 */
export function requireUnsealSecret(stored: string, label = "secret"): string {
  if (
    isTokenEncryptionEnabled() &&
    !isSealedToken(stored) &&
    (stored.startsWith("sk_") ||
      stored.startsWith("whsec_") ||
      stored.startsWith("rk_"))
  ) {
    throw new Error(
      `${label} encore en clair — exécuter npm run seal-org-stripe`
    );
  }
  const plain = unsealToken(stored);
  if (plain == null || plain === "") {
    throw new Error(`${label} illisible`);
  }
  return plain;
}
