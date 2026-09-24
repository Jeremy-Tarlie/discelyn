/**
 * Purge des warns de modération au-delà de la durée de conservation RGPD.
 */

export const MODERATION_WARNING_RETENTION_DAYS = 90;

export function moderationWarningCutoff(
  now = new Date(),
  retentionDays = MODERATION_WARNING_RETENTION_DAYS
): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}
