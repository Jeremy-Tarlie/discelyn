import { beforeEach, describe, expect, it, vi } from "vitest";

const leadFindMany = vi.fn();
const userFindMany = vi.fn();
const campaignCreate = vi.fn();
const recipientUpdateMany = vi.fn();
const queryRaw = vi.fn();
const campaignUpdateMany = vi.fn();
const campaignFindUnique = vi.fn();
const campaignFindMany = vi.fn();
const recipientUpdate = vi.fn();
const campaignUpdate = vi.fn();
const emailEventCreate = vi.fn();
const recipientCount = vi.fn();
const transaction = vi.fn();
const sendEmail = vi.fn();
const isEmailConfigured = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findMany: (...args: unknown[]) => leadFindMany(...args) },
    user: { findMany: (...args: unknown[]) => userFindMany(...args) },
    marketingCampaign: {
      create: (...args: unknown[]) => campaignCreate(...args),
      updateMany: (...args: unknown[]) => campaignUpdateMany(...args),
      findUnique: (...args: unknown[]) => campaignFindUnique(...args),
      findMany: (...args: unknown[]) => campaignFindMany(...args),
      update: (...args: unknown[]) => campaignUpdate(...args),
    },
    marketingCampaignRecipient: {
      updateMany: (...args: unknown[]) => recipientUpdateMany(...args),
      update: (...args: unknown[]) => recipientUpdate(...args),
      count: (...args: unknown[]) => recipientCount(...args),
    },
    emailEvent: { create: (...args: unknown[]) => emailEventCreate(...args) },
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock("@/lib/email", () => ({
  isEmailConfigured: () => isEmailConfigured(),
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

vi.mock("@/lib/marketing-unsubscribe", () => ({
  unsubscribeUrlFor: () => "https://app.example/unsubscribe?token=t",
  unsubscribeApiUrlFor: () => "https://app.example/api/unsubscribe?token=t",
}));

describe("admin-campaigns", () => {
  beforeEach(() => {
    leadFindMany.mockReset();
    userFindMany.mockReset();
    campaignCreate.mockReset();
    recipientUpdateMany.mockReset().mockResolvedValue({ count: 0 });
    queryRaw.mockReset();
    campaignUpdateMany.mockReset();
    campaignFindUnique.mockReset();
    campaignFindMany.mockReset();
    recipientUpdate.mockReset();
    campaignUpdate.mockReset();
    emailEventCreate.mockReset();
    recipientCount.mockReset().mockResolvedValue(0);
    transaction.mockReset();
    sendEmail.mockReset();
    isEmailConfigured.mockReset().mockReturnValue(true);
    vi.resetModules();
  });

  it("déduplique leads + customers", async () => {
    leadFindMany.mockResolvedValue([
      { email: "A@Ex.com" },
      { email: "b@ex.com" },
    ]);
    userFindMany.mockResolvedValue([
      { email: "a@ex.com" },
      { email: "c@ex.com" },
    ]);
    const { resolveCampaignRecipients } = await import("@/lib/admin-campaigns");
    const emails = await resolveCampaignRecipients("both");
    expect(emails.sort()).toEqual(["a@ex.com", "b@ex.com", "c@ex.com"]);
  });

  it("enqueueCampaign crée une file queued", async () => {
    leadFindMany.mockResolvedValue([{ email: "a@ex.com" }]);
    userFindMany.mockResolvedValue([]);
    campaignCreate.mockResolvedValue({ id: "camp1" });
    const { enqueueCampaign } = await import("@/lib/admin-campaigns");
    const result = await enqueueCampaign({
      subject: "Hello there",
      bodyText: "Body text long enough",
      audience: "leads",
      createdById: "admin1",
    });
    expect(result).toEqual({
      ok: true,
      campaignId: "camp1",
      queuedCount: 1,
      status: "queued",
    });
    expect(campaignCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "queued",
          recipients: {
            create: [{ email: "a@ex.com", status: "pending" }],
          },
        }),
      }),
    );
  });

  it("processCampaignBatch envoie un destinataire claimé", async () => {
    transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        const tx = {
          $queryRaw: queryRaw,
          marketingCampaignRecipient: {
            updateMany: campaignUpdateMany,
          },
          marketingCampaign: { updateMany: campaignUpdateMany },
        };
        queryRaw.mockResolvedValue([
          { id: "r1", campaignId: "c1", email: "a@ex.com" },
        ]);
        return arg(tx);
      }
      return Promise.all(arg as Promise<unknown>[]);
    });
    campaignFindMany.mockResolvedValue([
      {
        id: "c1",
        subject: "Hi",
        bodyText: "Hello world body",
        status: "sending",
      },
    ]);
    sendEmail.mockResolvedValue({ ok: true });
    recipientUpdate.mockResolvedValue({});
    campaignUpdate.mockResolvedValue({});
    emailEventCreate.mockResolvedValue({});

    const { processCampaignBatch } = await import("@/lib/admin-campaigns");
    const result = await processCampaignBatch(10);
    expect(result.processed).toBe(1);
    expect(result.sent).toBe(1);
    expect(campaignFindMany).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "a@ex.com",
        headers: expect.objectContaining({
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }),
      }),
    );
  });
});
