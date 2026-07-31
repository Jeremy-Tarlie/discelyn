import { createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

export function decryptSecret(input: {
  ciphertext: string;
  nonce: string;
  authTag: string;
  keyHex: string;
}): string {
  const key = Buffer.from(input.keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("BOT_SECRETS_ENCRYPTION_KEY invalide");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(input.nonce, "base64")
  );
  decipher.setAuthTag(Buffer.from(input.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
