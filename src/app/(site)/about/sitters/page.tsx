import type { Metadata } from "next";
import {
  Bell, Briefcase, CalendarCheck, CheckCircle, ClipboardText, CurrencyDollar, IdentificationCard, Star, UserCircle,
} from "@phosphor-icons/react/ssr";
import { config } from "@/lib/config";
import { quote } from "@/lib/pricing";
import { formatMoney, formatRate } from "@/lib/format";
import { LinkButton } from "@/components/ui";
import { Faq } from "@/components/faq";

export const metadata: Metadata = {
  title: "Babysit with Meraki",
  description: "How Meraki works for babysitters: build your profile, get verified, get booked or apply to jobs near you, and get paid weekly.",
};

const STEPS = [
  { icon: UserCircle, title: "Create your profile", body: "Add a photo, your story, skills, languages and hourly rate. Set your weekly availability and how far you'll travel." },
  { icon: IdentificationCard, title: "Get verified", body: "Our team reviews every new sitter, usually within one business day. A cleared background check and CPR certificate earn you badges families look for." },
  { icon: Bell, title: "Get requests", body: `Families near you book times inside your availability. You get a notification and have ${config.sitterResponseHours} hours to accept or decline.` },
  { icon: Briefcase, title: "Apply to jobs", body: "Families also post jobs. Browse the ones near you, apply with a short message, and if they hire you, the booking is confirmed instantly." },
  { icon: CalendarCheck, title: "Do the job", body: "See the family's address, phone and children's details once you accept. Message them in the app to plan." },
  { icon: CurrencyDollar, title: "Get paid weekly", body: "When the family confirms the job, your full rate is added to your next weekly payout. No fees come out of your pay." },
];

const RULES = [
  "Reply to requests within 24 hours, even if it's a no.",
  "Only accept jobs you can do. Cancelling a confirmed booking lets a family down, and repeated cancellations pause your profile.",
  "Keep all bookings and payments on Meraki so you're protected by holds, reviews and disputes.",
  "Follow the family's routines and never leave children unattended.",
  "Review families after each job. Reviews go both ways.",
];

export default function AboutSittersPage() {
  const example = quote(2200, 240);
  const FAQ = [
    { q: "How much can I earn?", a: `You set your own hourly rate between ${formatMoney(config.minRateCents)} and ${formatMoney(config.maxRateCents)}. You keep 100% of it; families pay Meraki's service fee on top.` },
    { q: "When do I get paid?", a: `After each job the family confirms (or it's confirmed automatically after ${config.autoConfirmHours} hours). Confirmed jobs are paid out every Monday.` },
    { q: "What if a family cancels late?", a: `If they cancel less than ${config.freeCancelHours} hours before the start, you receive ${Math.round(config.lateCancelFeeRate * 100)}% of the booking's pay.` },
    { q: "What if there's a problem on the job?", a: "If a family reports a problem, the payment is paused and our team talks to both of you before deciding. You can share your side in the booking's messages." },
    { q: "Who can join?", a: "Anyone 18 or older with childcare experience and references. You'll need a phone number and a clear photo of yourself." },
    { q: "Can I pause my profile?", a: "Yes. One click on your dashboard pauses new bookings. Your existing bookings stay as they are." },
  ];

  return (
    <>
      <section className="bg-[linear-gradient(120deg,#fdeee8_0%,#fff4e6_60%,#e1f0ef_100%)]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-24">
          <p className="text-sm font-semibold text-accent-strong">For babysitters</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight md:text-5xl">Babysit for families near you, on your own schedule.</h1>
          <p className="mt-5 max-w-xl text-lg text-ink-2">Set your rate and hours, get booked by verified families nearby, and get paid every week.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/signup?role=sitter" size="lg">Become a sitter</LinkButton>
            <LinkButton href="#how" size="lg" variant="secondary">See how it works</LinkButton>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 md:py-24">
        <h2 className="text-3xl font-bold md:text-4xl">How it works from your side</h2>
        <ol className="mt-10 grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.title} className="flex gap-4">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
                <s.icon size={26} aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-ink-2">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-surface-2">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
          <div className="rounded-3xl border border-line bg-surface p-8 shadow-card">
            <h2 className="text-2xl font-bold">What you earn</h2>
            <p className="mt-1 text-ink-3">Example: a 4-hour evening at {formatRate(example.hourlyRateCents)}</p>
            <dl className="mt-6 space-y-3 tabular">
              <div className="flex justify-between"><dt className="text-ink-2">Your pay</dt><dd className="font-semibold">{formatMoney(example.subtotalCents)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">Meraki fee taken from you</dt><dd className="font-semibold">{formatMoney(0)}</dd></div>
              <div className="flex justify-between border-t border-line pt-3 text-xl font-bold"><dt>You receive</dt><dd className="text-accent-strong">{formatMoney(example.subtotalCents)}</dd></div>
            </dl>
            <p className="mt-6 text-sm text-ink-3">
              The family pays {formatMoney(example.totalCents)}, which includes our {formatMoney(example.serviceFeeCents)} service fee. Payment is guaranteed:
              the family&apos;s card is held before you even accept.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold">What families expect from you</h2>
            <ul className="mt-6 space-y-4">
              {RULES.map((r) => (
                <li key={r} className="flex gap-3">
                  <CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-info" aria-hidden />
                  <span className="text-ink-2">{r}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex gap-6 text-sm text-ink-2">
              <span className="flex items-center gap-2"><Star size={20} weight="fill" className="text-sun" aria-hidden />Two-way reviews</span>
              <span className="flex items-center gap-2"><ClipboardText size={20} className="text-brand" aria-hidden />Clear booking details</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
        <h2 className="text-3xl font-bold md:text-4xl">Questions sitters ask</h2>
        <Faq items={FAQ} />
        <div className="mt-12 text-center">
          <LinkButton href="/signup?role=sitter" size="lg">Start your sitter profile</LinkButton>
        </div>
      </section>
    </>
  );
}
