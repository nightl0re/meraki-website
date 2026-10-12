import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { jobsNear, jobWhen } from "@/lib/jobs";
import { JobCard } from "@/components/job-card";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, cn } from "@/components/ui";

export const metadata: Metadata = { title: "Find jobs" };

export default async function SitterJobsPage({ searchParams }: PageProps<"/sitter/jobs">) {
  const user = await requireUser(["SITTER"]);
  const tab = (await searchParams).tab === "applications" ? "applications" : "near";
  const profile = await db.sitterProfile.findUniqueOrThrow({ where: { userId: user.id }, select: { hourlyRateCents: true, serviceRadiusKm: true } });

  const [jobs, applications] = await Promise.all([
    tab === "near" && user.status === "ACTIVE" ? jobsNear(user.id) : Promise.resolve([]),
    tab === "applications"
      ? db.jobApplication.findMany({
          where: { sitterId: user.id },
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { job: { select: { id: true, title: true, startsAt: true, endsAt: true, area: true, status: true, hiredBookingId: true } } },
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Find jobs"
        description={`Families within ${profile.serviceRadiusKm} km who need a sitter. Apply with a short message; if they hire you, the booking is confirmed straight away.`}
      />
      <nav aria-label="Job tabs" className="mb-6 flex gap-1 border-b border-line">
        {[
          { key: "near", label: "Jobs near you" },
          { key: "applications", label: "My applications" },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/sitter/jobs${t.key === "near" ? "" : "?tab=applications"}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-3 py-2.5 text-sm", tab === t.key ? "border-accent font-semibold" : "border-transparent text-ink-3 hover:text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {user.status !== "ACTIVE" ? (
        <Alert tone="warn">You can browse and apply to jobs once our team has approved your profile.</Alert>
      ) : tab === "near" ? (
        jobs.length === 0 ? (
          <EmptyState
            icon={<Briefcase size={32} />}
            title="No open jobs near you right now"
            body="We'll notify you when a family nearby posts one. A wider travel radius shows more jobs."
            action={<LinkButton href="/sitter/profile" variant="secondary">Change travel distance</LinkButton>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {jobs.map((j) => <JobCard key={j.id} j={j} myRateCents={profile.hourlyRateCents} />)}
          </div>
        )
      ) : applications.length === 0 ? (
        <EmptyState icon={<Briefcase size={32} />} title="No applications yet" action={<LinkButton href="/sitter/jobs">Browse jobs</LinkButton>} />
      ) : (
        <Card className="divide-y divide-line">
          {applications.map((a) => (
            <Link key={a.id} href={a.status === "HIRED" && a.job.hiredBookingId ? `/bookings/${a.job.hiredBookingId}` : `/sitter/jobs/${a.job.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{a.job.title}</p>
                <p className="text-sm text-ink-3">{jobWhen(a.job)}, {a.job.area}</p>
              </div>
              <Badge tone={a.status === "HIRED" ? "info" : a.status === "APPLIED" ? "accent" : "neutral"}>
                {a.status === "HIRED" ? "Hired" : a.status === "APPLIED" ? (a.job.status === "OPEN" ? "Waiting" : "Closed") : a.status === "DECLINED" ? "Not selected" : "Withdrawn"}
              </Badge>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
