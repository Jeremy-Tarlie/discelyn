import { describe, expect, it } from "vitest";
import { leadSchemaFor } from "@/lib/validation";

describe("leadSchemaFor", () => {
  it("exige contactConsent et n’exige pas marketingConsent", () => {
    const schema = leadSchemaFor("fr");
    const ok = schema.safeParse({
      email: "a@ex.com",
      contactConsent: true,
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.marketingConsent).toBe(false);
    }

    const missingContact = schema.safeParse({
      email: "a@ex.com",
      marketingConsent: true,
    });
    expect(missingContact.success).toBe(false);
  });

  it("accepte marketingConsent optionnel", () => {
    const schema = leadSchemaFor("fr");
    const ok = schema.safeParse({
      email: "a@ex.com",
      contactConsent: true,
      marketingConsent: true,
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.marketingConsent).toBe(true);
    }
  });
});
