import { afterEach, describe, expect, it } from "vitest";
import {
  ipv4FromMappedIpv6,
  validateOutboundWebhookUrl,
  type WebhookDnsLookup,
} from "@/lib/webhook-url-safety";

const publicLookup: WebhookDnsLookup = async () => ["93.184.216.34"];
const loopbackLookup: WebhookDnsLookup = async () => ["127.0.0.1"];
const linkLocalLookup: WebhookDnsLookup = async () => ["169.254.169.254"];
const mixedLookup: WebhookDnsLookup = async () => [
  "93.184.216.34",
  "127.0.0.1",
];

describe("ipv4FromMappedIpv6", () => {
  it("décode ::ffff:dotted et ::ffff:hex", () => {
    expect(ipv4FromMappedIpv6("::ffff:127.0.0.1")).toBe("127.0.0.1");
    expect(ipv4FromMappedIpv6("::ffff:7f00:1")).toBe("127.0.0.1");
    expect(ipv4FromMappedIpv6("::ffff:0a00:0001")).toBe("10.0.0.1");
  });
});

describe("validateOutboundWebhookUrl", () => {
  const prev = process.env.APP_ENV;

  afterEach(() => {
    if (prev === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prev;
  });

  it("accepte https public (DNS public)", async () => {
    const r = await validateOutboundWebhookUrl(
      "https://hooks.example.com/discelyn",
      publicLookup
    );
    expect(r.ok).toBe(true);
  });

  it("refuse localhost", async () => {
    expect(
      (await validateOutboundWebhookUrl("http://localhost:3000/h")).ok
    ).toBe(false);
    expect((await validateOutboundWebhookUrl("http://127.0.0.1/h")).ok).toBe(
      false
    );
  });

  it("refuse IP privées", async () => {
    expect((await validateOutboundWebhookUrl("http://10.0.0.5/hook")).ok).toBe(
      false
    );
    expect(
      (await validateOutboundWebhookUrl("http://192.168.1.1/hook")).ok
    ).toBe(false);
    expect(
      (await validateOutboundWebhookUrl("http://172.16.0.1/hook")).ok
    ).toBe(false);
  });

  it("refuse metadata AWS littéral", async () => {
    expect(
      (
        await validateOutboundWebhookUrl(
          "http://169.254.169.254/latest/meta-data"
        )
      ).ok
    ).toBe(false);
  });

  it("refuse IPv6 mappé loopback (dotted et hex)", async () => {
    expect(
      (await validateOutboundWebhookUrl("http://[::ffff:127.0.0.1]/")).ok
    ).toBe(false);
    expect(
      (await validateOutboundWebhookUrl("http://[::ffff:7f00:1]/")).ok
    ).toBe(false);
  });

  it("refuse DNS rebinding / nip.io (résolution privée)", async () => {
    expect(
      (
        await validateOutboundWebhookUrl(
          "https://127.0.0.1.nip.io/hook",
          loopbackLookup
        )
      ).ok
    ).toBe(false);
    expect(
      (
        await validateOutboundWebhookUrl(
          "https://localtest.me/hook",
          loopbackLookup
        )
      ).ok
    ).toBe(false);
    expect(
      (
        await validateOutboundWebhookUrl(
          "http://169.254.169.254.nip.io/latest/meta-data",
          linkLocalLookup
        )
      ).ok
    ).toBe(false);
  });

  it("refuse si une seule adresse résolue est privée", async () => {
    expect(
      (
        await validateOutboundWebhookUrl(
          "https://hooks.example.com/x",
          mixedLookup
        )
      ).ok
    ).toBe(false);
  });

  it("refuse si DNS échoue", async () => {
    const failing: WebhookDnsLookup = async () => {
      throw new Error("ENOTFOUND");
    };
    const r = await validateOutboundWebhookUrl(
      "https://does-not-resolve.example/x",
      failing
    );
    expect(r.ok).toBe(false);
  });

  it("exige https en production", async () => {
    process.env.APP_ENV = "production";
    expect(
      (
        await validateOutboundWebhookUrl(
          "http://hooks.example.com/x",
          publicLookup
        )
      ).ok
    ).toBe(false);
    expect(
      (
        await validateOutboundWebhookUrl(
          "https://hooks.example.com/x",
          publicLookup
        )
      ).ok
    ).toBe(true);
  });
});
