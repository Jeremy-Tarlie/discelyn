import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  userFindFirst,
  userCreate,
  userUpdate,
  userDelete,
  verificationDeleteMany,
  verificationCreate,
  verificationFindUnique,
  sessionDeleteMany,
  bootstrapMock,
  trackMock,
  sendMailMock,
  isAuthMailConfiguredMock,
  prismaTransaction,
} = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  userDelete: vi.fn(),
  verificationDeleteMany: vi.fn(),
  verificationCreate: vi.fn(),
  verificationFindUnique: vi.fn(),
  sessionDeleteMany: vi.fn(),
  bootstrapMock: vi.fn(),
  trackMock: vi.fn(),
  sendMailMock: vi.fn(),
  isAuthMailConfiguredMock: vi.fn(() => true),
  prismaTransaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: userFindFirst,
      create: userCreate,
      update: userUpdate,
      delete: userDelete,
    },
    verificationToken: {
      deleteMany: verificationDeleteMany,
      create: verificationCreate,
      findUnique: verificationFindUnique,
    },
    session: {
      deleteMany: sessionDeleteMany,
    },
    $transaction: prismaTransaction,
  },
}));

vi.mock("@/lib/org-access", () => ({
  bootstrapOrganizationForUser: bootstrapMock,
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: trackMock,
}));

vi.mock("@/lib/auth-mail", () => ({
  authEmailBaseUrl: () => "http://localhost:3000",
  sendAuthMail: sendMailMock,
  isAuthMailConfigured: () => isAuthMailConfiguredMock(),
}));

vi.mock("@/lib/demo", () => ({
  getAppEnvironment: () => "development",
}));

import {
  credentialsUserBlocksDiscordOAuth,
  loginCredentialsUser,
  registerCredentialsUser,
  resetCredentialsPassword,
  verifyCredentialsEmail,
} from "@/lib/auth-credentials";
import { hashPassword } from "@/lib/password";

