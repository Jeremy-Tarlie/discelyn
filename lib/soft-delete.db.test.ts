/**
 * Soft-delete orga : purge secrets / produits + bot indisponible.
 * Postgres réel (DATABASE_URL). Discord mocké.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL obligatoire pour soft-delete.db.test.ts (Postgres requis)"
  );
}

vi.mock("@/lib/discord-roles", () => ({
  grantGuildRole: vi.fn(),
  revokeGuildRole: vi.fn().mockResolvedValue({ ok: true }),
  createSingleUseInvite: vi.fn(),
  sendUserDm: vi.fn(),
  postGuildLog: vi.fn(),
}));

vi.mock("@/lib/outbound-webhooks", () => ({
  dispatchOutboundWebhooks: vi.fn(),
}));

vi.mock("@/lib/runtime-notify", () => ({
  notifyRuntimeReload: vi.fn(),
  notifyRuntimeStop: vi.fn(),
}));

describe("soft-delete purge (DB)", () => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const guildId = "511111111111111111";

  let userId = "";
  let botId = "";
  let productId = "";
  let prisma: typeof import("@/lib/prisma").prisma;
  let softDeleteUserAccount: typeof import("@/lib/soft-delete-ops").softDeleteUserAccount;
  let softDeleteBot: typeof import("@/lib/soft-delete-ops").softDeleteBot;
  let purgeOrgAccessInfrastructure: typeof import("@/lib/soft-delete-ops").purgeOrgAccessInfrastructure;

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({
      softDeleteUserAccount,
      softDeleteBot,
      purgeOrgAccessInfrastructure,
    } = await import("@/lib/soft-delete-ops"));

    const user = await prisma.user.create({
      data: {
        email: `softdel_${suffix}@example.com`,
        name: "SoftDel",
        discordId: `7${Date.now().toString().padStart(17, "0").slice(-17)}`,
        subscription: { create: { plan: "STARTER", status: "ACTIVE" } },
      },
    });
    userId = user.id;

    const bot = await prisma.bot.create({
      data: {
        userId,
        name: `SD-Bot ${suffix}`,
        guildId,
        status: "ONLINE",
        enabledModules: ["welcome"],
        config: {},
      },
    });
    botId = bot.id;

    const product = await prisma.accessProduct.create({
      data: {
        userId,
        botId,
        name: `SD-Prod ${suffix}`,
        stripePriceId: `price_sd_${suffix}`,
        discordRoleId: "role_sd_aaaaaaaaaa",
        active: true,
      },
    });
    productId = product.id;

    await prisma.orgStripeConfig.create({
      data: {
        userId,
        webhookPathToken: `tok_sd_${suffix}`,
        webhookSecret: "enc:v1:test_whsec_placeholder",
        stripeSecretKey: "enc:v1:test_sk_placeholder",
      },
    });

    await prisma.orgOutboundWebhook.create({
      data: {
        userId,
        url: "https://example.com/hook",
        secret: "outbound-secret-live",
        events: ["claim_reminder"],
        active: true,
      },
    });

    await prisma.affiliate.create({
      data: {
        userId,
        code: `AFF${suffix.slice(0, 6).toUpperCase()}`,
        label: "test",
        active: true,
      },
    });
  });

  afterAll(async () => {
    if (!userId) return;
    // Hard cleanup test rows (cascade) après soft-delete assertions.
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  });

  it("softDeleteBot désactive les produits et null guildId", async () => {
    await softDeleteBot({
      botId,
      guildId,
      revokeReason: "bot_deleted",
    });

    const bot = await prisma.bot.findUniqueOrThrow({ where: { id: botId } });
    expect(bot.deletedAt).not.toBeNull();
    expect(bot.guildId).toBeNull();
    expect(bot.status).toBe("OFFLINE");

    const product = await prisma.accessProduct.findUniqueOrThrow({
      where: { id: productId },
    });
    expect(product.active).toBe(false);
  });

  it("purgeOrgAccessInfrastructure supprime OrgStripe et coupe webhooks", async () => {
    // Recréer un produit actif + stripe pour tester la purge seule.
    await prisma.accessProduct.update({
      where: { id: productId },
      data: { active: true },
    });
    const stripe = await prisma.orgStripeConfig.findUnique({
      where: { userId },
    });
    // softDeleteBot n’efface pas OrgStripe — encore présent.
    expect(stripe).not.toBeNull();

    const result = await purgeOrgAccessInfrastructure(userId);
    expect(result.orgStripeDeleted).toBe(true);
    expect(result.productsDeactivated).toBeGreaterThanOrEqual(1);
    expect(result.outboundDisabled).toBeGreaterThanOrEqual(1);
    expect(result.affiliatesDeactivated).toBeGreaterThanOrEqual(1);

    expect(
      await prisma.orgStripeConfig.findUnique({ where: { userId } })
    ).toBeNull();

    const hooks = await prisma.orgOutboundWebhook.findMany({
      where: { userId },
    });
    expect(hooks.every((h) => !h.active && h.secret === "revoked")).toBe(true);
  });

  it("softDeleteUserAccount anonymise et marque subscription CANCELED", async () => {
    // Nouveau user dédié (le précédent a déjà bot soft-deleted).
    const u2 = await prisma.user.create({
      data: {
        email: `softdel2_${suffix}@example.com`,
        name: "SoftDel2",
        discordId: `6${Date.now().toString().padStart(17, "0").slice(-17)}`,
        subscription: { create: { plan: "OPS", status: "ACTIVE" } },
        bots: {
          create: {
            name: `SD2 ${suffix}`,
            guildId: "522222222222222222",
            status: "ONLINE",
            enabledModules: [],
            config: {},
          },
        },
        orgStripeConfig: {
          create: {
            webhookPathToken: `tok_sd2_${suffix}`,
            webhookSecret: "enc:v1:whsec2",
            stripeSecretKey: "enc:v1:sk2",
          },
        },
      },
      include: { bots: true },
    });

    await softDeleteUserAccount({ userId: u2.id, email: u2.email });

    const gone = await prisma.user.findUniqueOrThrow({ where: { id: u2.id } });
    expect(gone.deletedAt).not.toBeNull();
    expect(gone.email).toBeNull();
    expect(gone.discordId).toBeNull();
    expect(gone.name).toBeNull();

    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { userId: u2.id },
    });
    expect(sub.status).toBe("CANCELED");
    expect(sub.plan).toBe("FREE");

    expect(
      await prisma.orgStripeConfig.findUnique({ where: { userId: u2.id } })
    ).toBeNull();

    const bots = await prisma.bot.findMany({ where: { userId: u2.id } });
    expect(bots.every((b) => b.deletedAt != null && b.guildId == null)).toBe(
      true
    );

    await prisma.user.delete({ where: { id: u2.id } }).catch(() => undefined);
  });
});
