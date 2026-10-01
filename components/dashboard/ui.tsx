import type { ReactNode } from "react";

export const dashFieldClass =
  "w-full rounded-xl border border-line bg-surface-muted px-3.5 py-2.5 text-sm text-page-fg outline-none transition placeholder:text-soft/70 focus:border-signal/40 focus:ring-1 focus:ring-signal/40";

export const dashBtnPrimaryClass =
  "inline-flex items-center justify-center rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50";

export const dashBtnGhostClass =
  "inline-flex items-center justify-center rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-page-fg transition hover:border-signal/50 hover:text-signal disabled:opacity-50";

export function DashboardPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight text-page-fg">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-soft">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function DashboardPanel({
  title,
  description,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] sm:p-6 ${className}`}
    >
      {title ? (
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-soft">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-soft/90">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function DashboardEmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface-muted/40 px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-signal/10 text-signal">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 7.5h16M6 12h12M8 16.5h8"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-page-fg">{title}</p>
      {hint ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-soft">{hint}</p>
      ) : null}
    </div>
  );
}

export function DashboardBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "signal" | "warn" | "accent";
}) {
  const tones = {
    neutral: "bg-surface-muted text-soft",
    signal: "bg-signal/15 text-signal",
    warn: "bg-warn/15 text-warn",
    accent: "bg-[#5865F2]/15 text-[#5865F2]",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function DashboardAlert({
  tone,
  children,
}: {
  tone: "error" | "ok" | "muted";
  children: ReactNode;
}) {
  const styles =
    tone === "error"
      ? "border-warn/30 bg-warn/10 text-warn"
      : tone === "ok"
        ? "border-signal/30 bg-signal/10 text-signal"
        : "border-line bg-surface-muted text-soft";
  return (
    <p className={`rounded-xl border px-3.5 py-2.5 text-sm ${styles}`}>
      {children}
    </p>
  );
}
