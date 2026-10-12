import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, SealCheck, ShieldCheck, Users } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatMoney, formatRate, timeAgo } from "@/lib/format";
import { distanceKm, formatDistance } from "@/lib/geo";
import { jobWhen } from "@/lib/jobs";
import { quote } from "@/lib/pricing";
import { closeJobAction, declineApplicantAction } from "@/app/actions/jobs";
import { ActionForm } from "@/components/action-form";
import { HireForm } from "@/components/job-forms";
import { Alert, Avatar, Badge, Card, EmptyState, LinkButton, Rating } from "@/components/ui";

export const metadata: Metadata = { title: "Job post" };

export default async function JobPage({ params, searchParams }: PageProps<"/jobs/[id]">) {
  const user = await requireUser(["PARENT"]);
  const { id } = await params;
  const sp = await searchParams;
  const job = await db.job.findFirst({
    where: { id, parentId: user.id },
    include: {
      applications: {
        orderBy: { createdAt: "asc" },
        include: {
          sitter: {
            select: {
              id: true, firstName: true, lastName: true, avatarUrl: true, area: true, latitude: true, longitude: true,
              sitterProfile: {
                select: {
                  headline: true, hourlyRateCents: true, experienceYears: true, ratingAvg: true, ratingCount: true,
                  completedJobs: true, verifiedAt: true, backgroundCheckAt: true, cprCertified: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!job) notFound();

  const [cards, profile] = await Promise.all([
    db.paymentMethod.findMany({ where: { userId: user.id, removedAt: null }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
    db.parentProfile.findUnique({ where: { userId: user.id } }),
  ]);
  const minutes = (job.endsAt.getTime() - job.startsAt.getTime()) / 60_000;
  const open = job.applications.filter((a) => a.status === "APPLIED");
  const others = job.applications.filter((a) => a.status !== "APPLIED");

  return (
    <div className="max-w-4xl">
      <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> My job posts
      </Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {job.status === "OPEN" ? <Badge tone="accent">Open</Badge> : job.status === "FILLED" ? <Badge tone="info">Hired</Badge> : <Badge>Closed</Badge>}
          </div>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">{job.title}</h1>
          <p className="mt-1 text-ink-2">{jobWhen(job)}. {job.childrenCount} {job.childrenCount === 1 ? "child" : "children"}, budget up to {formatRate(job.maxRateCents)}.</p>
        </div>
        {job.status === "OPEN" && (
          <ActionForm action={closeJobAction} hidden={{ jobId: job.id }} label="Close job" variant="secondary"
            confirm={{ title: "Close this job?", body: "Applicants are told it's no longer available.", confirmLabel: "Close job" }} pendingText="Closing" />
        )}
        {job.status === "FILLED" && job.hiredBookingId && <LinkButton href={`/bookings/${job.hiredBookingId}`} variant="secondary">View booking</LinkButton>}
      </div>

      {sp.posted === "1" && <div className="mt-6"><Alert tone="accent">Your job is live. Sitters nearby have been notified, and you&apos;ll get a notification for every applicant.</Alert></div>}
      {job.description && <p className="mt-6 max-w-[65ch] whitespace-pre-line text-ink-2">{job.description}</p>}

      <section className="mt-10" aria-labelledby="applicants">
        <h2 id="applicants" className="text-lg font-semibold">Applicants {open.length > 0 && <span className="text-ink-3">({open.length})</span>}</h2>
        {open.length === 0 && job.status === "OPEN" && (
          <div className="mt-4">
            <EmptyState icon={<Users size={32} />} title="No applicants yet" body="Most jobs get their first applicant within a few hours. We'll notify you." />
          </div>
        )}
        <div className="mt-4 space-y-4">
          {open.map((a) => {
            const p = a.sitter.sitterProfile!;
            const q = quote(p.hourlyRateCents, minutes);
            const km = a.sitter.latitude != null && job.latitude != null
              ? distanceKm({ lat: job.latitude, lng: job.longitude! }, { lat: a.sitter.latitude, lng: a.sitter.longitude! })
              : null;
            return (
              <Card key={a.id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Avatar src={a.sitter.avatarUrl} first={a.sitter.firstName} last={a.sitter.lastName} size={64} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/sitters/${a.sitter.id}`} className="text-lg font-semibold hover:underline">{a.sitter.firstName} {a.sitter.lastName.charAt(0)}.</Link>
                      <Rating avg={p.ratingAvg} count={p.ratingCount} />
                    </div>
                    <p className="text-sm text-ink-3">
                      {p.headline}. {p.experienceYears} yrs experience, {p.completedJobs} jobs on Meraki{km != null && `, ${formatDistance(km)}`}.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.verifiedAt && <Badge tone="info"><SealCheck size={14} weight="fill" aria-hidden />ID verified</Badge>}
                      {p.backgroundCheckAt && <Badge tone="info"><ShieldCheck size={14} weight="fill" aria-hidden />Background check</Badge>}
                      {p.cprCertified && <Badge tone="info">CPR certified</Badge>}
                    </div>
                    {a.message && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-ink-2">“{a.message}”</p>}
                    <p className="mt-2 text-xs text-ink-3">Applied {timeAgo(a.createdAt)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xl font-bold tabular">{formatRate(p.hourlyRateCents)}</p>
                    <p className="text-sm text-ink-3 tabular">{formatMoney(q.totalCents)} total</p>
                    {p.hourlyRateCents > job.maxRateCents && <p className="text-xs text-warn">Above your budget</p>}
                  </div>
                </div>
                {job.status === "OPEN" && (
                  <details className="group mt-4 border-t border-line pt-4">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 [&::-webkit-details-marker]:hidden">
                      <span className="inline-flex h-10 items-center rounded-[10px] bg-accent px-5 text-sm font-semibold text-accent-ink hover:bg-accent-strong">
                        Hire {a.sitter.firstName}
                      </span>
                      <span className="text-sm text-ink-3 group-open:hidden">Choose card and confirm on the next step</span>
                    </summary>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
                      <HireForm
                        applicationId={a.id}
                        sitterName={a.sitter.firstName}
                        total={formatMoney(q.totalCents)}
                        address={profile?.address ?? ""}
                        cards={cards.map((c) => ({ id: c.id, label: `${c.brand} ending ${c.last4}`, isDefault: c.isDefault }))}
                      />
                      <ActionForm action={declineApplicantAction} hidden={{ applicationId: a.id, jobId: job.id }} label="Not this time" variant="ghost" pendingText="Declining" />
                    </div>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
        {others.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-ink-3">Earlier applicants</h3>
            <ul className="mt-2 divide-y divide-line text-sm">
              {others.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5">
                  <span>{a.sitter.firstName} {a.sitter.lastName.charAt(0)}.</span>
                  <Badge tone={a.status === "HIRED" ? "info" : "neutral"}>{a.status.toLowerCase()}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
