import { describe, expect, it } from "vitest";
import { userCanManageGuild } from "@/lib/discord-permissions";
import {
  MODERATION_WARNING_RETENTION_DAYS,
  moderationWarningCutoff,
} from "@/lib/moderation-retention";

describe("userCanManageGuild", () => {
  it("autorise le propriétaire", () => {
    expect(
      userCanManageGuild({ id: "1", owner: true, permissions: "0" })
    ).toBe(true);
  });

  it("autorise Administrator (bit 3)", () => {
    expect(
      userCanManageGuild({ id: "1", owner: false, permissions: "8" })
    ).toBe(true);
  });

  it("autorise Manage Guild (bit 5)", () => {
    expect(
      userCanManageGuild({ id: "1", owner: false, permissions: "32" })
    ).toBe(true);
  });

  it("refuse un membre sans permission", () => {
    expect(
      userCanManageGuild({ id: "1", owner: false, permissions: "1024" })
    ).toBe(false);
  });
});

describe("moderationWarningCutoff", () => {
  it("calcule 90 jours en arrière", () => {
    const now = new Date("2026-09-08T12:00:00.000Z");
    const cutoff = moderationWarningCutoff(now);
    expect(MODERATION_WARNING_RETENTION_DAYS).toBe(90);
    expect(cutoff.toISOString()).toBe("2026-06-10T12:00:00.000Z");
  });
});
