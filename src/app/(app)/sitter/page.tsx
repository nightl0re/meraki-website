import type { Metadata } from "next";
import Link from "next/link";
import { CalendarBlank, Tray } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { zonedParts, zonedToUtc } from "@/lib/time";
import { setAccepting } from "@/app/actions/sitter";
import { BookingRow } from "@/components/booking-row";
import { Alert, Card, EmptyState, LinkButton, Rating, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Sitter dashboard" };

export default async function SitterDashboard() {
  const user = await requireUser(["SITTER"]);
  const now = new Date();
  const p = zonedParts(now);
  const monthStart = zonedToUtc(`${p.year}-${String(p.month).padStart(2, "0")}-01`, "00:00")!;
  const parentSelect = { select: { firstName: true, lastName: true, avatarUrl: true } };

  const [profile, requests, upcoming, earnedMonth, pending, availabilityCount] = await Promise.all([
    db.sitterProfile.findUniqueOrThrow({ where: { userId: user.id } }),
    db.booking.findMany({
      where: { sitterId: user.id, status: "REQUESTED" },
      orderBy: { respondBy: "asc" },
      include: { parent: parentSelect },
    }),
    db.booking.findMany({
      where: { sitterId: user.id, status: "ACCEPTED", endsAt: { gt: now } },
      orderBy: { startsAt: "asc" },
      take: 6,
      include: { parent: parentSelect },
    }),
    db.payout.aggregate({
      where: { sitterId: user.id, status: { not: "CANCELLED" }, createdAt: { gte: monthStart } },
      _sum: { amountCents: true },
    }),
    db.payout.aggregate({ where: { sitterId: user.id, status: "PENDING" }, _sum: { amountCents: true } }),
    db.availability.count({ where: { sitterId: user.id } }),
  ]);

  const incomplete = !profile.bio || !profile.headline || availabilityCount === 0;

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Hi {user.firstName}</h1>
          <p className="mt-1 text-ink-3">
            {user.status === "ACTIVE"
              ? profile.acceptingBookings ? "You're visible to families nearby." : "You're hidden from new bookings."
              : "Your profile is waiting for review."}
          </p>
        </div>
        {user.status === "ACTIVE" && (
          <form action={setAccepting}>
            <input type="hidden" name="accepting" value={profile.acceptingBookings ? "0" : "1"} />
            <button className={buttonClass(profile.acceptingBookings ? "secondary" : "primary")}>
              {profile.acceptingBookings ? "Pause new bookings" : "Start taking bookings"}
            </button>
          </form>
        )}
      </div>

      {user.status === "PENDING_REVIEW" && (
        <Alert tone={incomplete ? "warn" : "info"}>
          {incomplete
            ? <>Finish your profile so we can review it: add a headline, a bio and your weekly availability. <Link href="/sitter/profile" className="font-medium underline">Complete profile</Link></>
            : "Thanks! Your profile is complete and our team will review it within one business day."}
        </Alert>
      )}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
        <Stat label="Earned this month" value={formatMoney(earnedMonth._sum.amountCents ?? 0)} />
        <Stat label="Next payout" value={formatMoney(pending._sum.amountCents ?? 0)} />
        <Stat label="Jobs completed" value={String(profile.completedJobs)} />
        <div className="bg-surface p-5">
          <dt className="text-sm text-ink-3">Rating</dt>
          <dd className="mt-1.5"><Rating avg={profile.ratingAvg} count={profile.ratingCount} size="md" /></dd>
        </div>
      </dl>

      <section aria-labelledby="req-heading">
        <h2 id="req-heading" className="mb-3 font-semibold">
          Requests {requests.length > 0 && <span className="ml-1 rounded-full bg-warn-soft px-2 text-sm text-warn tabular">{requests.length}</span>}
        </h2>
        {requests.length === 0 ? (
          <EmptyState icon={<Tray size={28} />} title="No new requests" body="New booking requests from families will show up here." />
        ) : (
          <Card className="p-2">
            <ul className="divide-y divide-line">
              {requests.map((b) => <BookingRow key={b.id} viewer="SITTER" b={{ ...b, person: b.parent }} />)}
            </ul>
          </Card>
        )}
      </section>

      <section aria-labelledby="up-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="up-heading" className="font-semibold">Your schedule</h2>
          <Link href="/bookings" className="text-sm text-accent-strong hover:underline">All bookings</Link>
        </div>
        {upcoming.length === 0 ? (
          <EmptyState icon={<CalendarBlank size={28} />} title="Nothing scheduled" action={<LinkButton href="/sitter/profile" variant="secondary" size="sm">Update availability</LinkButton>} />
        ) : (
          <Card className="p-2">
            <ul className="divide-y divide-line">
              {upcoming.map((b) => <BookingRow key={b.id} viewer="SITTER" b={{ ...b, person: b.parent }} />)}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-5">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular">{value}</dd>
    </div>
  );
}
