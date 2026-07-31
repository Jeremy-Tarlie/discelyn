import type { NextRequest } from "next/server";

export function hasSessionCookie(request: NextRequest): boolean {
  return Boolean(
    request.cookies.get("next-auth.session-token")?.value ||
      request.cookies.get("__Secure-next-auth.session-token")?.value
  );
}
