import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, CalendarBlank, Clock, MapPin, NotePencil, Phone, Receipt, UsersThree,
} from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { canMarkDone, canReportProblem, cancellationTerms } from "@/lib/bookings";
import { childAge, formatLongDate, formatMoney, formatShortDate, formatTime, formatTimeRange, timeAgo } from "@/lib/format";
import {
  acceptAction, cancelAction, confirmAction, declineAction, markDoneAction, messageAction, reportAction, reviewAction,
} from "@/app/actions/bookings";
import { approvePaymentAction } from "@/app/actions/admin";
import { BookingTimeline } from "@/components/booking-timeline";
import { ActionForm, MessageForm, ReviewForm } from "@/components/action-form";
import { Alert, Avatar, BookingStatus, Card, LinkButton, Rating, cn } from "@/components/ui";

export const metadata: Metadata = { title: "Booking" };

const paymentLabel: Record<string, string> = {
  AUTHORIZED: "Held on card, not charged",
  CAPTURED: "Charged",
  VOIDED: "Hold released, nothing charged",
  PARTIALLY_REFUNDED: "Charged, partly refunded",
  REFUNDED: "Refunded",
  FAILED: "Payment failed",
};

export default async function BookingPage({ params, searchParams }: PageProps<"/bookings/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;

  const b = await db.booking.findUnique({
    where: { id },
    include: {
      parent: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, phone: true, area: true, parentProfile: true } },
      sitter: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, phone: true, area: true, sitterProfile: { select: { ratingAvg: true, ratingCount: true } } } },
      payment: { include: { paymentMethod: true } },
      payout: true,
      reviews: true,
      children: { include: { child: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
    },
  });
  const isParent = b?.parentId === user.id;
  const isSitter = b?.sitterId === user.id;
  if (!b || (!isParent && !isSitter && user.role !== "ADMIN")) notFound();

  const now = new Date();
  const started = b.startsAt <= now;
  const ended = b.endsAt <= now;
  const other = isParent ? b.sitter : b.parent;
  const confirmedSide = ["ACCEPTED", "AWAITING_CONFIRMATION", "AWAITING_PAYMENT", "COMPLETED", "DISPUTED"].includes(b.status);
  const isAdmin = user.role === "ADMIN";
  const terms = cancellationTerms(b, now);
  const autoConfirmAt = new Date((b.sitterDoneAt ?? b.endsAt).getTime() + config.autoConfirmHours * 3_600_000);
  const reportForm = (
    <ActionForm action={reportAction} hidden={{ bookingId: b.id }} label="Report a problem" variant="secondary"
      confirm={{ title: "Report a problem", body: "The payment is paused and a person from our team looks into it.", confirmLabel: "Send report" }}
      reason={{ label: "What happened?", required: true }} pendingText="Sending" />
  );
  const myReview = b.reviews.find((r) => r.authorId === user.id);
  const hidden = { bookingId: b.id };

  return (
    <div>
      <Link href="/bookings" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> All bookings
      </Link>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <BookingStatus status={b.status} ended={ended} />
            <span className="font-mono text-xs text-ink-3">{b.code}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
            {formatLongDate(b.startsAt)}
          </h1>
          <p className="mt-1 text-ink-2">
            {formatTimeRange(b.startsAt, b.endsAt)} with {isParent ? other.firstName : `the ${b.parent.lastName} family`}
          </p>
        </div>
        {b.status === "COMPLETED" && isParent && (
          <LinkButton href={`/bookings/${b.id}/receipt`} variant="secondary"><Receipt size={18} aria-hidden />Receipt</LinkButton>
        )}
      </div>

      {sp.hired === "1" && b.status === "ACCEPTED" && (
        <div className="mt-6"><Alert tone="accent">You hired {other.firstName}! The booking is confirmed and {formatMoney(b.totalCents)} is on hold. Nothing is charged until after the job.</Alert></div>
      )}
      {sp.requested === "1" && b.status === "REQUESTED" && (
        <div className="mt-6"><Alert tone="accent">Request sent! We&apos;ve placed a hold of {formatMoney(b.totalCents)} on your card. Nothing is charged yet.</Alert></div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          {/* What happens next */}
          <NextStep>
            {/* ---- parent ---- */}
            {isParent && b.status === "REQUESTED" && (
              <>
                <StepText title={`Waiting for ${other.firstName} to accept`}>
                  They have until {formatTime(b.respondBy)} on {formatShortDate(b.respondBy)}. If they don&apos;t answer, the hold on your card is released automatically.
                </StepText>
                <ActionForm action={cancelAction} hidden={hidden} label="Cancel request" variant="secondary"
                  confirm={{ title: "Cancel this request?", body: "The hold on your card is released straight away.", confirmLabel: "Cancel request" }}
                  reason={{ label: "Reason (optional)" }} pendingText="Cancelling" />
              </>
            )}
            {isParent && b.status === "ACCEPTED" && (
              <>
                <StepText title={started ? `Waiting for ${other.firstName} to mark the job completed` : `${other.firstName} accepted your booking`}>
                  {started
                    ? "Once they mark it completed, you'll be asked to confirm. Nothing is charged until then."
                    : terms.late
                      ? `It's less than ${config.freeCancelHours} hours to go, so cancelling now costs ${formatMoney(terms.feeCents)} (paid to your sitter).`
                      : `Free cancellation until ${formatTime(new Date(b.startsAt.getTime() - config.freeCancelHours * 3_600_000))} on ${formatShortDate(new Date(b.startsAt.getTime() - config.freeCancelHours * 3_600_000))}.`}
                </StepText>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  {ended && <ActionForm action={confirmAction} hidden={hidden} label="Confirm the job went well" pendingText="Confirming" />}
                  {!started && (
                    <ActionForm action={cancelAction} hidden={hidden} label="Cancel booking" variant="danger"
                      confirm={{
                        title: "Cancel this booking?",
                        body: terms.late ? `A late-cancellation fee of ${formatMoney(terms.feeCents)} will be charged.` : "You won't be charged anything.",
                        confirmLabel: terms.late ? `Cancel and pay ${formatMoney(terms.feeCents)}` : "Cancel booking",
                      }}
                      reason={{ label: "Let your sitter know why (optional)" }} pendingText="Cancelling" />
                  )}
                  {canReportProblem(b, now) && reportForm}
                </div>
              </>
            )}
            {isParent && b.status === "AWAITING_CONFIRMATION" && (
              <>
                <StepText title={`${other.firstName} marked the job as completed`}>
                  Did everything go well? Confirm, or report a problem. If you don&apos;t respond, it&apos;s confirmed automatically on {formatShortDate(autoConfirmAt)} at {formatTime(autoConfirmAt)}.
                  Your card ({formatMoney(b.totalCents)}) is charged only after Meraki approves the payment.
                </StepText>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <ActionForm action={confirmAction} hidden={hidden} label="Yes, confirm it went well" pendingText="Confirming" />
                  {reportForm}
                </div>
              </>
            )}
            {isParent && b.status === "AWAITING_PAYMENT" && (
              <>
                <StepText title="Thanks for confirming">
                  Meraki is approving the payment. Your card will then be charged {formatMoney(b.totalCents)} and your receipt will be ready.
                </StepText>
                {reportForm}
              </>
            )}

            {/* ---- sitter ---- */}
            {isSitter && b.status === "REQUESTED" && (
              <>
                <StepText title="New request">
                  Please respond by {formatTime(b.respondBy)} on {formatShortDate(b.respondBy)}. The family&apos;s card is already held for {formatMoney(b.totalCents)}.
                </StepText>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <ActionForm action={acceptAction} hidden={hidden} label="Accept booking" pendingText="Accepting" />
                  <ActionForm action={declineAction} hidden={hidden} label="Decline" variant="secondary"
                    confirm={{ title: "Decline this request?", body: "The family will be told you're not available.", confirmLabel: "Decline request" }}
                    reason={{ label: "Message to the family (optional)" }} pendingText="Declining" />
                </div>
              </>
            )}
            {isSitter && b.status === "ACCEPTED" && (
              <>
                <StepText title={started ? (ended ? "Is the job done?" : "Happening now") : "You're booked"}>
                  {canMarkDone(b, now)
                    ? `When the job is finished, mark it completed. The family confirms, Meraki approves, and ${formatMoney(b.subtotalCents)} goes to your next payout.`
                    : `You'll earn ${formatMoney(b.subtotalCents)}. You can mark the job completed once it has started.`}
                </StepText>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  {canMarkDone(b, now) && (
                    <ActionForm action={markDoneAction} hidden={hidden} label="Mark job as completed"
                      confirm={{ title: "Mark this job as completed?", body: ended ? "The family will be asked to confirm." : "This booking hasn't ended yet. Only mark it completed if the job is actually done.", confirmLabel: "Yes, it's completed" }}
                      pendingText="Saving" />
                  )}
                  {!started && (
                    <ActionForm action={cancelAction} hidden={hidden} label="Cancel booking" variant="danger"
                      confirm={{ title: "Cancel this booking?", body: "Families rely on you. Frequent cancellations can lead to your profile being paused.", confirmLabel: "Cancel booking" }}
                      reason={{ label: "Reason for the family", required: true }} pendingText="Cancelling" />
                  )}
                </div>
              </>
            )}
            {isSitter && b.status === "AWAITING_CONFIRMATION" && (
              <StepText title="Waiting for the family to confirm">
                You marked the job completed. If they don&apos;t respond, it&apos;s confirmed automatically on {formatShortDate(autoConfirmAt)}.
              </StepText>
            )}
            {isSitter && b.status === "AWAITING_PAYMENT" && (
              <StepText title="Confirmed by the family">
                Meraki is approving the payment. Then {formatMoney(b.subtotalCents)} is added to your next payout.
              </StepText>
            )}

            {/* ---- admin ---- */}
            {isAdmin && !isParent && !isSitter && (
              <StepText title="Admin">
                {b.status === "AWAITING_PAYMENT"
                  ? `Both sides are done: the sitter marked it completed and the family confirmed. Approving charges ${formatMoney(b.totalCents)} and queues ${formatMoney(b.subtotalCents)} for the sitter.`
                  : b.status === "DISPUTED"
                    ? "This booking is disputed. Decide the refund on the Disputes page."
                    : "No admin action is needed at this stage."}
              </StepText>
            )}
            {isAdmin && b.status === "AWAITING_PAYMENT" && (
              <ActionForm action={approvePaymentAction} hidden={hidden} label={`Approve payment of ${formatMoney(b.totalCents)}`} pendingText="Charging card" />
            )}
            {isAdmin && b.status === "DISPUTED" && <LinkButton href="/admin/disputes" variant="secondary">Open disputes</LinkButton>}

            {/* ---- everyone ---- */}
            {b.status === "DISPUTED" && (isParent || isSitter) && (
              <StepText title="Under review">
                {isParent ? "Thanks for telling us. No money has moved; our team will contact you both within one business day." : "The family reported a problem. Our team will contact you within one business day."}
                {b.disputeReason && <span className="mt-2 block rounded-lg bg-surface-2 p-3 text-ink-2">“{b.disputeReason}”</span>}
              </StepText>
            )}
            {b.status === "COMPLETED" && (isParent || isSitter) && (
              <StepText title="All done">
                {isParent
                  ? `You were charged ${formatMoney(b.payment?.capturedCents ?? b.totalCents)}.`
                  : `${formatMoney(b.payout?.amountCents ?? b.subtotalCents)} ${b.payout?.status === "PAID" ? "was paid out to you" : "is in your next payout"}.`}
              </StepText>
            )}
            {["DECLINED", "EXPIRED", "CANCELLED"].includes(b.status) && (isParent || isSitter) && (
              <StepText title={b.status === "DECLINED" ? "Declined" : b.status === "EXPIRED" ? "Request expired" : "Cancelled"}>
                {b.payment?.status === "CAPTURED"
                  ? `A late-cancellation fee of ${formatMoney(b.payment.capturedCents)} was charged.`
                  : "No money was charged."}
                {b.cancelReason && <span className="mt-2 block text-ink-3">Reason: {b.cancelReason}</span>}
                {isParent && b.status !== "CANCELLED" && (
                  <span className="mt-3 block"><LinkButton href="/sitters" size="sm" variant="secondary">Find another sitter</LinkButton></span>
                )}
              </StepText>
            )}
          </NextStep>

          <Card className="p-6">
            <h2 className="mb-4 font-semibold">Progress</h2>
            <BookingTimeline b={b} />
          </Card>

          {b.status === "COMPLETED" && (isParent || isSitter) && (
            <Card className="p-6">
              <h2 className="font-semibold">{myReview ? "Your review" : `Review ${other.firstName}`}</h2>
              <div className="mt-4">
                {myReview ? (
                  <p className="text-ink-2">You gave {myReview.rating} stars. {myReview.comment && `“${myReview.comment}”`}</p>
                ) : (
                  <ReviewForm action={reviewAction} bookingId={b.id} name={other.firstName} />
                )}
              </div>
            </Card>
          )}

          {/* Details */}
          <Card className="p-6">
            <h2 className="font-semibold">Details</h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Detail icon={<CalendarBlank size={18} />} label="Date">{formatLongDate(b.startsAt)}</Detail>
              <Detail icon={<Clock size={18} />} label="Time">{formatTimeRange(b.startsAt, b.endsAt)} ({Number(b.hours)} h)</Detail>
              <Detail icon={<UsersThree size={18} />} label="Children">
                {b.children.length && (!isSitter || confirmedSide)
                  ? b.children.map((c) => `${c.child.firstName} (${childAge(c.child.birthYear)})`).join(", ")
                  : b.childrenCount}
              </Detail>
              <Detail icon={<MapPin size={18} />} label="Address">
                {isSitter && !confirmedSide ? `${b.parent.area} (full address after you accept)` : b.address}
              </Detail>
              {(!isSitter || confirmedSide) && b.children.some((c) => c.child.notes) && (
                <Detail icon={<NotePencil size={18} />} label="About the children" wide>
                  <ul className="space-y-1">
                    {b.children.filter((c) => c.child.notes).map((c) => <li key={c.childId}><span className="font-semibold">{c.child.firstName}:</span> {c.child.notes}</li>)}
                  </ul>
                </Detail>
              )}
              {b.notes && (
                <Detail icon={<NotePencil size={18} />} label="Notes" wide>
                  <span className="whitespace-pre-line">{b.notes}</span>
                </Detail>
              )}
            </dl>
          </Card>

          {/* Messages */}
          <Card className="p-6" id="messages">
            <h2 className="font-semibold">Messages</h2>
            <ul className="mt-4 space-y-4">
              {b.messages.length === 0 && (
                <li className="text-sm text-ink-3">No messages yet. Use this to share routines, allergies or directions.</li>
              )}
              {b.messages.map((m) => {
                const mine = m.senderId === user.id;
                return (
                  <li key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
                    <Avatar src={m.sender.avatarUrl} first={m.sender.firstName} last={m.sender.lastName} size={32} />
                    <div className={cn("max-w-[80%] rounded-xl px-4 py-2.5", mine ? "bg-accent-soft" : "bg-surface-2")}>
                      <p className="whitespace-pre-line text-[15px]">{m.body}</p>
                      <p className="mt-1 text-xs text-ink-3">{mine ? "You" : m.sender.firstName}, {timeAgo(m.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {(isParent || isSitter) && !["DECLINED", "EXPIRED"].includes(b.status) && (
              <div className="mt-5 border-t border-line pt-5">
                <MessageForm action={messageAction} bookingId={b.id} />
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          {isAdmin && !isParent && !isSitter && (
            <Card className="space-y-4 p-6">
              {[{ label: "Parent", u: b.parent }, { label: "Sitter", u: b.sitter }].map(({ label, u }) => (
                <div key={label}>
                  <p className="text-xs font-medium text-ink-3">{label}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <Avatar src={u.avatarUrl} first={u.firstName} last={u.lastName} size={40} />
                    <div>
                      <p className="font-semibold">{u.firstName} {u.lastName}</p>
                      <p className="text-sm text-ink-3">{u.phone || "No phone"}, {u.area}</p>
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}
          {(isParent || isSitter) && (
          <Card className="p-6">
            <p className="text-xs font-medium text-ink-3">{isParent ? "Your sitter" : "Family"}</p>
            <div className="mt-3 flex items-center gap-3">
              <Avatar src={other.avatarUrl} first={other.firstName} last={other.lastName} size={48} />
              <div>
                <p className="font-semibold">{other.firstName} {other.lastName}</p>
                {isParent
                  ? <Rating avg={b.sitter.sitterProfile?.ratingAvg ?? 0} count={b.sitter.sitterProfile?.ratingCount ?? 0} />
                  : <p className="text-sm text-ink-3">{b.parent.area}</p>}
              </div>
            </div>
            {confirmedSide && other.phone && (isParent || isSitter) && (
              <a href={`tel:${other.phone.replace(/[^\d+]/g, "")}`} className="mt-4 flex items-center gap-2 text-sm text-accent-strong hover:underline">
                <Phone size={16} aria-hidden />{other.phone}
              </a>
            )}
            {isParent && (
              <Link href={`/sitters/${b.sitter.id}`} className="mt-3 inline-block text-sm text-ink-3 hover:text-ink">View profile</Link>
            )}
          </Card>
          )}

          <Card className="p-6">
            <h2 className="font-semibold">{isSitter ? "Your earnings" : "Payment"}</h2>
            <dl className="mt-4 space-y-2.5 text-sm tabular">
              <div className="flex justify-between">
                <dt className="text-ink-2">{formatMoney(b.hourlyRateCents)} x {Number(b.hours)} h</dt>
                <dd>{formatMoney(b.subtotalCents)}</dd>
              </div>
              {!isSitter && (
                <>
                  <div className="flex justify-between"><dt className="text-ink-2">Service fee</dt><dd>{formatMoney(b.serviceFeeCents)}</dd></div>
                  <div className="flex justify-between border-t border-line pt-2.5 font-semibold"><dt>Total</dt><dd>{formatMoney(b.totalCents)}</dd></div>
                </>
              )}
            </dl>
            {b.payment && !isSitter && (
              <div className="mt-4 rounded-[10px] bg-surface-2 p-3 text-sm">
                <p className="font-medium">{paymentLabel[b.payment.status]}</p>
                <p className="mt-0.5 text-ink-3">{b.payment.paymentMethod.brand} ending {b.payment.paymentMethod.last4}</p>
                {b.payment.refundedCents > 0 && <p className="mt-0.5 text-ink-3">Refunded {formatMoney(b.payment.refundedCents)}</p>}
              </div>
            )}
            {isSitter && b.payout && (
              <p className="mt-4 rounded-[10px] bg-surface-2 p-3 text-sm">
                Payout {formatMoney(b.payout.amountCents)}: {b.payout.status === "PAID" ? `paid ${b.payout.paidAt ? formatShortDate(b.payout.paidAt) : ""}` : "pending, paid out weekly"}
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function NextStep({ children }: { children: React.ReactNode }) {
  return <Card className="space-y-5 border-l-4 border-l-accent p-6">{children}</Card>;
}

function StepText({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-ink-2">{children}</p>
    </div>
  );
}

function Detail({ icon, label, children, wide }: { icon: React.ReactNode; label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("flex gap-3", wide && "sm:col-span-2")}>
      <span className="mt-0.5 text-ink-3">{icon}</span>
      <div>
        <dt className="text-xs text-ink-3">{label}</dt>
        <dd className="mt-0.5">{children}</dd>
      </div>
    </div>
  );
}
