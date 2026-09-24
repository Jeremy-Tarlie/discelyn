import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decideGrantOutcome } from "@/lib/grant-outcome-pure";

describe("grant-outcome parity web ↔ runtime", () => {
  it("sources identiques", () => {
    const web = readFileSync(
      join(process.cwd(), "lib/grant-outcome-pure.ts"),
      "utf8"
    );
    const runtime = readFileSync(
      join(process.cwd(), "bot-runtime/src/grant-outcome.ts"),
      "utf8"
    );
    const strip = (s: string) =>
      s
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "")
        .replace(/\s+/g, " ")
        .trim();
    expect(strip(runtime)).toBe(strip(web));
  });

  it("comportement partagé", () => {
    expect(decideGrantOutcome(["granted", "absent"]).status).toBe(
      "AWAITING_JOIN"
    );
    expect(decideGrantOutcome(["granted", "granted"]).status).toBe("ACTIVE");
  });
});
