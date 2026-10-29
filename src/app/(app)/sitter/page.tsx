import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, Circle, SealCheck, ShieldCheck, Tray, FirstAid } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney, formatShortDate, formatTime, formatTimeRange, greeting } from "@/lib/format";
import { jobsNear } from "@/lib/jobs";
import { zonedParts, zonedToUtc } from "@/lib/time";
import { setAccepting } from "@/app/actions/sitter";
import { acceptAction, declineAction, markDoneAction } from "@/app/actions/bookings";
import { ActionForm } from "@/components/action-form";
import { JobCard } from "@/components/job-card";
import { MonthCalendar, NotificationsPanel, Panel, PanelLink, StatTile } from "@/components/dashboard-parts";
import { Alert, Avatar, Badge, EmptyState, LinkButton, Rating, buttonClass, cn } from "@/components/ui";

export const metadata: Metadata = { title: "Home" };

export default async function SitterHome() {
  const user = await requireUser(["SITTER"]);
  const now = new Date();
  const today = zonedParts(now);
  const ym = `${today.year}-${String(today.month).padStart(2, "0")}`;
  const monthStart = zonedToUtc(`${ym}-01`, "00:00")!;
  const nextMonth = today.month === 12 ? `${today.year + 1}-01` : `${today.year}-${String(today.month + 1).padStart(2, "0")}`;
  const monthEnd = zonedToUtc(`${nextMonth}-01`, "00:00")!;
  const parentSelect = { select: { firstName: true, lastName: true, avatarUrl: true } };

  const [me, requests, upcoming, monthBookings, earnedMonth, hours, totalBookings, availabilityCount, jobs, toFinish] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { avatarUrl: true, phone: true, area: true, sitterProfile: { include: { _count: { select: { skills: true } } } } },
    }),
    db.booking.findMany({
      where: { sitterId: user.id, status: "REQUESTED" },
      orderBy: { respondBy: "asc" },
      include: { parent: parentSelect },
    }),
    db.booking.findMany({
      where: { sitterId: user.id, status: "ACCEPTED", endsAt: { gt: now } },
      orderBy: { startsAt: "asc" },
      take: 4,
      include: { parent: parentSelect },
    }),
    db.booking.findMany({
      where: { sitterId: user.id, status: { in: ["REQUESTED", "ACCEPTED", "AWAITING_CONFIRMATION", "AWAITING_PAYMENT", "COMPLETED"] }, startsAt: { gte: monthStart, lt: monthEnd } },
      select: { id: true, startsAt: true, status: true, parent: { select: { lastName: true } } },
    }),
    db.payout.aggregate({ where: { sitterId: user.id, status: { not: "CANCELLED" }, createdAt: { gte: monthStart } }, _sum: { amountCents: true } }),
    db.booking.aggregate({ where: { sitterId: user.id, status: "COMPLETED" }, _sum: { hours: true } }),
    db.booking.count({ where: { sitterId: user.id, status: { in: ["ACCEPTED", "AWAITING_CONFIRMATION", "AWAITING_PAYMENT", "COMPLETED"] } } }),
    db.availability.count({ where: { sitterId: user.id } }),
    user.status === "ACTIVE" ? jobsNear(user.id, 3) : Promise.resolve([]),
    // Accepted jobs that have started: the sitter should mark them completed.
    db.booking.findMany({
      where: { sitterId: user.id, status: "ACCEPTED", startsAt: { lte: now } },
      orderBy: { startsAt: "asc" },
      include: { parent: parentSelect },
    }),
  ]);
  const p = me.sitterProfile!;

  // Profile strength, like the onboarding steps on the big platforms.
  const checklist = [
    { done: !!me.avatarUrl, label: "Add a friendly photo" },
    { done: p.headline.length >= 10, label: "Write a headline" },
    { done: p.bio.length >= 80, label: "Tell families about yourself" },
    { done: availabilityCount > 0, label: "Set your weekly availability" },
    { done: p._count.skills > 0, label: "Pick your skills" },
    { done: !!me.phone, label: "Add a phone number" },
    { done: !!p.verifiedAt, label: "Identity verified by Meraki" },
    { done: !!p.backgroundCheckAt, label: "Background check" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = Math.round((doneCount / checklist.length) * 100);

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-8">
        <section className="flex flex-col gap-4 rounded-2xl bg-[linear-gradient(120deg,#fdeee8_0%,#fff4e6_60%,#e1f0ef_100%)] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{greeting(today.hour)}, {user.firstName}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-ink-2">
              <Rating avg={p.ratingAvg} count={p.ratingCount} />
              <span>
                {user.status !== "ACTIVE" ? "Your profile is being reviewed." : p.acceptingBookings ? "Families near you can book you." : "New bookings are paused."}
              </span>
            </p>
          </div>
          {user.status === "ACTIVE" && (
            <form action={setAccepting}>
              <input type="hidden" name="accepting" value={p.acceptingBookings ? "0" : "1"} />
              <button className={buttonClass(p.acceptingBookings ? "secondary" : "primary")}>
                {p.acceptingBookings ? "Pause new bookings" : "Start taking bookings"}
              </button>
            </form>
          )}
        </section>

        {user.status === "PENDING_REVIEW" && (
          <Alert tone={pct >= 75 ? "info" : "warn"}>
            {pct >= 75
              ? "Thanks! Your profile is ready and our team will review it within one business day."
              : <>Finish your profile so we can review it. <Link href="/sitter/profile" className="font-semibold underline">Complete profile</Link></>}
          </Alert>
        )}

        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Earned this month" value={formatMoney(earnedMonth._sum.amountCents ?? 0)} tone="peach" />
          <StatTile label="Total bookings" value={String(totalBookings)} tone="teal" />
          <StatTile label="Avg. rating" value={p.ratingCount ? p.ratingAvg.toFixed(1) : "New"} hint={p.ratingCount ? `${p.ratingCount} reviews` : undefined} tone="sun" />
          <StatTile label="Hours worked" value={`${Math.round(Number(hours._sum.hours ?? 0))}h`} />
        </dl>

        <Panel
          title={`Pending requests${requests.length ? ` (${requests.length})` : ""}`}
          action={<PanelLink href="/bookings?tab=action">All requests</PanelLink>}
        >
          {requests.length === 0 ? (
            <EmptyState icon={<Tray size={28} />} title="No new requests" body="When a family requests you, you can accept or decline right here." />
          ) : (
            <ul className="space-y-3">
              {requests.map((b) => (
                <li key={b.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar src={b.parent.avatarUrl} first={b.parent.firstName} last={b.parent.lastName} size={44} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/bookings/${b.id}`} className="font-semibold hover:underline">{b.parent.lastName} family</Link>
                      <p className="text-sm text-ink-3">
                        {formatDate(b.startsAt)}, {formatTimeRange(b.startsAt, b.endsAt)}. {b.childrenCount} {b.childrenCount === 1 ? "child" : "children"}.
                      </p>
                      <p className="text-xs text-warn">Reply by {formatTime(b.respondBy)}, {formatShortDate(b.respondBy)}</p>
                    </div>
                    <p className="text-lg font-bold tabular">{formatMoney(b.subtotalCents)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionForm action={acceptAction} hidden={{ bookingId: b.id }} label="Accept" pendingText="Accepting" />
                    <ActionForm action={declineAction} hidden={{ bookingId: b.id }} label="Decline" variant="secondary"
                      confirm={{ title: "Decline this request?", body: "The family is told you're not available and their card hold is released.", confirmLabel: "Decline" }}
                      reason={{ label: "Message to the family (optional)" }} pendingText="Declining" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {toFinish.length > 0 && (
          <Panel title={`Jobs to mark completed (${toFinish.length})`}>
            <ul className="space-y-3">
              {toFinish.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/25 bg-accent-soft/40 p-4">
                  <Avatar src={b.parent.avatarUrl} first={b.parent.firstName} last={b.parent.lastName} size={40} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/bookings/${b.id}`} className="font-semibold hover:underline">{b.parent.lastName} family</Link>
                    <p className="text-sm text-ink-3">{formatDate(b.startsAt)}, {formatTimeRange(b.startsAt, b.endsAt)}</p>
                  </div>
                  <p className="font-bold tabular">{formatMoney(b.subtotalCents)}</p>
                  <ActionForm action={markDoneAction} hidden={{ bookingId: b.id }} label="Mark completed"
                    confirm={{ title: "Mark this job as completed?", body: "The family will be asked to confirm. Then Meraki approves your payment.", confirmLabel: "Yes, it's completed" }}
                    pendingText="Saving" />
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title="My schedule" action={<PanelLink href="/bookings">All bookings</PanelLink>}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,300px)_1fr]">
            <MonthCalendar
              year={today.year}
              month={today.month}
              today={today}
              events={monthBookings.map((b) => ({ id: b.id, startsAt: b.startsAt, status: b.status, label: `${b.parent.lastName} family` }))}
            />
            <div className="min-w-0">
              <p className="mb-2 text-sm font-semibold text-ink-2">Next up</p>
              {upcoming.length === 0 ? (
                <p className="text-sm text-ink-3">Nothing confirmed yet. Keep your availability up to date to get booked.</p>
              ) : (
                <ul className="space-y-2">
                  {upcoming.map((b) => {
                    const d = zonedParts(b.startsAt);
                    return (
                      <li key={b.id}>
                        <Link href={`/bookings/${b.id}`} className="flex items-center gap-3 rounded-xl border border-line p-3 hover:bg-surface-2">
                          <span className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-accent-soft py-1.5 text-accent-strong">
                            <span className="text-[11px] font-semibold uppercase">{formatDate(b.startsAt).split(",")[0]}</span>
                            <span className="text-lg font-bold leading-none tabular">{d.day}</span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{b.parent.lastName} family</span>
                            <span className="block text-sm text-ink-3">{formatTimeRange(b.startsAt, b.endsAt)}</span>
                          </span>
                          <span className="text-sm font-semibold tabular">{formatMoney(b.subtotalCents)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </Panel>

        {user.status === "ACTIVE" && (
          <Panel title="Jobs near you" action={<PanelLink href="/sitter/jobs">Browse all jobs</PanelLink>}>
            {jobs.length === 0 ? (
              <p className="text-sm text-ink-3">No open jobs nearby right now. We&apos;ll notify you when a family posts one.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {jobs.map((j) => <JobCard key={j.id} j={j} myRateCents={p.hourlyRateCents} />)}
              </div>
            )}
          </Panel>
        )}
      </div>

      {/* Right rail: profile card, as on the desktop app */}
      <div className="space-y-6">
        <section className="rounded-2xl border border-line bg-surface p-5 text-center shadow-card">
          <Avatar src={me.avatarUrl} first={user.firstName} last={user.lastName} size={88} className="mx-auto" />
          <p className="mt-3 text-lg font-bold">{user.firstName} {user.lastName}</p>
          <p className="text-sm text-ink-3">Babysitter, {p.experienceYears} {p.experienceYears === 1 ? "yr" : "yrs"} experience</p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {p.verifiedAt && <Badge tone="info"><SealCheck size={14} weight="fill" aria-hidden />Verified</Badge>}
            {p.backgroundCheckAt && <Badge tone="info"><ShieldCheck size={14} weight="fill" aria-hidden />Background check</Badge>}
            {p.cprCertified && <Badge tone="info"><FirstAid size={14} weight="fill" aria-hidden />CPR</Badge>}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line">
            <div className="bg-surface-2 p-3"><dt className="text-xs text-ink-3">Jobs done</dt><dd className="font-bold tabular">{p.completedJobs}</dd></div>
            <div className="bg-surface-2 p-3"><dt className="text-xs text-ink-3">Rating</dt><dd className="font-bold tabular">{p.ratingCount ? p.ratingAvg.toFixed(1) : "New"}</dd></div>
          </dl>
          <div className="mt-4 flex gap-2">
            <LinkButton href="/sitter/profile" variant="secondary" size="sm" className="flex-1">Edit profile</LinkButton>
            {user.status === "ACTIVE" && <LinkButton href={`/sitters/${user.id}`} variant="ghost" size="sm" className="flex-1">Public view</LinkButton>}
          </div>
        </section>

        <Panel title="Profile strength" action={<span className="text-sm font-bold text-accent-strong tabular">{pct}%</span>}>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile strength">
            <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
          <ul className="space-y-2 text-sm">
            {checklist.map((c) => (
              <li key={c.label} className={cn("flex items-center gap-2", c.done ? "text-ink-3" : "text-ink")}>
                {c.done ? <CheckCircle size={18} weight="fill" className="text-info" aria-hidden /> : <Circle size={18} className="text-line-strong" aria-hidden />}
                <span className={c.done ? "line-through decoration-line-strong" : undefined}>{c.label}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <NotificationsPanel userId={user.id} />
      </div>
    </div>
  );
}
