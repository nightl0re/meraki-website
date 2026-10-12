"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

const ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/sitters", label: "Sitter approvals" },
  { href: "/admin/disputes", label: "Disputes" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/users", label: "Users" },
];

export function AdminNav({ counts }: { counts: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
      {ITEMS.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-sm",
              active ? "bg-accent-soft font-semibold text-accent-strong" : "text-ink-2 hover:bg-surface-2",
            )}
          >
            {i.label}
            {counts[i.href] > 0 && (
              <span className="rounded-full bg-brand px-1.5 text-xs font-bold text-white tabular">{counts[i.href]}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
