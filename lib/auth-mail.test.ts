import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEmailMock = vi.fn();
const isEmailConfiguredMock = vi.fn();

vi.mock("@/lib/email", () => ({
  sendEmail: (input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) => sendEmailMock(input),
  isEmailConfigured: () => isEmailConfiguredMock(),
}));

import { isAuthMailConfigured, sendAuthMail } from "./auth-mail";

describe("sendAuthMail (Resend)", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    isEmailConfiguredMock.mockReset();
    isEmailConfiguredMock.mockReturnValue(true);
    sendEmailMock.mockResolvedValue({ ok: true });
  });

  it("expose isAuthMailConfigured via Resend", () => {
    isEmailConfiguredMock.mockReturnValue(false);
    expect(isAuthMailConfigured()).toBe(false);
    isEmailConfiguredMock.mockReturnValue(true);
    expect(isAuthMailConfigured()).toBe(true);
  });

  it("refuse un destinataire avec CRLF sans appeler Resend", async () => {
    const result = await sendAuthMail({
      to: "victim@example.com\r\nBcc: evil@example.com",
      subject: "x",
      text: "y",
    });
    expect(result).toEqual({ ok: false, error: "auth_mail_invalid_recipient" });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("signale mail non configuré si Resend absent", async () => {
    isEmailConfiguredMock.mockReturnValue(false);
    const result = await sendAuthMail({
      to: "ok@example.com",
      subject: "x",
      text: "y",
    });
    expect(result).toEqual({ ok: false, error: "auth_mail_not_configured" });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("délègue à sendEmail (Resend)", async () => {
    const result = await sendAuthMail({
      to: "ok@example.com",
      subject: "hello",
      text: "body",
      html: "<p>body</p>",
    });
    expect(result).toEqual({ ok: true });
    expect(sendEmailMock).toHaveBeenCalledWith({
      to: "ok@example.com",
      subject: "hello",
      text: "body",
      html: "<p>body</p>",
    });
  });
});
