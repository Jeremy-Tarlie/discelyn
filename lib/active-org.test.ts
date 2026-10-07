import { describe, expect, it } from "vitest";
import { pickActiveMembership } from "@/lib/active-org";

describe("pickActiveMembership", () => {
  const rows = [
    { organizationId: "a", role: "MEMBER" as const },
    { organizationId: "b", role: "OWNER" as const },
    { organizationId: "c", role: "ADMIN" as const },
  ];

  it("préfère l’org demandée si membership valide", () => {
    expect(pickActiveMembership(rows, "c")?.organizationId).toBe("c");
  });

  it("ignore une préférence invalide et prend OWNER", () => {
    expect(pickActiveMembership(rows, "ghost")?.organizationId).toBe("b");
  });

  it("sans OWNER prend la première", () => {
    const members = [
      { organizationId: "x", role: "MEMBER" as const },
      { organizationId: "y", role: "ADMIN" as const },
    ];
    expect(pickActiveMembership(members, null)?.organizationId).toBe("x");
  });

  it("liste vide → null", () => {
    expect(pickActiveMembership([], "a")).toBeNull();
  });
});
