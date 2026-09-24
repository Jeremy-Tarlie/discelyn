import type { Locale } from "@/i18n/config";
import fr from "@/messages/fr.json";
import en from "@/messages/en.json";

type Messages = typeof fr;

const catalogs: Record<Locale, Messages> = { fr, en };

type ApiLeaf = Messages["api"];

type NestedKeyOf<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string
        ? K
        : `${K}.${NestedKeyOf<T[K]>}`;
    }[keyof T & string];

export type ApiMessageKey = NestedKeyOf<ApiLeaf>;

function getByPath(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

/** Translate API / Zod messages for a given locale (usable outside RSC). */
export function tApi(
  locale: Locale,
  key: ApiMessageKey,
  params?: Record<string, string | number>
): string {
  const catalog = catalogs[locale].api as Record<string, unknown>;
  let text = getByPath(catalog, key) ?? getByPath(catalogs.fr.api as Record<string, unknown>, key) ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
