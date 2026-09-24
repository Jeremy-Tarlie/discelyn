import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE, type Theme } from "@/i18n/config";

export async function getRequestTheme(): Promise<Theme> {
  const jar = await cookies();
  return parseTheme(jar.get(THEME_COOKIE)?.value);
}
