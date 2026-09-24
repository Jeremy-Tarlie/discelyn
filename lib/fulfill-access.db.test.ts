/**
 * Test DB réel : fulfillDiscordAccess + grantPendingOnJoin multi-guild.
 * Discord est mocké ; Prisma écrit vraiment dans DATABASE_URL.
 *
 * Skip si DATABASE_URL absent (local sans Postgres).
 * En CI : service Postgres + migrate deploy + ce fichier.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const runDb = Boolean(process.env.DATABASE_URL);

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

describe.runIf(runDb)("fulfill + join multi-guild (DB)", () => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const guildA = "111111111111111111";
  const guildB = "222222222222222222";
  const discordUserId = "333333333333333333";
  const roleA = "aaaaaaaaaaaaaaaaaa";
  const roleB = "bbbbbbbbbbbbbbbbbb";

  let userId = "";
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

    const user = await prisma.user.create({
      data: {
        email: `dbtest_${suffix}@example.com`,
        name: "DB Test",
        discordId: `9${Date.now().toString().padStart(17, "0").slice(-17)}`,
        subscription: {
          create: {
            plan: "OPS",
            status: "ACTIVE",
          },
        },
      },
    });
    userId = user.id;

    const bot = await prisma.bot.create({
      data: {
        userId,
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
        userId,
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
        userId,
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
    if (!prisma || !userId) return;
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
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

describe.runIf(!runDb)("fulfill + join multi-guild (DB skipped)", () => {
  it("skip — DATABASE_URL absent", () => {
    expect(runDb).toBe(false);
  });
});
