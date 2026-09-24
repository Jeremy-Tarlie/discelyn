"use client";

import {
  useCallback,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";

type GlowCardProps = {
  children: ReactNode;
  className?: string;
};

/** Carte avec halo qui suit le curseur au survol. */
export function GlowCard({ children, className = "" }: GlowCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    node.style.setProperty("--glow-x", `${x}%`);
    node.style.setProperty("--glow-y", `${y}%`);
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={`card-glow ${className}`.trim()}
    >
      {children}
    </div>
  );
}
