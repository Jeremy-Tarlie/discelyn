import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashAccessCode } from "@/lib/access-code-crypto";

const {
  accessCodeFindUnique,
  transaction,
  isProductSoldOut,
  tryReserveSeat,
  releaseSeat,
  syncPaymentLinkAvailability,
  recordEvent,
  fulfillDiscordAccess,
  newClaimToken,
} = vi.hoisted(() => ({
  accessCodeFindUnique: vi.fn(),
  transaction: vi.fn(),
  isProductSoldOut: vi.fn(),
  tryReserveSeat: vi.fn(),
  releaseSeat: vi.fn(),
  syncPaymentLinkAvailability: vi.fn(),
  recordEvent: vi.fn(),
  fulfillDiscordAccess: vi.fn(),
  newClaimToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accessCode: { findUnique: (...args: unknown[]) => accessCodeFindUnique(...args) },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock("@/lib/access-seats", () => ({
  isProductSoldOut: (...args: unknown[]) => isProductSoldOut(...args),
  tryReserveSeat: (...args: unknown[]) => tryReserveSeat(...args),
  releaseSeat: (...args: unknown[]) => releaseSeat(...args),
}));

vi.mock("@/lib/access-payment-link", () => ({
  syncPaymentLinkAvailability: (...args: unknown[]) =>
    syncPaymentLinkAvailability(...args),
}));

vi.mock("@/lib/learner-access-events", () => ({
  recordEvent: (...args: unknown[]) => recordEvent(...args),
  notifyOutbound: vi.fn(),
}));

vi.mock("@/lib/learner-access-fulfill", () => ({
  fulfillDiscordAccess: (...args: unknown[]) => fulfillDiscordAccess(...args),
}));

vi.mock("@/lib/access-tokens", () => ({
  newClaimToken: (...args: unknown[]) => newClaimToken(...args),
  CLAIM_TTL_MS: 86_400_000,
}));

type CodeRow = {
  id: string;
  active: boolean;
  expiresAt: Date | null;
  redemptions: number;
  maxRedemptions: number;
  product: {
    id: string;
    active: boolean;
    botId: string;
    maxSeats: number | null;
    seatsUsed: number;
    bot: { id: string; guildId: string | null; organizationId: string };
  };
};

function baseCodeRow(overrides: Partial<CodeRow> = {}): CodeRow {
  return {
    id: "code-1",
    active: true,
    expiresAt: null,
    redemptions: 0,
    maxRedemptions: 10,
    product: {
      id: "prod-1",
      active: true,
      botId: "bot-1",
      maxSeats: null,
      seatsUsed: 0,
      bot: { id: "bot-1", guildId: "guild-1", organizationId: "org-1" },
    },
    ...overrides,
  };
}

const PLAIN_CODE = "ABCD1234EFGH5678";

describe("openLearnerAccessFromCode", () => {
  beforeEach(() => {
    accessCodeFindUnique.mockReset();
    transaction.mockReset();
    isProductSoldOut.mockReset();
    tryReserveSeat.mockReset();
    releaseSeat.mockReset();
    syncPaymentLinkAvailability.mockReset();
    recordEvent.mockReset();
    fulfillDiscordAccess.mockReset();
    newClaimToken.mockReturnValue("claim-token-test12");
    isProductSoldOut.mockReturnValue(false);
    syncPaymentLinkAvailability.mockResolvedValue(undefined);
    recordEvent.mockResolvedValue(undefined);
    fulfillDiscordAccess.mockResolvedValue({ status: "ACTIVE" as const });
  });

  afterEach(() => {
    vi.resetModules();
  });

  async function importOpen() {
    const { openLearnerAccessFromCode } = await import("@/lib/learner-access-open");
    return openLearnerAccessFromCode;
  }

  it("retourne invalid_code si code inconnu ou inactif", async () => {
    accessCodeFindUnique.mockResolvedValue(null);
    const open = await importOpen();
    let result = await open({ code: PLAIN_CODE });
    expect(result).toEqual({ ok: false, error: "invalid_code" });

    accessCodeFindUnique.mockResolvedValue(baseCodeRow({ active: false }));
    result = await open({ code: PLAIN_CODE });
    expect(result).toEqual({ ok: false, error: "invalid_code" });
    expect(accessCodeFindUnique).toHaveBeenCalledWith({
      where: { codeHash: hashAccessCode(PLAIN_CODE) },
      include: expect.objectContaining({ product: expect.any(Object) }),
    });
  });

  it("retourne code_expired si expiresAt est passé", async () => {
    accessCodeFindUnique.mockResolvedValue(
      baseCodeRow({ expiresAt: new Date("2020-01-01T00:00:00.000Z") })
    );
    const open = await importOpen();
    const result = await open({ code: PLAIN_CODE });
    expect(result).toEqual({ ok: false, error: "code_expired" });
  });

  it("retourne code_exhausted si redemptions >= maxRedemptions", async () => {
    accessCodeFindUnique.mockResolvedValue(
      baseCodeRow({ redemptions: 10, maxRedemptions: 10 })
    );
    const open = await importOpen();
    const result = await open({ code: PLAIN_CODE });
    expect(result).toEqual({ ok: false, error: "code_exhausted" });
  });

  it("retourne sold_out si le produit est complet (avant transaction)", async () => {
    accessCodeFindUnique.mockResolvedValue(baseCodeRow());
    isProductSoldOut.mockReturnValue(true);
    const open = await importOpen();
    const result = await open({ code: PLAIN_CODE });
    expect(result).toEqual({ ok: false, error: "sold_out" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("retourne sold_out si la réservation de siège échoue en transaction", async () => {
    accessCodeFindUnique.mockResolvedValue(baseCodeRow());
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<string>) => {
      tryReserveSeat.mockResolvedValue(false);
      const tx = {
        accessCode: { updateMany: vi.fn() },
        learnerAccess: { create: vi.fn() },
      };
      return fn(tx);
    });
    const open = await importOpen();
    const result = await open({ code: PLAIN_CODE });
    expect(result).toEqual({ ok: false, error: "sold_out" });
  });

  it("crée un accès PENDING_CLAIM et enregistre l’événement en succès", async () => {
    accessCodeFindUnique.mockResolvedValue(baseCodeRow());
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue({ id: "access-new-1" });
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<string>) => {
      tryReserveSeat.mockResolvedValue(true);
      const tx = {
        accessCode: { updateMany },
        learnerAccess: { create },
      };
      return fn(tx);
    });

    const open = await importOpen();
    const result = await open({ code: PLAIN_CODE });

    expect(result).toEqual({
      ok: true,
      accessId: "access-new-1",
      claimToken: "claim-token-test12",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING_CLAIM",
          source: "ACCESS_CODE",
          guildId: "guild-1",
          claimToken: "claim-token-test12",
          discordUserId: null,
        }),
      })
    );
    expect(recordEvent).toHaveBeenCalledWith("access-new-1", "code_redeemed", {
      codeId: "code-1",
    });
    expect(syncPaymentLinkAvailability).toHaveBeenCalledWith("prod-1");
    expect(fulfillDiscordAccess).not.toHaveBeenCalled();
  });

  it("appelle fulfillDiscordAccess si discordUserId est fourni", async () => {
    accessCodeFindUnique.mockResolvedValue(baseCodeRow());
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<string>) => {
      tryReserveSeat.mockResolvedValue(true);
      const tx = {
        accessCode: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        learnerAccess: {
          create: vi.fn().mockResolvedValue({ id: "access-dm-1" }),
        },
      };
      return fn(tx);
    });

    const open = await importOpen();
    await open({ code: PLAIN_CODE, discordUserId: "discord-user-99" });

    expect(fulfillDiscordAccess).toHaveBeenCalledWith("access-dm-1");
  });
});
