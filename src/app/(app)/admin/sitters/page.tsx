import type { Metadata } from "next";
import { CheckCircle } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { WEEKDAYS, formatMinutes, formatRate, formatShortDate } from "@/lib/format";
import { reviewSitter } from "@/app/actions/admin";
import { Avatar, Badge, Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Sitter approvals" };

export default async function SitterApprovalsPage() {
  await requireUser(["ADMIN"]);
  const pending = await db.user.findMany({
    where: { role: "SITTER", status: "PENDING_REVIEW" },
    orderBy: { createdAt: "asc" },
    include: { sitterProfile: { include: { skills: { include: { skill: true } }, availability: true } } },
  });

  return (
    <>
      <PageHeader
        title="Sitter approvals"
        description="Check identity and references before approving. Approved sitters appear in search immediately."
      />
      {pending.length === 0 ? (
        <EmptyState icon={<CheckCircle size={32} />} title="Nothing to review" body="New sitter sign-ups will appear here." />
      ) : (
        <div className="space-y-4">
          {pending.map((u) => {
            const p = u.sitterProfile!;
            const complete = !!p.headline && p.bio.length >= 80 && p.availability.length > 0;
            return (
              <Card key={u.id} className="p-6">
                <div className="flex flex-col gap-5 md:flex-row">
                  <Avatar src={u.avatarUrl} first={u.firstName} last={u.lastName} size={64} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{u.firstName} {u.lastName}</h2>
                      {complete ? <Badge tone="info">Profile complete</Badge> : <Badge tone="warn">Profile incomplete</Badge>}
                    </div>
                    <p className="text-sm text-ink-3">
                      {u.email}{u.phone && `, ${u.phone}`}. {u.area || "No area"}. Signed up {formatShortDate(u.createdAt)}.
                    </p>
                    <p className="mt-3 font-medium">{p.headline || "No headline"}</p>
                    <p className="mt-1 line-clamp-3 max-w-[70ch] text-sm text-ink-2">{p.bio || "No bio yet."}</p>
                    <p className="mt-3 text-sm text-ink-2">
                      {formatRate(p.hourlyRateCents)}, {p.experienceYears} years experience, up to {p.maxChildren} children, travels {p.serviceRadiusKm} km.
                    </p>
                    <p className="mt-1 text-sm text-ink-3">
                      {p.availability.length
                        ? p.availability.map((a) => `${WEEKDAYS[a.weekday].slice(0, 3)} ${formatMinutes(a.startMinute)} to ${formatMinutes(a.endMinute)}`).join("; ")
                        : "No availability set"}
                    </p>
                    {p.skills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">{p.skills.map((s) => <Badge key={s.skillId}>{s.skill.name}</Badge>)}</div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2 md:flex-col">
                    <form action={reviewSitter}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <button className={buttonClass("primary", "md", "w-full")}>Approve</button>
                    </form>
                    <form action={reviewSitter}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <button className={buttonClass("danger", "md", "w-full")}>Reject</button>
                    </form>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
