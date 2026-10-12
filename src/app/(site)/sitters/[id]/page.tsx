import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Briefcase, CheckCircle, Clock, Heart, MapPin, SealCheck, UsersThree } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { WEEKDAYS, formatMinutes, formatRate, formatShortDate } from "@/lib/format";
import { toggleFavorite } from "@/app/actions/parent";
import { Avatar, Badge, Card, LinkButton, Rating, Stars, buttonClass } from "@/components/ui";

async function load(id: string) {
  return db.user.findFirst({
    where: { id, role: "SITTER", status: "ACTIVE", sitterProfile: { verifiedAt: { not: null } } },
    select: {
      id: true, firstName: true, lastName: true, avatarUrl: true, area: true, city: true, createdAt: true,
      sitterProfile: {
        include: {
          skills: { include: { skill: true } },
          availability: { orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] },
        },
      },
    },
  });
}

export async function generateMetadata({ params }: PageProps<"/sitters/[id]">): Promise<Metadata> {
  const s = await load((await params).id);
  return { title: s ? `${s.firstName} ${s.lastName.charAt(0)}., babysitter in ${s.area}` : "Sitter not found" };
}

export default async function SitterProfilePage({ params }: PageProps<"/sitters/[id]">) {
  const { id } = await params;
  const [s, user] = await Promise.all([load(id), getCurrentUser()]);
  if (!s || !s.sitterProfile) notFound();
  const p = s.sitterProfile;

  const [reviews, favorite] = await Promise.all([
    db.review.findMany({
      where: { subjectId: s.id, direction: "PARENT_TO_SITTER" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { author: { select: { firstName: true, lastName: true, avatarUrl: true } } },
    }),
    user?.role === "PARENT"
      ? db.favorite.findUnique({ where: { parentId_sitterId: { parentId: user.id, sitterId: s.id } } })
      : null,
  ]);

  const byDay = WEEKDAYS.map((name, i) => ({ name, slots: p.availability.filter((a) => a.weekday === i) }));
  const canBook = !user || user.role === "PARENT";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {/* Header */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar src={s.avatarUrl} first={s.firstName} last={s.lastName} size={112} />
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
                {s.firstName} {s.lastName.charAt(0)}.
                <SealCheck size={24} weight="fill" className="text-info" aria-label="Verified sitter" />
              </h1>
              <p className="mt-1 text-lg text-ink-2">{p.headline}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-3">
                <span className="inline-flex items-center gap-1.5"><MapPin size={16} aria-hidden />{s.area}, travels up to {p.serviceRadiusKm} km</span>
                <Rating avg={p.ratingAvg} count={p.ratingCount} />
              </div>
            </div>
          </div>

          {/* Facts */}
          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
            <Fact icon={<Briefcase size={18} />} label="Experience" value={`${p.experienceYears} ${p.experienceYears === 1 ? "year" : "years"}`} />
            <Fact icon={<CheckCircle size={18} />} label="Jobs on Meraki" value={String(p.completedJobs)} />
            <Fact icon={<UsersThree size={18} />} label="Max children" value={String(p.maxChildren)} />
            <Fact icon={<SealCheck size={18} />} label="Verified" value={p.verifiedAt ? formatShortDate(p.verifiedAt) : "No"} />
          </dl>

          <section className="mt-10">
            <h2 className="text-lg font-semibold">About {s.firstName}</h2>
            <p className="mt-3 max-w-[65ch] whitespace-pre-line leading-relaxed text-ink-2">{p.bio || "No bio yet."}</p>
            {p.skills.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {p.skills.map((k) => <Badge key={k.skillId} tone="accent">{k.skill.name}</Badge>)}
              </div>
            )}
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-semibold">Weekly availability</h2>
            <p className="mt-1 text-sm text-ink-3">Times are in {config.timeZone.replace("_", " ")} time.</p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {byDay.map((d) => (
                <div key={d.name} className="flex items-center justify-between rounded-[10px] border border-line bg-surface px-4 py-3 text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span className={d.slots.length ? "text-ink-2 tabular" : "text-ink-3"}>
                    {d.slots.length ? d.slots.map((a) => `${formatMinutes(a.startMinute)} to ${formatMinutes(a.endMinute)}`).join(", ") : "Unavailable"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10" aria-labelledby="reviews">
            <h2 id="reviews" className="text-lg font-semibold">
              Reviews {p.ratingCount > 0 && <span className="font-normal text-ink-3">({p.ratingCount})</span>}
            </h2>
            {reviews.length === 0 ? (
              <p className="mt-3 text-ink-3">No reviews yet. {s.firstName} is new to Meraki.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {reviews.map((r) => (
                  <li key={r.id} className="py-5">
                    <div className="flex items-center gap-3">
                      <Avatar src={r.author.avatarUrl} first={r.author.firstName} last={r.author.lastName} size={36} />
                      <div>
                        <p className="text-sm font-medium">{r.author.firstName} {r.author.lastName.charAt(0)}.</p>
                        <p className="text-xs text-ink-3">{formatShortDate(r.createdAt)}</p>
                      </div>
                      <span className="ml-auto"><Stars value={r.rating} /></span>
                    </div>
                    {r.comment && <p className="mt-3 max-w-[65ch] text-ink-2">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Booking panel */}
        <aside>
          <Card className="p-6 lg:sticky lg:top-24">
            <p className="text-3xl font-semibold tabular">{formatRate(p.hourlyRateCents)}</p>
            <p className="mt-1 text-sm text-ink-3">
              Plus a {Math.round(config.serviceFeeRate * 100)}% service fee. Charged only after the job.
            </p>
            {canBook && (
              p.acceptingBookings ? (
                <LinkButton href={`/book/${s.id}`} size="lg" className="mt-6 w-full">Request a booking</LinkButton>
              ) : (
                <p className="mt-6 rounded-[10px] bg-warn-soft px-4 py-3 text-sm text-warn">
                  {s.firstName} isn&apos;t taking new bookings right now.
                </p>
              )
            )}
            {user?.role === "PARENT" && (
              <form action={toggleFavorite} className="mt-3">
                <input type="hidden" name="sitterId" value={s.id} />
                <button className={buttonClass("secondary", "md", "w-full")}>
                  <Heart size={18} weight={favorite ? "fill" : "regular"} className={favorite ? "text-danger" : undefined} aria-hidden />
                  {favorite ? "Saved" : "Save sitter"}
                </button>
              </form>
            )}
            <ul className="mt-6 space-y-2.5 border-t border-line pt-5 text-sm text-ink-2">
              <li className="flex gap-2"><Clock size={18} className="shrink-0 text-accent" aria-hidden />Replies within {config.sitterResponseHours} hours</li>
              <li className="flex gap-2"><CheckCircle size={18} className="shrink-0 text-accent" aria-hidden />Free cancellation up to {config.freeCancelHours}h before</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-surface p-4">
      <dt className="flex items-center gap-1.5 text-xs text-ink-3">{icon}{label}</dt>
      <dd className="mt-1 font-semibold tabular">{value}</dd>
    </div>
  );
}
