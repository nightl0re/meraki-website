import Link from "next/link";
import Image from "next/image";
import brandIcon from "../../../public/brand/meraki-icon.png";
import {
  ArrowRight, CalendarCheck, ChatCircleText, CreditCard, MagnifyingGlass, SealCheck, ShieldCheck,
} from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { listAreas } from "@/lib/geo";
import { bookableSitter } from "@/lib/sitters";
import { quote } from "@/lib/pricing";
import { config } from "@/lib/config";
import { formatMoney, formatRate } from "@/lib/format";
import { LocationSearch } from "@/components/location-search";
import { Reveal } from "@/components/reveal";
import { Avatar, LinkButton, Rating, Stars } from "@/components/ui";

export default async function Home() {
  const [featured, areas, reviews] = await Promise.all([
    db.user.findMany({
      where: { ...bookableSitter, sitterProfile: { verifiedAt: { not: null }, ratingCount: { gt: 0 } } },
      orderBy: { sitterProfile: { ratingCount: "desc" } },
      take: 3,
      select: {
        id: true, firstName: true, lastName: true, avatarUrl: true, area: true,
        sitterProfile: { select: { headline: true, hourlyRateCents: true, ratingAvg: true, ratingCount: true } },
      },
    }),
    listAreas(),
    db.review.findMany({
      where: { direction: "PARENT_TO_SITTER", rating: 5, comment: { not: "" } },
      orderBy: { createdAt: "desc" },
      take: 3,
      distinct: ["comment"],
      select: {
        id: true, comment: true, rating: true,
        author: { select: { firstName: true, lastName: true, area: true } },
        subject: { select: { firstName: true } },
      },
    }),
  ]);

  const example = quote(2200, 240);

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid grid-cols-1 max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 md:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24">
        <div>
          <h1 className="max-w-xl text-4xl font-bold leading-[1.08] tracking-tight md:text-5xl lg:text-6xl">
            Caring babysitters, right in your neighborhood.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-2">
            Verified sitters near you. Book in minutes, and your card is only charged after the job.
          </p>
          <div className="mt-8 max-w-xl">
            <LocationSearch />
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
          {/* Brand artwork from the original Meraki logo, with real sitters overlapping it. */}
          <div className="relative ml-auto w-[78%] overflow-hidden rounded-[28%] shadow-card">
            <Image src={brandIcon} alt="A mother hugging a smiling toddler, the Meraki logo" loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 340px, 70vw" />
          </div>
          <div className="relative -mt-24 space-y-3 sm:-mt-32">
            {featured.slice(0, 2).map((s, i) => (
              <Reveal key={s.id} delay={0.15 + i * 0.1}>
                <Link
                  href={`/sitters/${s.id}`}
                  className={`flex max-w-sm items-center gap-4 rounded-2xl border border-line bg-surface/95 p-4 shadow-card backdrop-blur transition-transform duration-200 hover:-translate-y-0.5 ${i === 1 ? "ml-8" : ""}`}
                >
                  <Avatar src={s.avatarUrl} first={s.firstName} last={s.lastName} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-semibold">
                      {s.firstName} {s.lastName.charAt(0)}.
                      <SealCheck size={16} weight="fill" className="text-info" aria-label="Verified" />
                    </p>
                    <p className="truncate text-sm text-ink-3">{s.area}</p>
                    <Rating avg={s.sitterProfile!.ratingAvg} count={s.sitterProfile!.ratingCount} />
                  </div>
                  <p className="font-semibold tabular">{formatRate(s.sitterProfile!.hourlyRateCents)}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Browse by area */}
      {areas.length > 0 && (
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <h2 className="text-lg font-semibold tracking-tight">Browse by neighborhood</h2>
            <ul className="-mx-4 mt-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {areas.map((a) => (
                <li key={a.area} className="snap-start">
                  <Link
                    href={`/sitters?area=${encodeURIComponent(a.area)}`}
                    className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border border-line-strong bg-bg px-4 text-sm transition-colors hover:border-accent hover:text-accent-strong"
                  >
                    {a.area}
                    <span className="text-ink-3 tabular">{a.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* How it works */}
      <section id="how-it-works" className="mx-auto grid grid-cols-1 max-w-7xl gap-12 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">From search to sorted in one evening.</h2>
          <p className="mt-4 max-w-md text-ink-2">
            No back-and-forth over text. You see real availability, request a time, and the sitter confirms.
          </p>
          <LinkButton href="/sitters" size="lg" className="mt-8">
            Find a sitter <ArrowRight size={18} aria-hidden />
          </LinkButton>
        </div>
        <ol className="space-y-4">
          {[
            { icon: MagnifyingGlass, title: "Search your area", body: "Enter your address or pick a neighborhood. You'll see sitters who travel to you, nearest first." },
            { icon: CalendarCheck, title: "Request a time", body: "Choose a slot inside their availability. Your card gets a temporary hold, not a charge." },
            { icon: ChatCircleText, title: "Plan the details", body: `Message your sitter about routines and allergies. They confirm within ${config.sitterResponseHours} hours or the hold is released.` },
            { icon: CreditCard, title: "Pay after the job", body: `Confirm everything went well and we charge your card. Something wrong? Report it within ${config.autoConfirmHours} hours.` },
          ].map((s, i) => (
            <Reveal key={s.title} delay={i * 0.05}>
              <li className="flex gap-5 rounded-2xl border border-line bg-surface p-6">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                  <s.icon size={22} aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-ink-2">{s.body}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Pricing & trust bento */}
      <section id="pricing" className="bg-surface-2/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">Clear prices. Your money stays put until the job is done.</h2>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-6">
            <div className="rounded-2xl bg-[linear-gradient(140deg,#fde3c9_0%,#f9b48f_55%,#ef8a64_100%)] p-8 text-[#3c322d] md:col-span-3 md:row-span-2">
              <p className="text-sm font-medium">Example: 4 hours at {formatRate(example.hourlyRateCents)}</p>
              <dl className="mt-6 space-y-3 text-base tabular">
                <div className="flex justify-between"><dt>Sitter pay</dt><dd>{formatMoney(example.subtotalCents)}</dd></div>
                <div className="flex justify-between"><dt>Service fee</dt><dd>{formatMoney(example.serviceFeeCents)}</dd></div>
                <div className="flex justify-between border-t border-[#3c322d]/20 pt-3 text-xl font-bold"><dt>Total</dt><dd>{formatMoney(example.totalCents)}</dd></div>
              </dl>
              <p className="mt-8 max-w-sm text-sm">
                The sitter keeps 100% of their rate. Our fee is {Math.round(config.serviceFeeRate * 100)}% with a {formatMoney(config.serviceFeeMinCents)} minimum, and there&apos;s no subscription.
              </p>
            </div>
            <div className="rounded-2xl border border-info/20 bg-info-soft p-7 md:col-span-3">
              <ShieldCheck size={28} className="text-info" aria-hidden />
              <h3 className="mt-4 font-semibold">Every sitter is reviewed by a person</h3>
              <p className="mt-1 text-ink-2">We check identity and experience before anyone appears in search.</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-7 md:col-span-2">
              <h3 className="font-semibold">Free cancellation</h3>
              <p className="mt-1 text-ink-2">Up to {config.freeCancelHours} hours before the start.</p>
            </div>
            <div className="rounded-2xl border border-warn/20 bg-warn-soft p-7 md:col-span-1">
              <p className="text-3xl font-semibold text-warn tabular">{config.autoConfirmHours}h</p>
              <p className="mt-1 text-sm text-ink-2">to report a problem</p>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">What parents say</h2>
          <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-[1.3fr_1fr_1fr]">
            {reviews.map((r, i) => (
              <Reveal key={r.id} delay={i * 0.06}>
                <figure>
                  <Stars value={r.rating} />
                  <blockquote className={`mt-3 line-clamp-3 text-ink ${i === 0 ? "text-xl md:text-2xl" : "text-lg"}`}>
                    “{r.comment}”
                  </blockquote>
                  <figcaption className="mt-4 text-sm text-ink-3">
                    {r.author.firstName} {r.author.lastName.charAt(0)}., parent in {r.author.area}, about {r.subject.firstName}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Sitter recruitment */}
      <section className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Looking after kids is your thing?</h2>
            <p className="mt-2 max-w-lg text-ink-2">Set your own rate and hours, get booked by families nearby, and get paid weekly.</p>
          </div>
          <LinkButton href="/signup?role=sitter" variant="secondary" size="lg">Become a sitter</LinkButton>
        </div>
      </section>
    </>
  );
}
