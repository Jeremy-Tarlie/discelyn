import { describe, expect, it } from "vitest";
import { pickPinnedAddress } from "@/lib/webhook-url-safety";

describe("pickPinnedAddress", () => {
  it("préfère IPv4", () => {
    expect(pickPinnedAddress(["2001:db8::1", "93.184.216.34"])).toBe(
      "93.184.216.34"
    );
  });

  it("retombe sur IPv6 si seul", () => {
    expect(pickPinnedAddress(["2001:db8::1"])).toBe("2001:db8::1");
  });
});
