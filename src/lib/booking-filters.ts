import type { Prisma } from "@prisma/client";

// Which bookings are waiting for someone. Shared by the menu badges, the
// "Needs action" tab and the dashboards so they always agree.

// Parent: confirm a job the sitter marked done (or that ended without it).
export const parentNeedsAction = (parentId: string, now = new Date()): Prisma.BookingWhereInput => ({
  parentId,
  OR: [{ status: "AWAITING_CONFIRMATION" }, { status: "ACCEPTED", endsAt: { lte: now } }],
});

// Sitter: answer a request, or mark a started job completed.
export const sitterNeedsAction = (sitterId: string, now = new Date()): Prisma.BookingWhereInput => ({
  sitterId,
  OR: [{ status: "REQUESTED" }, { status: "ACCEPTED", startsAt: { lte: now } }],
});

// Admin: payments both sides have confirmed.
export const adminPaymentsToApprove: Prisma.BookingWhereInput = { status: "AWAITING_PAYMENT" };

export const UPCOMING: Prisma.BookingWhereInput["status"] = { in: ["REQUESTED", "ACCEPTED"] };
export const IN_PROGRESS_AFTER_JOB = ["AWAITING_CONFIRMATION", "AWAITING_PAYMENT"] as const;
export const FINISHED = ["COMPLETED", "CANCELLED", "DECLINED", "EXPIRED", "DISPUTED"] as const;
