import Link from "next/link";

const nav = [
  { href: "/dashboard", label: "Vue d'ensemble" },
  { href: "/dashboard/bots", label: "Mes bots" },
  { href: "/dashboard/billing", label: "Abonnement" },
];

export function DashboardNav({ planName }: { planName: string }) {
  return (
    <aside className="flex w-full flex-col gap-8 border-b border-ink-600/70 bg-ink-900/60 p-6 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
      <div>
        <Link href="/" className="font-display text-lg font-bold text-mist-100">
          Botly
        </Link>
        <p className="mt-1 text-xs uppercase tracking-wider text-signal">
          Plan {planName}
        </p>
      </div>
      <nav className="flex flex-row gap-3 md:flex-col">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-2 text-sm text-mist-300 transition hover:bg-ink-700 hover:text-mist-100"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <Link
        href="/api/auth/signout"
        className="mt-auto text-sm text-mist-400 hover:text-warn"
      >
        Déconnexion
      </Link>
    </aside>
  );
}
