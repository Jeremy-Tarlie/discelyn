type FeatureIconProps = {
  name:
    | "access"
    | "welcome"
    | "ticket"
    | "mod"
    | "commands"
    | "rgpd"
    | "dashboard";
  className?: string;
};

const COLORS: Record<FeatureIconProps["name"], string> = {
  access: "bg-[#5865F2]",
  welcome: "bg-[#3dcfb0]",
  ticket: "bg-[#57f287] text-ink-950",
  mod: "bg-[#ed4245]",
  commands: "bg-[#fee75c] text-ink-950",
  rgpd: "bg-[#eb459e]",
  dashboard: "bg-[#99aab5] text-ink-950",
};

/** Pictogrammes produit — access en premier (wedge vs bots hobby). */
export function FeatureIcon({ name, className = "" }: FeatureIconProps) {
  return (
    <span
      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-md ${COLORS[name]} ${className}`}
    >
      {name === "access" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5Zm-3 8V6a3 3 0 1 1 6 0v3H9Zm3 5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
        </svg>
      ) : null}
      {name === "welcome" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4 0-8 2-8 4v1h16v-1c0-2-4-4-8-4Z" />
        </svg>
      ) : null}
      {name === "ticket" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M20 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2a2 2 0 1 1 0 4v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2a2 2 0 1 1 0-4Zm-8 5.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
        </svg>
      ) : null}
      {name === "mod" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm0 4 5 2v3.1c0 3.2-1.9 6.1-5 7.4-3.1-1.3-5-4.2-5-7.4V8l5-2Z" />
        </svg>
      ) : null}
      {name === "commands" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M4 5h16v2H4V5Zm0 6h10v2H4v-2Zm0 6h16v2H4v-2Z" />
        </svg>
      ) : null}
      {name === "rgpd" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm1 7V3.5L18.5 9H15ZM8 13h8v2H8v-2Zm0 4h8v2H8v-2Z" />
        </svg>
      ) : null}
      {name === "dashboard" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M3 3h8v8H3V3Zm10 0h8v5h-8V3ZM3 13h5v8H3v-8Zm7 0h11v8H10v-8Z" />
        </svg>
      ) : null}
    </span>
  );
}
