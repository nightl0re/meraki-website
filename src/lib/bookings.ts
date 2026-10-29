import "server-only";
import { randomInt } from "node:crypto";
import type { Booking, Payment, Prisma } from "@prisma/client";
import { db } from "./db";
import { config } from "./config";
import { quote, lateCancelChargeCents } from "./pricing";
import { payments } from "./payments/provider";
import { notify, audit } from "./notify";
import { HOUR, minuteOfDay, zonedParts } from "./time";
import { formatDate, formatMoney, formatTime } from "./format";
import type { CurrentUser } from "./auth";

// ---------------------------------------------------------------------------
// Booking lifecycle. Every state change goes through this file.
//
//   1. parent books          REQUESTED              card AUTHORIZED (held, not charged)
//   2. sitter accepts        ACCEPTED
//   3. sitter marks done     AWAITING_CONFIRMATION
//   4. parent confirms       AWAITING_PAYMENT       (or automatically after 48 h)
//   5. admin approves        COMPLETED              card CAPTURED, sitter payout queued
//
//   From ACCEPTED, AWAITING_CONFIRMATION or AWAITING_PAYMENT the parent can
//   report a problem -> DISPUTED -> admin refunds 0-100% -> COMPLETED/CANCELLED.
//   REQUESTED -> DECLINED / EXPIRED (hold released).
//   REQUESTED / ACCEPTED -> CANCELLED (free, or 50% late fee < 24 h before start).
//
// Money only moves on admin approval, dispute resolution or a late fee.
// ---------------------------------------------------------------------------

export type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const fail = (error: string): Result<never> => ({ ok: false, error });

const ACTIVE_STATUSES = ["REQUESTED", "ACCEPTED"] as const;

function bookingCode() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[randomInt(alphabet.length)];
  return `MK-${s}`;
}

const when = (b: Pick<Booking, "startsAt">) => `${formatDate(b.startsAt)} at ${formatTime(b.startsAt)}`;

// --- creating ---------------------------------------------------------------

export type NewBooking = {
  sitterId: string;
  startsAt: Date;
  endsAt: Date;
  childrenCount: number;
  address: string;
  notes: string;
  paymentMethodId: string;
  childIds?: string[]; // children from the family profile; sets childrenCount
};

// When a parent hires a sitter from a job post, the sitter has already said
// yes to that time, so the booking starts out ACCEPTED.
export type HireFromJob = { jobId: string; applicationId: string };

