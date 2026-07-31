import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";

export const metadata: Metadata = { title: "CGU" };

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl text-mist-100">CGU</h1>
        <p className="mt-4 text-mist-300">
          Botly fournit un service d&apos;hébergement et de configuration de
          bots Discord. L&apos;usage abusif (spam, raid, contenu illégal)
          entraîne la suspension immédiate. Les abonnements sont mensuels et
          résiliables via le portail Stripe.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
