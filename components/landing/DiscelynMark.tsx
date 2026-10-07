type DiscelynMarkSize = "sm" | "md" | "lg" | "xl";
type DiscelynMarkTone = "solid" | "soft";
type DiscelynMarkShape = "square" | "circle";

const BOX_CLASS: Record<DiscelynMarkSize, string> = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
};

const SQUARE_RADIUS: Record<DiscelynMarkSize, string> = {
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-2xl",
};

const SQUARE_TEXT: Record<DiscelynMarkSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-sm",
  xl: "font-display text-lg",
};

const TONE_CLASS: Record<DiscelynMarkTone, string> = {
  solid: "bg-signal text-ink-950",
  soft: "bg-signal/20 text-signal",
};

type DiscelynMarkProps = {
  size?: DiscelynMarkSize;
  tone?: DiscelynMarkTone;
  shape?: DiscelynMarkShape;
  className?: string;
};

/** Marque Discelyn (lettre D) — header, footer, login, mocks. */
export function DiscelynMark({
  size = "md",
  tone = "solid",
  shape = "square",
  className = "",
}: DiscelynMarkProps) {
  const radius = shape === "circle" ? "rounded-full" : SQUARE_RADIUS[size];
  const text =
    shape === "circle" ? "text-[10px]" : SQUARE_TEXT[size];

  return (
    <span
      aria-hidden
      className={[
        "inline-flex shrink-0 items-center justify-center font-bold",
        BOX_CLASS[size],
        text,
        radius,
        TONE_CLASS[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      D
    </span>
  );
}
