import { describe, expect, it } from "vitest";
import { PLANS, type PlanId } from "@/lib/plans";
import {
  MODERATION_WARNING_RETENTION_DAYS as WEB_RETENTION,
  moderationWarningCutoff as webCutoff,
} from "@/lib/moderation-retention";
import {
  RUNTIME_PLAN_LIMITS,
  type RuntimePlanId,
} from "../bot-runtime/src/plan-limits";
import {
  MODERATION_WARNING_RETENTION_DAYS as RUNTIME_RETENTION,
  moderationWarningCutoff as runtimeCutoff,
} from "../bot-runtime/src/moderation-retention";

const PLAN_IDS = Object.keys(PLANS) as PlanId[];

describe("parité plans web ↔ runtime", () => {
  it("aligne maxGuilds, forceBranding, modules, maxCustomCommands", () => {
    for (const planId of PLAN_IDS) {
      const web = PLANS[planId];
      const runtime = RUNTIME_PLAN_LIMITS[planId as RuntimePlanId];
      expect(web.maxGuilds).toBe(runtime.maxGuilds);
      expect(web.maxBots).toBe(runtime.maxGuilds);
      expect(web.forceBranding).toBe(runtime.forceBranding);
      expect(web.maxCustomCommands).toBe(runtime.maxCustomCommands);
      expect([...web.modules].sort()).toEqual([...runtime.modules].sort());
    }
  });
});

describe("parité rétention warns", () => {
  it("utilise la même durée et le même cutoff", () => {
    expect(WEB_RETENTION).toBe(RUNTIME_RETENTION);
    const now = new Date("2026-09-09T12:00:00.000Z");
    expect(webCutoff(now).toISOString()).toBe(runtimeCutoff(now).toISOString());
  });
});
