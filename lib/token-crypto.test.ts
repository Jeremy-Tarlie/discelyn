import { afterEach, describe, expect, it } from "vitest";
import {
  isSealedToken,
  isTokenEncryptionEnabled,
  requireSealToken,
  requireUnsealSecret,
  sealToken,
  unsealToken,
} from "@/lib/token-crypto";

describe("token-crypto", () => {
  const prev = process.env.TOKEN_ENCRYPTION_KEY;

  afterEach(() => {
    if (prev === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = prev;
  });

  it("no-op sans clé", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(isTokenEncryptionEnabled()).toBe(false);
    expect(sealToken("plain-token")).toBe("plain-token");
    expect(unsealToken("plain-token")).toBe("plain-token");
  });

  it("chiffre et déchiffre avec une clé", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "test-secret-key-for-oauth";
    expect(isTokenEncryptionEnabled()).toBe(true);
    const sealed = sealToken("discord-access-token");
    expect(sealed).not.toBe("discord-access-token");
    expect(sealed?.startsWith("enc:v1:")).toBe(true);
    expect(unsealToken(sealed)).toBe("discord-access-token");
  });

  it("accepte le plaintext legacy au déchiffrement", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "test-secret-key-for-oauth";
    expect(unsealToken("legacy-plaintext")).toBe("legacy-plaintext");
  });

  it("ne double-chiffre pas", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "test-secret-key-for-oauth";
    const once = sealToken("token");
    expect(sealToken(once)).toBe(once);
  });

  it("requireSealToken refuse sans clé", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => requireSealToken("sk_test_x", "sk_")).toThrow(
      /TOKEN_ENCRYPTION_KEY/
    );
  });

  it("requireSealToken produit enc:v1:", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "test-secret-key-for-oauth";
    const sealed = requireSealToken("sk_test_x", "sk_");
    expect(isSealedToken(sealed)).toBe(true);
    expect(requireUnsealSecret(sealed, "sk_")).toBe("sk_test_x");
  });

  it("requireUnsealSecret refuse sk_ en clair si clé présente", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "test-secret-key-for-oauth";
    expect(() => requireUnsealSecret("sk_live_plain", "sk_")).toThrow(
      /encore en clair/
    );
  });
});
