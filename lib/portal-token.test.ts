import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  mintLearnerPortalToken,
  verifyLearnerPortalToken,
} from "@/lib/portal-token";

describe("learner portal token", () => {
  const prev = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-portal-secret-32chars-minimum!!";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = prev;
  });

  it("round-trip mint / verify", () => {
    const token = mintLearnerPortalToken("access_abc");
    expect(token).toBeTruthy();
    expect(verifyLearnerPortalToken(token!)).toBe("access_abc");
  });

  it("refuse token expiré", () => {
    const token = mintLearnerPortalToken("access_abc", Date.now() - 7200_000);
    expect(token).toBeTruthy();
    expect(verifyLearnerPortalToken(token!)).toBeNull();
  });

  it("refuse signature altérée", () => {
    const token = mintLearnerPortalToken("access_abc");
    expect(token).toBeTruthy();
    const bad = `${token!.slice(0, -4)}xxxx`;
    expect(verifyLearnerPortalToken(bad)).toBeNull();
  });
});
