import { describe, expect, it } from "vitest";
import {
  buildOtpAuthUrl,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyRecoveryCode,
  verifyTotpCode,
} from "@/lib/totp";
import { createHmac } from "node:crypto";

function hotpForTest(secretBase32: string, counter: number): string {
  // Mirror production via verifying round-trip with current window.
  // Generate by calling verify against a freshly computed code using the same algo.
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = secretBase32.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const idx = alphabet.indexOf(char);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const key = Buffer.from(bytes);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return (binary % 1_000_000).toString().padStart(6, "0");
}

describe("totp", () => {
  it("generates base32 secret and otpauth url", () => {
    const secret = generateTotpSecret();
    expect(secret.length).toBeGreaterThan(10);
    const url = buildOtpAuthUrl({
      secret,
      accountName: "user@example.com",
    });
    expect(url.startsWith("otpauth://totp/")).toBe(true);
    expect(url).toContain(secret);
  });

  it("verifies a current TOTP code", () => {
    const secret = generateTotpSecret();
    const counter = Math.floor(Date.now() / 1000 / 30);
    const code = hotpForTest(secret, counter);
    expect(verifyTotpCode(secret, code)).toBe(true);
    expect(verifyTotpCode(secret, "000000")).toBe(false);
  });

  it("consumes recovery codes once", () => {
    const codes = generateRecoveryCodes(3);
    const hashes = codes.map(hashRecoveryCode);
    const first = verifyRecoveryCode(codes[0]!, JSON.stringify(hashes));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = verifyRecoveryCode(
      codes[0]!,
      JSON.stringify(first.remainingHashes)
    );
    expect(second.ok).toBe(false);
  });
});
