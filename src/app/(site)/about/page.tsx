import type { Metadata } from "next";
import Image from "next/image";
import {
  Briefcase, CalendarCheck, ChatCircleText, CreditCard, Eye, HandHeart, LockSimple, MagnifyingGlass,
  SealCheck, ShieldCheck, Star,
} from "@phosphor-icons/react/ssr";
import logo from "../../../../public/brand/meraki-logo-tight.jpg";
import { config } from "@/lib/config";
import { formatMoney } from "@/lib/format";
import { LinkButton } from "@/components/ui";
import { Faq } from "@/components/faq";

export const metadata: Metadata = {
  title: "About Meraki and how it works",
  description: "How Meraki works for families: finding a verified babysitter near you, booking, safety, and paying only after the job.",
};

const STEPS = [
  { icon: MagnifyingGlass, title: "Search near your home", body: "Type your address or ZIP code, or pick your neighborhood. You only see sitters who travel to you, with their real weekly availability, rate and reviews." },
  { icon: Briefcase, title: "Or post a job", body: "Tell us when you need help and your budget. Sitters nearby are notified and apply with a message. You compare them side by side and hire in one click." },
  { icon: CalendarCheck, title: "Request a time", body: `Pick a slot inside the sitter's availability and choose which children they'll look after. They have ${config.sitterResponseHours} hours to accept.` },
  { icon: ChatCircleText, title: "Plan the details", body: "Message your sitter about routines, allergies and directions. Your address and phone number are only shared once they accept." },
  { icon: CreditCard, title: "Pay after the job", body: `Your card is held, not charged, when you book. After the job you confirm it went well and we charge it. Something wrong? Report it within ${config.autoConfirmHours} hours.` },
];

const TRUST = [
  { icon: SealCheck, title: "A person reviews every sitter", body: "Before anyone appears in search, our team checks their identity, experience and profile." },
  { icon: ShieldCheck, title: "Background checks", body: "Sitters with a cleared background check show a badge on their profile, so you can choose with confidence." },
  { icon: Star, title: "Reviews from real bookings", body: "Only families who completed a booking can review a sitter, and sitters review families too." },
  { icon: LockSimple, title: "Your money is protected", body: "Holds, not charges. Free cancellation up to 24 hours before. Disputes are decided by a person, not a bot." },
  { icon: Eye, title: "Privacy by default", body: "Nobody sees your exact location. Sitters see your neighborhood until they accept, and card numbers are never stored." },
];

const FAQ = [
  { q: "How much does Meraki cost?", a: `Joining is free. When you book, you pay the sitter's hourly rate plus a ${Math.round(config.serviceFeeRate * 100)}% service fee (minimum ${formatMoney(config.serviceFeeMinCents)}). There's no subscription.` },
  { q: "When is my card charged?", a: `Only after the job. We place a hold when you book. You're charged when you confirm, or automatically ${config.autoConfirmHours} hours after the job if you don't respond.` },
  { q: "What if I need to cancel?", a: `Cancelling is free until ${config.freeCancelHours} hours before the start. After that, ${Math.round(config.lateCancelFeeRate * 100)}% of the sitter's pay is charged and goes to the sitter, who kept that time free for you.` },
  { q: "What if something goes wrong?", a: "Use “Report a problem” on the booking. The payment is paused and our team contacts you and the sitter, usually within one business day, and decides on a full or partial refund." },
  { q: "Can I book the same sitter again?", a: "Yes. Your home page has a “Book again” list with every sitter you've used, and you can save favorites." },
  { q: "Which areas do you cover?", a: "Any area where sitters have joined. Search your address to see who travels to you, or browse by neighborhood." },
];

export default function AboutPage() {
  return (
    <>
      <section className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 md:py-20 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-sm font-semibold text-accent-strong">About us</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight md:text-5xl">Childcare that feels like family, close to home.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
            Meraki is a Greek word for doing something with your whole heart. We built Meraki so parents can find caring,
            verified babysitters in their own neighborhood, and so good sitters get the steady, fair work they deserve.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/sitters" size="lg">Find a babysitter</LinkButton>
            <LinkButton href="/about/sitters" size="lg" variant="secondary">I&apos;m a babysitter</LinkButton>
          </div>
        </div>
        <Image src={logo} alt="The Meraki logo: a mother hugging a smiling toddler, with the words Caring Babysitters" className="mx-auto w-full max-w-sm rounded-[28px] shadow-card" loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 384px, 90vw" />
      </section>

      <section className="bg-surface-2">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
          <h2 className="text-3xl font-bold md:text-4xl">How Meraki works for parents</h2>
          <p className="mt-3 max-w-2xl text-ink-2">Two ways to find someone: search and book a sitter directly, or post a job and let sitters come to you.</p>
          <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className={`rounded-2xl border border-line bg-surface p-6 ${i === 0 ? "xl:row-span-2 xl:bg-accent-soft" : ""}`}>
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
                  <s.icon size={24} aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-bold md:text-4xl">Safety comes first</h2>
            <p className="mt-3 max-w-md text-ink-2">
              You&apos;re trusting someone with your children. Here&apos;s what we do so you can do that with confidence.
            </p>
            <HandHeart size={64} weight="duotone" className="mt-8 text-brand" aria-hidden />
          </div>
          <ul className="grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2">
            {TRUST.map((t) => (
              <li key={t.title}>
                <t.icon size={28} className="text-info" aria-hidden />
                <h3 className="mt-3 font-semibold">{t.title}</h3>
                <p className="mt-1 text-ink-2">{t.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
          <h2 className="text-3xl font-bold md:text-4xl">Questions parents ask</h2>
          <Faq items={FAQ} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-[linear-gradient(120deg,#fdeee8_0%,#fff4e6_60%,#e1f0ef_100%)] p-8 md:flex-row md:items-center md:p-12">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Ready to meet sitters near you?</h2>
            <p className="mt-2 text-ink-2">It&apos;s free to join and takes about a minute.</p>
          </div>
          <LinkButton href="/signup" size="lg">Create a free account</LinkButton>
        </div>
      </section>
    </>
  );
}
