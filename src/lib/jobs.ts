import "server-only";
import { db } from "./db";
import { config } from "./config";
import { HOUR } from "./time";
import { boundingBox, distanceKm } from "./geo";
import { createBooking, type Result } from "./bookings";
import { notify, audit } from "./notify";
import { formatDate, formatTime } from "./format";
import type { CurrentUser } from "./auth";

// ---------------------------------------------------------------------------
// Job board: a parent posts a time they need help; nearby sitters apply;
// the parent hires one. Hiring creates an ACCEPTED booking with a card hold
// through the normal booking engine, so payments work exactly the same way.
// ---------------------------------------------------------------------------

const fail = (error: string): Result<never> => ({ ok: false, error });

export type NewJob = {
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  childrenCount: number;
  maxRateCents: number;
};

export async function createJob(parent: CurrentUser, input: NewJob): Promise<Result<{ id: string }>> {
  const minutes = (input.endsAt.getTime() - input.startsAt.getTime()) / 60_000;
  if (minutes < config.minBookingHours * 60 || minutes > config.maxBookingHours * 60)
    return fail(`Jobs can be ${config.minBookingHours} to ${config.maxBookingHours} hours long.`);
  if (input.startsAt.getTime() < Date.now() + config.minLeadTimeHours * HOUR)
    return fail(`Pick a start at least ${config.minLeadTimeHours} hours from now.`);
  if (input.startsAt.getTime() > Date.now() + config.jobMaxDaysAhead * 24 * HOUR)
    return fail(`Jobs can be posted up to ${config.jobMaxDaysAhead} days ahead.`);
  if (input.maxRateCents < config.minRateCents || input.maxRateCents > config.maxRateCents)
    return fail("Enter a realistic hourly budget.");

  const open = await db.job.count({ where: { parentId: parent.id, status: "OPEN" } });
  if (open >= 10) return fail("You have 10 open jobs. Close one before posting another.");

  const me = await db.user.findUniqueOrThrow({ where: { id: parent.id }, select: { area: true, latitude: true, longitude: true } });
  if (me.latitude == null || me.longitude == null) return fail("Add your neighborhood in Settings first, so nearby sitters can see the job.");

  const job = await db.job.create({
    data: {
      parentId: parent.id,
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      childrenCount: input.childrenCount,
      maxRateCents: input.maxRateCents,
      area: me.area,
      latitude: me.latitude,
      longitude: me.longitude,
    },
  });

  // Tell nearby active sitters whose rate fits the budget (capped to avoid spam).
  const box = boundingBox({ lat: me.latitude, lng: me.longitude }, config.jobSearchRadiusKm);
  const sitters = await db.user.findMany({
    where: {
      role: "SITTER", status: "ACTIVE",
      latitude: { gte: box.minLat, lte: box.maxLat }, longitude: { gte: box.minLng, lte: box.maxLng },
      sitterProfile: { acceptingBookings: true, verifiedAt: { not: null }, hourlyRateCents: { lte: input.maxRateCents } },
    },
    select: { id: true, latitude: true, longitude: true, sitterProfile: { select: { serviceRadiusKm: true } } },
    take: 200,
  });
  const reached = sitters
    .filter((s) => distanceKm({ lat: me.latitude!, lng: me.longitude! }, { lat: s.latitude!, lng: s.longitude! }) <= (s.sitterProfile?.serviceRadiusKm ?? 8))
    .slice(0, 40);
  for (const s of reached) {
    await notify(s.id, "New job near you", `${input.title}, ${formatDate(input.startsAt)} at ${formatTime(input.startsAt)} in ${me.area}.`, `/sitter/jobs/${job.id}`);
  }
  await audit(parent.id, "job.posted", "Job", job.id, `${reached.length} sitters notified`);
  return { ok: true, data: { id: job.id } };
}

export async function closeJob(parent: CurrentUser, jobId: string): Promise<Result> {
  const res = await db.job.updateMany({ where: { id: jobId, parentId: parent.id, status: "OPEN" }, data: { status: "CLOSED" } });
  if (res.count !== 1) return fail("This job is no longer open.");
  const apps = await db.jobApplication.findMany({ where: { jobId, status: "APPLIED" }, select: { sitterId: true } });
  await db.jobApplication.updateMany({ where: { jobId, status: "APPLIED" }, data: { status: "DECLINED" } });
  for (const a of apps) await notify(a.sitterId, "Job closed", "A family closed a job you applied to.", "/sitter/jobs?tab=applications");
  return { ok: true };
}

