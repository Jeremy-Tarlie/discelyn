import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePlatformAdmin = vi.fn();
const orgCount = vi.fn();

vi.mock("@/lib/platform-admin", () => ({
  requirePlatformAdmin: (...args: unknown[]) => requirePlatformAdmin(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: {
      count: (...args: unknown[]) => orgCount(...args),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    subscription: { count: vi.fn().mockResolvedValue(0) },
    lead: { count: vi.fn().mockResolvedValue(0) },
    emailEvent: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

describe("admin-customers authz", () => {
  beforeEach(() => {
    requirePlatformAdmin.mockReset();
    orgCount.mockReset().mockResolvedValue(0);
    vi.resetModules();
  });

  it("retourne null sans platform admin", async () => {
    requirePlatformAdmin.mockResolvedValue(null);
    const { getAdminOverviewStats, listAdminCustomers, getAdminCustomerDetail } =
      await import("@/lib/admin-customers");
    expect(await getAdminOverviewStats()).toBeNull();
    expect(await listAdminCustomers()).toBeNull();
    expect(await getAdminCustomerDetail("org1")).toBeNull();
    expect(orgCount).not.toHaveBeenCalled();
  });

  it("charge les stats si admin", async () => {
    requirePlatformAdmin.mockResolvedValue({ id: "u1" });
    const { getAdminOverviewStats } = await import("@/lib/admin-customers");
    const stats = await getAdminOverviewStats();
    expect(stats).not.toBeNull();
    expect(orgCount).toHaveBeenCalled();
  });
});
