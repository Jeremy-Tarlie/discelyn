import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  learnerAccessFindMany,
  accessProductFindMany,
  learnerAccessGroupBy,
  accessProductUpdate,
  fulfillDiscordAccess,
  captureMoneyPathError,
} = vi.hoisted(() => ({
  learnerAccessFindMany: vi.fn(),
  accessProductFindMany: vi.fn(),
  learnerAccessGroupBy: vi.fn(),
  accessProductUpdate: vi.fn(),
  fulfillDiscordAccess: vi.fn(),
  captureMoneyPathError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    learnerAccess: {
      findMany: (...args: unknown[]) => learnerAccessFindMany(...args),
      groupBy: (...args: unknown[]) => learnerAccessGroupBy(...args),
      update: vi.fn(),
    },
    accessProduct: {
      findMany: (...args: unknown[]) => accessProductFindMany(...args),
      update: (...args: unknown[]) => accessProductUpdate(...args),
    },
  },
}));

vi.mock("@/lib/learner-access-fulfill", () => ({
  fulfillDiscordAccess: (...args: unknown[]) => fulfillDiscordAccess(...args),
}));

vi.mock("@/lib/money-path-sentry", () => ({
  captureMoneyPathError: (...args: unknown[]) => captureMoneyPathError(...args),
}));

vi.mock("@/lib/discord-roles", () => ({
  sendUserDm: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  isEmailConfigured: vi.fn().mockReturnValue(false),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/learner-access-events", () => ({
  recordEvent: vi.fn(),
  notifyOutbound: vi.fn(),
}));

describe("retryStuckGrants", () => {
  beforeEach(() => {
    learnerAccessFindMany.mockReset();
    fulfillDiscordAccess.mockReset();
    captureMoneyPathError.mockReset();
    accessProductUpdate.mockReset();
    accessProductFindMany.mockReset();
    learnerAccessGroupBy.mockReset();
    accessProductUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("appelle fulfillDiscordAccess et compte les statuts ACTIVE", async () => {
    learnerAccessFindMany.mockResolvedValue([
      { id: "la-1" },
      { id: "la-2" },
      { id: "la-3" },
    ]);
    fulfillDiscordAccess
      .mockResolvedValueOnce({ status: "ACTIVE" as const })
      .mockResolvedValueOnce({ status: "AWAITING_JOIN" as const })
      .mockRejectedValueOnce(new Error("discord_down"));

    const { retryStuckGrants } = await import("@/lib/learner-access-jobs");
    const fixed = await retryStuckGrants();

    expect(fixed).toBe(1);
    expect(fulfillDiscordAccess).toHaveBeenCalledTimes(3);
    expect(fulfillDiscordAccess).toHaveBeenNthCalledWith(1, "la-1");
    expect(captureMoneyPathError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ accessId: "la-3" })
    );
  });
});

describe("reconcileSeatsUsed", () => {
  beforeEach(() => {
    accessProductFindMany.mockReset();
    learnerAccessGroupBy.mockReset();
    accessProductUpdate.mockReset();
    accessProductUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("corrige seatsUsed divergents et ignore les produits déjà alignés", async () => {
    accessProductFindMany.mockResolvedValue([
      { id: "p-ok", seatsUsed: 2 },
      { id: "p-drift", seatsUsed: 10 },
      { id: "p-empty", seatsUsed: 5 },
    ]);
    learnerAccessGroupBy.mockResolvedValue([
      { accessProductId: "p-ok", _count: { _all: 2 } },
      { accessProductId: "p-drift", _count: { _all: 3 } },
    ]);

    const { reconcileSeatsUsed } = await import("@/lib/learner-access-jobs");
    const fixed = await reconcileSeatsUsed();

    expect(fixed).toBe(2);
    expect(accessProductUpdate).toHaveBeenCalledTimes(2);
    expect(accessProductUpdate).toHaveBeenCalledWith({
      where: { id: "p-drift" },
      data: { seatsUsed: 3 },
    });
    expect(accessProductUpdate).toHaveBeenCalledWith({
      where: { id: "p-empty" },
      data: { seatsUsed: 0 },
    });
    expect(accessProductUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p-ok" } }),
      expect.anything()
    );
  });
});
