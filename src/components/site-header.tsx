import Link from "next/link";
import { Bell } from "@phosphor-icons/react/ssr";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "@/app/actions/auth";
import { Logo } from "./logo";
import { Avatar, LinkButton } from "./ui";
import { MobileMenu } from "./mobile-menu";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const unread = user
    ? await db.notification.count({ where: { userId: user.id, readAt: null } })
    : 0;

  const links = !user
    ? [
        { href: "/sitters", label: "Find a sitter" },
        { href: "/signup?role=sitter", label: "Become a sitter" },
      ]
    : user.role === "PARENT"
      ? [
          { href: "/sitters", label: "Find a sitter" },
          { href: "/parent", label: "Dashboard" },
          { href: "/bookings", label: "Bookings" },
        ]
      : user.role === "SITTER"
        ? [
            { href: "/sitter", label: "Dashboard" },
            { href: "/bookings", label: "Bookings" },
            { href: "/sitter/earnings", label: "Earnings" },
          ]
        : [
            { href: "/admin", label: "Overview" },
            { href: "/admin/sitters", label: "Sitters" },
            { href: "/admin/bookings", label: "Bookings" },
          ];

  return (
    <header className="sticky top-0 z-30 print:hidden border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo href={user ? homeFor(user.role) : "/"} />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full px-3 py-1.5 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/notifications"
                className="relative inline-flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
                aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
              >
                <Bell size={20} />
                {unread > 0 && (
                  <span className="absolute right-1.5 top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-accent-ink tabular">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <details className="group relative hidden md:block">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full p-1 pr-3 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                  <Avatar src={user.avatarUrl} first={user.firstName} last={user.lastName} size={32} />
                  <span className="text-sm font-medium">{user.firstName}</span>
                </summary>
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-card">
                  <p className="truncate px-3 py-2 text-xs text-ink-3">{user.email}</p>
                  {user.role === "PARENT" && (
                    <>
                      <MenuLink href="/favorites">Saved sitters</MenuLink>
                      <MenuLink href="/settings/payment">Payment methods</MenuLink>
                    </>
                  )}
                  {user.role === "SITTER" && <MenuLink href="/sitter/profile">Profile & availability</MenuLink>}
                  <MenuLink href="/settings">Account settings</MenuLink>
                  <form action={logout}>
                    <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
                      Log out
                    </button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <LinkButton href="/login" variant="ghost">Log in</LinkButton>
              <LinkButton href="/signup">Sign up</LinkButton>
            </div>
          )}
          <MobileMenu
            links={[
              ...links,
              ...(user
                ? [
                    ...(user.role === "PARENT"
                      ? [{ href: "/favorites", label: "Saved sitters" }, { href: "/settings/payment", label: "Payment methods" }]
                      : user.role === "SITTER"
                        ? [{ href: "/sitter/profile", label: "Profile & availability" }]
                        : [{ href: "/admin/disputes", label: "Disputes" }, { href: "/admin/payouts", label: "Payouts" }]),
                    { href: "/settings", label: "Account settings" },
                  ]
                : [{ href: "/login", label: "Log in" }, { href: "/signup", label: "Sign up" }]),
            ]}
            logoutAction={user ? logout : undefined}
          />
        </div>
      </div>
    </header>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
      {children}
    </Link>
  );
}
