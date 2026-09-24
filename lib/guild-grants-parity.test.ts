import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  expandGuildRoleTargets,
  resolveRoleIdForGuild,
} from "@/lib/guild-grants-pure";

describe("guild-grants parity web ↔ runtime", () => {
  it("sources identiques", () => {
    const web = readFileSync(
      join(process.cwd(), "lib/guild-grants-pure.ts"),
      "utf8"
    );
    const runtime = readFileSync(
      join(process.cwd(), "bot-runtime/src/guild-grants.ts"),
      "utf8"
    );
    const strip = (s: string) =>
      s
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "")
        .replace(/\s+/g, " ")
        .trim();
    expect(strip(runtime)).toBe(strip(web));
  });

  it("comportement partagé", () => {
    const grants = [
      { guildId: "a", discordRoleId: "ra" },
      { guildId: "b", discordRoleId: "rb" },
    ];
    expect(
      resolveRoleIdForGuild({
        joinedGuildId: "b",
        primaryGuildId: "a",
        primaryRoleId: "ra",
        grants,
      })
    ).toBe("rb");
    expect(
      expandGuildRoleTargets({
        primaryGuildId: "a",
        primaryRoleId: "ra",
        grants,
      })
    ).toHaveLength(2);
  });
});
