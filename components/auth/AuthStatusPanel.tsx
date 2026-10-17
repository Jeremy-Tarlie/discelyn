"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

type AuthStatusAction = {
  href: string;
  label: string;
};

export function AuthStatusPanel({
  tone,
  title,
  description,
  action,
}: {
  tone: "success" | "error";
  title: string;
  description: string;
  action: AuthStatusAction;
}) {
  const isSuccess = tone === "success";
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col items-center text-center">
      <span
        aria-hidden
        className={`mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl ring-1 animate-scale-in ${
          isSuccess
            ? "bg-signal/15 text-signal ring-signal/30 shadow-[0_0_32px_-8px_rgba(61,207,176,0.55)]"
            : "bg-warn/15 text-warn ring-warn/35"
        }`}
      >
        <span className={isSuccess ? "animate-pulse-soft" : undefined}>
          {isSuccess ? <CheckIcon /> : <WarnIcon />}
        </span>
      </span>

      <div
        className="animate-fade-up"
        role={isSuccess ? "status" : "alert"}
        aria-live={isSuccess ? "polite" : "assertive"}
      >
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-2xl font-bold tracking-tight text-[color:var(--page-fg)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] sm:text-[1.75rem]"
        >
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[color:var(--muted)]">
          {description}
        </p>
      </div>

      <Link
        href={action.href}
        className={`mt-8 inline-flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] ${
          isSuccess
            ? "bg-signal text-ink-950 shadow-[0_8px_24px_-12px_rgba(61,207,176,0.7)] hover:bg-signal-glow"
            : "bg-[color:var(--page-fg)] text-[color:var(--page-bg)] hover:opacity-90"
        }`}
      >
        {action.label}
      </Link>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5 9.5 17 19 7"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 8v5.5M12 16.5h.01"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <path
        d="M10.2 4.8 2.9 17.2A2 2 0 0 0 4.6 20h14.8a2 2 0 0 0 1.7-2.8L13.8 4.8a2 2 0 0 0-3.6 0Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
