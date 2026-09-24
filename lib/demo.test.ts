import { describe, expect, it, afterEach } from "vitest";
import {
  assertStripeKeyAllowedForEnvironment,
  getAppEnvironment,
  isNonProductionEnvironment,
} from "@/lib/demo";

describe("APP_ENV", () => {
  const prevApp = process.env.APP_ENV;
  const prevDemo = process.env.DEMO_MODE;
  const prevStrict = process.env.STRICT_STRIPE_LIVE;

  afterEach(() => {
    if (prevApp === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prevApp;
    if (prevDemo === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = prevDemo;
    if (prevStrict === undefined) delete process.env.STRICT_STRIPE_LIVE;
    else process.env.STRICT_STRIPE_LIVE = prevStrict;
  });

  it("refuse sk_live_ en staging", () => {
    process.env.APP_ENV = "staging";
    expect(getAppEnvironment()).toBe("staging");
    expect(isNonProductionEnvironment()).toBe(true);
    expect(() =>
      assertStripeKeyAllowedForEnvironment("sk_live_x")
    ).toThrow(/sk_live_/);
    expect(() =>
      assertStripeKeyAllowedForEnvironment("sk_test_x")
    ).not.toThrow();
  });

  it("autorise sk_live_ en production", () => {
    process.env.APP_ENV = "production";
    expect(() =>
      assertStripeKeyAllowedForEnvironment("sk_live_x")
    ).not.toThrow();
  });
});
