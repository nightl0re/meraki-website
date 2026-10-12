import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { toDateInput } from "@/lib/time";
import { PostJobForm } from "@/components/job-forms";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Post a job" };

export default async function NewJobPage() {
  const user = await requireUser(["PARENT"]);
  const [kids, me] = await Promise.all([
    db.child.count({ where: { parentId: user.id } }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { area: true } }),
  ]);
  const now = new Date().getTime();
  return (
    <div className="max-w-3xl">
      <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> My job posts
      </Link>
      <div className="mt-4">
        <PageHeader title="Post a job" description={`Sitters near ${me.area || "you"} will see it and can apply. You choose who to hire.`} />
      </div>
      <Card className="p-6 sm:p-8">
        <PostJobForm
          minDate={toDateInput(new Date(now + config.minLeadTimeHours * 3_600_000))}
          maxDate={toDateInput(new Date(now + config.jobMaxDaysAhead * 86_400_000))}
          defaultChildren={Math.max(1, kids)}
          currency={config.currency}
        />
      </Card>
    </div>
  );
}
