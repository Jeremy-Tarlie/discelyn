import * as Sentry from "@sentry/nextjs";

/** Capture money-path / access errors for ops (Sentry if configured). */
export function captureMoneyPathError(
  error: unknown,
  context: {
    area: string;
    organizationId?: string | null;
    accessId?: string | null;
    extra?: Record<string, string | number | boolean | null>;
  }
): void {
  console.error(`[${context.area}]`, error);
  Sentry.withScope((scope) => {
    scope.setTag("money_path", context.area);
    if (context.organizationId) {
      scope.setTag("organizationId", context.organizationId);
    }
    if (context.accessId) {
      scope.setTag("accessId", context.accessId);
    }
    if (context.extra) {
      scope.setContext("money_path", context.extra);
    }
    Sentry.captureException(error);
  });
}
