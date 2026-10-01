/** Fuseaux proposés dans les préférences compte. */
export const TIMEZONE_OPTIONS = [
  "Europe/Paris",
  "Europe/Brussels",
  "Europe/London",
  "America/New_York",
  "America/Toronto",
  "America/Sao_Paulo",
  "Africa/Casablanca",
  "Asia/Dubai",
  "UTC",
] as const;

export type AppTimezone = (typeof TIMEZONE_OPTIONS)[number];

export function isAppTimezone(value: string): value is AppTimezone {
  return (TIMEZONE_OPTIONS as readonly string[]).includes(value);
}

export function formatInTimezone(
  date: Date,
  timezone: string,
  locale: string
): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(date);
  } catch {
    return date.toLocaleString(locale);
  }
}
