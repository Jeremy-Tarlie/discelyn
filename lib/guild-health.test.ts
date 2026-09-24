import { describe, expect, it } from "vitest";

const ADMINISTRATOR = BigInt(8);
const MANAGE_ROLES = BigInt(268435456);

function hasPerm(perms: bigint, bit: bigint): boolean {
  return (
    (perms & ADMINISTRATOR) === ADMINISTRATOR || (perms & bit) === bit
  );
}

describe("guild health permission bits", () => {
  it("admin implies manage roles", () => {
    expect(hasPerm(ADMINISTRATOR, MANAGE_ROLES)).toBe(true);
  });

  it("manage roles alone is enough", () => {
    expect(hasPerm(MANAGE_ROLES, MANAGE_ROLES)).toBe(true);
  });

  it("send messages alone is not manage roles", () => {
    expect(hasPerm(BigInt(2048), MANAGE_ROLES)).toBe(false);
  });
});
