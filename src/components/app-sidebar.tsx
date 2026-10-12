"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOut } from "@phosphor-icons/react";
import type { NavBadge, NavItem } from "@/lib/nav";
import { NavIcon } from "./nav-icon";
import { cn } from "./ui";

export function isActive(path: string, href: string) {
  if (href === "/parent" || href === "/sitter" || href === "/admin" || href === "/settings") return path === href;
  return path === href || path.startsWith(`${href}/`);
}

// Left-hand menu for signed-in pages, like the desktop app's sidebar.
export function AppSidebar({
  items,
  counts,
  profile,
  logoutAction,
}: {
  items: NavItem[];
  counts: Partial<Record<NavBadge, number>>;
  profile: React.ReactNode;
  logoutAction: () => Promise<void>;
}) {
  const path = usePathname();
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-20 flex max-h-[calc(100dvh-6rem)] flex-col gap-4 overflow-y-auto pb-6">
        {profile}
        <nav aria-label="Account" className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = isActive(path, item.href);
            const count = item.badge ? counts[item.badge] ?? 0 : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[15px] transition-colors",
                  active ? "bg-accent-soft font-semibold text-accent-strong" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                <NavIcon name={item.icon} active={active} />
                <span className="flex-1">{item.label}</span>
                {count > 0 && (
                  <span className="min-w-5 rounded-full bg-brand px-1.5 text-center text-xs font-bold leading-5 text-white tabular">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="border-t border-line pt-3">
          <button className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-[15px] text-ink-2 hover:bg-surface-2 hover:text-ink">
            <SignOut size={20} aria-hidden /> Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
