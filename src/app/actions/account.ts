"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { geocode } from "@/lib/geo";
import { deleteImage, saveImage } from "@/lib/uploads";
import type { FormState } from "./auth";

export async function uploadAvatar(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo first." };
  const saved = await saveImage(file);
  if (!saved.ok) return { error: saved.error };
  const old = await db.user.findUnique({ where: { id: user.id }, select: { avatarUrl: true } });
  await db.user.update({ where: { id: user.id }, data: { avatarUrl: saved.url } });
  await deleteImage(old?.avatarUrl);
  revalidatePath("/", "layout");
  return { ok: true, message: "Photo updated." };
}

const accountSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(60),
  lastName: z.string().trim().min(1, "Enter your last name.").max(60),
  phone: z.string().trim().max(30),
  area: z.string().trim().max(120),
});

export async function updateAccount(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = Object.fromEntries(Object.entries(Object.fromEntries(form)).map(([k, v]) => [k, String(v)]));
  const parsed = accountSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const d = parsed.data;
  const current = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { area: true } });

  let location = {};
  if (d.area && d.area !== current.area) {
    const place = await geocode(d.area);
    if (!place) return { fieldErrors: { area: ["We couldn't find that place. Try a ZIP code."] }, values };
    location = { area: place.label.split(",")[0].trim(), latitude: place.lat, longitude: place.lng };
  }
  await db.user.update({
    where: { id: user.id },
    data: { firstName: d.firstName, lastName: d.lastName, phone: d.phone, ...location },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

const passwordSchema = z.object({
  current: z.string().min(1, "Enter your current password."),
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Use letters and at least one number."),
});

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(parsed.data.current, row.passwordHash))) {
    return { fieldErrors: { current: ["That isn't your current password."] } };
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  // Sign out every other device, then start a fresh session here.
  await db.session.deleteMany({ where: { userId: user.id } });
  await createSession(user.id);
  return { ok: true, message: "Password changed. Other devices have been signed out." };
}

export async function markAllRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}
