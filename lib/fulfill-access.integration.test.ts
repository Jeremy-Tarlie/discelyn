import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFindUniqueAccess,
  mockFindManyGrants,
  mockUpdateAccess,
  mockCreateEvent,
  mockGrantGuildRole,
  mockCreateInvite,
  mockSendDm,
  mockPostLog,
  mockDispatch,
} = vi.hoisted(() => ({
  mockFindUniqueAccess: vi.fn(),
  mockFindManyGrants: vi.fn(),
  mockUpdateAccess: vi.fn(),
  mockCreateEvent: vi.fn(),
  mockGrantGuildRole: vi.fn(),
  mockCreateInvite: vi.fn(),
  mockSendDm: vi.fn(),
  mockPostLog: vi.fn(),
  mockDispatch: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    learnerAccess: {
      findUnique: mockFindUniqueAccess,
      update: mockUpdateAccess,
    },
    accessProductGuildGrant: {
      findMany: mockFindManyGrants,
    },
    learnerAccessEvent: {
      create: mockCreateEvent,
    },
  },
}));

vi.mock("@/lib/discord-roles", () => ({
  grantGuildRole: mockGrantGuildRole,
  createSingleUseInvite: mockCreateInvite,
  sendUserDm: mockSendDm,
  postGuildLog: mockPostLog,
  revokeGuildRole: vi.fn(),
}));

vi.mock("@/lib/outbound-webhooks", () => ({
  dispatchOutboundWebhooks: mockDispatch,
}));

import { fulfillDiscordAccess } from "@/lib/learner-access";

function baseAccess(overrides: Record<string, unknown> = {}) {
  return {
    id: "access_1",
    accessProductId: "prod_1",
    botId: "bot_1",
    guildId: "guild_primary",
    status: "PENDING_CLAIM",
    discordUserId: null,
    inviteUrl: null,
    claimToken: "tok",
    product: {
      discordRoleId: "role_primary",
      accessEndsAt: null,
      name: "Formation X",
      welcomeDm: null,
      onboardingSteps: null,
      bot: { userId: "user_org" },
    },
    bot: {
      config: {},
      guildId: "guild_primary",
      userId: "user_org",
    },
    ...overrides,
  };
}

describe("fulfillDiscordAccess (intégration mockée)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateAccess.mockResolvedValue({});
    mockCreateEvent.mockResolvedValue({});
    mockSendDm.mockResolvedValue(undefined);
    mockPostLog.mockResolvedValue(undefined);
    mockDispatch.mockResolvedValue(undefined);
    mockCreateInvite.mockResolvedValue("https://discord.gg/invite");
  });

  it("passe ACTIVE seulement quand tous les grants sont posés", async () => {
    mockFindUniqueAccess.mockResolvedValue(baseAccess());
    mockFindManyGrants.mockResolvedValue([
      {
        guildId: "guild_primary",
        discordRoleId: "role_primary",
        botId: "bot_1",
        bot: { config: {} },
      },
      {
        guildId: "guild_b",
        discordRoleId: "role_b",
        botId: "bot_2",
        bot: { config: {} },
      },
    ]);
    mockGrantGuildRole
      .mockResolvedValueOnce({ ok: true, inGuild: true })
      .mockResolvedValueOnce({ ok: true, inGuild: true });

    const result = await fulfillDiscordAccess(
      "access_1",
      "123456789012345678"
    );

    expect(result.status).toBe("ACTIVE");
    expect(mockUpdateAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
  });

  it("reste AWAITING_JOIN si un grant secondaire manque encore", async () => {
    mockFindUniqueAccess.mockResolvedValue(baseAccess());
    mockFindManyGrants.mockResolvedValue([
      {
        guildId: "guild_primary",
        discordRoleId: "role_primary",
        botId: "bot_1",
        bot: { config: {} },
      },
      {
        guildId: "guild_b",
        discordRoleId: "role_b",
        botId: "bot_2",
        bot: { config: {} },
      },
    ]);
    mockGrantGuildRole
      .mockResolvedValueOnce({ ok: true, inGuild: true })
      .mockResolvedValueOnce({ ok: true, inGuild: false });

    const result = await fulfillDiscordAccess(
      "access_1",
      "123456789012345678"
    );

    expect(result.status).toBe("AWAITING_JOIN");
    expect(result.inviteUrl).toBe("https://discord.gg/invite");
    expect(mockUpdateAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "AWAITING_JOIN" }),
      })
    );
  });

  it("ne passe pas ACTIVE sur un seul serveur si un autre a échoué", async () => {
    mockFindUniqueAccess.mockResolvedValue(
      baseAccess({ status: "AWAITING_JOIN" })
    );
    mockFindManyGrants.mockResolvedValue([
      {
        guildId: "guild_primary",
        discordRoleId: "role_primary",
        botId: "bot_1",
        bot: { config: {} },
      },
      {
        guildId: "guild_b",
        discordRoleId: "role_b",
        botId: "bot_2",
        bot: { config: {} },
      },
    ]);
    mockGrantGuildRole
      .mockResolvedValueOnce({ ok: true, inGuild: true })
      .mockResolvedValueOnce({
        ok: false,
        error: "Discord 403",
        inGuild: true,
      });

    const result = await fulfillDiscordAccess(
      "access_1",
      "123456789012345678"
    );

    expect(result.status).toBe("AWAITING_JOIN");
    expect(result.error).toBe("Discord 403");
  });
});
