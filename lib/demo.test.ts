import { describe, expect, it, afterEach } from "vitest";
import {
  assertStripeKeyAllowedForEnvironment,
  getAppEnvironment,
  isNonProductionEnvironment,
} from "@/lib/demo";

describe("APP_ENV", () => {
  const prevApp = process.env.APP_ENV;
  const prevDemo = process.env.DEMO_MODE;
  const prevAllowTest = process.env.ALLOW_STRIPE_TEST_IN_PROD;

  afterEach(() => {
    if (prevApp === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prevApp;
    if (prevDemo === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = prevDemo;
    if (prevAllowTest === undefined) delete process.env.ALLOW_STRIPE_TEST_IN_PROD;
    else process.env.ALLOW_STRIPE_TEST_IN_PROD = prevAllowTest;
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

  it("autorise sk_live_ en production et refuse sk_test_ par défaut", () => {
    process.env.APP_ENV = "production";
    delete process.env.ALLOW_STRIPE_TEST_IN_PROD;
    expect(() =>
      assertStripeKeyAllowedForEnvironment("sk_live_x")
    ).not.toThrow();
    expect(() =>
      assertStripeKeyAllowedForEnvironment("sk_test_x")
    ).toThrow(/sk_test_/);
  });

  it("autorise sk_test_ en prod seulement avec ALLOW_STRIPE_TEST_IN_PROD=1", () => {
    process.env.APP_ENV = "production";
    process.env.ALLOW_STRIPE_TEST_IN_PROD = "1";
    expect(() =>
      assertStripeKeyAllowedForEnvironment("sk_test_x")
    ).not.toThrow();
  });
});
