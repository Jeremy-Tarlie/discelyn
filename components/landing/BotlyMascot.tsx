import Image from "next/image";

/** Mascotte hero — même taille partout, sans mask / contour. */
export function BotlyMascot({
  priority = false,
  className = "",
  size = "hero",
}: {
  priority?: boolean;
  className?: string;
  size?: "hero" | "cta";
}) {
  const dim =
    size === "cta"
      ? "h-44 w-44"
      : "aspect-square w-[min(100%,20rem)] md:w-[min(100%,24rem)]";

  return (
    <div className={`animate-float relative ${dim} ${className}`.trim()}>
      <Image
        src="/brand/botly-mascot-transparent.png"
        alt="Mascotte Botly"
        fill
        priority={priority}
        className="object-contain object-bottom drop-shadow-[0_20px_40px_rgba(0,0,0,0.35)]"
        sizes={
          size === "cta"
            ? "176px"
            : "(max-width: 768px) 90vw, 384px"
        }
      />
    </div>
  );
}