export async function checkSlot(
  sitterId: string,
  startsAt: Date,
  endsAt: Date,
  opts: { skipAvailability?: boolean } = {},
): Promise<Result> {
  const minutes = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  if (minutes < config.minBookingHours * 60) return fail(`Bookings are at least ${config.minBookingHours} hour.`);
  if (minutes > config.maxBookingHours * 60) return fail(`Bookings can be at most ${config.maxBookingHours} hours.`);
  if (startsAt.getTime() < Date.now() + config.minLeadTimeHours * HOUR)
    return fail(`Bookings must start at least ${config.minLeadTimeHours} hours from now.`);
  if (startsAt.getTime() > Date.now() + config.maxDaysAhead * 24 * HOUR)
    return fail(`You can book up to ${config.maxDaysAhead} days ahead.`);

  // Must fit inside one of the sitter's availability windows for that weekday.
  if (!opts.skipAvailability) {
    const day = zonedParts(startsAt).weekday;
    const startMin = minuteOfDay(startsAt);
    const endMin = startMin + minutes;
    const windows = await db.availability.findMany({ where: { sitterId, weekday: day } });
    if (!windows.some((w) => w.startMinute <= startMin && w.endMinute >= endMin)) {
      return fail("That time is outside this sitter's availability.");
    }
  }

  const clash = await db.booking.findFirst({
    where: {
      sitterId,
      status: { in: [...ACTIVE_STATUSES] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true },
  });
  if (clash) return fail("The sitter already has a booking at that time.");
  return { ok: true };
}

export async function createBooking(
  parent: CurrentUser,
  input: NewBooking,
  hire?: HireFromJob,
): Promise<Result<{ id: string }>> {
  const sitter = await db.user.findFirst({
    where: { id: input.sitterId, role: "SITTER", status: "ACTIVE" },
    include: { sitterProfile: true },
  });
  const profile = sitter?.sitterProfile;
  if (!sitter || !profile || !profile.verifiedAt) return fail("This sitter can't be booked right now.");
  if (!profile.acceptingBookings && !hire) return fail("This sitter isn't taking new bookings at the moment.");

  let childIds: string[] = [];
  if (input.childIds?.length) {
    const kids = await db.child.findMany({ where: { id: { in: input.childIds }, parentId: parent.id }, select: { id: true } });
    childIds = kids.map((k) => k.id);
    if (childIds.length !== new Set(input.childIds).size) return fail("Choose children from your family profile.");
    input = { ...input, childrenCount: childIds.length };
  }
  if (input.childrenCount < 1 || input.childrenCount > profile.maxChildren)
    return fail(`This sitter looks after up to ${profile.maxChildren} children.`);

  const slot = await checkSlot(sitter.id, input.startsAt, input.endsAt, { skipAvailability: !!hire });
  if (!slot.ok) return slot;

  const method = await db.paymentMethod.findFirst({
    where: { id: input.paymentMethodId, userId: parent.id, removedAt: null },
  });
  if (!method) return fail("Choose a payment method.");

  const minutes = (input.endsAt.getTime() - input.startsAt.getTime()) / 60_000;
  const q = quote(profile.hourlyRateCents, minutes);

  // Place the hold first. If anything below fails we release it again.
  const auth = await payments.authorize(method.providerRef, q.totalCents);
  if (!auth.ok) return fail(auth.reason);

  try {
    const booking = await db.$transaction(async (tx) => {
      // Lock the sitter row so two parents can't grab the same slot at once.
      await tx.$queryRaw`SELECT "userId" FROM "SitterProfile" WHERE "userId" = ${sitter.id} FOR UPDATE`;
      const clash = await tx.booking.findFirst({
        where: {
          sitterId: sitter.id,
          status: { in: [...ACTIVE_STATUSES] },
          startsAt: { lt: input.endsAt },
          endsAt: { gt: input.startsAt },
        },
      });
      if (clash) throw new SlotTaken();

      if (hire) {
        // Close the job exactly once, even if the parent double-clicks.
        const closed = await tx.job.updateMany({
          where: { id: hire.jobId, parentId: parent.id, status: "OPEN" },
          data: { status: "FILLED" },
        });
        if (closed.count !== 1) throw new JobTaken();
      }

      const respondBy = new Date(
        Math.min(Date.now() + config.sitterResponseHours * HOUR, input.startsAt.getTime()),
      );
      const b = await tx.booking.create({
        data: {
          code: bookingCode(),
          parentId: parent.id,
          sitterId: sitter.id,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          childrenCount: input.childrenCount,
          address: input.address,
          notes: input.notes,
          hourlyRateCents: q.hourlyRateCents,
          hours: q.hours,
          subtotalCents: q.subtotalCents,
          serviceFeeCents: q.serviceFeeCents,
          totalCents: q.totalCents,
          respondBy,
          ...(hire ? { status: "ACCEPTED" as const, respondedAt: new Date() } : {}),
          children: childIds.length ? { create: childIds.map((childId) => ({ childId })) } : undefined,
          payment: {
            create: {
              paymentMethodId: method.id,
              providerRef: auth.ref,
              amountCents: q.totalCents,
              status: "AUTHORIZED",
            },
          },
        },
      });
      if (hire) {
        await tx.job.update({ where: { id: hire.jobId }, data: { hiredBookingId: b.id } });
        await tx.jobApplication.update({ where: { id: hire.applicationId }, data: { status: "HIRED" } });
        const others = await tx.jobApplication.findMany({
          where: { jobId: hire.jobId, status: "APPLIED", id: { not: hire.applicationId } },
          select: { sitterId: true },
        });
        await tx.jobApplication.updateMany({
          where: { jobId: hire.jobId, status: "APPLIED", id: { not: hire.applicationId } },
          data: { status: "DECLINED" },
        });
        for (const o of others) {
          await notify(o.sitterId, "Job filled", `The family picked another sitter for ${when(b)}. Thanks for applying!`, "/sitter/jobs?tab=applications", tx);
        }
        await notify(sitter.id, "You're hired!", `${parent.firstName} hired you for ${when(b)}.`, `/bookings/${b.id}`, tx);
        await audit(parent.id, "job.hired", "Booking", b.id, `hold ${formatMoney(q.totalCents)}`, tx);
      } else {
        await notify(
          sitter.id,
          "New booking request",
          `${parent.firstName} ${parent.lastName} wants to book you on ${when(b)}.`,
          `/bookings/${b.id}`,
          tx,
        );
        await audit(parent.id, "booking.requested", "Booking", b.id, `hold ${formatMoney(q.totalCents)}`, tx);
      }
      return b;
    });
    return { ok: true, data: { id: booking.id } };
  } catch (e) {
    await payments.void(auth.ref);
    if (e instanceof SlotTaken) return fail("Someone just booked that time. Please pick another.");
    if (e instanceof JobTaken) return fail("This job has already been filled or closed.");
    throw e;
  }
}

class SlotTaken extends Error {}
class JobTaken extends Error {}

// --- helpers for transitions -----------------------------------------------

type BookingWithPayment = Booking & { payment: Payment | null };

async function load(id: string) {
  return db.booking.findUnique({ where: { id }, include: { payment: true } });
}

// Moves the booking only if it is still in the expected status, so a double
// click or two tabs can't run the same transition twice.
async function transition(
  tx: Prisma.TransactionClient,
  id: string,
  from: Booking["status"][],
  data: Prisma.BookingUpdateManyMutationInput,
) {
  const res = await tx.booking.updateMany({ where: { id, status: { in: from } }, data });
  if (res.count !== 1) throw new StaleState();
}

class StaleState extends Error {}

async function guarded(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof StaleState) return fail("This booking was updated in the meantime. Refresh and try again.");
    throw e;
  }
}

