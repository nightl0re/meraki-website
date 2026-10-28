"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { deleteFile, saveImage } from "@/lib/files";
import { audit, notify } from "@/lib/notify";
import { applicationMissing } from "@/lib/sitter-application";
import { config } from "@/lib/config";
import { geocode } from "@/lib/geo";
import type { FormState } from "./auth";

export async function setAccepting(form: FormData) {
  const user = await requireUser(["SITTER"]);
  await db.sitterProfile.update({
    where: { userId: user.id },
    data: { acceptingBookings: form.get("accepting") === "1" },
  });
  revalidatePath("/sitter");
  revalidatePath("/sitter/profile");
  revalidatePath("/sitter/application");
}

const profileSchema = z.object({
  headline: z.string().trim().min(10, "Write a short headline (at least 10 characters).").max(120),
  bio: z.string().trim().min(80, "Tell families a bit more (at least 80 characters).").max(2000),
  hourlyRate: z.coerce
    .number({ error: "Enter your hourly rate." })
    .min(config.minRateCents / 100, `Minimum is ${config.minRateCents / 100}.`)
    .max(config.maxRateCents / 100, `Maximum is ${config.maxRateCents / 100}.`),
  experienceYears: z.coerce.number().int().min(0).max(60),
  maxChildren: z.coerce.number().int().min(1).max(8),
  serviceRadiusKm: z.coerce.number().int().min(1).max(50),
  area: z.string().trim().min(2, "Enter your neighborhood or postcode.").max(120),
  skills: z.array(z.coerce.number().int()).max(14),
  languages: z.string().trim().max(120).regex(/^[\p{L} ,.-]*$/u, "Use letters and commas only."),
  cprCertified: z.boolean(),
});

export async function updateSitterProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["SITTER"], { allowPendingSitter: true });
  const raw = { ...Object.fromEntries(form), skills: form.getAll("skills"), cprCertified: form.get("cprCertified") === "on" };
  const parsed = profileSchema.safeParse(raw);
  const values = Object.fromEntries(Object.entries(Object.fromEntries(form)).map(([k, v]) => [k, String(v)]));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const d = parsed.data;

  const current = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { area: true, latitude: true } });
  let location = {};
  if (d.area !== current.area || current.latitude == null) {
    const place = await geocode(d.area);
    if (!place) return { fieldErrors: { area: ["We couldn't find that place. Try a postcode."] }, values };
    location = { area: place.label.split(",")[0].trim(), latitude: place.lat, longitude: place.lng };
  }

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: location }),
    db.sitterProfile.update({
      where: { userId: user.id },
      data: {
        headline: d.headline,
        bio: d.bio,
        hourlyRateCents: Math.round(d.hourlyRate * 100),
        experienceYears: d.experienceYears,
        maxChildren: d.maxChildren,
        serviceRadiusKm: d.serviceRadiusKm,
        languages: d.languages || "English",
        cprCertified: d.cprCertified,
      },
    }),
    db.sitterSkill.deleteMany({ where: { sitterId: user.id } }),
    db.sitterSkill.createMany({ data: d.skills.map((skillId) => ({ sitterId: user.id, skillId })), skipDuplicates: true }),
  ]);
  revalidatePath("/sitter/profile");
  revalidatePath("/sitter/application");
  revalidatePath(`/sitters/${user.id}`);
  return { ok: true, message: "Profile saved." };
}

export async function saveAvailability(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["SITTER"], { allowPendingSitter: true });
  const rows: { sitterId: string; weekday: number; startMinute: number; endMinute: number }[] = [];
  for (let day = 0; day < 7; day++) {
    if (form.get(`on_${day}`) !== "on") continue;
    const start = Number(form.get(`start_${day}`));
    const end = Number(form.get(`end_${day}`));
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1440 || end - start < 60) {
      return { error: "Each day needs at least one hour between start and end." };
    }
    rows.push({ sitterId: user.id, weekday: day, startMinute: start, endMinute: end });
  }
  await db.$transaction([
    db.availability.deleteMany({ where: { sitterId: user.id } }),
    db.availability.createMany({ data: rows }),
  ]);
  revalidatePath("/sitter/profile");
  revalidatePath("/sitter/application");
  revalidatePath(`/sitters/${user.id}`);
  return { ok: true, message: rows.length ? "Availability saved." : "Availability cleared. Families can't book you until you add some." };
}

// --- application / verification -------------------------------------------------

export async function uploadIdPhoto(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["SITTER"], { allowPendingSitter: true });
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Take or choose a photo first." };
  const saved = await saveImage(user.id, "ID_PHOTO", file);
  if (!saved.ok) return { error: saved.error };
  const profile = await db.sitterProfile.findUniqueOrThrow({ where: { userId: user.id }, select: { idPhotoId: true } });
  await db.sitterProfile.update({ where: { userId: user.id }, data: { idPhotoId: saved.id } });
  await deleteFile(user.id, profile.idPhotoId);
  await audit(user.id, "sitter.id_photo_uploaded", "User", user.id);
  revalidatePath("/sitter/application");
  return { ok: true, message: "Verification photo saved. Only our review team can see it." };
}

export async function submitApplication(): Promise<FormState> {
  const user = await requireUser(["SITTER"], { allowPendingSitter: true });
  if (user.status === "ACTIVE") return { error: "Your profile is already approved." };
  const missing = await applicationMissing(user.id);
  if (missing.length) return { error: `Almost there. Still to do: ${missing.join(", ").toLowerCase()}.` };
  const res = await db.sitterProfile.updateMany({
    where: { userId: user.id, submittedAt: null },
    data: { submittedAt: new Date(), reviewNote: "" },
  });
  if (res.count === 1) {
    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    for (const a of admins) {
      await notify(a.id, "Sitter application to review", `${user.firstName} ${user.lastName} submitted their application.`, "/admin/sitters");
    }
    await audit(user.id, "sitter.application_submitted", "User", user.id);
  }
  revalidatePath("/sitter/application");
  return { ok: true, message: "Application sent! We'll review it within one business day and notify you." };
}
