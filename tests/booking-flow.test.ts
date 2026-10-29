// End-to-end tests for the booking + payment state machine against the real
// database. Run with `npm test`. Creates its own users and removes them after.

import { assertLocalDatabase } from "../prisma/local-only";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import {
  acceptBooking, approvePayment, cancelBooking, confirmCompletion, createBooking, declineBooking, markJobDone,
  reportProblem, resolveDispute, sweep, type NewBooking,
} from "@/lib/bookings";
import { payments } from "@/lib/payments/provider";
import { toDateInput, zonedToUtc } from "@/lib/time";
import type { CurrentUser } from "@/lib/auth";


assertLocalDatabase("the tests");
const HOUR = 3_600_000;
const tag = `t${Date.now()}`;
let parent: CurrentUser;
let sitter: CurrentUser;
let admin: CurrentUser;
let cardId = "";
let declineCardId = "";

const asUser = (u: { id: string; role: CurrentUser["role"]; firstName: string; lastName: string; email: string }): CurrentUser => ({
  ...u, status: "ACTIVE", avatarUrl: null,
});

// A slot `daysAhead` days from now at 11:00 in the app's time zone (whatever
// APP_TIMEZONE is), so it never crosses midnight there; `hours` long.
function slot(daysAhead: number, hours = 3) {
  const start = zonedToUtc(toDateInput(new Date(Date.now() + daysAhead * 24 * HOUR)), "11:00")!;
  return { startsAt: start, endsAt: new Date(start.getTime() + hours * HOUR) };
}

function booking(extra: Partial<NewBooking> & { startsAt: Date; endsAt: Date }): NewBooking {
  return {
    sitterId: sitter.id, childrenCount: 1, address: "1 Test Street", notes: "", paymentMethodId: cardId, ...extra,
  };
}

const paymentOf = (bookingId: string) => db.payment.findUniqueOrThrow({ where: { bookingId } });
const bookingOf = (id: string) => db.booking.findUniqueOrThrow({ where: { id } });

before(async () => {
  const mk = (role: "PARENT" | "SITTER" | "ADMIN", name: string) =>
    db.user.create({
      data: { email: `${name}.${tag}@test.local`, passwordHash: "x", role, firstName: name, lastName: "Test", status: "ACTIVE" },
    });
  const p = await mk("PARENT", "parent");
  const s = await mk("SITTER", "sitter");
  const a = await mk("ADMIN", "admin");
  await db.sitterProfile.create({
    data: {
      userId: s.id, hourlyRateCents: 2000, verifiedAt: new Date(), maxChildren: 3,
      // available all day, every day
      availability: { create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 0, endMinute: 1440 })) },
    },
  });
  for (const [number, isDefault] of [["4242424242424242", true], ["4000000000000002", false]] as const) {
    const t = await payments.tokenizeCard({ number, expMonth: 12, expYear: 2035, cvc: "123", holderName: "P Test" });
    assert.ok(t.ok);
    const card = await db.paymentMethod.create({
      data: { userId: p.id, providerRef: t.token, brand: t.brand, last4: t.last4, expMonth: 12, expYear: 2035, holderName: "P Test", isDefault },
    });
    if (isDefault) cardId = card.id;
    else declineCardId = card.id;
  }
  parent = asUser(p);
  sitter = asUser(s);
  admin = asUser(a);
});

after(async () => {
  const ids = [parent?.id, sitter?.id, admin?.id].filter(Boolean);
  const bookings = await db.booking.findMany({ where: { OR: [{ parentId: { in: ids } }, { sitterId: { in: ids } }] }, select: { id: true } });
  const bIds = bookings.map((b) => b.id);
  await db.payout.deleteMany({ where: { bookingId: { in: bIds } } });
  await db.payment.deleteMany({ where: { bookingId: { in: bIds } } });
  await db.booking.deleteMany({ where: { id: { in: bIds } } });
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { targetId: { in: bIds } }] } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

