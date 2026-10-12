// Job board (post -> apply -> hire) and security helpers, against the real database.

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { applyToJob, closeJob, createJob, hireApplicant, jobsNear, withdrawApplication } from "@/lib/jobs";
import { rateLimit, sha256 } from "@/lib/security";
import { payments } from "@/lib/payments/provider";
import { passwordRule } from "@/lib/validation";
import type { CurrentUser } from "@/lib/auth";

const HOUR = 3_600_000;
const tag = `j${Date.now()}`;
const PARK_SLOPE = { lat: 40.671, lng: -73.9814 };
const users: Record<string, CurrentUser> = {};
let cardId = "";

const as = (u: { id: string; role: CurrentUser["role"]; firstName: string; lastName: string; email: string }): CurrentUser => ({
  ...u, status: "ACTIVE", avatarUrl: null,
});

function when(daysAhead: number, hours = 3) {
  const startsAt = new Date(Date.now() + daysAhead * 24 * HOUR);
  startsAt.setUTCHours(17, 0, 0, 0);
  return { startsAt, endsAt: new Date(startsAt.getTime() + hours * HOUR) };
}

before(async () => {
  const mk = async (key: string, role: "PARENT" | "SITTER", lat: number, lng: number, rate = 2000) => {
    const u = await db.user.create({
      data: {
        email: `${key}.${tag}@test.local`, passwordHash: "x", role, status: "ACTIVE", firstName: key, lastName: "Test",
        area: "Park Slope", latitude: lat, longitude: lng,
        ...(role === "SITTER"
          ? { sitterProfile: { create: { hourlyRateCents: rate, verifiedAt: new Date(), serviceRadiusKm: 10 } } }
          : { parentProfile: { create: {} } }),
      },
    });
    users[key] = as(u);
  };
  await mk("parent", "PARENT", PARK_SLOPE.lat, PARK_SLOPE.lng);
  await mk("near", "SITTER", PARK_SLOPE.lat + 0.01, PARK_SLOPE.lng);
  await mk("near2", "SITTER", PARK_SLOPE.lat - 0.01, PARK_SLOPE.lng, 2400);
  await mk("far", "SITTER", 40.8116, -73.9465); // Harlem, ~16 km away
  const t = await payments.tokenizeCard({ number: "4242424242424242", expMonth: 12, expYear: 2035, cvc: "123", holderName: "P" });
  assert.ok(t.ok);
  cardId = (await db.paymentMethod.create({
    data: { userId: users.parent.id, providerRef: t.token, brand: t.brand, last4: t.last4, expMonth: 12, expYear: 2035, holderName: "P", isDefault: true },
  })).id;
});

after(async () => {
  const ids = Object.values(users).map((u) => u.id);
  const bookings = await db.booking.findMany({ where: { parentId: { in: ids } }, select: { id: true } });
  const bIds = bookings.map((b) => b.id);
  await db.job.updateMany({ where: { parentId: { in: ids } }, data: { hiredBookingId: null } });
  await db.payment.deleteMany({ where: { bookingId: { in: bIds } } });
  await db.booking.deleteMany({ where: { id: { in: bIds } } });
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { targetId: { in: bIds } }] } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.rateLimit.deleteMany({ where: { key: { startsWith: `test:${tag}` } } });
  await db.$disconnect();
});

describe("job board", () => {
  let jobId = "";

  test("posting validates the time and budget", async () => {
    const bad = await createJob(users.parent, { title: "Too soon", description: "", ...when(0, 3), childrenCount: 1, maxRateCents: 2500, startsAt: new Date(Date.now() + HOUR), endsAt: new Date(Date.now() + 3 * HOUR) });
    assert.equal(bad.ok, false);
    const r = await createJob(users.parent, { title: "Date night", description: "Two kids", ...when(5), childrenCount: 2, maxRateCents: 2500 });
    assert.ok(r.ok);
    jobId = r.data!.id;
  });

  test("nearby sitters see it and are notified; far sitters don't", async () => {
    assert.ok((await jobsNear(users.near.id)).some((j) => j.id === jobId));
    assert.ok(!(await jobsNear(users.far.id)).some((j) => j.id === jobId));
    assert.ok(await db.notification.findFirst({ where: { userId: users.near.id, href: `/sitter/jobs/${jobId}` } }));
    assert.equal(await db.notification.count({ where: { userId: users.far.id } }), 0);
  });

  test("sitters apply once; withdraw and re-apply works", async () => {
    assert.ok((await applyToJob(users.near, jobId, "Hi!")).ok);
    assert.equal((await applyToJob(users.near, jobId, "Again")).ok, false);
    assert.ok((await applyToJob(users.near2, jobId, "Hello")).ok);
    assert.ok((await withdrawApplication(users.near2, jobId)).ok);
    assert.ok((await applyToJob(users.near2, jobId, "Back again")).ok);
  });

  test("hiring creates a confirmed booking with a hold, fills the job, declines the others", async () => {
    const app = await db.jobApplication.findUniqueOrThrow({ where: { jobId_sitterId: { jobId, sitterId: users.near.id } } });
    const r = await hireApplicant(users.parent, app.id, cardId, "1 Test Street");
    assert.ok(r.ok, !r.ok ? r.error : "");
    const b = await db.booking.findUniqueOrThrow({ where: { id: r.data!.id }, include: { payment: true } });
    assert.equal(b.status, "ACCEPTED");
    assert.equal(b.payment?.status, "AUTHORIZED");
    assert.equal(b.subtotalCents, 6000);
    const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
    assert.equal(job.status, "FILLED");
    assert.equal(job.hiredBookingId, b.id);
    const other = await db.jobApplication.findUniqueOrThrow({ where: { jobId_sitterId: { jobId, sitterId: users.near2.id } } });
    assert.equal(other.status, "DECLINED");
    // a second hire on the same job is refused and places no new hold
    const again = await hireApplicant(users.parent, other.id, cardId, "1 Test Street");
    assert.equal(again.ok, false);
    assert.equal(await db.booking.count({ where: { parentId: users.parent.id } }), 1);
  });

  test("another parent can't hire from someone else's job", async () => {
    const r = await createJob(users.parent, { title: "Second job", description: "", ...when(9), childrenCount: 1, maxRateCents: 2500 });
    assert.ok(r.ok);
    assert.ok((await applyToJob(users.near2, r.data!.id, "")).ok);
    const app = await db.jobApplication.findFirstOrThrow({ where: { jobId: r.data!.id } });
    const stranger = { ...users.near, role: "PARENT" as const };
    assert.equal((await hireApplicant(stranger, app.id, cardId, "x street")).ok, false);
    assert.ok((await closeJob(users.parent, r.data!.id)).ok);
    assert.equal((await db.jobApplication.findUniqueOrThrow({ where: { id: app.id } })).status, "DECLINED");
  });
});

describe("security helpers", () => {
  test("rate limiter allows up to the limit, then blocks", async () => {
    const key = `test:${tag}:login`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(key, 3, 60_000));
    assert.deepEqual(results, [true, true, true, false]);
  });

  test("password policy rejects weak passwords", () => {
    assert.equal(passwordRule.safeParse("short1").success, false);
    assert.equal(passwordRule.safeParse("onlyletters").success, false);
    assert.equal(passwordRule.safeParse("password123").success, false);
    assert.equal(passwordRule.safeParse("Sunny-garden-42").success, true);
  });

  test("tokens are stored as SHA-256 hashes", () => {
    const h = sha256("abc");
    assert.equal(h.length, 64);
    assert.notEqual(h, "abc");
  });
});