async function releaseHold(tx: Prisma.TransactionClient, payment: Payment | null) {
  if (!payment || payment.status !== "AUTHORIZED") return;
  await payments.void(payment.providerRef);
  await tx.payment.update({ where: { id: payment.id }, data: { status: "VOIDED", voidedAt: new Date() } });
}

// Charge `amountCents` of the hold and queue `payoutCents` for the sitter.
async function charge(
  tx: Prisma.TransactionClient,
  b: BookingWithPayment,
  amountCents: number,
  payoutCents: number,
) {
  const p = b.payment;
  if (!p || p.status !== "AUTHORIZED") return;
  const amount = Math.min(amountCents, p.amountCents);
  if (amount <= 0) return releaseHold(tx, p);
  const res = await payments.capture(p.providerRef, amount);
  if (!res.ok) {
    await tx.payment.update({ where: { id: p.id }, data: { status: "FAILED", failureReason: "Capture failed" } });
    await notify(b.parentId, "Payment failed", `We couldn't charge your card for booking ${b.code}.`, `/bookings/${b.id}`, tx);
    return;
  }
  await tx.payment.update({
    where: { id: p.id },
    data: { status: "CAPTURED", capturedCents: amount, capturedAt: new Date() },
  });
  if (payoutCents > 0) {
    await tx.payout.create({ data: { sitterId: b.sitterId, bookingId: b.id, amountCents: payoutCents } });
  }
  await audit(null, "payment.captured", "Booking", b.id, formatMoney(amount), tx);
}

// --- sitter actions ---------------------------------------------------------

