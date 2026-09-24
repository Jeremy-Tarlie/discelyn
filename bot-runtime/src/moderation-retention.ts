/**
 * Miroir de `lib/moderation-retention.ts` — parité vérifiée par test web.
 */
export const MODERATION_WARNING_RETENTION_DAYS = 90;

export function moderationWarningCutoff(
  now = new Date(),
  retentionDays = MODERATION_WARNING_RETENTION_DAYS
): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}
