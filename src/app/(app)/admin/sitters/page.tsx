import type { Metadata } from "next";
import { CheckCircle, LockSimple } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fileUrl } from "@/lib/files";
import { WEEKDAYS, formatMinutes, formatRate, formatShortDate, timeAgo } from "@/lib/format";
import { reviewSitter } from "@/app/actions/admin";
import { Avatar, Badge, Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";

export const metadata: Metadata = { title: "Sitter approvals" };

export default async function SitterApprovalsPage() {
  await requireUser(["ADMIN"]);
  const pending = await db.user.findMany({
    where: { role: "SITTER", status: "PENDING_REVIEW" },
    include: { sitterProfile: { include: { skills: { include: { skill: true } }, availability: true } } },
  });
  // Submitted applications first (oldest first), then ones still being filled in.
  pending.sort((a, b) => {
    const sa = a.sitterProfile?.submittedAt?.getTime() ?? Infinity;
    const sb = b.sitterProfile?.submittedAt?.getTime() ?? Infinity;
    return sa - sb || a.createdAt.getTime() - b.createdAt.getTime();
  });
  const submitted = pending.filter((u) => u.sitterProfile?.submittedAt).length;

  return (
    <>
      <PageHeader
        title="Sitter approvals"
        description="Compare the verification photo with the profile photo, check the details, then approve. Approved sitters appear in search immediately."
      />
      {pending.length === 0 ? (
        <EmptyState icon={<CheckCircle size={32} />} title="Nothing to review" body="New babysitter applications will appear here." />
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-3">
            {submitted} submitted, {pending.length - submitted} still filling in their application.
          </p>
          <div className="space-y-4">
            {pending.map((u) => {
              const p = u.sitterProfile!;
              const ready = !!p.submittedAt && !!p.idPhotoId;
              return (
                <Card key={u.id} className={ready ? "p-6" : "p-6 opacity-80"}>
                  <div className="flex flex-col gap-6 sm:flex-row sm:flex-wrap xl:flex-nowrap">
                    {/* Photos: verification (private) next to profile photo */}
                    <div className="flex shrink-0 gap-3">
                      <figure className="w-32">
                        <div className="aspect-[3/4] overflow-hidden rounded-xl border border-line bg-surface-2">
                          {p.idPhotoId ? (
                            <a href={fileUrl(p.idPhotoId)} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element -- private photo, admin-only route */}
                              <img src={fileUrl(p.idPhotoId)} alt={`Verification photo of ${u.firstName} ${u.lastName}`} className="h-full w-full object-cover" />
                            </a>
                          ) : (
                            <div className="flex h-full items-center justify-center p-2 text-center text-xs text-ink-3">No verification photo yet</div>
                          )}
                        </div>
                        <figcaption className="mt-1 flex items-center gap-1 text-xs text-ink-3"><LockSimple size={12} aria-hidden />Verification</figcaption>
                      </figure>
                      <figure className="w-32">
                        <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-2">
                          {u.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- public profile photo
                            <img src={u.avatarUrl} alt={`Profile photo of ${u.firstName} ${u.lastName}`} className="h-full w-full object-cover" />
                          ) : (
                            <Avatar first={u.firstName} last={u.lastName} size={56} />
                          )}
                        </div>
                        <figcaption className="mt-1 text-xs text-ink-3">Profile photo</figcaption>
                      </figure>
                    </div>

                    <div className="min-w-0 flex-1 sm:min-w-[280px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{u.firstName} {u.lastName}</h2>
                        {p.submittedAt
                          ? <Badge tone="accent">Submitted {timeAgo(p.submittedAt)}</Badge>
                          : p.reviewNote
                            ? <Badge tone="warn">Changes requested</Badge>
                            : <Badge>Not submitted yet</Badge>}
                      </div>
                      <p className="text-sm text-ink-3">
                        {u.email}{u.phone && `, ${u.phone}`}. {u.area || "No area"}. Signed up {formatShortDate(u.createdAt)}.
                      </p>
                      <p className="mt-3 font-medium">{p.headline || "No headline"}</p>
                      <p className="mt-1 line-clamp-3 max-w-[70ch] text-sm text-ink-2">{p.bio || "No bio yet."}</p>
                      <p className="mt-3 text-sm text-ink-2">
                        {formatRate(p.hourlyRateCents)}, {p.experienceYears} years experience, up to {p.maxChildren} children, travels {p.serviceRadiusKm} km.
                        {p.cprCertified && " Says they hold a CPR certificate."}
                      </p>
                      <p className="mt-1 text-sm text-ink-3">
                        {p.availability.length
                          ? p.availability.map((a) => `${WEEKDAYS[a.weekday].slice(0, 3)} ${formatMinutes(a.startMinute)} to ${formatMinutes(a.endMinute)}`).join("; ")
                          : "No availability set"}
                      </p>
                      {p.skills.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">{p.skills.map((s) => <Badge key={s.skillId}>{s.skill.name}</Badge>)}</div>
                      )}
                      {p.reviewNote && !p.submittedAt && <p className="mt-3 text-sm text-warn">You asked: “{p.reviewNote}”</p>}
                    </div>

                    <div className="grid w-full shrink-0 grid-cols-1 items-start gap-3 sm:grid-cols-3 xl:flex xl:w-56 xl:flex-col">
                      <form action={reviewSitter} className="space-y-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="backgroundCheck" className="size-4 accent-[var(--accent)]" />
                          Background check cleared
                        </label>
                        <button disabled={!ready} className={buttonClass("primary", "md", "w-full")}>Approve</button>
                        {!ready && <p className="text-xs text-ink-3">Available once they submit with a verification photo.</p>}
                      </form>
                      <details className="group">
                        <summary className={buttonClass("secondary", "md", "w-full cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>Ask for a change</summary>
                        <form action={reviewSitter} className="mt-2 space-y-2">
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="decision" value="changes" />
                          <label htmlFor={`note-${u.id}`} className="sr-only">What should they change?</label>
                          <textarea id={`note-${u.id}`} name="note" rows={3} maxLength={500} className={`${inputClass} h-auto py-2 text-sm`}
                            placeholder="e.g. Your face isn't clearly visible, please retake the photo in better light." />
                          <button className={buttonClass("secondary", "sm", "w-full")}>Send request</button>
                        </form>
                      </details>
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
        </>
      )}
    </>
  );
}
