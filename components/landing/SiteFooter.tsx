import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-600/60 bg-ink-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-mist-400 md:flex-row md:items-center md:justify-between">
        <p className="font-display text-mist-200">Botly</p>
        <div className="flex gap-5">
          <Link href="/pricing" className="hover:text-signal">
            Tarifs
          </Link>
          <Link href="/privacy" className="hover:text-signal">
            Confidentialité
          </Link>
          <Link href="/terms" className="hover:text-signal">
            CGU
          </Link>
        </div>
        <p>© {new Date().getFullYear()} Botly</p>
      </div>
    </footer>
  );
}
