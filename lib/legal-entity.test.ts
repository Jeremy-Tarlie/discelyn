import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";

describe("getLegalEntity", () => {
  const keys = [
    "NEXT_PUBLIC_LEGAL_ENTITY_NAME",
    "NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS",
    "NEXT_PUBLIC_LEGAL_ENTITY_COUNTRY",
    "NEXT_PUBLIC_LEGAL_ENTITY_SIRET",
    "NEXT_PUBLIC_SUPPORT_EMAIL",
    "NEXT_PUBLIC_HOSTING_PROVIDER",
    "NEXT_PUBLIC_HOSTING_REGION",
  ] as const;
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) prev[key] = process.env[key];
    for (const key of keys) delete process.env[key];
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of keys) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  });

  it("lit les variables publiques et valide la config complète", async () => {
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME = "SARL Test";
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS = "1 rue Test";
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_COUNTRY = "FR";
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_SIRET = "12345678900012";
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "a@b.c";
    process.env.NEXT_PUBLIC_HOSTING_PROVIDER = "OVH";
    process.env.NEXT_PUBLIC_HOSTING_REGION = "EU";

    const {
      getLegalEntity,
      getConfiguredLegalEntity,
      legalEntityConfigured,
      missingLegalEnvVars,
      assertLegalEnv,
    } = await import("@/lib/legal-entity");
    const entity = getLegalEntity();
    expect(entity.name).toBe("SARL Test");
    expect(entity.siret).toBe("12345678900012");
    expect(legalEntityConfigured(entity)).toBe(true);
    expect(getConfiguredLegalEntity()?.supportEmail).toBe("a@b.c");
    expect(missingLegalEnvVars()).toEqual([]);
    expect(() => assertLegalEnv()).not.toThrow();
  });

  it("refuse une identité partielle (hébergeur manquant)", async () => {
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME = "SARL Test";
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS = "1 rue Test";
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_COUNTRY = "FR";
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "a@b.c";

    const {
      legalEntityConfigured,
      getConfiguredLegalEntity,
      missingLegalEnvVars,
      assertLegalEnv,
    } = await import("@/lib/legal-entity");
    expect(legalEntityConfigured()).toBe(false);
    expect(getConfiguredLegalEntity()).toBeNull();
    expect(missingLegalEnvVars()).toEqual(
      expect.arrayContaining([
        "NEXT_PUBLIC_HOSTING_PROVIDER",
        "NEXT_PUBLIC_HOSTING_REGION",
      ])
    );
    expect(() => assertLegalEnv()).toThrow(/Identité légale incomplète/);
  });
});
