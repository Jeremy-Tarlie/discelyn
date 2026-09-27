import { describe, expect, it } from "vitest";
import { isActiveRow, notDeleted } from "@/lib/soft-delete";
import { isEmailConfigured } from "@/lib/email";
import { StripeWebhookPermanentIgnore } from "@/lib/stripe-webhook-errors";

describe("soft-delete helpers", () => {
  it("notDeleted filtre deletedAt null", () => {
    expect(notDeleted).toEqual({ deletedAt: null });
  });

  it("isActiveRow", () => {
    expect(isActiveRow({ deletedAt: null })).toBe(true);
    expect(isActiveRow({ deletedAt: new Date() })).toBe(false);
    expect(isActiveRow(null)).toBe(false);
  });
});

describe("StripeWebhookPermanentIgnore", () => {
  it("expose reason pour réponse ignored non-retryable", () => {
    const err = new StripeWebhookPermanentIgnore("org_deleted");
    expect(err.name).toBe("StripeWebhookPermanentIgnore");
    expect(err.reason).toBe("org_deleted");
  });
});

describe("email config", () => {
  it("isEmailConfigured lit l’env", () => {
    const prevKey = process.env.RESEND_API_KEY;
    const prevFrom = process.env.EMAIL_FROM;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    expect(isEmailConfigured()).toBe(false);
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Botly <noreply@example.com>";
    expect(isEmailConfigured()).toBe(true);
    if (prevKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevKey;
    if (prevFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = prevFrom;
  });
});
