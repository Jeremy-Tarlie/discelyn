import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TransportOptions = {
  host: string;
  disableFileAccess?: boolean;
  disableUrlAccess?: boolean;
  auth: { user: string; pass: string };
};

const sendMail = vi.fn(async () => ({}));
const createTransport = vi.fn((options: TransportOptions) => {
  void options;
  return { sendMail };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: (options: TransportOptions) => createTransport(options),
  },
}));

import {
  resetAuthMailTransporterForTests,
  sendAuthMail,
} from "./auth-mail";

describe("sendAuthMail", () => {
  beforeEach(() => {
    createTransport.mockClear();
    sendMail.mockClear();
    createTransport.mockImplementation((options: TransportOptions) => {
      void options;
      return { sendMail };
    });
    sendMail.mockResolvedValue({});
    resetAuthMailTransporterForTests();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
  });

  afterEach(() => {
    resetAuthMailTransporterForTests();
  });

  it("refuse un destinataire avec CRLF sans ouvrir SMTP", async () => {
    process.env.SMTP_HOST = "smtp.example";
    process.env.SMTP_FROM = "noreply@example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";

    const result = await sendAuthMail({
      to: "victim@example.com\r\nBcc: evil@example.com",
      subject: "x",
      text: "y",
    });
    expect(result).toEqual({ ok: false, error: "auth_mail_invalid_recipient" });
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("signale mail non configuré sans SMTP", async () => {
    const result = await sendAuthMail({
      to: "ok@example.com",
      subject: "x",
      text: "y",
    });
    expect(result).toEqual({ ok: false, error: "auth_mail_not_configured" });
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("crée le transport avec disableFileAccess et disableUrlAccess", async () => {
    process.env.SMTP_HOST = "smtp.example";
    process.env.SMTP_FROM = "noreply@example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";

    const result = await sendAuthMail({
      to: "ok@example.com",
      subject: "hello",
      text: "body",
    });

    expect(result).toEqual({ ok: true });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example",
        disableFileAccess: true,
        disableUrlAccess: true,
        auth: { user: "user", pass: "pass" },
      })
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ok@example.com",
        from: "noreply@example.com",
      })
    );
  });
});
