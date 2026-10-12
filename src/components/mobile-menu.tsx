"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, X } from "@phosphor-icons/react";

export function MobileMenu({
  links,
  logoutAction,
}: {
  links: { href: string; label: string }[];
  logoutAction?: () => Promise<void>;
}) {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (fn: (o: boolean) => boolean) => setOpenOn(fn(open) ? pathname : null);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
          className="absolute inset-x-0 top-16 border-b border-line bg-bg px-4 pb-6 pt-2 shadow-card"
        >
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded-lg px-3 py-3 text-base text-ink hover:bg-surface-2">
                  {l.label}
                </Link>
              </li>
            ))}
            {logoutAction && (
              <li>
                <form action={logoutAction}>
                  <button className="w-full rounded-lg px-3 py-3 text-left text-base text-ink-2 hover:bg-surface-2">
                    Log out
                  </button>
                </form>
              </li>
            )}
          </ul>
        </nav>
      )}
    </div>
  );
}
