import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("SignupWizard", () => {
  const src = readFileSync(
    join(process.cwd(), "components/auth/SignupWizard.tsx"),
    "utf8",
  );

  it("enchaîne les étapes plan → account → verify", () => {
    expect(src).toMatch(/type SignupStep = "plan" \| "account" \| "verify"/);
    expect(src).toMatch(/const STEPS: SignupStep\[] = \["plan", "account"\]/);
    expect(src).toMatch(/setStep\("account"\)/);
    expect(src).toMatch(/setStep\("verify"\)/);
  });

  it("expose un stepper avec aria-current", () => {
    expect(src).toMatch(/aria-current=\{active \? "step" : undefined\}/);
    expect(src).toMatch(/aria-label=\{t\("stepsLabel"\)\}/);
  });

  it("conserve Discord + register email sans changer les endpoints", () => {
    expect(src).toMatch(/\/api\/auth\/register/);
    expect(src).toMatch(/discordCallbackForSignupPlan/);
    expect(src).toMatch(/signIn\("discord"/);
  });
});