export async function acceptBooking(sitter: CurrentUser, id: string): Promise<Result> {
  return guarded(async () => {
    const b = await load(id);
    if (!b || b.sitterId !== sitter.id) return fail("Booking not found.");
    if (b.status !== "REQUESTED") return fail("This request is no longer open.");
    if (b.respondBy < new Date()) return fail("This request has expired.");
    const clash = await db.booking.findFirst({
      where: {
        sitterId: sitter.id, status: "ACCEPTED", id: { not: b.id },
        startsAt: { lt: b.endsAt }, endsAt: { gt: b.startsAt },
      },
    });
    if (clash) return fail("You already have an accepted booking at this time.");
    await db.$transaction(async (tx) => {
      await transition(tx, id, ["REQUESTED"], { status: "ACCEPTED", respondedAt: new Date() });
      await notify(b.parentId, "Booking confirmed", `${sitter.firstName} accepted your booking on ${when(b)}.`, `/bookings/${id}`, tx);
      await audit(sitter.id, "booking.accepted", "Booking", id, "", tx);
    });
    return { ok: true };
  });
}

export async function declineBooking(sitter: CurrentUser, id: string, reason: string): Promise<Result> {
  return guarded(async () => {
    const b = await load(id);
    if (!b || b.sitterId !== sitter.id) return fail("Booking not found.");
    if (b.status !== "REQUESTED") return fail("This request is no longer open.");
    await db.$transaction(async (tx) => {
      await transition(tx, id, ["REQUESTED"], {
        status: "DECLINED", respondedAt: new Date(), cancelReason: reason.slice(0, 300),
      });
      await releaseHold(tx, b.payment);
      await notify(
        b.parentId, "Booking declined",
        `${sitter.firstName} can't make ${when(b)}. The hold on your card has been released.`,
        `/bookings/${id}`, tx,
      );
      await audit(sitter.id, "booking.declined", "Booking", id, "hold released", tx);
    });
    return { ok: true };
  });
}

// --- cancelling (either side) ------------------------------------------------

export function cancellationTerms(b: Pick<Booking, "status" | "startsAt" | "subtotalCents">, now = new Date()) {
  const hoursLeft = (b.startsAt.getTime() - now.getTime()) / HOUR;
  const late = b.status === "ACCEPTED" && hoursLeft < config.freeCancelHours;
  return { late, feeCents: late ? lateCancelChargeCents(b.subtotalCents) : 0 };
}

export async function cancelBooking(user: CurrentUser, id: string, reason: string): Promise<Result> {
  return guarded(async () => {
    const b = await load(id);
    const isParent = b?.parentId === user.id;
    const isSitter = b?.sitterId === user.id;
    if (!b || (!isParent && !isSitter)) return fail("Booking not found.");
    if (b.status !== "REQUESTED" && b.status !== "ACCEPTED") return fail("This booking can't be cancelled.");
    if (b.startsAt <= new Date()) return fail("This booking has already started. Contact support instead.");

    const terms = cancellationTerms(b);
    await db.$transaction(async (tx) => {
      await transition(tx, id, ["REQUESTED", "ACCEPTED"], {
        status: "CANCELLED", cancelledAt: new Date(), cancelledById: user.id, cancelReason: reason.slice(0, 300),
      });
      if (isParent && terms.late) {
        await charge(tx, b, terms.feeCents, terms.feeCents);
      } else {
        await releaseHold(tx, b.payment);
      }
      const other = isParent ? b.sitterId : b.parentId;
      const body = isParent && terms.late
        ? `${user.firstName} cancelled ${when(b)}. A late-cancellation fee of ${formatMoney(terms.feeCents)} is paid to you.`
        : `${user.firstName} cancelled the booking on ${when(b)}.`;
      await notify(other, "Booking cancelled", body, `/bookings/${id}`, tx);
      await audit(user.id, "booking.cancelled", "Booking", id, terms.late ? `late fee ${terms.feeCents}` : "free", tx);
    });
    return { ok: true };
  });
}

// --- after the job ------------------------------------------------------------

async function notifyAdmins(tx: Prisma.TransactionClient, title: string, body: string, href: string) {
  const admins = await tx.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  for (const a of admins) await notify(a.id, title, body, href, tx);
}

export function canMarkDone(b: Pick<Booking, "status" | "startsAt">, now = new Date()) {
  return b.status === "ACCEPTED" && (config.allowEarlyCompletion || b.startsAt <= now);
}

