import type { ReactNode } from "react";
import { DiscelynMark } from "@/components/landing/DiscelynMark";

/** Card body only — safe to import from Client Components. */
export function AuthPageShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-md flex-col items-center justify-center px-6 py-16 outline-none"
    >
      <div className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-8 sm:p-10">
        <DiscelynMark size="xl" className="mx-auto mb-6" />
        <h1 className="text-center font-display text-3xl font-bold text-[color:var(--page-fg)]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mx-auto mt-3 max-w-sm text-center text-sm text-[color:var(--muted)]">
            {subtitle}
          </p>
        ) : null}
        <div className="mt-8">{children}</div>
        {footer ? (
          <div className="mt-6 text-center text-xs text-[color:var(--muted)]">
            {footer}
          </div>
        ) : null}
      </div>
    </main>
  );
}
