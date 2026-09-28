/**
 * Test DB réel : fulfillDiscordAccess + grantPendingOnJoin multi-guild.
 * Discord est mocké ; Prisma écrit vraiment dans DATABASE_URL.
 * DATABASE_URL est obligatoire (sinon échec, jamais de skip).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL obligatoire pour fulfill-access.db.test.ts (Postgres requis)"
  );
}

const mockGrantGuildRole = vi.fn();
const mockCreateInvite = vi.fn();
const mockSendDm = vi.fn();
const mockPostLog = vi.fn();
const mockDispatch = vi.fn();

vi.mock("@/lib/discord-roles", () => ({
  grantGuildRole: (...args: unknown[]) => mockGrantGuildRole(...args),
  createSingleUseInvite: (...args: unknown[]) => mockCreateInvite(...args),
  sendUserDm: (...args: unknown[]) => mockSendDm(...args),
  postGuildLog: (...args: unknown[]) => mockPostLog(...args),
  revokeGuildRole: vi.fn(),
}));

vi.mock("@/lib/outbound-webhooks", () => ({
  dispatchOutboundWebhooks: (...args: unknown[]) => mockDispatch(...args),
}));

describe("fulfill + join multi-guild (DB)", () => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const guildA = "111111111111111111";
  const guildB = "222222222222222222";
  const discordUserId = "333333333333333333";
  const roleA = "aaaaaaaaaaaaaaaaaa";
  const roleB = "bbbbbbbbbbbbbbbbbb";

  let userId = "";
  let organizationId = "";
  let botId = "";
  let botBId = "";
  let productId = "";
  let accessId = "";
  let fulfillDiscordAccess: typeof import("@/lib/learner-access").fulfillDiscordAccess;
  let grantPendingOnJoin: typeof import("@/lib/learner-access").grantPendingOnJoin;
  let prisma: typeof import("@/lib/prisma").prisma;

  beforeAll(async () => {
    ({ fulfillDiscordAccess, grantPendingOnJoin } = await import(
      "@/lib/learner-access"
    ));
    ({ prisma } = await import("@/lib/prisma"));
    const { bootstrapOrganizationForUser } = await import("@/lib/org-access");

    const user = await prisma.user.create({
      data: {
        email: `dbtest_${suffix}@example.com`,
        name: "DB Test",
        discordId: `9${Date.now().toString().padStart(17, "0").slice(-17)}`,
      },
    });
    userId = user.id;

    const bootstrapped = await bootstrapOrganizationForUser({
      userId: user.id,
      name: user.name,
    });
    organizationId = bootstrapped.organizationId;

    await prisma.subscription.update({
      where: { organizationId },
      data: { plan: "OPS" },
    });

    const bot = await prisma.bot.create({
      data: {
        organizationId,
        name: `BotA ${suffix}`,
        guildId: guildA,
        status: "ONLINE",
        enabledModules: ["welcome"],
        config: {},
      },
    });
    botId = bot.id;

    const botB = await prisma.bot.create({
      data: {
        organizationId,
        name: `BotB ${suffix}`,
        guildId: guildB,
        status: "ONLINE",
        enabledModules: ["welcome"],
        config: {},
      },
    });
    botBId = botB.id;

    const product = await prisma.accessProduct.create({
      data: {
        organizationId,
        botId,
        name: `Prod ${suffix}`,
        stripePriceId: `price_dbtest_${suffix}`,
        discordRoleId: roleA,
        active: true,
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

    const access = await prisma.learnerAccess.create({
      data: {
        accessProductId: productId,
        botId,
        guildId: guildA,
        status: "PENDING_CLAIM",
        source: "STRIPE",
        claimToken: `claim_${suffix}`,
        claimTokenExpiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    accessId = access.id;

    mockCreateInvite.mockResolvedValue("https://discord.gg/dbtest");
    mockSendDm.mockResolvedValue(undefined);
    mockPostLog.mockResolvedValue(undefined);
    mockDispatch.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    if (!prisma) return;
    if (organizationId) {
      await prisma.organization
        .delete({ where: { id: organizationId } })
        .catch(() => undefined);
    }
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it("reste AWAITING_JOIN tant qu’un grant manque", async () => {
    mockGrantGuildRole.mockReset();
    mockGrantGuildRole
      .mockResolvedValueOnce({ ok: true, inGuild: true })
      .mockResolvedValueOnce({ ok: true, inGuild: false });

    const result = await fulfillDiscordAccess(accessId, discordUserId);
    expect(result.status).toBe("AWAITING_JOIN");

    const row = await prisma.learnerAccess.findUniqueOrThrow({
      where: { id: accessId },
    });
    expect(row.status).toBe("AWAITING_JOIN");
    expect(row.discordUserId).toBe(discordUserId);
    expect(row.inviteUrl).toBeTruthy();
  });

  it("grantPendingOnJoin → ACTIVE quand tous les grants sont OK", async () => {
    mockGrantGuildRole.mockReset();
    mockGrantGuildRole.mockResolvedValue({ ok: true, inGuild: true });

    const n = await grantPendingOnJoin({
      guildId: guildB,
      discordUserId,
    });
    expect(n).toBe(1);

    const row = await prisma.learnerAccess.findUniqueOrThrow({
      where: { id: accessId },
    });
    expect(row.status).toBe("ACTIVE");
    expect(row.inviteUrl).toBeNull();
    expect(row.grantedAt).not.toBeNull();
  });
});
