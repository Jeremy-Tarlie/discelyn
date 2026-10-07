import { randomBytes } from "node:crypto";

export const CLAIM_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function newClaimToken(): string {
  return randomBytes(24).toString("base64url");
}

export function newWebhookPathToken(): string {
  return randomBytes(24).toString("base64url");
}
