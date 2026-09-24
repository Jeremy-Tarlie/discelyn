type AmbientOrbsProps = {
  variant?: "hero" | "page" | "login";
};

/** Orbes + grille décoratives — pure CSS, pas de JS. */
export function AmbientOrbs({ variant = "page" }: AmbientOrbsProps) {
  if (variant === "login") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="animate-orb-drift absolute left-1/2 top-1/3 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal/20 blur-[120px]" />
        <div className="animate-orb-drift-slow absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-[#5865F2]/15 blur-[100px]" />
        <div className="animate-orb-drift absolute -left-16 top-1/2 h-56 w-56 rounded-full bg-signal/10 blur-[90px]" />
        <div className="absolute inset-0 bg-grid-drift opacity-[0.35]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/35 to-transparent" />
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="animate-orb-drift absolute -left-20 top-0 h-80 w-80 rounded-full bg-signal/22 blur-[100px]" />
        <div className="animate-orb-drift-slow absolute -right-10 top-1/4 h-72 w-72 rounded-full bg-signal/12 blur-[110px]" />
        <div className="absolute inset-0 bg-grid-drift opacity-[0.28]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/35 to-transparent" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_70%,#07090d_100%)]" />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="animate-orb-drift absolute -left-20 top-0 h-64 w-64 rounded-full bg-signal/15 blur-[100px]" />
      <div className="animate-orb-drift-slow absolute -right-10 bottom-0 h-80 w-80 rounded-full bg-signal/10 blur-[110px]" />
      <div className="absolute inset-0 bg-grid-drift opacity-30" />
    </div>
  );
}
