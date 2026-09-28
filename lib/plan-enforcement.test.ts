import { describe, expect, it } from "vitest";

/**
 * Spec de comportement pour la reprise PAUSED (couverte aussi côté runtime
 * par suppression du `continue` sur status PAUSED).
 * Ici on documente la règle métier testable sans Prisma.
 */
function shouldResumePausedBot(input: {
  status: string;
  guildId: string | null;
  index: number;
  maxGuilds: number;
}): boolean {
  return (
    input.status === "PAUSED" &&
    input.guildId !== null &&
    input.index < input.maxGuilds
  );
}

describe("plan enforcement resume rule", () => {
  it("reprend un bot PAUSED encore lié et dans le quota", () => {
    expect(
      shouldResumePausedBot({
        status: "PAUSED",
        guildId: "guild-1",
        index: 0,
        maxGuilds: 1,
      })
    ).toBe(true);
  });

  it("ne reprend pas un bot délié (limite maxGuilds)", () => {
    expect(
      shouldResumePausedBot({
        status: "PAUSED",
        guildId: null,
        index: 0,
        maxGuilds: 1,
      })
    ).toBe(false);
  });

  it("ne reprend pas un bot hors quota", () => {
    expect(
      shouldResumePausedBot({
        status: "PAUSED",
        guildId: "guild-1",
        index: 1,
        maxGuilds: 1,
      })
    ).toBe(false);
  });
});
