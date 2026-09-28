import { describe, expect, it } from "vitest";
import { orgRoleAtLeast } from "@/lib/org-role";

describe("orgRoleAtLeast", () => {
  it("ordonne MEMBER < ADMIN < OWNER", () => {
    expect(orgRoleAtLeast("MEMBER", "MEMBER")).toBe(true);
    expect(orgRoleAtLeast("MEMBER", "ADMIN")).toBe(false);
    expect(orgRoleAtLeast("ADMIN", "MEMBER")).toBe(true);
    expect(orgRoleAtLeast("ADMIN", "OWNER")).toBe(false);
    expect(orgRoleAtLeast("OWNER", "ADMIN")).toBe(true);
    expect(orgRoleAtLeast("OWNER", "OWNER")).toBe(true);
  });
});
