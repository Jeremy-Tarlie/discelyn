import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LoginButton } from "@/components/landing/LoginButton";

export const metadata: Metadata = {
  title: "Connexion",
};

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto flex max-w-lg flex-col px-6 py-24">
        <h1 className="font-display text-4xl text-mist-100">Connexion</h1>
        <p className="mt-3 text-mist-400">
          Connecte-toi avec Discord. On ne stocke pas de mot de passe.
        </p>
        <div className="mt-10">
          <LoginButton />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