// Step 3: the sitter says the job is done.
export async function markJobDone(sitter: CurrentUser, id: string): Promise<Result> {
  return guarded(async () => {
    const b = await load(id);
    if (!b || b.sitterId !== sitter.id) return fail("Booking not found.");
    if (b.status !== "ACCEPTED") return fail("This booking can't be marked as completed.");
    if (!canMarkDone(b)) return fail("You can mark the job completed once it has started.");
    await db.$transaction(async (tx) => {
      await transition(tx, id, ["ACCEPTED"], { status: "AWAITING_CONFIRMATION", sitterDoneAt: new Date() });
      await notify(
        b.parentId, "Please confirm the job",
        `${sitter.firstName} marked ${b.code} as completed. Confirm it went well, or report a problem.`,
        `/bookings/${id}`, tx,
      );
      await audit(sitter.id, "booking.sitter_done", "Booking", id, "", tx);
    });
    return { ok: true };
  });
}

// Step 4: the parent confirms. Allowed after the sitter marked it done, or
// once the booking has ended if the sitter forgot.
export async function confirmCompletion(parent: CurrentUser, id: string): Promise<Result> {
  return guarded(async () => {
    const b = await load(id);
    if (!b || b.parentId !== parent.id) return fail("Booking not found.");
    const ended = b.endsAt <= new Date();
    if (!(b.status === "AWAITING_CONFIRMATION" || (b.status === "ACCEPTED" && ended))) {
      return fail(b.status === "ACCEPTED" ? "You can confirm once your sitter marks the job completed." : "This booking can't be confirmed.");
    }
    await db.$transaction(async (tx) => {
      await transition(tx, id, ["AWAITING_CONFIRMATION", "ACCEPTED"], { status: "AWAITING_PAYMENT", confirmedAt: new Date() });
      await notify(b.sitterId, "Job confirmed by the family", `${parent.firstName} confirmed ${b.code}. Meraki will approve your payment shortly.`, `/bookings/${id}`, tx);
      await notifyAdmins(tx, "Payment to approve", `${b.code}: the family confirmed the job (${formatMoney(b.totalCents)}).`, "/admin/payments");
      await audit(parent.id, "booking.parent_confirmed", "Booking", id, "", tx);
    });
    return { ok: true };
  });
}

const DISPUTABLE = ["ACCEPTED", "AWAITING_CONFIRMATION", "AWAITING_PAYMENT"] as const;

export function canReportProblem(b: Pick<Booking, "status" | "startsAt">, now = new Date()) {
  if (b.status === "AWAITING_CONFIRMATION" || b.status === "AWAITING_PAYMENT") return true;
  return b.status === "ACCEPTED" && (config.allowEarlyCompletion || b.startsAt <= now);
}

export async function reportProblem(parent: CurrentUser, id: string, reason: string): Promise<Result> {
  return guarded(async () => {
    const b = await load(id);
    if (!b || b.parentId !== parent.id) return fail("Booking not found.");
    if (!canReportProblem(b)) return fail("You can report a problem once the booking has started.");
    if (reason.trim().length < 10) return fail("Please describe what happened (at least 10 characters).");
    await db.$transaction(async (tx) => {
      await transition(tx, id, [...DISPUTABLE], { status: "DISPUTED", disputeReason: reason.slice(0, 2000) });
      await notify(b.sitterId, "A problem was reported", `${parent.firstName} reported an issue with ${b.code}. Our team will be in touch.`, `/bookings/${id}`, tx);
      await notifyAdmins(tx, "New dispute", `Booking ${b.code} needs a decision.`, "/admin/disputes");
      await audit(parent.id, "booking.disputed", "Booking", id, reason, tx);
    });
    return { ok: true };
  });
}

// Step 5 (and dispute release): charge the card in full and queue the payout.
async function complete(tx: Prisma.TransactionClient, b: BookingWithPayment, admin: CurrentUser) {
  await transition(tx, b.id, ["AWAITING_PAYMENT", "DISPUTED"], {
    status: "COMPLETED", paymentApprovedAt: new Date(), paymentApprovedById: admin.id,
  });
  await charge(tx, b, b.totalCents, b.subtotalCents);
  await tx.sitterProfile.update({ where: { userId: b.sitterId }, data: { completedJobs: { increment: 1 } } });
  await notify(
    b.sitterId, "Payment approved",
    `Booking ${b.code} is complete. ${formatMoney(b.subtotalCents)} is in your next payout.`,
    `/sitter/earnings`, tx,
  );
  await notify(b.parentId, "Receipt ready", `You were charged ${formatMoney(b.totalCents)} for ${b.code}.`, `/bookings/${b.id}/receipt`, tx);
  await audit(admin.id, "payment.approved", "Booking", b.id, formatMoney(b.totalCents), tx);
}

