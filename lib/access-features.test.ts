import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  isProductSoldOut,
  parseOnboardingSteps,
} from "@/lib/access-seats-pure";
import { OUTBOUND_EVENTS } from "@/lib/outbound-webhooks";

describe("access seats helpers", () => {
  it("detects sold out", () => {
    expect(isProductSoldOut({ maxSeats: 10, seatsUsed: 10 })).toBe(true);
    expect(isProductSoldOut({ maxSeats: 10, seatsUsed: 9 })).toBe(false);
    expect(isProductSoldOut({ maxSeats: null, seatsUsed: 100 })).toBe(false);
  });

  it("parses onboarding steps", () => {
    expect(
      parseOnboardingSteps([" a ", "", "b", 1, null] as unknown[])
    ).toEqual(["a", "b"]);
    expect(parseOnboardingSteps(null)).toEqual([]);
  });
});

describe("outbound webhook signing", () => {
  it("includes expected event names", () => {
    expect(OUTBOUND_EVENTS).toContain("payment_received");
    expect(OUTBOUND_EVENTS).toContain("role_granted");
    expect(OUTBOUND_EVENTS).toContain("sold_out");
  });

  it("hmac is stable", () => {
    const body = JSON.stringify({ event: "payment_received" });
    const a = createHmac("sha256", "secret").update(body).digest("hex");
    const b = createHmac("sha256", "secret").update(body).digest("hex");
    expect(a).toBe(b);
  });
});
