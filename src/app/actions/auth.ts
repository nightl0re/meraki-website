"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import {
  clientIp, createSession, destroySession, hashPassword, homeFor, randomToken, rateLimit, sha256, verifyPassword,
} from "@/lib/auth";
import { config } from "@/lib/config";
import { geocode } from "@/lib/geo";
import { appUrl, sendEmail } from "@/lib/mail";
import { passwordRule } from "@/lib/validation";
import { audit, notify } from "@/lib/notify";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
  ok?: boolean;
  message?: string;
};

// Only allow redirects back into this site, and only into pages this role can open.
function safeNext(next: FormDataEntryValue | null, role: Role) {
  const v = typeof next === "string" ? next : "";
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return null;
  const owner = v.startsWith("/admin") ? "ADMIN" : v.startsWith("/sitter/") || v === "/sitter" ? "SITTER" : v.startsWith("/parent") ? "PARENT" : null;
  return owner && owner !== role ? null : v;
}

const loginSchema = z.object({
  email: z.email("Enter a valid email address.").transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "Enter your password.").max(200),
});

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const values = { email: String(form.get("email") ?? "") };
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const { email, password } = parsed.data;

  const ip = await clientIp();
  if (!(await rateLimit(`login:ip:${ip}`, 30, 15 * 60_000))) {
    return { error: "Too many attempts from this network. Please wait 15 minutes and try again.", values };
  }

  const user = await db.user.findUnique({ where: { email } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    return { error: "This account is temporarily locked after too many wrong passwords. Try again in 15 minutes, or reset your password.", values };
  }
  // Same message whether the email exists or not, so accounts can't be probed.
  const valid = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, await dummyHash());
  if (!user || !valid) {
    if (user) {
      const failed = user.failedLogins + 1;
      const lock = failed >= config.maxFailedLogins;
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLogins: lock ? 0 : failed,
          lockedUntil: lock ? new Date(Date.now() + config.lockMinutes * 60_000) : undefined,
        },
      });
      if (lock) await audit(null, "user.locked", "User", user.id, `after ${failed} failed logins from ${ip}`);
    }
    return { error: "That email and password don't match.", values };
  }
  if (user.status === "SUSPENDED") return { error: "This account is suspended. Contact support@meraki.app.", values };
  if (user.status === "REJECTED") return { error: "This sitter application wasn't approved.", values };

  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession(user.id);
  // Drop any pages cached in the browser for the previous account.
  revalidatePath("/", "layout");
  redirect(safeNext(form.get("next"), user.role) ?? homeFor(user.role));
}

// Comparing against a throwaway hash keeps response time equal for unknown emails.
let dummy: Promise<string> | undefined;
const dummyHash = () => (dummy ??= hashPassword("timing-equaliser-not-a-password"));

