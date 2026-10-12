import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarBlank, MapPin, UsersThree, Wallet } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatMoney, formatRate } from "@/lib/format";
import { distanceKm, formatDistance } from "@/lib/geo";
import { jobWhen } from "@/lib/jobs";
import { withdrawAction } from "@/app/actions/jobs";
import { ActionForm } from "@/components/action-form";
import { ApplyForm } from "@/components/job-forms";
import { Alert, Avatar, Card, Rating } from "@/components/ui";

export const metadata: Metadata = { title: "Job" };

export default async function SitterJobPage({ params }: PageProps<"/sitter/jobs/[id]">) {
  const user = await requireUser(["SITTER"]);
  const { id } = await params;
  const [job, me] = await Promise.all([
    db.job.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            firstName: true, lastName: true, avatarUrl: true, createdAt: true,
            parentProfile: { select: { about: true, ratingAvg: true, ratingCount: true } },
            children: { select: { birthYear: true } },
          },
        },
        applications: { where: { sitterId: user.id } },
      },
    }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { latitude: true, longitude: true, sitterProfile: { select: { hourlyRateCents: true } } } }),
  ]);
  // Sitters only see open jobs, or jobs they've applied to.
  if (!job || (job.status !== "OPEN" && job.applications.length === 0)) notFound();

  const mine = job.applications[0];
  const rate = me.sitterProfile?.hourlyRateCents ?? 0;
  const hours = (job.endsAt.getTime() - job.startsAt.getTime()) / 3_600_000;
  const km = me.latitude != null && job.latitude != null ? distanceKm({ lat: me.latitude, lng: me.longitude! }, { lat: job.latitude, lng: job.longitude! }) : null;
  const ages = job.parent.children.map((c) => new Date().getFullYear() - c.birthYear).sort((a, b) => a - b);

  return (
    <div className="max-w-4xl">
      <Link href="/sitter/jobs" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Jobs near you
      </Link>
      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold md:text-3xl">{job.title}</h1>
          <ul className="mt-4 grid grid-cols-1 gap-3 text-ink-2 sm:grid-cols-2">
            <li className="flex items-center gap-2"><CalendarBlank size={18} aria-hidden />{jobWhen(job)}</li>
            <li className="flex items-center gap-2"><MapPin size={18} aria-hidden />{job.area}{km != null && `, ${formatDistance(km)}`}</li>
            <li className="flex items-center gap-2"><UsersThree size={18} aria-hidden />{job.childrenCount} {job.childrenCount === 1 ? "child" : "children"}{ages.length > 0 && ` (ages ${ages.join(", ")})`}</li>
            <li className="flex items-center gap-2"><Wallet size={18} aria-hidden />Budget up to {formatRate(job.maxRateCents)}</li>
          </ul>
          {job.description && <p className="mt-6 max-w-[65ch] whitespace-pre-line text-ink-2">{job.description}</p>}

          <Card className="mt-8 p-6">
            {job.status !== "OPEN" ? (
              <Alert tone="neutral">This job is no longer open.</Alert>
            ) : mine?.status === "APPLIED" ? (
              <div className="space-y-4">
                <Alert tone="accent">You applied. The family will hire or decline in the app; we&apos;ll notify you either way.</Alert>
                {mine.message && <p className="text-sm text-ink-2">Your message: “{mine.message}”</p>}
                <ActionForm action={withdrawAction} hidden={{ jobId: job.id }} label="Withdraw application" variant="secondary" pendingText="Withdrawing" />
              </div>
            ) : mine?.status === "DECLINED" ? (
              <Alert tone="neutral">The family went with someone else for this job.</Alert>
            ) : user.status !== "ACTIVE" ? (
              <Alert tone="warn">You can apply once your profile is approved.</Alert>
            ) : (
              <>
                <h2 className="mb-4 font-semibold">Apply</h2>
                {rate > job.maxRateCents && (
                  <div className="mb-4"><Alert tone="warn">Your rate ({formatRate(rate)}) is above this family&apos;s budget. You can still apply.</Alert></div>
                )}
                <ApplyForm jobId={job.id} />
              </>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <p className="text-xs font-semibold text-ink-3">Posted by</p>
            <div className="mt-3 flex items-center gap-3">
              <Avatar src={job.parent.avatarUrl} first={job.parent.firstName} last={job.parent.lastName} size={48} />
              <div>
                <p className="font-semibold">{job.parent.firstName} {job.parent.lastName.charAt(0)}.</p>
                <Rating avg={job.parent.parentProfile?.ratingAvg ?? 0} count={job.parent.parentProfile?.ratingCount ?? 0} />
              </div>
            </div>
            {job.parent.parentProfile?.about && <p className="mt-3 text-sm text-ink-2">{job.parent.parentProfile.about}</p>}
          </Card>
          <Card className="p-5">
            <p className="text-xs font-semibold text-ink-3">You would earn</p>
            <p className="mt-1 text-2xl font-bold tabular">{formatMoney(Math.round(rate * hours))}</p>
            <p className="text-sm text-ink-3">{formatRate(rate)} x {Math.round(hours * 100) / 100} h. You keep 100% of your rate.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
