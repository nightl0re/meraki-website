import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { CalendarBlank } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { BookingRow } from "@/components/booking-row";
import { FINISHED, IN_PROGRESS_AFTER_JOB, UPCOMING, parentNeedsAction, sitterNeedsAction } from "@/lib/booking-filters";
import { Card, EmptyState, LinkButton, PageHeader, cn } from "@/components/ui";

export const metadata: Metadata = { title: "Bookings" };

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "action", label: "Needs action" },
  { key: "past", label: "Past" },
] as const;

export default async function BookingsPage({ searchParams }: PageProps<"/bookings">) {
  const user = await requireUser(["PARENT", "SITTER"]);
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "upcoming";
  const now = new Date();
  const mine: Prisma.BookingWhereInput = user.role === "PARENT" ? { parentId: user.id } : { sitterId: user.id };

  const filters: Record<typeof tab, Prisma.BookingWhereInput> = {
    upcoming: { status: UPCOMING, endsAt: { gt: now } },
    action: user.role === "PARENT" ? parentNeedsAction(user.id, now) : sitterNeedsAction(user.id, now),
    // Finished jobs, including ones still being confirmed or approved.
    past: { OR: [{ status: { in: [...FINISHED, ...IN_PROGRESS_AFTER_JOB] } }, { endsAt: { lte: now }, status: "ACCEPTED" }] },
  };

  const [bookings, actionCount] = await Promise.all([
    db.booking.findMany({
      where: { ...mine, ...filters[tab] },
      orderBy: { startsAt: tab === "past" ? "desc" : "asc" },
      take: 100,
      include: {
        parent: { select: { firstName: true, lastName: true, avatarUrl: true } },
        sitter: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
    }),
    db.booking.count({ where: { ...mine, ...filters.action } }),
  ]);

  return (
    <>
      <PageHeader
        title="Bookings"
        actions={user.role === "PARENT" ? <LinkButton href="/sitters">Book a sitter</LinkButton> : undefined}
      />
      <nav aria-label="Booking filters" className="mb-4 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/bookings?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm",
              tab === t.key ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {t.label}
            {t.key === "action" && actionCount > 0 && (
              <span className="rounded-full bg-warn-soft px-1.5 text-xs font-semibold text-warn tabular">{actionCount}</span>
            )}
          </Link>
        ))}
      </nav>

      {bookings.length === 0 ? (
        <EmptyState
          icon={<CalendarBlank size={32} />}
          title={tab === "action" ? "You're all caught up" : tab === "past" ? "No past bookings yet" : "Nothing coming up"}
          body={user.role === "PARENT" && tab === "upcoming" ? "Find a sitter near you and request a time." : undefined}
          action={user.role === "PARENT" && tab === "upcoming" ? <LinkButton href="/sitters">Find a sitter</LinkButton> : undefined}
        />
      ) : (
        <Card className="p-2">
          <ul className="divide-y divide-line">
            {bookings.map((b) => (
              <BookingRow
                key={b.id}
                viewer={user.role}
                b={{ ...b, person: user.role === "PARENT" ? b.sitter : b.parent }}
              />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
