import { describe, expect, it } from "vitest";
import { buildPlatformInviteUrl } from "@/lib/invite";

describe("buildPlatformInviteUrl", () => {
  it("inclut client_id et scope bot uniquement", () => {
    const url = buildPlatformInviteUrl("987654321098765432");
    expect(url).toContain("client_id=987654321098765432");
    expect(url).toContain("scope=bot");
    expect(url).not.toContain("applications.commands");
  });

  it("pré-sélectionne le serveur quand guildId est fourni", () => {
    const url = buildPlatformInviteUrl("987654321098765432", {
      guildId: "111222333444555666",
    });
    expect(url).toContain("guild_id=111222333444555666");
    expect(url).toContain("disable_guild_select=true");
  });

  it("inclut ChangeNickname pour le pseudo serveur", () => {
    const url = buildPlatformInviteUrl("987654321098765432");
    expect(url).toContain("permissions=335932496");
  });
});
