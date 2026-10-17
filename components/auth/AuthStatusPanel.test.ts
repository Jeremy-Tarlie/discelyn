import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("AuthStatusPanel", () => {
  const src = readFileSync(
    join(process.cwd(), "components/auth/AuthStatusPanel.tsx"),
    "utf8",
  );

  it("expose un h1 focusable pour les états status", () => {
    expect(src).toMatch(/<h1[\s\S]*?tabIndex=\{-1\}/);
    expect(src).not.toMatch(/<h2\b/);
  });

  it("annonce success via status et error via alert", () => {
    expect(src).toMatch(/role=\{isSuccess \? "status" : "alert"\}/);
  });

  it("place le CTA hors de la région live (après le bloc role)", () => {
    const roleBlockEnd = src.indexOf("</div>", src.indexOf('role={isSuccess'));
    const linkIndex = src.indexOf("<Link");
    expect(roleBlockEnd).toBeGreaterThan(-1);
    expect(linkIndex).toBeGreaterThan(roleBlockEnd);
  });
});

describe("ForgotPasswordClient loading", () => {
  it("libère loading dans finally après fetch", () => {
    const src = readFileSync(
      join(process.cwd(), "components/auth/ForgotPasswordClient.tsx"),
      "utf8",
    );
    expect(src).toMatch(/finally\s*\{\s*setLoading\(false\)/);
    expect(src).toMatch(/setDone\(true\)/);
  });
});
