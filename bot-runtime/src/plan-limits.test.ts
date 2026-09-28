import { describe, expect, it } from "vitest";
import {
  filterModulesForLimits,
  resolvePlanLimits,
  trimCustomCommands,
  RUNTIME_PLAN_LIMITS,
} from "./plan-limits";

describe("resolvePlanLimits", () => {
  it("pousse FREE avec le socle ops + 5 commandes", () => {
    expect([...resolvePlanLimits("FREE").modules]).toEqual([
      "welcome",
      "roles",
      "moderation",
      "logs",
      "tickets",
      "custom_commands",
    ]);
    expect(resolvePlanLimits("FREE").maxCustomCommands).toBe(5);
    expect(resolvePlanLimits("FREE").maxGuilds).toBe(1);
  });

  it("SCALE autorise 5 guilds", () => {
    expect(resolvePlanLimits("SCALE").maxGuilds).toBe(5);
  });

  it("fallback FREE pour plan inconnu", () => {
    expect(resolvePlanLimits("NOPE")).toEqual(RUNTIME_PLAN_LIMITS.FREE);
  });
});

describe("filterModulesForLimits", () => {
  it("filtre les modules hors plan", () => {
    const limits = resolvePlanLimits("FREE");
    expect(
      filterModulesForLimits(limits, [
        "welcome",
        "moderation",
        "tickets",
        "roles",
        "automod",
      ])
    ).toEqual(["welcome", "moderation", "tickets", "roles"]);
  });
});

describe("trimCustomCommands", () => {
  it("coupe au plafond FREE", () => {
    const limits = resolvePlanLimits("FREE");
    const cmds = Array.from({ length: 8 }, (_, i) => ({
      name: String(i),
      response: "x",
    }));
    expect(trimCustomCommands(limits, cmds)).toHaveLength(5);
  });

  it("coupe au plafond Ops", () => {
    const limits = resolvePlanLimits("OPS");
    const cmds = Array.from({ length: 50 }, (_, i) => ({
      name: String(i),
      response: "x",
    }));
    expect(trimCustomCommands(limits, cmds)).toHaveLength(40);
  });
});
