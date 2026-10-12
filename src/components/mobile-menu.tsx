"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, X } from "@phosphor-icons/react";
import { cn } from "./ui";

export function MobileMenu({
  links,
  logoutAction,
  hideFrom = "md",
  who,
}: {
  links: { href: string; label: string }[];
  logoutAction?: () => Promise<void>;
  hideFrom?: "md" | "lg";
  who?: string;
}) {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <div className={hideFrom === "lg" ? "lg:hidden" : "md:hidden"}>
      <button
        type="button"
        onClick={() => setOpenOn(open ? null : pathname)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-surface-2"
      >
        {open ? <X size={22} /> : <List size={22} />}
      </button>
      {open && (
        <nav
          id="mobile-menu"
          aria-label="Mobile"
          className="absolute inset-x-0 top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-line bg-white px-4 pb-6 pt-2 shadow-card"
        >
          {who && <p className="px-3 pb-2 pt-1 text-sm text-ink-3">Signed in as {who}</p>}
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={cn("block rounded-[10px] px-3 py-3 text-base hover:bg-surface-2", pathname === l.href ? "font-semibold text-accent-strong" : "text-ink")}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            {logoutAction && (
              <li>
                <form action={logoutAction}>
                  <button className="w-full rounded-[10px] px-3 py-3 text-left text-base text-ink-2 hover:bg-surface-2">Log out</button>
                </form>
              </li>
            )}
          </ul>
        </nav>
      )}
    </div>
  );
}
