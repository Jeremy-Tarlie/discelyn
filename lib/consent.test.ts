import { describe, expect, it } from "vitest";
import {
  allowsAffiliate,
  allowsAnalytics,
  allowsSentry,
  consentAllowsOptional,
  isValidVisitorId,
  parseConsent,
  parseConsentPreferences,
  serializeConsent,
  EMPTY_CONSENT,
  FULL_CONSENT,
} from "@/lib/consent";

describe("parseConsentPreferences", () => {
  it("parse necessary / all", () => {
    expect(parseConsentPreferences("necessary")).toEqual(EMPTY_CONSENT);
    expect(parseConsentPreferences("all")).toEqual(FULL_CONSENT);
  });

  it("parse v2 granulaire", () => {
    expect(
      parseConsentPreferences(
        'v2.{"analytics":true,"sentry":false,"affiliate":true}'
      )
    ).toEqual({ analytics: true, sentry: false, affiliate: true });
  });

  it("refuse les valeurs invalides", () => {
    expect(parseConsentPreferences(null)).toBeNull();
    expect(parseConsentPreferences("optional")).toBeNull();
    expect(parseConsentPreferences("v2.not-json")).toBeNull();
  });
});

describe("serializeConsent", () => {
  it("compacte en necessary / all / v2", () => {
    expect(serializeConsent(EMPTY_CONSENT)).toBe("necessary");
    expect(serializeConsent(FULL_CONSENT)).toBe("all");
    expect(
      serializeConsent({ analytics: true, sentry: false, affiliate: false })
    ).toBe('v2.{"analytics":true,"sentry":false,"affiliate":false}');
  });
});

describe("category helpers", () => {
  it("gate par catégorie", () => {
    const prefs = { analytics: true, sentry: false, affiliate: true };
    expect(allowsAnalytics(prefs)).toBe(true);
    expect(allowsSentry(prefs)).toBe(false);
    expect(allowsAffiliate(prefs)).toBe(true);
    expect(consentAllowsOptional(prefs)).toBe(true);
    expect(consentAllowsOptional(EMPTY_CONSENT)).toBe(false);
  });
});

describe("parseConsent (legacy)", () => {
  it("ne retourne necessary/all que pour les extrêmes", () => {
    expect(parseConsent("necessary")).toBe("necessary");
    expect(parseConsent("all")).toBe("all");
    expect(
      parseConsent('v2.{"analytics":true,"sentry":false,"affiliate":false}')
    ).toBeNull();
  });
});

describe("isValidVisitorId", () => {
  it("valide un UUID v4", () => {
    expect(
      isValidVisitorId("550e8400-e29b-41d4-a716-446655440000")
    ).toBe(true);
  });

  it("refuse les chaînes hors UUID", () => {
    expect(isValidVisitorId("not-a-uuid")).toBe(false);
    expect(isValidVisitorId(null)).toBe(false);
  });
});
