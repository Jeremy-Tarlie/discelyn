import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";

describe("authorizeCron", () => {
  const prev = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret-value";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  it("refuse sans secret env", () => {
    delete process.env.CRON_SECRET;
    const req = new NextRequest("http://localhost/api/cron/retention", {
      method: "POST",
      headers: { authorization: "Bearer test-cron-secret-value" },
    });
    expect(authorizeCron(req)).toBe(false);
  });

  it("refuse sans Authorization", () => {
    const req = new NextRequest("http://localhost/api/cron/retention", {
      method: "POST",
    });
    expect(authorizeCron(req)).toBe(false);
  });

  it("refuse un mauvais Bearer", () => {
    const req = new NextRequest("http://localhost/api/cron/retention", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    });
    expect(authorizeCron(req)).toBe(false);
  });

  it("accepte le bon Bearer", () => {
    const req = new NextRequest("http://localhost/api/cron/retention", {
      method: "POST",
      headers: { authorization: "Bearer test-cron-secret-value" },
    });
    expect(authorizeCron(req)).toBe(true);
  });
});
