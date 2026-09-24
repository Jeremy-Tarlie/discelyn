import { describe, expect, it, afterEach } from "vitest";
import {
  isLeadsAdmin,
  isLeadsAdminDiscordId,
  isLeadsAdminEmail,
} from "@/lib/leads-admin";

describe("leads-admin", () => {
  const prevEmail = process.env.LEADS_ADMIN_EMAILS;
  const prevDiscord = process.env.LEADS_ADMIN_DISCORD_IDS;

  afterEach(() => {
    if (prevEmail === undefined) delete process.env.LEADS_ADMIN_EMAILS;
    else process.env.LEADS_ADMIN_EMAILS = prevEmail;
    if (prevDiscord === undefined) delete process.env.LEADS_ADMIN_DISCORD_IDS;
    else process.env.LEADS_ADMIN_DISCORD_IDS = prevDiscord;
  });

  it("refuse si allowlist email vide", () => {
    delete process.env.LEADS_ADMIN_EMAILS;
    delete process.env.LEADS_ADMIN_DISCORD_IDS;
    expect(isLeadsAdminEmail("a@b.com")).toBe(false);
    expect(isLeadsAdmin({ email: "a@b.com", discordId: "1" })).toBe(false);
  });

  it("accepte un email listé (case-insensitive) sans liste Discord", () => {
    process.env.LEADS_ADMIN_EMAILS = "Admin@Botly.fr, other@x.com";
    delete process.env.LEADS_ADMIN_DISCORD_IDS;
    expect(isLeadsAdminEmail("admin@botly.fr")).toBe(true);
    expect(isLeadsAdminEmail("nope@x.com")).toBe(false);
    expect(isLeadsAdmin({ email: "admin@botly.fr", discordId: null })).toBe(
      true
    );
  });

  it("priorise Discord ID quand la liste est configurée", () => {
    process.env.LEADS_ADMIN_EMAILS = "admin@botly.fr";
    process.env.LEADS_ADMIN_DISCORD_IDS = "123456789012345678";
    expect(isLeadsAdminDiscordId("123456789012345678")).toBe(true);
    expect(
      isLeadsAdmin({
        email: "admin@botly.fr",
        discordId: "999",
      })
    ).toBe(false);
    expect(
      isLeadsAdmin({
        email: "nope@x.com",
        discordId: "123456789012345678",
      })
    ).toBe(true);
  });
});
