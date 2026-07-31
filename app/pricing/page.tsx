import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { PricingGrid } from "@/components/landing/PricingGrid";

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "Plans Free, Starter 2,99 €, Pro 6,99 € et Business 12,99 €. Paiement sécurisé via Stripe.",
};

export default async function PricingPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen">
      <SiteHeader signedIn={Boolean(session)} />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="font-display text-4xl text-mist-100 sm:text-5xl">
          Tarifs simples
        </h1>
        <p className="mt-3 max-w-2xl text-mist-400">
          Commence gratuit. Passe au plan supérieur seulement si tu actives plus
          de modules. Abonnement mensuel, annulable via Stripe.
        </p>
        <div className="mt-12">
          <PricingGrid />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
