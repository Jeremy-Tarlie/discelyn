import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";

describe("getLegalEntity", () => {
  const keys = [
    "NEXT_PUBLIC_LEGAL_ENTITY_NAME",
    "NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS",
    "NEXT_PUBLIC_LEGAL_ENTITY_COUNTRY",
    "NEXT_PUBLIC_SUPPORT_EMAIL",
    "NEXT_PUBLIC_HOSTING_PROVIDER",
    "NEXT_PUBLIC_HOSTING_REGION",
  ] as const;
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) prev[key] = process.env[key];
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of keys) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  });

  it("lit les variables publiques", async () => {
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME = "SARL Test";
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS = "1 rue Test";
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_COUNTRY = "FR";
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "a@b.c";
    process.env.NEXT_PUBLIC_HOSTING_PROVIDER = "OVH";
    process.env.NEXT_PUBLIC_HOSTING_REGION = "EU";

    const { getLegalEntity, legalEntityConfigured } = await import(
      "@/lib/legal-entity"
    );
    const entity = getLegalEntity();
    expect(entity.name).toBe("SARL Test");
    expect(legalEntityConfigured(entity)).toBe(true);
  });
});