describe("card tokenization", () => {
  test("rejects a bad card number and keeps only the last 4 digits", async () => {
    const bad = await payments.tokenizeCard({ number: "4242424242424241", expMonth: 1, expYear: 2035, cvc: "123", holderName: "x" });
    assert.equal(bad.ok, false);
    const good = await payments.tokenizeCard({ number: "4242 4242 4242 4242", expMonth: 1, expYear: 2035, cvc: "123", holderName: "x" });
    assert.ok(good.ok && good.last4 === "4242" && good.brand === "Visa" && !good.token.includes("4242424242"));
  });
});

describe("booking lifecycle", () => {
  test("request places a hold, accept confirms, nothing charged yet", async () => {
    const r = await createBooking(parent, booking(slot(5)));
    assert.ok(r.ok, !r.ok ? r.error : "");
    const id = r.data!.id;
    const b = await bookingOf(id);
    assert.equal(b.status, "REQUESTED");
    assert.equal(b.subtotalCents, 6000); // 3h x $20
    assert.equal(b.serviceFeeCents, 600);
    assert.equal(b.totalCents, 6600);
    assert.equal((await paymentOf(id)).status, "AUTHORIZED");

    assert.ok((await acceptBooking(sitter, id)).ok);
    assert.equal((await bookingOf(id)).status, "ACCEPTED");
    // accepting twice is refused instead of running twice
    assert.equal((await acceptBooking(sitter, id)).ok, false);
    assert.equal((await paymentOf(id)).capturedCents, 0);
  });

  test("the same slot can't be double-booked", async () => {
    const s = slot(6);
    assert.ok((await createBooking(parent, booking(s))).ok);
    const clash = await createBooking(parent, booking({ ...s, startsAt: new Date(s.startsAt.getTime() + HOUR) }));
    assert.equal(clash.ok, false);
  });

  test("a declined card creates no booking", async () => {
    const before = await db.booking.count({ where: { parentId: parent.id } });
    const r = await createBooking(parent, booking({ ...slot(7), paymentMethodId: declineCardId }));
    assert.equal(r.ok, false);
    assert.equal(await db.booking.count({ where: { parentId: parent.id } }), before);
  });

  test("decline releases the hold", async () => {
    const r = await createBooking(parent, booking(slot(8)));
    assert.ok(r.ok);
    assert.ok((await declineBooking(sitter, r.data!.id, "Busy")).ok);
    assert.equal((await paymentOf(r.data!.id)).status, "VOIDED");
  });

  test("early cancellation is free, late cancellation charges 50% to the sitter", async () => {
    const early = await createBooking(parent, booking(slot(9)));
    assert.ok(early.ok);
    await acceptBooking(sitter, early.data!.id);
    assert.ok((await cancelBooking(parent, early.data!.id, "")).ok);
    assert.equal((await paymentOf(early.data!.id)).status, "VOIDED");

    const late = await createBooking(parent, booking(slot(10)));
    assert.ok(late.ok);
    await acceptBooking(sitter, late.data!.id);
    // move it to start in 5 hours (inside the 24h window)
    const startsAt = new Date(Date.now() + 5 * HOUR);
    await db.booking.update({ where: { id: late.data!.id }, data: { startsAt, endsAt: new Date(startsAt.getTime() + 3 * HOUR) } });
    assert.ok((await cancelBooking(parent, late.data!.id, "")).ok);
    const p = await paymentOf(late.data!.id);
    assert.equal(p.status, "CAPTURED");
    assert.equal(p.capturedCents, 3000);
    const payout = await db.payout.findUniqueOrThrow({ where: { bookingId: late.data!.id } });
    assert.equal(payout.amountCents, 3000);
  });

  test("full flow: sitter marks done, parent confirms, admin approves, then the card is charged", async () => {
    const r = await createBooking(parent, booking(slot(11)));
    assert.ok(r.ok);
    const id = r.data!.id;
    await acceptBooking(sitter, id);

    // Before the job starts nobody can complete it.
    assert.equal((await markJobDone(sitter, id)).ok, false);
    assert.equal((await confirmCompletion(parent, id)).ok, false);

    await db.booking.update({ where: { id }, data: slot(-1) });
    // Only the booking's own sitter can mark it done.
    assert.equal((await markJobDone({ ...sitter, id: parent.id }, id)).ok, false);
    assert.ok((await markJobDone(sitter, id)).ok);
    assert.equal((await bookingOf(id)).status, "AWAITING_CONFIRMATION");
    assert.equal((await paymentOf(id)).status, "AUTHORIZED");

    // Admin can't approve before the parent confirms.
    assert.equal((await approvePayment(admin, id)).ok, false);
    assert.equal((await confirmCompletion(sitter, id)).ok, false); // not the parent
    assert.ok((await confirmCompletion(parent, id)).ok);
    const confirmed = await bookingOf(id);
    assert.equal(confirmed.status, "AWAITING_PAYMENT");
    assert.ok(confirmed.sitterDoneAt && confirmed.confirmedAt);
    assert.equal((await paymentOf(id)).status, "AUTHORIZED"); // still not charged

    assert.ok((await approvePayment(admin, id)).ok);
    const done = await bookingOf(id);
    assert.equal(done.status, "COMPLETED");
    assert.equal(done.paymentApprovedById, admin.id);
    const p = await paymentOf(id);
    assert.equal(p.status, "CAPTURED");
    assert.equal(p.capturedCents, 6600);
    assert.equal((await db.payout.findUniqueOrThrow({ where: { bookingId: id } })).amountCents, 6000);
    // Approving twice doesn't charge twice.
    assert.equal((await approvePayment(admin, id)).ok, false);
  });

  test("unanswered requests expire; unconfirmed jobs go to admin approval after 48 h, uncharged", async () => {
    const req = await createBooking(parent, booking(slot(12)));
    const acc = await createBooking(parent, booking(slot(13)));
    assert.ok(req.ok && acc.ok);
    await acceptBooking(sitter, acc.data!.id);
    await db.booking.update({ where: { id: req.data!.id }, data: { respondBy: new Date(Date.now() - 1000) } });
    await db.booking.update({
      where: { id: acc.data!.id },
      data: { ...slot(-4), status: "AWAITING_CONFIRMATION", sitterDoneAt: new Date(Date.now() - 49 * HOUR) },
    });
    await sweep(true);
    assert.equal((await bookingOf(req.data!.id)).status, "EXPIRED");
    assert.equal((await paymentOf(req.data!.id)).status, "VOIDED");
    assert.equal((await bookingOf(acc.data!.id)).status, "AWAITING_PAYMENT");
    assert.equal((await paymentOf(acc.data!.id)).status, "AUTHORIZED");
  });

  test("a problem can be reported after the parent confirmed, until the admin approves", async () => {
    const r = await createBooking(parent, booking(slot(15)));
    assert.ok(r.ok);
    const id = r.data!.id;
    await acceptBooking(sitter, id);
    await db.booking.update({ where: { id }, data: slot(-1) });
    await markJobDone(sitter, id);
    await confirmCompletion(parent, id);
    assert.ok((await reportProblem(parent, id, "The kids said the sitter left early.")).ok);
    assert.equal((await bookingOf(id)).status, "DISPUTED");
    assert.equal((await approvePayment(admin, id)).ok, false); // disputes go through resolveDispute
    assert.ok((await resolveDispute(admin, id, 0, "Checked with both sides, paid in full")).ok);
    assert.equal((await paymentOf(id)).capturedCents, 6600);
    assert.equal((await bookingOf(id)).status, "COMPLETED");
  });

  test("dispute holds the money until an admin decides a partial refund", async () => {
    const r = await createBooking(parent, booking(slot(14)));
    assert.ok(r.ok);
    const id = r.data!.id;
    await acceptBooking(sitter, id);
    await db.booking.update({ where: { id }, data: slot(-1) });
    assert.ok((await reportProblem(parent, id, "Sitter left two hours early.")).ok);
    assert.equal((await paymentOf(id)).status, "AUTHORIZED");
    assert.ok((await resolveDispute(admin, id, 3300, "Half refunded")).ok);
    const p = await paymentOf(id);
    assert.equal(p.capturedCents, 3300);
    assert.equal((await db.payout.findUniqueOrThrow({ where: { bookingId: id } })).amountCents, 3000);
    assert.equal((await bookingOf(id)).status, "COMPLETED");
  });
});
