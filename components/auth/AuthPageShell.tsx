import type { ReactNode } from "react";
import { DiscelynMark } from "@/components/landing/DiscelynMark";

/** Card body only — safe to import from Client Components. */
export function AuthPageShell({
  title,
  subtitle,
  children,
  footer,
  variant = "default",
  size = "md",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "default" | "status";
  size?: "md" | "lg";
}) {
  const isStatus = variant === "status";
  const maxWidth = size === "lg" ? "max-w-lg" : "max-w-md";

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`mx-auto flex min-h-[calc(100vh-12rem)] ${maxWidth} flex-col items-center justify-center px-6 py-16 outline-none`}
    >
      <div
        className={`animate-fade-up relative w-full overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/85 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl ${
          isStatus ? "p-8 sm:p-9" : "p-8 sm:p-10"
        }`}
      >
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-signal to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-signal/10 blur-3xl"
        />

        <div className="relative mb-7 flex items-center justify-center gap-2.5">
          <DiscelynMark size="lg" />
          <p className="font-display text-xl font-bold tracking-tight text-[color:var(--page-fg)]">
            discelyn
          </p>
        </div>

        {!isStatus && title ? (
          <h1 className="relative text-center font-display text-3xl font-bold tracking-tight text-[color:var(--page-fg)] sm:text-[2rem]">
            {title}
          </h1>
        ) : null}
        {!isStatus && subtitle ? (
          <p className="relative mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-[color:var(--muted)]">
            {subtitle}
          </p>
        ) : null}

        <div className={`relative ${!isStatus && title ? "mt-8" : "mt-2"}`}>
          {children}
        </div>

        {footer ? (
          <div className="relative mt-7 text-center text-xs text-[color:var(--muted)]">
            {footer}
          </div>
        ) : null}
      </div>
    </main>
  );
}