// Open jobs a sitter can travel to, nearest first.
export async function jobsNear(sitterId: string, limit = 50) {
  const me = await db.user.findUniqueOrThrow({
    where: { id: sitterId },
    select: { latitude: true, longitude: true, sitterProfile: { select: { serviceRadiusKm: true, hourlyRateCents: true } } },
  });
  if (me.latitude == null || me.longitude == null) return [];
  const centre = { lat: me.latitude, lng: me.longitude };
  const radius = Math.max(me.sitterProfile?.serviceRadiusKm ?? 8, 1);
  const box = boundingBox(centre, radius);
  const rows = await db.job.findMany({
    where: {
      status: "OPEN",
      startsAt: { gt: new Date(Date.now() + config.minLeadTimeHours * HOUR) },
      latitude: { gte: box.minLat, lte: box.maxLat },
      longitude: { gte: box.minLng, lte: box.maxLng },
      parentId: { not: sitterId },
    },
    orderBy: { startsAt: "asc" },
    take: 200,
    include: {
      parent: { select: { firstName: true, lastName: true, avatarUrl: true, parentProfile: { select: { ratingAvg: true, ratingCount: true } } } },
      applications: { where: { sitterId }, select: { id: true, status: true } },
      _count: { select: { applications: { where: { status: "APPLIED" } } } },
    },
  });
  return rows
    .map((j) => ({ ...j, distanceKm: distanceKm(centre, { lat: j.latitude!, lng: j.longitude! }), myApplication: j.applications[0] ?? null }))
    .filter((j) => j.distanceKm <= radius)
    .slice(0, limit);
}

export async function applyToJob(sitter: CurrentUser, jobId: string, message: string): Promise<Result> {
  if (sitter.status !== "ACTIVE") return fail("Your profile needs to be approved before you can apply to jobs.");
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "OPEN" || job.startsAt <= new Date()) return fail("This job is no longer open.");
  const existing = await db.jobApplication.findUnique({ where: { jobId_sitterId: { jobId, sitterId: sitter.id } } });
  if (existing && existing.status !== "WITHDRAWN") return fail("You've already applied to this job.");

  const clash = await db.booking.findFirst({
    where: { sitterId: sitter.id, status: { in: ["REQUESTED", "ACCEPTED"] }, startsAt: { lt: job.endsAt }, endsAt: { gt: job.startsAt } },
  });
  if (clash) return fail("You already have a booking at that time.");

  const text = message.trim().slice(0, 1000);
  if (existing) {
    await db.jobApplication.update({ where: { id: existing.id }, data: { status: "APPLIED", message: text, createdAt: new Date() } });
  } else {
    await db.jobApplication.create({ data: { jobId, sitterId: sitter.id, message: text } });
  }
  await notify(job.parentId, "New applicant", `${sitter.firstName} applied to “${job.title}”.`, `/jobs/${jobId}`);
  return { ok: true };
}

export async function withdrawApplication(sitter: CurrentUser, jobId: string): Promise<Result> {
  const res = await db.jobApplication.updateMany({
    where: { jobId, sitterId: sitter.id, status: "APPLIED" },
    data: { status: "WITHDRAWN" },
  });
  return res.count ? { ok: true } : fail("There's no open application to withdraw.");
}

export async function declineApplicant(parent: CurrentUser, applicationId: string): Promise<Result> {
  const app = await db.jobApplication.findUnique({ where: { id: applicationId }, include: { job: true } });
  if (!app || app.job.parentId !== parent.id) return fail("Application not found.");
  if (app.status !== "APPLIED") return fail("This application is no longer open.");
  await db.jobApplication.update({ where: { id: applicationId }, data: { status: "DECLINED" } });
  await notify(app.sitterId, "Application not selected", `The family went another way for “${app.job.title}”.`, "/sitter/jobs?tab=applications");
  return { ok: true };
}

export async function hireApplicant(
  parent: CurrentUser,
  applicationId: string,
  paymentMethodId: string,
  address: string,
): Promise<Result<{ id: string }>> {
  const app = await db.jobApplication.findUnique({ where: { id: applicationId }, include: { job: true } });
  if (!app || app.job.parentId !== parent.id) return fail("Application not found.");
  if (app.status !== "APPLIED") return fail("This sitter withdrew or was already answered.");
  if (app.job.status !== "OPEN") return fail("This job is already filled or closed.");
  const job = app.job;
  return createBooking(
    parent,
    {
      sitterId: app.sitterId,
      startsAt: job.startsAt,
      endsAt: job.endsAt,
      childrenCount: job.childrenCount,
      address,
      notes: [job.title, job.description].filter(Boolean).join("\n\n"),
      paymentMethodId,
    },
    { jobId: job.id, applicationId: app.id },
  );
}

export const jobWhen = (j: { startsAt: Date; endsAt: Date }) =>
  `${formatDate(j.startsAt)}, ${formatTime(j.startsAt)} to ${formatTime(j.endsAt)}`;
