import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle, Circle, Hourglass, WarningCircle } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fileUrl } from "@/lib/files";
import { formatShortDate, formatTime } from "@/lib/format";
import { applicationMissing } from "@/lib/sitter-application";
import { FaceCapture } from "@/components/face-capture";
import { SubmitApplication } from "@/components/submit-application";
import { AccountForm, AvailabilityForm, AvatarForm, SitterProfileForm } from "@/components/settings-forms";
import { Alert, Card, cn } from "@/components/ui";

export const metadata: Metadata = { title: "Your babysitter application" };

export default async function SitterApplicationPage({ searchParams }: PageProps<"/sitter/application">) {
  const user = await requireUser(["SITTER"], { allowPendingSitter: true });
  // Approved sitters have the full dashboard instead.
  if (user.status === "ACTIVE") redirect("/sitter");
  const welcome = (await searchParams).welcome === "1";

  const [me, skills, missing] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { sitterProfile: { include: { skills: true, availability: true } } },
    }),
    db.skill.findMany({ orderBy: { name: "asc" } }),
    applicationMissing(user.id),
  ]);
  const p = me.sitterProfile!;
  const submitted = !!p.submittedAt;

  const steps = [
    { label: "Verification photo", done: !!p.idPhotoId, href: "#verify" },
    { label: "Profile photo", done: !!me.avatarUrl, href: "#photo" },
    { label: "About you", done: p.headline.length >= 10 && p.bio.length >= 80 && me.latitude != null, href: "#about" },
    { label: "Availability", done: p.availability.length > 0, href: "#availability" },
    { label: "Phone number", done: !!me.phone, href: "#contact" },
  ];

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold md:text-3xl">Your babysitter application</h1>
      <p className="mt-1.5 max-w-[65ch] text-ink-2">
        Every babysitter on Meraki is checked by a person before families can see them. Complete the steps below and submit
        your application. Your dashboard opens as soon as you&apos;re approved.
      </p>

      {/* Status */}
      <div className="mt-6">
        {submitted ? (
          <div className="flex items-start gap-4 rounded-2xl border border-info/20 bg-info-soft p-5">
            <Hourglass size={28} className="mt-0.5 shrink-0 text-info" aria-hidden />
            <div>
              <p className="font-semibold">Waiting for approval</p>
              <p className="mt-0.5 text-ink-2">
                You submitted your application on {formatShortDate(p.submittedAt!)} at {formatTime(p.submittedAt!)}. Our team
                usually reviews it within one business day, and you&apos;ll get a notification. You can still update your details below.
              </p>
            </div>
          </div>
        ) : p.reviewNote ? (
          <div className="flex items-start gap-4 rounded-2xl border border-warn/25 bg-warn-soft p-5">
            <WarningCircle size={28} className="mt-0.5 shrink-0 text-warn" aria-hidden />
            <div>
              <p className="font-semibold">Our team asked for a change</p>
              <p className="mt-0.5 text-ink-2">“{p.reviewNote}”</p>
              <p className="mt-1 text-sm text-ink-3">Update your application and submit it again.</p>
            </div>
          </div>
        ) : welcome ? (
          <Alert tone="accent">Welcome to Meraki, {user.firstName}! Your account is created. Finish these steps to apply.</Alert>
        ) : null}
      </div>

      {/* Progress */}
      <ol className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.label}>
            <a href={s.href} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm", s.done ? "border-info/20 bg-info-soft text-info" : "border-line bg-surface text-ink-2 hover:border-brand/40")}>
              {s.done ? <CheckCircle size={18} weight="fill" aria-hidden /> : <Circle size={18} aria-hidden />}
              <span><span className="sr-only">Step {i + 1}: </span>{s.label}</span>
            </a>
          </li>
        ))}
      </ol>

      <div className="mt-8 space-y-6">
        <Step id="verify" n={1} title="Verification photo" done={steps[0].done}
          intro="A live photo of your face so we can confirm you are who you say you are.">
          <FaceCapture savedUrl={p.idPhotoId ? fileUrl(p.idPhotoId) : null} />
        </Step>

        <Step id="photo" n={2} title="Profile photo" done={steps[1].done} intro="The friendly photo families see on your profile.">
          <AvatarForm user={me} />
        </Step>

        <Step id="about" n={3} title="About you" done={steps[2].done} intro="Your experience, rate and where you work. Save when you're done.">
          <SitterProfileForm
            allSkills={skills}
            profile={{
              headline: p.headline,
              bio: p.bio,
              hourlyRate: (p.hourlyRateCents / 100).toFixed(2),
              experienceYears: p.experienceYears,
              maxChildren: p.maxChildren,
              serviceRadiusKm: p.serviceRadiusKm,
              area: me.area,
              skills: p.skills.map((s) => s.skillId),
              languages: p.languages,
              cprCertified: p.cprCertified,
            }}
          />
        </Step>

        <Step id="availability" n={4} title="Weekly availability" done={steps[3].done} intro="When families can book you. You can change it any time.">
          <AvailabilityForm windows={p.availability.map((a) => ({ weekday: a.weekday, start: a.startMinute, end: a.endMinute }))} />
        </Step>

        <Step id="contact" n={5} title="Contact details" done={steps[4].done} intro="Your phone number is only shared with families after you accept their booking.">
          <AccountForm user={me} />
        </Step>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">{submitted ? "Application sent" : "Submit your application"}</h2>
          {submitted ? (
            <p className="mt-1 text-ink-2">Thanks! There&apos;s nothing else to do. We&apos;ll notify you when it&apos;s reviewed.</p>
          ) : (
            <>
              {missing.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
                  {missing.map((m) => <li key={m}>{m}</li>)}
                </ul>
              ) : (
                <p className="mt-1 text-ink-2">Everything is ready. Send it to our team for review.</p>
              )}
              <div className="mt-5">
                <SubmitApplication ready={missing.length === 0} />
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function Step({ id, n, title, intro, done, children }: { id: string; n: number; title: string; intro: string; done: boolean; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24 p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", done ? "bg-info text-white" : "bg-accent-soft text-accent-strong")}>
          {done ? <CheckCircle size={18} weight="bold" aria-hidden /> : n}
        </span>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-ink-3">{intro}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}
