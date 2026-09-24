"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export function DashboardNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-row gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
      {items.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-surface-muted font-semibold text-page-fg"
                : "text-soft hover:bg-surface-muted hover:text-page-fg"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
