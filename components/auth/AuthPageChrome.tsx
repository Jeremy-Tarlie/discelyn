import type { ReactNode } from "react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";

/** Server-only chrome: SiteHeader reads theme cookies via next/headers. */
export async function AuthPageChrome({
  signedIn = false,
  children,
}: {
  signedIn?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <SiteHeader signedIn={signedIn} />
      {children}
      <SiteFooter />
    </div>
  );
}
