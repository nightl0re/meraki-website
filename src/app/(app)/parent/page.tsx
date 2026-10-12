import type { Metadata } from "next";
import Link from "next/link";
import { CalendarBlank, CreditCard, Heart, Warning } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney, formatRate } from "@/lib/format";
import { BookingRow } from "@/components/booking-row";
import { LocationSearch } from "@/components/location-search";
import { Avatar, Card, EmptyState, LinkButton, Rating } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };

export default async function ParentDashboard() {
  const user = await requireUser(["PARENT"]);
  const now = new Date();
  const personSelect = { select: { firstName: true, lastName: true, avatarUrl: true } };

  const [toConfirm, upcoming, favorites, cards, me] = await Promise.all([
    db.booking.findMany({
      where: { parentId: user.id, status: "ACCEPTED", endsAt: { lte: now } },
      orderBy: { endsAt: "asc" },
      include: { sitter: personSelect },
    }),
    db.booking.findMany({
      where: { parentId: user.id, status: { in: ["REQUESTED", "ACCEPTED"] }, endsAt: { gt: now } },
      orderBy: { startsAt: "asc" },
      take: 5,
      include: { sitter: personSelect },
    }),
    db.favorite.findMany({
      where: { parentId: user.id, sitter: { status: "ACTIVE" } },
      take: 4,
      orderBy: { createdAt: "desc" },
      include: {
        sitter: {
          select: {
            id: true, firstName: true, lastName: true, avatarUrl: true, area: true,
            sitterProfile: { select: { hourlyRateCents: true, ratingAvg: true, ratingCount: true } },
          },
        },
      },
    }),
    db.paymentMethod.count({ where: { userId: user.id, removedAt: null } }),
    db.user.findUnique({ where: { id: user.id }, select: { area: true } }),
  ]);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Hi {user.firstName}</h1>
          <p className="mt-1 text-ink-3">Need someone this week?</p>
        </div>
        <div className="w-full md:max-w-md">
          <LocationSearch size="md" defaultValue={me?.area ?? ""} />
        </div>
      </div>

      {toConfirm.length > 0 && (
        <section aria-labelledby="confirm-heading">
          <h2 id="confirm-heading" className="mb-3 flex items-center gap-2 font-semibold">
            <Warning size={18} className="text-warn" aria-hidden /> Confirm finished jobs
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {toConfirm.map((b) => (
              <Card key={b.id} className="flex items-center gap-4 border-warn/30 p-4">
                <Avatar src={b.sitter.avatarUrl} first={b.sitter.firstName} last={b.sitter.lastName} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{b.sitter.firstName}, {formatDate(b.startsAt)}</p>
                  <p className="text-sm text-ink-3">{formatMoney(b.totalCents)} held on your card</p>
                </div>
                <LinkButton href={`/bookings/${b.id}`} size="sm">Review</LinkButton>
              </Card>
            ))}
          </div>
        </section>
      )}

      {cards === 0 && (
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <CreditCard size={28} className="text-accent" aria-hidden />
          <div className="flex-1">
            <p className="font-medium">Add a card to book faster</p>
            <p className="text-sm text-ink-3">You&apos;re only charged after a job is done.</p>
          </div>
          <LinkButton href="/settings/payment" variant="secondary" size="sm">Add card</LinkButton>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="upcoming-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="upcoming-heading" className="font-semibold">Coming up</h2>
            <Link href="/bookings" className="text-sm text-accent-strong hover:underline">All bookings</Link>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState icon={<CalendarBlank size={28} />} title="No upcoming bookings" action={<LinkButton href="/sitters" size="sm">Find a sitter</LinkButton>} />
          ) : (
            <Card className="p-2">
              <ul className="divide-y divide-line">
                {upcoming.map((b) => <BookingRow key={b.id} viewer="PARENT" b={{ ...b, person: b.sitter }} />)}
              </ul>
            </Card>
          )}
        </section>

        <section aria-labelledby="saved-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="saved-heading" className="font-semibold">Saved sitters</h2>
            <Link href="/favorites" className="text-sm text-accent-strong hover:underline">See all</Link>
          </div>
          {favorites.length === 0 ? (
            <EmptyState icon={<Heart size={28} />} title="No saved sitters" body="Tap Save on a sitter's profile to keep them here." />
          ) : (
            <ul className="space-y-2">
              {favorites.map(({ sitter: s }) => (
                <li key={s.id}>
                  <Link href={`/sitters/${s.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:border-line-strong">
                    <Avatar src={s.avatarUrl} first={s.firstName} last={s.lastName} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.firstName} {s.lastName.charAt(0)}.</p>
                      <p className="text-sm text-ink-3">{s.area}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular">{formatRate(s.sitterProfile?.hourlyRateCents ?? 0)}</p>
                      <Rating avg={s.sitterProfile?.ratingAvg ?? 0} count={s.sitterProfile?.ratingCount ?? 0} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
