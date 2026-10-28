import { describe, expect, it, afterEach, vi } from "vitest";
import {
  isLeadsAdmin,
  isLeadsAdminDiscordId,
  isLeadsAdminEmail,
} from "@/lib/leads-admin";

vi.mock("@/lib/demo", () => ({
  getAppEnvironment: vi.fn(() => "development"),
}));

import { getAppEnvironment } from "@/lib/demo";

describe("leads-admin", () => {
  const prevEmail = process.env.LEADS_ADMIN_EMAILS;
  const prevDiscord = process.env.LEADS_ADMIN_DISCORD_IDS;
  const prevPlatformDiscord = process.env.PLATFORM_ADMIN_DISCORD_IDS;
  const prevPlatformEmail = process.env.PLATFORM_ADMIN_EMAILS;

  afterEach(() => {
    if (prevEmail === undefined) delete process.env.LEADS_ADMIN_EMAILS;
    else process.env.LEADS_ADMIN_EMAILS = prevEmail;
    if (prevDiscord === undefined) delete process.env.LEADS_ADMIN_DISCORD_IDS;
    else process.env.LEADS_ADMIN_DISCORD_IDS = prevDiscord;
    if (prevPlatformDiscord === undefined) {
      delete process.env.PLATFORM_ADMIN_DISCORD_IDS;
    } else process.env.PLATFORM_ADMIN_DISCORD_IDS = prevPlatformDiscord;
    if (prevPlatformEmail === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
    else process.env.PLATFORM_ADMIN_EMAILS = prevPlatformEmail;
    vi.mocked(getAppEnvironment).mockReturnValue("development");
  });

  it("refuse si allowlist email vide", () => {
    delete process.env.LEADS_ADMIN_EMAILS;
    delete process.env.LEADS_ADMIN_DISCORD_IDS;
    delete process.env.PLATFORM_ADMIN_EMAILS;
    delete process.env.PLATFORM_ADMIN_DISCORD_IDS;
    expect(isLeadsAdminEmail("a@b.com")).toBe(false);
    expect(isLeadsAdmin({ email: "a@b.com", discordId: "1" })).toBe(false);
  });

  it("accepte un email listé (case-insensitive) hors production sans Discord", () => {
    process.env.LEADS_ADMIN_EMAILS = "Admin@Discelyn.fr, other@x.com";
    delete process.env.LEADS_ADMIN_DISCORD_IDS;
    delete process.env.PLATFORM_ADMIN_DISCORD_IDS;
    expect(isLeadsAdminEmail("admin@discelyn.fr")).toBe(true);
    expect(isLeadsAdminEmail("nope@x.com")).toBe(false);
    expect(isLeadsAdmin({ email: "admin@discelyn.fr", discordId: null })).toBe(
      true,
    );
  });

  it("priorise Discord ID quand la liste est configurée", () => {
    process.env.LEADS_ADMIN_EMAILS = "admin@discelyn.fr";
    process.env.LEADS_ADMIN_DISCORD_IDS = "123456789012345678";
    expect(isLeadsAdminDiscordId("123456789012345678")).toBe(true);
    expect(
      isLeadsAdmin({
        email: "admin@discelyn.fr",
        discordId: "999",
      }),
    ).toBe(false);
    expect(
      isLeadsAdmin({
        email: "nope@x.com",
        discordId: "123456789012345678",
      }),
    ).toBe(true);
  });

  it("en production refuse l’email seul et exige Discord", () => {
    vi.mocked(getAppEnvironment).mockReturnValue("production");
    process.env.PLATFORM_ADMIN_EMAILS = "admin@discelyn.fr";
    delete process.env.PLATFORM_ADMIN_DISCORD_IDS;
    delete process.env.LEADS_ADMIN_DISCORD_IDS;
    expect(
      isLeadsAdmin({ email: "admin@discelyn.fr", discordId: null }),
    ).toBe(false);

    process.env.PLATFORM_ADMIN_DISCORD_IDS = "123456789012345678";
    expect(
      isLeadsAdmin({
        email: "admin@discelyn.fr",
        discordId: "123456789012345678",
      }),
    ).toBe(true);
  });
});
