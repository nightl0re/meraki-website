"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  clientIp, createSession, destroySession, hashPassword, homeFor, rateLimit, verifyPassword,
} from "@/lib/auth";
import { geocode } from "@/lib/geo";
import { audit, notify } from "@/lib/notify";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
  ok?: boolean;
  message?: string;
};

// Only allow redirects back into this site.
function safeNext(next: FormDataEntryValue | null) {
  const v = typeof next === "string" ? next : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : null;
}

const loginSchema = z.object({
  email: z.email("Enter a valid email address.").transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "Enter your password."),
});

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const values = { email: String(form.get("email") ?? "") };
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };

  const { email, password } = parsed.data;
  if (!rateLimit(`login:${await clientIp()}:${email}`)) {
    return { error: "Too many attempts. Please wait 15 minutes and try again.", values };
  }

  const user = await db.user.findUnique({ where: { email } });
  // Same message whether the email exists or not, so accounts can't be probed.
  const valid = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, await dummyHash());
  if (!user || !valid) return { error: "That email and password don't match.", values };
  if (user.status === "SUSPENDED") return { error: "This account is suspended. Contact support@meraki.app.", values };
  if (user.status === "REJECTED") return { error: "This sitter application wasn't approved.", values };

  await createSession(user.id);
  redirect(safeNext(form.get("next")) ?? homeFor(user.role));
}

// Comparing against a throwaway hash keeps response time equal for unknown emails.
let dummy: Promise<string> | undefined;
const dummyHash = () => (dummy ??= hashPassword("timing-equaliser-not-a-password"));

const signupSchema = z.object({
  role: z.enum(["PARENT", "SITTER"]),
  firstName: z.string().trim().min(1, "Enter your first name.").max(60),
  lastName: z.string().trim().min(1, "Enter your last name.").max(60),
  email: z.email("Enter a valid email address.").transform((v) => v.toLowerCase().trim()),
  phone: z.string().trim().max(30).optional().default(""),
  area: z.string().trim().min(2, "Tell us your neighborhood or postcode.").max(120),
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(200)
    .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Use letters and at least one number."),
  terms: z.literal("on", { error: "Please accept the terms to continue." }),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const values = Object.fromEntries(
    ["role", "firstName", "lastName", "email", "phone", "area"].map((k) => [k, String(form.get(k) ?? "")]),
  );
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const d = parsed.data;

  if (!rateLimit(`signup:${await clientIp()}`, 10, 60 * 60_000)) {
    return { error: "Too many sign-ups from this network. Try again later.", values };
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
      ...(d.role === "SITTER"
        ? { sitterProfile: { create: {} } }
        : { parentProfile: { create: {} } }),
    },
  });

  if (d.role === "SITTER") {
    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    for (const a of admins) {
      await notify(a.id, "New sitter application", `${d.firstName} ${d.lastName} signed up as a sitter.`, "/admin/sitters");
    }
    await notify(user.id, "Welcome to Meraki", "Finish your profile and availability. We'll review it within one business day.", "/sitter/profile");
  } else {
    await notify(user.id, "Welcome to Meraki", "Add a card and find a sitter near you. You're only charged after the job.", "/sitters");
  }
  await audit(user.id, "user.signup", "User", user.id, d.role);

  await createSession(user.id);
  redirect(d.role === "SITTER" ? "/sitter/profile?welcome=1" : "/sitters");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
