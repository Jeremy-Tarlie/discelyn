import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;

function getEncryptionKey(): Buffer {
  const raw = process.env.BOT_SECRETS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("BOT_SECRETS_ENCRYPTION_KEY manquant");
  }

  const key = Buffer.from(raw, "hex");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      "BOT_SECRETS_ENCRYPTION_KEY doit être 64 caractères hex (32 bytes)"
    );
  }
  return key;
}

export type EncryptedSecret = {
  ciphertext: string;
  nonce: string;
  authTag: string;
};

export function encryptSecret(plaintext: string): EncryptedSecret {
  const key = getEncryptionKey();
  const nonce = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    nonce: nonce.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptSecret(payload: EncryptedSecret): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(payload.nonce, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function buildBotInviteUrl(discordAppId: string): string {
  const permissions = "268823632"; // manage roles, kick, ban, messages, embeds, etc.
  const params = new URLSearchParams({
    client_id: discordAppId,
    permissions,
    scope: "bot applications.commands",
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}
