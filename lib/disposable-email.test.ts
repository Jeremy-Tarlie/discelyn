import { afterEach, describe, expect, it } from "vitest";
import {
  assertEmailAllowedInProduction,
  emailDomainForDisposableCheck,
  isDisposableEmailDomain,
  normalizeEmail,
  stripPlusAlias,
} from "@/lib/disposable-email";

describe("disposable-email", () => {
  const prev = process.env.APP_ENV;

  afterEach(() => {
    if (prev === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prev;
  });

  it("normalise et strip +alias", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
    expect(stripPlusAlias("user+tag@mailinator.com")).toBe(
      "user@mailinator.com"
    );
    expect(emailDomainForDisposableCheck("a+b@Mailinator.com")).toBe(
      "mailinator.com"
    );
  });

  it("détecte un domaine jetable connu", () => {
    expect(isDisposableEmailDomain("x@mailinator.com")).toBe(true);
    expect(isDisposableEmailDomain("x@gmail.com")).toBe(false);
  });

  it("bloque en production uniquement", () => {
    process.env.APP_ENV = "production";
    expect(assertEmailAllowedInProduction("a@mailinator.com").ok).toBe(false);

    process.env.APP_ENV = "development";
    expect(assertEmailAllowedInProduction("a@mailinator.com").ok).toBe(true);
  });
});
