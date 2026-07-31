import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";

export const metadata: Metadata = { title: "Confidentialité" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="prose prose-invert mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl text-mist-100">Confidentialité</h1>
        <p className="mt-4 text-mist-300">
          Botly collecte l&apos;identité Discord nécessaire à l&apos;auth
          (identifiant, email, avatar), les données de configuration de tes
          bots, et les identifiants Stripe pour la facturation. Aucune donnée
          n&apos;est revendue. Les paiements sont traités par Stripe.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
