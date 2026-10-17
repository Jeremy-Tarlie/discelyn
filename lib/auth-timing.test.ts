import { describe, expect, it } from "vitest";
import { withOpaqueTimingFloor } from "@/lib/auth-timing";

describe("withOpaqueTimingFloor", () => {
  it("pad jusqu’au plancher si work est rapide", async () => {
    const started = Date.now();
    const result = await withOpaqueTimingFloor(async () => "ok", 80);
    expect(result).toBe("ok");
    expect(Date.now() - started).toBeGreaterThanOrEqual(75);
  });

  it("ne raccourcit pas si work dépasse le plancher", async () => {
    const started = Date.now();
    const result = await withOpaqueTimingFloor(async () => {
      await new Promise((r) => setTimeout(r, 40));
      return 1;
    }, 10);
    expect(result).toBe(1);
    expect(Date.now() - started).toBeGreaterThanOrEqual(35);
  });
});
