import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Briefcase, CalendarBlank, CreditCard, Heart, MagnifyingGlass, Plus, Warning } from "@phosphor-icons/react/ssr";
import icon from "../../../../public/brand/meraki-icon.png";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { childAge, formatDate, formatMoney, formatRate, greeting } from "@/lib/format";
import { zonedParts } from "@/lib/time";
import { BookingRow } from "@/components/booking-row";
import { NotificationsPanel, Panel, PanelLink } from "@/components/dashboard-parts";
import { Alert, Avatar, Card, EmptyState, LinkButton, Rating } from "@/components/ui";

export const metadata: Metadata = { title: "Home" };

export default async function ParentHome({ searchParams }: PageProps<"/parent">) {
  const user = await requireUser(["PARENT"]);
  const welcome = (await searchParams).welcome === "1";
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000);
  const personSelect = { select: { id: true, firstName: true, lastName: true, avatarUrl: true } };

  const [toConfirm, upcoming, applicants, pastSitters, children, card, favorites] = await Promise.all([
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
    db.job.findMany({
      where: { parentId: user.id, status: "OPEN", applications: { some: { status: "APPLIED" } } },
      include: { _count: { select: { applications: { where: { status: "APPLIED" } } } } },
      take: 3,
    }),
    // "Book again": sitters from completed bookings, most recent first.
    db.booking.findMany({
      where: { parentId: user.id, status: "COMPLETED", sitter: { status: "ACTIVE" } },
      orderBy: { startsAt: "desc" },
      distinct: ["sitterId"],
      take: 4,
      select: {
        startsAt: true,
        sitter: {
          select: {
            id: true, firstName: true, lastName: true, avatarUrl: true,
            sitterProfile: { select: { hourlyRateCents: true, ratingAvg: true, ratingCount: true } },
          },
        },
      },
    }),
    db.child.findMany({ where: { parentId: user.id }, orderBy: { birthYear: "desc" } }),
    db.paymentMethod.findFirst({ where: { userId: user.id, removedAt: null }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
    db.favorite.count({ where: { parentId: user.id } }),
  ]);

  const thisWeek = upcoming.filter((b) => b.startsAt < weekAhead).length;
  const hour = zonedParts(now).hour;

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-8">
        {/* Greeting */}
        <section className="flex items-center gap-5 overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#fdeee8_0%,#fff4e6_60%,#e1f0ef_100%)] p-6 sm:p-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold sm:text-3xl">{greeting(hour)}, {user.firstName}</h1>
            <p className="mt-1.5 text-ink-2">
              {thisWeek === 0 ? "No bookings in the next 7 days." : `You have ${thisWeek} ${thisWeek === 1 ? "booking" : "bookings"} in the next 7 days.`}
            </p>
          </div>
          <Image src={icon} alt="" width={88} height={88} className="hidden shrink-0 rounded-[22%] shadow-card sm:block" />
        </section>

        {welcome && <Alert tone="accent">Welcome to Meraki! Start by adding your children and a card, then find a sitter or post a job.</Alert>}

        {/* Quick actions, as on the desktop app */}
        <section aria-label="Quick actions" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickAction href="/sitters" icon={<MagnifyingGlass size={24} />} title="Find a babysitter" body="Search near your home" />
          <QuickAction href="/jobs/new" icon={<Briefcase size={24} />} title="Post a job" body="Let sitters apply to you" />
          <QuickAction href="/favorites" icon={<Heart size={24} />} title="Saved sitters" body={favorites ? `${favorites} saved` : "Keep your favorites"} />
        </section>

        {(toConfirm.length > 0 || applicants.length > 0) && (
          <section aria-labelledby="attention">
            <h2 id="attention" className="mb-3 flex items-center gap-2 font-semibold">
              <Warning size={18} weight="fill" className="text-brand" aria-hidden /> Needs your attention
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {toConfirm.map((b) => (
                <Card key={b.id} className="flex items-center gap-4 border-brand/30 p-4">
                  <Avatar src={b.sitter.avatarUrl} first={b.sitter.firstName} last={b.sitter.lastName} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">How did it go with {b.sitter.firstName}?</p>
                    <p className="text-sm text-ink-3">{formatDate(b.startsAt)}, {formatMoney(b.totalCents)} on hold</p>
                  </div>
                  <LinkButton href={`/bookings/${b.id}`} size="sm">Confirm</LinkButton>
                </Card>
              ))}
              {applicants.map((j) => (
                <Card key={j.id} className="flex items-center gap-4 border-brand/30 p-4">
                  <span className="inline-flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent-strong"><Briefcase size={22} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{j._count.applications} {j._count.applications === 1 ? "sitter" : "sitters"} applied</p>
                    <p className="truncate text-sm text-ink-3">{j.title}</p>
                  </div>
                  <LinkButton href={`/jobs/${j.id}`} size="sm">Review</LinkButton>
                </Card>
              ))}
            </div>
          </section>
        )}

        <Panel title="Upcoming bookings" action={<PanelLink href="/bookings">View all</PanelLink>}>
          {upcoming.length === 0 ? (
            <EmptyState icon={<CalendarBlank size={28} />} title="Nothing booked yet" action={<LinkButton href="/sitters" size="sm">Find a sitter</LinkButton>} />
          ) : (
            <ul className="-mx-2 divide-y divide-line">
              {upcoming.map((b) => <BookingRow key={b.id} viewer="PARENT" b={{ ...b, person: b.sitter }} />)}
            </ul>
          )}
        </Panel>

        {pastSitters.length > 0 && (
          <Panel title="Book again">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pastSitters.map(({ sitter: s, startsAt }) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <Avatar src={s.avatarUrl} first={s.firstName} last={s.lastName} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.firstName} {s.lastName.charAt(0)}.</p>
                    <p className="text-xs text-ink-3">Last time {formatDate(startsAt)}</p>
                    <Rating avg={s.sitterProfile?.ratingAvg ?? 0} count={s.sitterProfile?.ratingCount ?? 0} />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular">{formatRate(s.sitterProfile?.hourlyRateCents ?? 0)}</p>
                    <Link href={`/book/${s.id}`} className="text-sm font-semibold text-accent-strong hover:underline">Book</Link>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {/* Right rail */}
      <div className="space-y-6">
        <Panel title="Your family" action={<PanelLink href="/parent/family">Edit</PanelLink>}>
          {children.length === 0 ? (
            <Link href="/parent/family" className="flex items-center gap-2 rounded-xl border border-dashed border-line-strong p-3 text-sm text-ink-2 hover:border-brand">
              <Plus size={18} aria-hidden /> Add your children so sitters come prepared
            </Link>
          ) : (
            <ul className="space-y-2">
              {children.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-strong">{c.firstName.charAt(0)}</span>
                  <span className="flex-1 text-sm font-medium">{c.firstName}</span>
                  <span className="text-sm text-ink-3">{childAge(c.birthYear)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Payment" action={<PanelLink href="/settings/payment">Manage</PanelLink>}>
          {card ? (
            <p className="flex items-center gap-2 text-sm"><CreditCard size={20} className="text-ink-3" aria-hidden />{card.brand} ending {card.last4}</p>
          ) : (
            <Link href="/settings/payment" className="flex items-center gap-2 text-sm font-semibold text-accent-strong">Add a card <ArrowRight size={16} /></Link>
          )}
          <p className="mt-2 text-xs text-ink-3">Cards are held, not charged, until after each job.</p>
        </Panel>
        <NotificationsPanel userId={user.id} />
      </div>
    </div>
  );
}

function QuickAction({ href, icon, title, body }: { href: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition-[border-color,transform] hover:-translate-y-0.5 hover:border-brand/40">
      <span className="inline-flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">{icon}</span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-ink-3">{body}</span>
      </span>
    </Link>
  );
}
