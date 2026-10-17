import { describe, expect, it } from "vitest";
import {
  ARGON2_OPTIONS,
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
  verifyPasswordOrDummy,
} from "@/lib/password";

describe("password hash", () => {
  it("exporte des options argon2id figées", () => {
    expect(ARGON2_OPTIONS).toEqual({
      type: expect.any(Number),
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  });

  it("hash produit encode m=65536,t=3,p=4", async () => {
    const hash = await hashPassword("Correct-horse1!");
    expect(hash).toMatch(/\$argon2id\$v=19\$m=65536,p=4,t=3\$/);
  });

  it("DUMMY_PASSWORD_HASH aligne les mêmes paramètres", () => {
    expect(DUMMY_PASSWORD_HASH).toMatch(
      /^\$argon2id\$v=19\$m=65536,p=4,t=3\$/
    );
  });

  it("hash ≠ plain et verify OK/KO", async () => {
    const plain = "Correct-horse1!";
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    expect(await verifyPassword(hash, plain)).toBe(true);
    expect(await verifyPassword(hash, "wrong-password!!")).toBe(false);
  });

  it("verifyPasswordOrDummy sans hash retourne false après travail CPU", async () => {
    const started = Date.now();
    const ok = await verifyPasswordOrDummy(null, "any-password-12!");
    expect(ok).toBe(false);
    // argon2id dummy : au moins quelques dizaines de ms (pas un early-return)
    expect(Date.now() - started).toBeGreaterThan(20);
  });
});
