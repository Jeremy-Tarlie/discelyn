import {
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function equalDigits(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function equalHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength));
}

export function buildOtpAuthUrl(input: {
  secret: string;
  accountName: string;
  issuer?: string;
}): string {
  const issuer = input.issuer ?? "Discelyn";
  const label = encodeURIComponent(`${issuer}:${input.accountName}`);
  const params = new URLSearchParams({
    secret: input.secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function verifyTotpCode(
  secretBase32: string,
  code: string,
  window = 1
): boolean {
  const normalized = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;

  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = hotp(secretBase32, counter + offset);
    if (equalDigits(expected, normalized)) return true;
  }
  return false;
}

export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    codes.push(randomBytes(4).toString("hex"));
  }
  return codes;
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256")
    .update(code.trim().toLowerCase(), "utf8")
    .digest("hex");
}

export function verifyRecoveryCode(
  code: string,
  hashesJson: string | null | undefined
): { ok: true; remainingHashes: string[] } | { ok: false } {
  if (!hashesJson) return { ok: false };
  let hashes: string[];
  try {
    const parsed: unknown = JSON.parse(hashesJson);
    if (!Array.isArray(parsed) || !parsed.every((h) => typeof h === "string")) {
      return { ok: false };
    }
    hashes = parsed;
  } catch {
    return { ok: false };
  }

  const candidate = hashRecoveryCode(code);
  const index = hashes.findIndex((hash) => equalHex(hash, candidate));
  if (index < 0) return { ok: false };
  const remainingHashes = hashes.filter((_, i) => i !== index);
  return { ok: true, remainingHashes };
}

function hotp(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  const otp = binary % 1_000_000;
  return otp.toString().padStart(6, "0");
}

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/g, "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx < 0) throw new Error("secret TOTP invalide");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
