import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, LOCALE_COOKIE, parseLocale } from "./config";

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = parseLocale(store.get(LOCALE_COOKIE)?.value ?? defaultLocale);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
