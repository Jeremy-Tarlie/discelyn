"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { PASSWORD_MAX_LENGTH } from "@/lib/password-policy";

const inputClass =
  "w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2.5 pr-11 text-[color:var(--page-fg)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2 2 0 002.8 2.8" />
        <path d="M9.9 5.1A9.8 9.8 0 0112 5c5 0 9.3 3.1 11 7-0.5 1.2-1.3 2.4-2.3 3.4" />
        <path d="M6.1 6.1C4.2 7.4 2.7 9.1 1.9 11c1.7 3.9 6 7 10.1 7 1.4 0 2.7-.3 3.9-.8" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M1.9 12C3.6 8.1 7.9 5 12 5s8.4 3.1 10.1 7c-1.7 3.9-6 7-10.1 7S3.6 15.9 1.9 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required = true,
  minLength,
  maxLength = PASSWORD_MAX_LENGTH,
  name,
  describedBy,
  invalid = false,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  name?: string;
  describedBy?: string;
  invalid?: boolean;
}) {
  const t = useTranslations("password");
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <label className="block space-y-1 text-sm" htmlFor={inputId}>
      <span className="text-[color:var(--muted)]">{label}</span>
      <span className="relative block">
        <input
          id={inputId}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[color:var(--muted)] transition hover:text-[color:var(--page-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
          aria-pressed={visible}
          aria-label={visible ? t("hide") : t("show")}
          onClick={() => setVisible((v) => !v)}
        >
          <EyeIcon open={visible} />
        </button>
      </span>
    </label>
  );
}
