import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/access";
import { listManageableGuilds } from "@/lib/discord";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

/** Liste les serveurs Discord administrables par l'utilisateur connecté. */
export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "discord-guilds",
    limit: 20,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: tApi(locale, "unauthenticated") }, { status: 401 });
  }

  const result = await listManageableGuilds(user.id);
  if (!result.ok) {
    const error =
      "code" in result ? tApi(locale, result.code) : result.error;
    return NextResponse.json({ error }, { status: 403 });
  }

  return NextResponse.json({ guilds: result.guilds });
}
