import Link from "next/link";
import { Bell } from "@phosphor-icons/react/ssr";
import { getCurrentUser, homeFor, roleLabel } from "@/lib/auth";
import { navFor } from "@/lib/nav";
import { navCounts } from "@/lib/nav-counts";
import { logout } from "@/app/actions/auth";
import { Logo } from "./logo";
import { Avatar, LinkButton, cn } from "./ui";
import { MobileMenu } from "./mobile-menu";

const PUBLIC_LINKS = [
  { href: "/sitters", label: "Find a babysitter" },
  { href: "/about", label: "How it works" },
  { href: "/about/sitters", label: "For babysitters" },
];

export async function SiteHeader({ variant = "site" }: { variant?: "site" | "app" }) {
  const user = await getCurrentUser();
  const counts = user ? await navCounts(user) : {};
  const unread = counts.notifications ?? 0;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur-md print:hidden">
      <div className={cn("mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6", variant === "app" ? "max-w-[1400px]" : "max-w-7xl")}>
        <div className="flex items-center gap-8">
          <Logo href={user ? homeFor(user.role) : "/"} />
          {variant === "site" && (
            <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
              {PUBLIC_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="rounded-[10px] px-3 py-2 text-[15px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
                  {l.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {variant === "site" && (
                <LinkButton href={homeFor(user.role)} variant="secondary" size="sm" className="hidden sm:inline-flex">
                  My dashboard
                </LinkButton>
              )}
              <Link
                href="/notifications"
                className="relative inline-flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
                aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
              >
                <Bell size={22} />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-white tabular">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link href="/settings" className="hidden items-center gap-2.5 rounded-full py-1 pl-1 pr-3 hover:bg-surface-2 md:flex">
                <Avatar src={user.avatarUrl} first={user.firstName} last={user.lastName} size={34} />
                <span className="leading-tight">
                  <span className="block text-sm font-semibold">{user.firstName} {user.lastName}</span>
                  <span className="block text-xs capitalize text-ink-3">{roleLabel(user.role)} account</span>
                </span>
              </Link>
            </>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <LinkButton href="/login" variant="ghost">Log in</LinkButton>
              <LinkButton href="/signup">Sign up</LinkButton>
            </div>
          )}
          <MobileMenu
            links={user ? navFor(user.role).map(({ href, label }) => ({ href, label })) : [...PUBLIC_LINKS, { href: "/login", label: "Log in" }, { href: "/signup", label: "Sign up" }]}
            hideFrom={variant === "app" ? "lg" : "md"}
            logoutAction={user ? logout : undefined}
            who={user ? `${user.firstName} ${user.lastName}, ${roleLabel(user.role)} account` : undefined}
          />
        </div>
      </div>
    </header>
  );
}
