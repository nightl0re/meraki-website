import { after } from "next/server";
import { SiteHeader } from "@/components/site-header";
import { AppSidebar } from "@/components/app-sidebar";
import { Avatar, Rating } from "@/components/ui";
import { sweep } from "@/lib/bookings";
import { getCurrentUser, roleLabel } from "@/lib/auth";
import { db } from "@/lib/db";
import { navFor } from "@/lib/nav";
import { navCounts } from "@/lib/nav-counts";
import { logout } from "@/app/actions/auth";

// Every signed-in page depends on the request (session, database), so it is
// never prerendered at build time.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Time-based housekeeping (expire unanswered requests, auto-confirm finished
  // jobs, close past job posts) runs after the response is sent, so it never
  // slows down or breaks the page. /api/cron does the same on a schedule.
  after(() => sweep().catch((e) => console.error("[sweep]", e)));
  const user = await getCurrentUser();
  // Pages call requireUser() themselves; this only decides whether to draw the sidebar.
  const counts = user ? await navCounts(user) : {};
  const sitter = user?.role === "SITTER"
    ? await db.sitterProfile.findUnique({ where: { userId: user.id }, select: { ratingAvg: true, ratingCount: true, verifiedAt: true } })
    : null;

  return (
    <>
      <SiteHeader variant="app" />
      <div className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 gap-8 px-4 py-6 sm:px-6 md:py-8 lg:grid-cols-[248px_minmax(0,1fr)]">
        {user && (
          <AppSidebar
            items={navFor(user.role)}
            counts={counts}
            logoutAction={logout}
            profile={
              <div className="rounded-2xl border border-line bg-surface-2 p-4">
                <div className="flex items-center gap-3">
                  <Avatar src={user.avatarUrl} first={user.firstName} last={user.lastName} size={44} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{user.firstName} {user.lastName}</p>
                    <p className="text-sm capitalize text-ink-3">{roleLabel(user.role)}</p>
                  </div>
                </div>
                {sitter && (
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <Rating avg={sitter.ratingAvg} count={sitter.ratingCount} />
                    <span className={sitter.verifiedAt ? "text-info" : "text-warn"}>{sitter.verifiedAt ? "Verified" : "In review"}</span>
                  </div>
                )}
              </div>
            }
          />
        )}
        <main className="min-w-0">{children}</main>
      </div>
    </>
  );
}
