import { afterEach, describe, expect, it } from "vitest";
import { isLeadsAdmin } from "@/lib/leads-admin";
import { isPlatformAdmin } from "@/lib/platform-admin";

describe("platform admin allowlist", () => {
  const prev = {
    PLATFORM_ADMIN_DISCORD_IDS: process.env.PLATFORM_ADMIN_DISCORD_IDS,
    PLATFORM_ADMIN_EMAILS: process.env.PLATFORM_ADMIN_EMAILS,
    LEADS_ADMIN_DISCORD_IDS: process.env.LEADS_ADMIN_DISCORD_IDS,
    LEADS_ADMIN_EMAILS: process.env.LEADS_ADMIN_EMAILS,
  };

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("accepte PLATFORM_ADMIN_DISCORD_IDS", () => {
    process.env.PLATFORM_ADMIN_DISCORD_IDS = "999";
    delete process.env.LEADS_ADMIN_DISCORD_IDS;
    delete process.env.PLATFORM_ADMIN_EMAILS;
    delete process.env.LEADS_ADMIN_EMAILS;
    expect(isPlatformAdmin({ discordId: "999", email: "x@y.z" })).toBe(true);
    expect(isPlatformAdmin({ discordId: "111", email: "x@y.z" })).toBe(false);
  });

  it("retombe sur LEADS_ADMIN si PLATFORM vide", () => {
    delete process.env.PLATFORM_ADMIN_DISCORD_IDS;
    delete process.env.PLATFORM_ADMIN_EMAILS;
    process.env.LEADS_ADMIN_DISCORD_IDS = "111";
    expect(isLeadsAdmin({ discordId: "111" })).toBe(true);
    expect(isPlatformAdmin({ discordId: "111" })).toBe(true);
  });
});
