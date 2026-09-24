import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/** Vérifie Authorization: Bearer $CRON_SECRET (comparaison constant-time). */
export function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  const expected = Buffer.from(secret, "utf8");
  const actual = Buffer.from(provided, "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
