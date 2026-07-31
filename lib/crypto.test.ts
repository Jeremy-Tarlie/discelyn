import { describe, expect, it, beforeAll } from "vitest";
import { encryptSecret, decryptSecret, buildBotInviteUrl } from "@/lib/crypto";

beforeAll(() => {
  process.env.BOT_SECRETS_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trip un token Discord", () => {
    const token = "MTIz.fake-discord-bot-token-value";
    const encrypted = encryptSecret(token);
    expect(encrypted.ciphertext).not.toContain(token);
    expect(decryptSecret(encrypted)).toBe(token);
  });

  it("échoue avec un authTag invalide", () => {
    const encrypted = encryptSecret("secret");
    expect(() =>
      decryptSecret({
        ...encrypted,
        authTag: Buffer.alloc(16).toString("base64"),
      })
    ).toThrow();
  });
});

describe("buildBotInviteUrl", () => {
  it("construit une URL Discord valide", () => {
    const url = buildBotInviteUrl("1234567890");
    expect(url).toContain("client_id=1234567890");
    expect(url).toContain("scope=bot");
  });
});
