import { describe, expect, it } from "vitest";
import {
  expandGuildRoleTargets,
  resolveRoleIdForGuild,
} from "./guild-grants.js";

describe("guild-grants (runtime)", () => {
  it("pose le rôle du grant sur la guild jointe (pas seulement le primaire)", () => {
    expect(
      resolveRoleIdForGuild({
        joinedGuildId: "secondary",
        primaryGuildId: "primary",
        primaryRoleId: "role-primary",
        grants: [
          { guildId: "primary", discordRoleId: "role-primary" },
          { guildId: "secondary", discordRoleId: "role-secondary" },
        ],
      })
    ).toBe("role-secondary");
  });

  it("expand conserve tous les grants", () => {
    const grants = [
      { guildId: "g1", discordRoleId: "r1" },
      { guildId: "g2", discordRoleId: "r2" },
    ];
    expect(
      expandGuildRoleTargets({
        primaryGuildId: "g1",
        primaryRoleId: "r1",
        grants,
      })
    ).toEqual(grants);
  });
});