const signupSchema = z.object({
  role: z.enum(["PARENT", "SITTER"], { error: "Choose whether you're a parent or a babysitter." }),
  firstName: z.string().trim().min(1, "Enter your first name.").max(60),
  lastName: z.string().trim().min(1, "Enter your last name.").max(60),
  email: z.email("Enter a valid email address.").transform((v) => v.toLowerCase().trim()),
  phone: z.string().trim().max(30).regex(/^[\d\s()+.-]*$/, "Use digits, spaces and + ( ) - only.").optional().default(""),
  area: z.string().trim().min(2, "Tell us your neighborhood or ZIP code.").max(120),
  password: passwordRule,
  terms: z.literal("on", { error: "Please accept the terms to continue." }),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const values = Object.fromEntries(
    ["role", "firstName", "lastName", "email", "phone", "area"].map((k) => [k, String(form.get(k) ?? "")]),
  );
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const d = parsed.data;

  if (!(await rateLimit(`signup:${await clientIp()}`, 10, 60 * 60_000))) {
    return { error: "Too many sign-ups from this network. Try again later.", values };
  }
  if (d.password.toLowerCase().includes(d.email.split("@")[0])) {
    return { fieldErrors: { password: ["Don't use your email name in your password."] }, values };
  }
  if (await db.user.findUnique({ where: { email: d.email } })) {
    return { fieldErrors: { email: ["An account with this email already exists. Try logging in."] }, values };
  }

  const place = await geocode(d.area);
  const user = await db.user.create({
    data: {
      email: d.email,
      passwordHash: await hashPassword(d.password),
      role: d.role,
      // Parents can book straight away; sitters are reviewed before they appear in search.
      status: d.role === "SITTER" ? "PENDING_REVIEW" : "ACTIVE",
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,
      area: place ? place.label.split(",")[0] : d.area,
      city: place?.label.split(",").slice(1, 2).join("").trim() ?? "",
      latitude: place?.lat ?? null,
      longitude: place?.lng ?? null,
      lastLoginAt: new Date(),
      ...(d.role === "SITTER" ? { sitterProfile: { create: {} } } : { parentProfile: { create: {} } }),
    },
  });

  if (d.role === "SITTER") {
    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    for (const a of admins) {
      await notify(a.id, "New sitter application", `${d.firstName} ${d.lastName} signed up as a sitter.`, "/admin/sitters");
    }
    await notify(user.id, "Welcome to Meraki", "Finish your profile and availability. We'll review it within one business day.", "/sitter/profile");
  } else {
    await notify(user.id, "Welcome to Meraki", "Add your children and a card, then find a sitter near you. You're only charged after the job.", "/parent/family");
  }
  await audit(user.id, "user.signup", "User", user.id, d.role);

  await createSession(user.id);
  revalidatePath("/", "layout");
  redirect(d.role === "SITTER" ? "/sitter/profile?welcome=1" : "/parent?welcome=1");
}

export async function logout() {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/login?signedOut=1");
}

// --- password reset --------------------------------------------------------------

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.email().safeParse(String(form.get("email") ?? "").toLowerCase().trim());
  if (!parsed.success) return { fieldErrors: { email: ["Enter a valid email address."] } };
  const email = parsed.data;
  const done: FormState = {
    ok: true,
    message: "If an account exists for that email, we've sent a link to reset the password. It works for 30 minutes.",
  };
  if (!(await rateLimit(`reset:${await clientIp()}`, 5, 60 * 60_000)) || !(await rateLimit(`reset:${email}`, 3, 60 * 60_000))) {
    return done; // don't reveal throttling per address either
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.status === "SUSPENDED") return done;

  const token = randomToken();
  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + config.resetTokenMinutes * 60_000) },
  });
  await sendEmail(
    user.email,
    "Reset your Meraki password",
    `Hi ${user.firstName},\n\nUse this link to choose a new password (valid for ${config.resetTokenMinutes} minutes):\n${appUrl(`/reset-password?token=${token}`)}\n\nIf you didn't ask for this, you can ignore this email.`,
  );
  await audit(user.id, "password.reset_requested", "User", user.id);
  return done;
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const parsed = passwordRule.safeParse(String(form.get("password") ?? ""));
  if (!parsed.success) return { fieldErrors: { password: parsed.error.issues.map((i) => i.message) } };
  if (form.get("password") !== form.get("confirm")) return { fieldErrors: { confirm: ["The passwords don't match."] } };

  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return { error: "This reset link has expired or was already used. Request a new one." };
  }
  await db.$transaction([
    db.user.update({
      where: { id: row.userId },
      data: { passwordHash: await hashPassword(parsed.data), failedLogins: 0, lockedUntil: null },
    }),
    db.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } }),
    // Sign out everywhere: whoever had the old password is out.
    db.session.deleteMany({ where: { userId: row.userId } }),
  ]);
  await notify(row.userId, "Password changed", "Your password was reset. If this wasn't you, contact support straight away.");
  await audit(row.userId, "password.reset", "User", row.userId);
  redirect("/login?reset=1");
}
