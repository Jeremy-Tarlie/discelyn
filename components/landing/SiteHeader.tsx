import Link from "next/link";

const links = [
  { href: "/pricing", label: "Tarifs" },
  { href: "/login", label: "Connexion" },
];

export function SiteHeader({
  signedIn = false,
}: {
  signedIn?: boolean;
}) {
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
      <Link href="/" className="font-display text-xl font-bold tracking-tight text-mist-100">
        Botly
      </Link>
      <nav className="flex items-center gap-6 text-sm text-mist-300">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="transition hover:text-signal"
          >
            {link.label}
          </Link>
        ))}
        <Link
          href={signedIn ? "/dashboard" : "/login"}
          className="rounded-full bg-signal px-4 py-2 font-medium text-ink-950 transition hover:bg-signal-glow"
        >
          {signedIn ? "Dashboard" : "Commencer"}
        </Link>
      </nav>
    </header>
  );
}
