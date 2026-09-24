import { afterEach, describe, expect, it } from "vitest";
import { validateOutboundWebhookUrl } from "@/lib/webhook-url-safety";

describe("validateOutboundWebhookUrl", () => {
  const prev = process.env.APP_ENV;

  afterEach(() => {
    if (prev === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prev;
  });

  it("accepte https public", () => {
    const r = validateOutboundWebhookUrl("https://hooks.example.com/botly");
    expect(r.ok).toBe(true);
  });

  it("refuse localhost", () => {
    expect(validateOutboundWebhookUrl("http://localhost:3000/h").ok).toBe(
      false
    );
    expect(validateOutboundWebhookUrl("http://127.0.0.1/h").ok).toBe(false);
  });

  it("refuse IP privées", () => {
    expect(validateOutboundWebhookUrl("http://10.0.0.5/hook").ok).toBe(false);
    expect(validateOutboundWebhookUrl("http://192.168.1.1/hook").ok).toBe(
      false
    );
    expect(validateOutboundWebhookUrl("http://172.16.0.1/hook").ok).toBe(
      false
    );
  });

  it("refuse metadata AWS", () => {
    expect(
      validateOutboundWebhookUrl("http://169.254.169.254/latest/meta-data")
        .ok
    ).toBe(false);
  });

  it("exige https en production", () => {
    process.env.APP_ENV = "production";
    expect(validateOutboundWebhookUrl("http://hooks.example.com/x").ok).toBe(
      false
    );
    expect(validateOutboundWebhookUrl("https://hooks.example.com/x").ok).toBe(
      true
    );
  });
});
