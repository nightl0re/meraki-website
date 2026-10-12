import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, CaretRight } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatRate } from "@/lib/format";
import { jobWhen } from "@/lib/jobs";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "My job posts" };

export default async function JobsPage() {
  const user = await requireUser(["PARENT"]);
  const jobs = await db.job.findMany({
    where: { parentId: user.id },
    orderBy: [{ status: "asc" }, { startsAt: "desc" }],
    take: 50,
    include: { _count: { select: { applications: { where: { status: "APPLIED" } } } } },
  });

  return (
    <>
      <PageHeader
        title="My job posts"
        description="Post when you need someone and let nearby sitters come to you. Pick from the applicants and hire in one click."
        actions={<LinkButton href="/jobs/new">Post a job</LinkButton>}
      />
      {jobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={32} />}
          title="You haven't posted a job yet"
          body="Tell sitters when you need help. Everyone nearby within your budget is notified."
          action={<LinkButton href="/jobs/new">Post your first job</LinkButton>}
        />
      ) : (
        <Card className="divide-y divide-line">
          {jobs.map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{j.title}</p>
                <p className="text-sm text-ink-3">{jobWhen(j)}, budget up to {formatRate(j.maxRateCents)}</p>
              </div>
              {j.status === "OPEN" ? (
                j._count.applications > 0
                  ? <Badge tone="accent">{j._count.applications} {j._count.applications === 1 ? "applicant" : "applicants"}</Badge>
                  : <Badge tone="warn">Waiting for applicants</Badge>
              ) : j.status === "FILLED" ? <Badge tone="info">Hired</Badge> : <Badge>Closed</Badge>}
              <CaretRight size={16} className="text-ink-3" aria-hidden />
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