// --- admin -------------------------------------------------------------------

export async function approvePayment(admin: CurrentUser, id: string): Promise<Result> {
  return guarded(async () => {
    const b = await load(id);
    if (!b) return fail("Booking not found.");
    if (b.status !== "AWAITING_PAYMENT") return fail("This payment isn't waiting for approval.");
    if (b.payment?.status !== "AUTHORIZED") return fail("There's no card hold to charge for this booking.");
    await db.$transaction((tx) => complete(tx, b, admin));
    return { ok: true };
  });
}

// refundCents = how much of the total the parent gets back (0 = release in full).
export async function resolveDispute(admin: CurrentUser, id: string, refundCents: number, note: string): Promise<Result> {
  return guarded(async () => {
    const b = await load(id);
    if (!b || b.status !== "DISPUTED") return fail("This dispute is already resolved.");
    const refund = Math.max(0, Math.min(Math.round(refundCents), b.totalCents));
    await db.$transaction(async (tx) => {
      if (refund >= b.totalCents) {
        await transition(tx, id, ["DISPUTED"], { status: "CANCELLED", cancelledAt: new Date(), cancelledById: admin.id, cancelReason: note || "Refunded after dispute" });
        await releaseHold(tx, b.payment);
      } else if (refund === 0) {
        await complete(tx, b, admin);
      } else {
        const chargeCents = b.totalCents - refund;
        const payout = Math.round((b.subtotalCents * chargeCents) / b.totalCents);
        await transition(tx, id, ["DISPUTED"], { status: "COMPLETED", paymentApprovedAt: new Date(), paymentApprovedById: admin.id });
        await charge(tx, b, chargeCents, payout);
      }
      const msg = refund === 0
        ? "The booking was confirmed and paid in full."
        : `${formatMoney(refund)} was refunded to the parent.`;
      await notify(b.parentId, "Dispute resolved", msg, `/bookings/${id}`, tx);
      await notify(b.sitterId, "Dispute resolved", msg, `/bookings/${id}`, tx);
      await audit(admin.id, "dispute.resolved", "Booking", id, `refund ${refund}; ${note}`, tx);
    });
    return { ok: true };
  });
}

// Refund (part of) a payment that was already captured.
export async function refundPayment(admin: CurrentUser, bookingId: string, cents: number): Promise<Result> {
  const p = await db.payment.findUnique({ where: { bookingId } });
  if (!p || !["CAPTURED", "PARTIALLY_REFUNDED"].includes(p.status)) return fail("Nothing to refund.");
  const amount = Math.min(Math.round(cents), p.capturedCents - p.refundedCents);
  if (amount <= 0) return fail("Enter an amount up to what was charged.");
  await payments.refund(p.providerRef, amount);
  const refunded = p.refundedCents + amount;
  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: p.id },
      data: {
        refundedCents: refunded,
        refundedAt: new Date(),
        status: refunded >= p.capturedCents ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    });
    const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    await notify(b.parentId, "Refund issued", `${formatMoney(amount)} was refunded for ${b.code}.`, `/bookings/${bookingId}/receipt`, tx);
    await audit(admin.id, "payment.refunded", "Booking", bookingId, formatMoney(amount), tx);
  });
  return { ok: true };
}

// --- time-based transitions ----------------------------------------------------

