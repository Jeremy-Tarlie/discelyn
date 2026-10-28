import { describe, expect, it } from "vitest";
import { isDiscordInviteUrl, resolveJoinCta } from "@/lib/claim-join-cta";

describe("isDiscordInviteUrl", () => {
  it("accepte discord.gg et discord.com/invite", () => {
    expect(isDiscordInviteUrl("https://discord.gg/abc123")).toBe(true);
    expect(isDiscordInviteUrl("https://discord.com/invite/abc123")).toBe(true);
    expect(isDiscordInviteUrl("https://www.discord.com/invite/xyz")).toBe(true);
  });

  it("refuse hosts / schémas dangereux", () => {
    expect(isDiscordInviteUrl("https://evil.example/phish")).toBe(false);
    expect(isDiscordInviteUrl("http://discord.gg/abc")).toBe(false);
    expect(isDiscordInviteUrl("https://discord.com/oauth2/authorize")).toBe(
      false
    );
    expect(isDiscordInviteUrl("not-a-url")).toBe(false);
  });
});

describe("resolveJoinCta", () => {
  it("retourne l’invite DB si AWAITING_JOIN + allowlist", () => {
    expect(
      resolveJoinCta({
        status: "AWAITING_JOIN",
        inviteUrl: "https://discord.gg/abc123",
      })
    ).toBe("https://discord.gg/abc123");
  });

  it("ignore ACTIVE / PENDING / invite non Discord", () => {
    expect(
      resolveJoinCta({
        status: "ACTIVE",
        inviteUrl: "https://discord.gg/abc123",
      })
    ).toBeNull();
    expect(
      resolveJoinCta({
        status: "PENDING_CLAIM",
        inviteUrl: "https://discord.gg/abc123",
      })
    ).toBeNull();
    expect(
      resolveJoinCta({
        status: "AWAITING_JOIN",
        inviteUrl: "https://evil.example/phish",
      })
    ).toBeNull();
    expect(
      resolveJoinCta({ status: "AWAITING_JOIN", inviteUrl: null })
    ).toBeNull();
    expect(resolveJoinCta(null)).toBeNull();
  });
});
