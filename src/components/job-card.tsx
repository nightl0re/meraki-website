import Link from "next/link";
import { CalendarBlank, MapPin, UsersThree } from "@phosphor-icons/react/ssr";
import { formatRate, timeAgo } from "@/lib/format";
import { formatDistance } from "@/lib/geo";
import { jobWhen } from "@/lib/jobs";
import { Avatar, Badge } from "./ui";

type JobCardData = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  childrenCount: number;
  maxRateCents: number;
  area: string;
  createdAt: Date;
  distanceKm: number;
  parent: { firstName: string; lastName: string; avatarUrl: string | null };
  myApplication: { status: string } | null;
  _count: { applications: number };
};

export function JobCard({ j, myRateCents }: { j: JobCardData; myRateCents: number }) {
  const overBudget = myRateCents > j.maxRateCents;
  return (
    <Link href={`/sitter/jobs/${j.id}`} className="block rounded-2xl border border-line bg-surface p-5 shadow-card transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong">
      <div className="flex items-start gap-3">
        <Avatar src={j.parent.avatarUrl} first={j.parent.firstName} last={j.parent.lastName} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{j.title}</p>
          <p className="text-sm text-ink-3">{j.parent.firstName} {j.parent.lastName.charAt(0)}., posted {timeAgo(j.createdAt)}</p>
        </div>
        <div className="text-right">
          <p className="font-bold tabular">up to {formatRate(j.maxRateCents)}</p>
          {overBudget && <p className="text-xs text-warn">Your rate is above budget</p>}
        </div>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-2">
        <li className="flex items-center gap-1.5"><CalendarBlank size={16} aria-hidden />{jobWhen(j)}</li>
        <li className="flex items-center gap-1.5"><MapPin size={16} aria-hidden />{formatDistance(j.distanceKm)}, {j.area}</li>
        <li className="flex items-center gap-1.5"><UsersThree size={16} aria-hidden />{j.childrenCount} {j.childrenCount === 1 ? "child" : "children"}</li>
      </ul>
      <div className="mt-4 flex items-center gap-2">
        {j.myApplication?.status === "APPLIED" ? <Badge tone="accent">You applied</Badge>
          : j.myApplication?.status === "DECLINED" ? <Badge>Not selected</Badge>
          : <Badge tone="info">Open for applications</Badge>}
        <span className="text-xs text-ink-3">{j._count.applications} {j._count.applications === 1 ? "applicant" : "applicants"} so far</span>
      </div>
    </Link>
  );
}
