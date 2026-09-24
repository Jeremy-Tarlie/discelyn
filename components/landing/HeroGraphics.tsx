/** Motifs géométriques hero (points, +, cercles, triangles). */
export function HeroPatterns({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full text-white ${className}`}
      aria-hidden
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="botly-dots"
          x="0"
          y="0"
          width="56"
          height="56"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="6" cy="6" r="2.5" fill="currentColor" opacity="0.45" />
        </pattern>
      </defs>
      <rect width="1200" height="600" fill="url(#botly-dots)" opacity="0.2" />

      <g fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.35">
        <circle cx="140" cy="160" r="28" />
        <circle cx="1050" cy="120" r="18" />
        <circle cx="980" cy="420" r="36" />
        <path d="M180 420 L210 470 L150 470 Z" />
        <path d="M1080 280 L1110 330 L1050 330 Z" />
      </g>

      <g stroke="currentColor" strokeWidth="2.5" opacity="0.4">
        <path d="M420 80 h16 M428 72 v16" />
        <path d="M860 200 h18 M869 191 v18" />
        <path d="M260 300 h14 M267 293 v14" />
        <path d="M720 480 h16 M728 472 v16" />
      </g>

      <g fill="currentColor" opacity="0.35">
        <circle cx="320" cy="480" r="4" />
        <circle cx="900" cy="80" r="3.5" />
        <circle cx="80" cy="340" r="3" />
        <circle cx="1120" cy="500" r="4" />
      </g>
    </svg>
  );
}

/** Vague de transition hero → contenu (style Carl-bot). */
export function HeroWave({ fill = "var(--wave-fill)" }: { fill?: string }) {
  return (
    <div className="relative -mb-px w-full overflow-hidden leading-none">
      <svg
        viewBox="0 0 1440 88"
        className="block h-[48px] w-full sm:h-[72px]"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0,48 C180,88 360,8 540,48 C720,88 900,8 1080,48 C1200,72 1320,40 1440,48 L1440,88 L0,88 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}
