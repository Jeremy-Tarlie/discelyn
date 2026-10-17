import type { ReactNode } from "react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { AmbientOrbs } from "@/components/landing/AmbientOrbs";

/** Server-only chrome: SiteHeader reads theme cookies via next/headers. */
export async function AuthPageChrome({
  signedIn = false,
  children,
}: {
  signedIn?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <AmbientOrbs variant="login" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <SiteHeader signedIn={signedIn} />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
    </div>
  );
}