// Expires unanswered requests and confirms jobs the parent didn't answer
// about (they then wait for admin approval; nothing is charged here). Runs on page
// loads (cheap: it only touches rows that are due). In production, also call
// it from a cron hitting /api/cron.
let lastSweep = 0;
export async function sweep(force = false) {
  if (!force && Date.now() - lastSweep < 30_000) return;
  lastSweep = Date.now();
  const now = new Date();

  // Job posts whose start time has passed can't be filled any more.
  await db.job.updateMany({ where: { status: "OPEN", startsAt: { lt: now } }, data: { status: "CLOSED" } });

  const stale = await db.booking.findMany({
    where: { status: "REQUESTED", OR: [{ respondBy: { lt: now } }, { startsAt: { lt: now } }] },
    include: { payment: true },
    take: 100,
  });
  for (const b of stale) {
    await db.$transaction(async (tx) => {
      await transition(tx, b.id, ["REQUESTED"], { status: "EXPIRED" });
      await releaseHold(tx, b.payment);
      await notify(b.parentId, "Request expired", `The sitter didn't respond in time for ${b.code}. Your card hold was released.`, `/bookings/${b.id}`, tx);
    }).catch(ignoreStale);
  }

  const due = await db.booking.findMany({
    where: { status: "AWAITING_CONFIRMATION", sitterDoneAt: { lt: new Date(now.getTime() - config.autoConfirmHours * HOUR) } },
    take: 100,
  });
  for (const b of due) {
    await db.$transaction(async (tx) => {
      await transition(tx, b.id, ["AWAITING_CONFIRMATION"], { status: "AWAITING_PAYMENT", confirmedAt: new Date() });
      await notify(b.parentId, "Job confirmed automatically", `We didn't hear back about ${b.code}, so it was confirmed. Meraki will now approve the payment.`, `/bookings/${b.id}`, tx);
      await notifyAdmins(tx, "Payment to approve", `${b.code} was confirmed automatically after ${config.autoConfirmHours} hours.`, "/admin/payments");
      await audit(null, "booking.auto_confirmed", "Booking", b.id, "", tx);
    }).catch(ignoreStale);
  }
}

function ignoreStale(e: unknown) {
  if (!(e instanceof StaleState)) throw e;
}

// --- messages & reviews ---------------------------------------------------------

export async function sendMessage(user: CurrentUser, bookingId: string, body: string): Promise<Result> {
  const text = body.trim();
  if (!text) return fail("Write a message first.");
  if (text.length > 2000) return fail("Messages can be up to 2000 characters.");
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (!b || (b.parentId !== user.id && b.sitterId !== user.id)) return fail("Booking not found.");
  await db.message.create({ data: { bookingId, senderId: user.id, body: text } });
  const other = b.parentId === user.id ? b.sitterId : b.parentId;
  await notify(other, `Message from ${user.firstName}`, text.slice(0, 120), `/bookings/${bookingId}#messages`);
  return { ok: true };
}

export async function submitReview(user: CurrentUser, bookingId: string, rating: number, comment: string): Promise<Result> {
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (!b || (b.parentId !== user.id && b.sitterId !== user.id)) return fail("Booking not found.");
  if (b.status !== "COMPLETED") return fail("You can leave a review once the booking is complete.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail("Choose a rating from 1 to 5.");
  const asParent = b.parentId === user.id;
  const direction = asParent ? "PARENT_TO_SITTER" : "SITTER_TO_PARENT";
  const subjectId = asParent ? b.sitterId : b.parentId;
  const existing = await db.review.findUnique({ where: { bookingId_direction: { bookingId, direction } } });
  if (existing) return fail("You already reviewed this booking.");

  await db.$transaction(async (tx) => {
    await tx.review.create({
      data: { bookingId, authorId: user.id, subjectId, direction, rating, comment: comment.trim().slice(0, 2000) },
    });
    const agg = await tx.review.aggregate({
      where: { subjectId, direction },
      _avg: { rating: true },
      _count: true,
    });
    const data = { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count };
    if (asParent) await tx.sitterProfile.update({ where: { userId: subjectId }, data });
    else await tx.parentProfile.upsert({ where: { userId: subjectId }, update: data, create: { userId: subjectId, ...data } });
    await notify(subjectId, "New review", `${user.firstName} left you a ${rating}-star review.`, asParent ? `/sitter` : `/parent`, tx);
  });
  return { ok: true };
}
