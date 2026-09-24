/**
 * E2E money path (preuve automatisée) :
 * checkout → AWAITING_JOIN (multi-guild) → grantPendingOnJoin → ACTIVE → revoke.
 *
 * Discord mocké ; Postgres réel (DATABASE_URL).
 * Skip si DATABASE_URL absent.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const runDb = Boolean(process.env.DATABASE_URL);

const mockGrantGuildRole = vi.fn();
const mockRevokeGuildRole = vi.fn();
const mockCreateInvite = vi.fn();
const mockSendDm = vi.fn();
const mockPostLog = vi.fn();
const mockDispatch = vi.fn();

vi.mock("@/lib/discord-roles", () => ({
  grantGuildRole: (...args: unknown[]) => mockGrantGuildRole(...args),
  revokeGuildRole: (...args: unknown[]) => mockRevokeGuildRole(...args),
  createSingleUseInvite: (...args: unknown[]) => mockCreateInvite(...args),
  sendUserDm: (...args: unknown[]) => mockSendDm(...args),
  postGuildLog: (...args: unknown[]) => mockPostLog(...args),
}));

vi.mock("@/lib/outbound-webhooks", () => ({
  dispatchOutboundWebhooks: (...args: unknown[]) => mockDispatch(...args),
}));

describe.runIf(runDb)("E2E money path (DB)", () => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const guildA = "411111111111111111";
  const guildB = "422222222222222222";
  const discordUserId = "433333333333333333";
  const roleA = "raaaaaaaaaaaaaaaaa";
  const roleB = "rbbbbbbbbbbbbbbbbb";
  const sessionId = `cs_e2e_${suffix}`;

  let userId = "";
  let botId = "";
  let botBId = "";
  let productId = "";
  let accessId = "";

  let openLearnerAccessFromCheckout: typeof import("@/lib/learner-access").openLearnerAccessFromCheckout;
  let fulfillDiscordAccess: typeof import("@/lib/learner-access").fulfillDiscordAccess;
  let grantPendingOnJoin: typeof import("@/lib/learner-access").grantPendingOnJoin;
  let revokeLearnerAccess: typeof import("@/lib/learner-access").revokeLearnerAccess;
  let prisma: typeof import("@/lib/prisma").prisma;

  beforeAll(async () => {
    const access = await import("@/lib/learner-access");
    openLearnerAccessFromCheckout = access.openLearnerAccessFromCheckout;
    fulfillDiscordAccess = access.fulfillDiscordAccess;
    grantPendingOnJoin = access.grantPendingOnJoin;
    revokeLearnerAccess = access.revokeLearnerAccess;
    ({ prisma } = await import("@/lib/prisma"));

    const user = await prisma.user.create({
      data: {
        email: `e2e_${suffix}@example.com`,
        name: "E2E",
        discordId: `8${Date.now().toString().padStart(17, "0").slice(-17)}`,
        subscription: { create: { plan: "OPS", status: "ACTIVE" } },
      },
    });
    userId = user.id;

    const bot = await prisma.bot.create({
      data: {
        userId,
        name: `E2E-A ${suffix}`,
        guildId: guildA,
        status: "ONLINE",
        enabledModules: ["welcome"],
        config: {},
      },
    });
    botId = bot.id;

    const botB = await prisma.bot.create({
      data: {
        userId,
        name: `E2E-B ${suffix}`,
        guildId: guildB,
        status: "ONLINE",
        enabledModules: ["welcome"],
        config: {},
      },
    });
    botBId = botB.id;

    const product = await prisma.accessProduct.create({
      data: {
        userId,
        botId,
        name: `E2E Prod ${suffix}`,
        stripePriceId: `price_e2e_${suffix}`,
        discordRoleId: roleA,
        active: true,
        revokeOnRefund: true,
        maxSeats: 10,
      },
    });
    productId = product.id;

    await prisma.accessProductGuildGrant.createMany({
      data: [
        {
          accessProductId: productId,
          botId,
          guildId: guildA,
          discordRoleId: roleA,
        },
        {
          accessProductId: productId,
          botId: botBId,
          guildId: guildB,
          discordRoleId: roleB,
        },
      ],
    });

    mockCreateInvite.mockResolvedValue("https://discord.gg/e2e");
    mockSendDm.mockResolvedValue(undefined);
    mockPostLog.mockResolvedValue(undefined);
    mockDispatch.mockResolvedValue(undefined);
    mockRevokeGuildRole.mockResolvedValue({ ok: true, inGuild: true });
  });

  afterAll(async () => {
    if (!prisma || !userId) return;
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  });

  it("paiement → claim partiel → join complet → revoke", async () => {
    const opened = await openLearnerAccessFromCheckout({
      productId,
      botId,
      guildId: guildA,
      customerEmail: `buyer_${suffix}@example.com`,
      discordUserIdFromMetadata: null,
      stripeCheckoutSessionId: sessionId,
      stripePaymentIntentId: `pi_e2e_${suffix}`,
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      amountTotal: 4900,
      currency: "eur",
      userId,
    });
    expect(opened.soldOut).toBeFalsy();
    expect(opened.accessId).toBeTruthy();
    expect(opened.claimToken).toBeTruthy();
    accessId = opened.accessId;

    let row = await prisma.learnerAccess.findUniqueOrThrow({
      where: { id: accessId },
    });
    expect(row.status).toBe("PENDING_CLAIM");
    expect(row.claimToken).toBeTruthy();

    const productAfterPay = await prisma.accessProduct.findUniqueOrThrow({
      where: { id: productId },
    });
    expect(productAfterPay.seatsUsed).toBeGreaterThanOrEqual(1);

    mockGrantGuildRole.mockReset();
    mockGrantGuildRole
      .mockResolvedValueOnce({ ok: true, inGuild: true })
      .mockResolvedValueOnce({ ok: true, inGuild: false });

    const claim = await fulfillDiscordAccess(accessId, discordUserId);
    expect(claim.status).toBe("AWAITING_JOIN");

    row = await prisma.learnerAccess.findUniqueOrThrow({
      where: { id: accessId },
    });
    expect(row.status).toBe("AWAITING_JOIN");
    expect(row.discordUserId).toBe(discordUserId);

    mockGrantGuildRole.mockReset();
    mockGrantGuildRole.mockResolvedValue({ ok: true, inGuild: true });

    const granted = await grantPendingOnJoin({
      guildId: guildB,
      discordUserId,
    });
    expect(granted).toBe(1);

    row = await prisma.learnerAccess.findUniqueOrThrow({
      where: { id: accessId },
    });
    expect(row.status).toBe("ACTIVE");
    expect(row.grantedAt).not.toBeNull();

    await revokeLearnerAccess(accessId, "refund");

    row = await prisma.learnerAccess.findUniqueOrThrow({
      where: { id: accessId },
    });
    expect(row.status).toBe("REVOKED");
    expect(row.revokeReason).toBe("refund");
    expect(mockRevokeGuildRole).toHaveBeenCalled();

    const events = await prisma.learnerAccessEvent.findMany({
      where: { learnerAccessId: accessId },
      orderBy: { createdAt: "asc" },
    });
    const types = events.map((e) => e.type);
    expect(types).toContain("payment_received");
    expect(types).toContain("awaiting_join");
    expect(types).toContain("role_granted");
    expect(types).toContain("access_revoked");
  });
});

describe.runIf(!runDb)("E2E money path (skipped)", () => {
  it("skip — DATABASE_URL absent", () => {
    expect(runDb).toBe(false);
  });
});
