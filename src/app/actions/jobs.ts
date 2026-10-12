"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { applyToJob, closeJob, createJob, declineApplicant, hireApplicant, withdrawApplication } from "@/lib/jobs";
import { zonedToUtc } from "@/lib/time";
import type { FormState } from "./auth";

const field = (form: FormData, k: string) => String(form.get(k) ?? "");

const jobSchema = z.object({
  title: z.string().trim().min(5, "Give the job a short title, e.g. “Friday date night”.").max(120),
  description: z.string().trim().max(2000).optional().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time."),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Pick an end time."),
  childrenCount: z.coerce.number().int().min(1, "At least one child.").max(8),
  maxRate: z.coerce.number({ error: "Enter your hourly budget." }).min(10).max(100),
});

export async function postJob(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["PARENT"]);
  const values = Object.fromEntries(["title", "description", "date", "start", "end", "childrenCount", "maxRate"].map((k) => [k, field(form, k)]));
  const parsed = jobSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const d = parsed.data;
  const startsAt = zonedToUtc(d.date, d.start);
  let endsAt = zonedToUtc(d.date, d.end);
  if (!startsAt || !endsAt) return { error: "Check the date and times.", values };
  if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 3_600_000);

  const r = await createJob(user, {
    title: d.title, description: d.description, startsAt, endsAt,
    childrenCount: d.childrenCount, maxRateCents: Math.round(d.maxRate * 100),
  });
  if (!r.ok) return { error: r.error, values };
  revalidatePath("/jobs");
  redirect(`/jobs/${r.data!.id}?posted=1`);
}

export async function closeJobAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["PARENT"]);
  const id = field(form, "jobId");
  const r = await closeJob(user, id);
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
  return r.ok ? { ok: true, message: "Job closed." } : { error: r.error };
}

export async function declineApplicantAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["PARENT"]);
  const r = await declineApplicant(user, field(form, "applicationId"));
  revalidatePath(`/jobs/${field(form, "jobId")}`);
  return r.ok ? { ok: true } : { error: r.error };
}

export async function hireAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["PARENT"]);
  const address = field(form, "address").trim();
  if (address.length < 5) return { error: "Enter the address where the sitter should come." };
  const r = await hireApplicant(user, field(form, "applicationId"), field(form, "paymentMethodId"), address.slice(0, 200));
  if (!r.ok) return { error: r.error };
  revalidatePath("/jobs");
  redirect(`/bookings/${r.data!.id}?hired=1`);
}

export async function applyAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["SITTER"]);
  const id = field(form, "jobId");
  const r = await applyToJob(user, id, field(form, "message"));
  revalidatePath(`/sitter/jobs/${id}`);
  revalidatePath("/sitter/jobs");
  revalidatePath("/sitter");
  return r.ok ? { ok: true, message: "Application sent. The family will be notified." } : { error: r.error };
}

export async function withdrawAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["SITTER"]);
  const id = field(form, "jobId");
  const r = await withdrawApplication(user, id);
  revalidatePath(`/sitter/jobs/${id}`);
  revalidatePath("/sitter/jobs");
  return r.ok ? { ok: true, message: "Application withdrawn." } : { error: r.error };
}

// --- family profile ----------------------------------------------------------------

const childSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name.").max(60),
  birthYear: z.coerce.number().int().min(new Date().getFullYear() - 17, "Meraki is for children up to 17.").max(new Date().getFullYear(), "Check the year."),
  notes: z.string().trim().max(500).optional().default(""),
});

export async function addChild(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["PARENT"]);
  const values = Object.fromEntries(["firstName", "birthYear", "notes"].map((k) => [k, field(form, k)]));
  const parsed = childSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  if ((await db.child.count({ where: { parentId: user.id } })) >= 8) return { error: "You can add up to 8 children.", values };
  await db.child.create({ data: { parentId: user.id, ...parsed.data } });
  await syncChildrenCount(user.id);
  revalidatePath("/parent/family");
  revalidatePath("/parent");
  return { ok: true, message: `${parsed.data.firstName} added.` };
}

export async function removeChild(form: FormData) {
  const user = await requireUser(["PARENT"]);
  await db.child.deleteMany({ where: { id: field(form, "childId"), parentId: user.id } });
  await syncChildrenCount(user.id);
  revalidatePath("/parent/family");
  revalidatePath("/parent");
}

async function syncChildrenCount(parentId: string) {
  const n = await db.child.count({ where: { parentId } });
  await db.parentProfile.upsert({
    where: { userId: parentId },
    update: { childrenCount: Math.max(1, n) },
    create: { userId: parentId, childrenCount: Math.max(1, n) },
  });
}

const familySchema = z.object({
  about: z.string().trim().max(2000),
  address: z.string().trim().max(200),
});

export async function updateFamily(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["PARENT"]);
  const values = { about: field(form, "about"), address: field(form, "address") };
  const parsed = familySchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  await db.parentProfile.upsert({
    where: { userId: user.id },
    update: parsed.data,
    create: { userId: user.id, ...parsed.data },
  });
  revalidatePath("/parent/family");
  return { ok: true, message: "Family profile saved." };
}