describe("auth-credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMailMock.mockResolvedValue({ ok: true });
    isAuthMailConfiguredMock.mockReturnValue(true);
    bootstrapMock.mockResolvedValue({ organizationId: "org1" });
    trackMock.mockResolvedValue(undefined);
    verificationDeleteMany.mockResolvedValue({ count: 0 });
    verificationCreate.mockResolvedValue({});
    userUpdate.mockResolvedValue({});
    userDelete.mockResolvedValue({});
    sessionDeleteMany.mockResolvedValue({ count: 0 });
    // Exécute le callback transaction avec un tx qui délègue aux mocks.
    prismaTransaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          user: {
            update: userUpdate,
            delete: userDelete,
          },
          verificationToken: {
            deleteMany: verificationDeleteMany,
            create: verificationCreate,
          },
          session: {
            deleteMany: sessionDeleteMany,
          },
        };
        return fn(tx);
      }
    );
  });

  it("register crée user unverified sans bootstrap", async () => {
    userFindFirst.mockResolvedValue(null);
    userCreate.mockResolvedValue({ id: "u1" });

    const result = await registerCredentialsUser({
      email: "New@Example.com",
      password: "Correct-horse1!",
      plan: "FREE",
      interval: "month",
      locale: "fr",
    });

    expect(result).toEqual({
      ok: true,
      intent: { plan: "FREE", interval: "month" },
    });

    expect(userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new@example.com",
          emailVerified: null,
          passwordHash: expect.any(String),
        }),
      })
    );
    expect(bootstrapMock).not.toHaveBeenCalled();
    expect(trackMock).not.toHaveBeenCalled();
    expect(sendMailMock).toHaveBeenCalled();
  });

  it("register refuse email déjà pris (après hash timing)", async () => {
    userFindFirst.mockResolvedValue({ id: "existing" });
    const started = Date.now();
    const result = await registerCredentialsUser({
      email: "a@example.com",
      password: "Correct-horse1!",
      plan: "STARTER",
      interval: "month",
      locale: "fr",
    });
    expect(result).toEqual({ ok: false, code: "email_taken" });
    expect(userCreate).not.toHaveBeenCalled();
    // hashPassword jeté : pas un early-return instantané
    expect(Date.now() - started).toBeGreaterThan(20);
  });

  it("register rollback si mail KO (SMTP configuré)", async () => {
    userFindFirst.mockResolvedValue(null);
    userCreate.mockResolvedValue({ id: "u1" });
    sendMailMock.mockResolvedValue({
      ok: false,
      error: "auth_mail_send_failed",
    });

    const result = await registerCredentialsUser({
      email: "a@example.com",
      password: "Correct-horse1!",
      plan: "FREE",
      interval: "month",
      locale: "fr",
    });

    expect(result).toEqual({
      ok: false,
      code: "mail_failed",
      intent: { plan: "FREE", interval: "month" },
    });
    expect(userDelete).toHaveBeenCalledWith({ where: { id: "u1" } });
  });

  it("login refuse email non vérifié", async () => {
    const hash = await hashPassword("legacy-pass-12");
    userFindFirst.mockResolvedValue({
      id: "u1",
      passwordHash: hash,
      emailVerified: null,
      deletedAt: null,
    });
    const result = await loginCredentialsUser({
      email: "a@example.com",
      password: "legacy-pass-12",
    });
    expect(result).toEqual({ ok: false, code: "email_not_verified" });
  });

  it("login OK si vérifié (MDP legacy sans complexité)", async () => {
    const hash = await hashPassword("legacy-pass-12");
    userFindFirst.mockResolvedValue({
      id: "u1",
      passwordHash: hash,
      emailVerified: new Date(),
      deletedAt: null,
    });
    const result = await loginCredentialsUser({
      email: "a@example.com",
      password: "legacy-pass-12",
    });
    expect(result).toEqual({ ok: true, userId: "u1" });
  });

  it("verify-email active le compte + bootstrap", async () => {
    const { createHash } = await import("node:crypto");
    const raw = "test-verify-token-abcdef";
    const hashed = createHash("sha256").update(raw, "utf8").digest("hex");
    verificationFindUnique.mockResolvedValue({
      identifier: "email-verify:a@example.com",
      token: hashed,
      expires: new Date(Date.now() + 60_000),
    });
    userFindFirst.mockResolvedValue({
      id: "u1",
      emailVerified: null,
      name: "Alice",
    });

    const result = await verifyCredentialsEmail({
      token: raw,
    });

    expect(result).toEqual({ ok: true, userId: "u1" });
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: { emailVerified: expect.any(Date) },
      })
    );
    expect(bootstrapMock).toHaveBeenCalledWith({
      userId: "u1",
      name: "Alice",
    });
    expect(trackMock).toHaveBeenCalledWith({
      name: "signup",
      userId: "u1",
    });
  });

  it("verify-email déjà vérifié → invalid_token opaque", async () => {
    const { createHash } = await import("node:crypto");
    const raw = "test-verify-token-already";
    const hashed = createHash("sha256").update(raw, "utf8").digest("hex");
    verificationFindUnique.mockResolvedValue({
      identifier: "email-verify:a@example.com",
      token: hashed,
      expires: new Date(Date.now() + 60_000),
    });
    userFindFirst.mockResolvedValue({
      id: "u1",
      emailVerified: new Date(),
      name: "Alice",
    });

    const result = await verifyCredentialsEmail({ token: raw });
    expect(result).toEqual({ ok: false, code: "invalid_token" });
    expect(bootstrapMock).not.toHaveBeenCalled();
  });

  it("verify-email refuse un token reset (mauvais préfixe)", async () => {
    const { createHash } = await import("node:crypto");
    const raw = "test-verify-token-wrongpfx";
    const hashed = createHash("sha256").update(raw, "utf8").digest("hex");
    verificationFindUnique.mockResolvedValue({
      identifier: "password-reset:a@example.com",
      token: hashed,
      expires: new Date(Date.now() + 60_000),
    });

    const result = await verifyCredentialsEmail({ token: raw });
    expect(result).toEqual({ ok: false, code: "invalid_token" });
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("reset password change le hash et purge sessions", async () => {
    const { createHash } = await import("node:crypto");
    const raw = "reset-token-xyz-123456";
    const hashed = createHash("sha256").update(raw, "utf8").digest("hex");
    verificationFindUnique.mockResolvedValue({
      identifier: "password-reset:a@example.com",
      token: hashed,
      expires: new Date(Date.now() + 60_000),
    });
    userFindFirst.mockResolvedValue({ id: "u1" });

    const result = await resetCredentialsPassword({
      token: raw,
      password: "New-password99!",
    });

    expect(result).toEqual({ ok: true });
    expect(userUpdate).toHaveBeenCalled();
    expect(sessionDeleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
  });

  it("credentialsUserBlocksDiscordOAuth trouve un email casse différente", async () => {
    userFindFirst.mockResolvedValue({
      id: "u1",
      accounts: [],
    });
    const blocked = await credentialsUserBlocksDiscordOAuth("Foo@Bar.com");
    expect(blocked).toBe(true);
    expect(userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: { equals: "foo@bar.com", mode: "insensitive" },
          passwordHash: { not: null },
        }),
      })
    );
  });
});
