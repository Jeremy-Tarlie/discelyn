import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AuthPageShell is imported by Client Components. It must never pull
 * next/headers (or SiteHeader → getRequestTheme) into the client graph.
 */
describe("AuthPageShell client boundary", () => {
  it("n'importe pas next/headers ni SiteHeader", () => {
    const src = readFileSync(
      join(process.cwd(), "components/auth/AuthPageShell.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/next\/headers/);
    expect(src).not.toMatch(/SiteHeader/);
    expect(src).not.toMatch(/SiteFooter/);
    expect(src).not.toMatch(/getRequestTheme/);
    expect(src).not.toMatch(/@\/lib\/theme/);
  });
});
