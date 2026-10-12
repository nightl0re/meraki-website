"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
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
  area: z.string().trim().min(2, "Enter your neighborhood or ZIP code.").max(120),
  skills: z.array(z.coerce.number().int()).max(14),
  languages: z.string().trim().max(120).regex(/^[\p{L} ,.-]*$/u, "Use letters and commas only."),
  cprCertified: z.boolean(),
});

export async function updateSitterProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["SITTER"]);
  const raw = { ...Object.fromEntries(form), skills: form.getAll("skills"), cprCertified: form.get("cprCertified") === "on" };
  const parsed = profileSchema.safeParse(raw);
  const values = Object.fromEntries(Object.entries(Object.fromEntries(form)).map(([k, v]) => [k, String(v)]));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const d = parsed.data;

  const current = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { area: true, latitude: true } });
  let location = {};
  if (d.area !== current.area || current.latitude == null) {
    const place = await geocode(d.area);
    if (!place) return { fieldErrors: { area: ["We couldn't find that place. Try a ZIP code."] }, values };
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
  revalidatePath(`/sitters/${user.id}`);
  return { ok: true, message: "Profile saved." };
}

export async function saveAvailability(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["SITTER"]);
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
  revalidatePath(`/sitters/${user.id}`);
  return { ok: true, message: rows.length ? "Availability saved." : "Availability cleared. Families can't book you until you add some." };
}
