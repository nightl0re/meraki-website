"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { payments } from "@/lib/payments/provider";
import { createBooking } from "@/lib/bookings";
import { zonedToUtc } from "@/lib/time";
import { audit } from "@/lib/notify";
import type { FormState } from "./auth";

export async function toggleFavorite(form: FormData) {
  const user = await requireUser(["PARENT"]);
  const sitterId = String(form.get("sitterId") ?? "");
  const key = { parentId_sitterId: { parentId: user.id, sitterId } };
  const existing = await db.favorite.findUnique({ where: key });
  if (existing) await db.favorite.delete({ where: key });
  else if (await db.user.findFirst({ where: { id: sitterId, role: "SITTER" } })) {
    await db.favorite.create({ data: { parentId: user.id, sitterId } });
  }
  revalidatePath(`/sitters/${sitterId}`);
  revalidatePath("/favorites");
}

// --- payment methods ---------------------------------------------------------

const cardSchema = z.object({
  holderName: z.string().trim().min(2, "Enter the name on the card.").max(100),
  number: z.string().min(12, "Enter the card number.").max(30),
  expiry: z.string().regex(/^\s*\d{1,2}\s*\/\s*\d{2,4}\s*$/, "Use MM/YY."),
  cvc: z.string().trim().min(3, "Enter the security code.").max(4),
});

export async function addPaymentMethod(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["PARENT"]);
  // Never echo the card number or CVC back to the page.
  const values = { holderName: String(form.get("holderName") ?? ""), expiry: String(form.get("expiry") ?? "") };
  const parsed = cardSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };

  const [mm, yy] = parsed.data.expiry.split("/").map((v) => Number(v.trim()));
  const result = await payments.tokenizeCard({
    number: parsed.data.number,
    expMonth: mm,
    expYear: yy,
    cvc: parsed.data.cvc,
    holderName: parsed.data.holderName,
  });
  if (!result.ok) return { fieldErrors: { [result.field]: [result.message] }, values };

  const count = await db.paymentMethod.count({ where: { userId: user.id, removedAt: null } });
  if (count >= 5) return { error: "You can save up to 5 cards. Remove one first.", values };

  await db.paymentMethod.create({
    data: {
      userId: user.id,
      providerRef: result.token,
      brand: result.brand,
      last4: result.last4,
      expMonth: result.expMonth,
      expYear: result.expYear,
      holderName: parsed.data.holderName,
      isDefault: count === 0,
    },
  });
  await audit(user.id, "card.added", "User", user.id, `${result.brand} ${result.last4}`);
  revalidatePath("/settings/payment");
  revalidatePath("/book", "layout");
  return { ok: true, message: `${result.brand} ending in ${result.last4} saved.` };
}

export async function removePaymentMethod(form: FormData) {
  const user = await requireUser(["PARENT"]);
  const id = String(form.get("id") ?? "");
  const card = await db.paymentMethod.findFirst({ where: { id, userId: user.id, removedAt: null } });
  if (!card) return;
  // Cards holding money for an open booking can't be removed.
  const inUse = await db.payment.count({ where: { paymentMethodId: id, status: "AUTHORIZED" } });
  if (inUse) redirect("/settings/payment?error=in-use");
  await db.paymentMethod.update({ where: { id }, data: { removedAt: new Date(), isDefault: false } });
  if (card.isDefault) {
    const next = await db.paymentMethod.findFirst({ where: { userId: user.id, removedAt: null }, orderBy: { createdAt: "desc" } });
    if (next) await db.paymentMethod.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  revalidatePath("/settings/payment");
}

export async function makeDefaultPaymentMethod(form: FormData) {
  const user = await requireUser(["PARENT"]);
  const id = String(form.get("id") ?? "");
  const card = await db.paymentMethod.findFirst({ where: { id, userId: user.id, removedAt: null } });
  if (!card) return;
  await db.$transaction([
    db.paymentMethod.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
    db.paymentMethod.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidatePath("/settings/payment");
}

// --- booking -----------------------------------------------------------------

const bookingSchema = z.object({
  sitterId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time."),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Pick an end time."),
  childrenCount: z.coerce.number().int().min(1, "At least one child.").max(8).optional().default(1),
  childIds: z.array(z.string().max(40)).max(8).optional().default([]),
  address: z.string().trim().min(5, "Enter the address where the sitter should come.").max(200),
  notes: z.string().trim().max(2000).optional().default(""),
  paymentMethodId: z.string().min(1, "Choose a card."),
});

export async function requestBooking(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["PARENT"]);
  const values = Object.fromEntries(
    ["date", "start", "end", "childrenCount", "address", "notes", "paymentMethodId"].map((k) => [k, String(form.get(k) ?? "")]),
  );
  const parsed = bookingSchema.safeParse({ ...Object.fromEntries(form), childIds: form.getAll("childIds").map(String) });
  if (parsed.success && form.has("childIds") === false && (await db.child.count({ where: { parentId: user.id } })) > 0) {
    return { fieldErrors: { childIds: ["Choose at least one child."] }, values };
  }
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const d = parsed.data;

  const startsAt = zonedToUtc(d.date, d.start);
  let endsAt = zonedToUtc(d.date, d.end);
  if (!startsAt || !endsAt) return { error: "Check the date and times.", values };
  // An end time earlier than the start means the booking runs past midnight.
  if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 3_600_000);

  const result = await createBooking(user, {
    sitterId: d.sitterId,
    startsAt,
    endsAt,
    childrenCount: d.childIds.length || d.childrenCount,
    childIds: d.childIds,
    address: d.address,
    notes: d.notes,
    paymentMethodId: d.paymentMethodId,
  });
  if (!result.ok) return { error: result.error, values };

  // Remember the address for next time.
  await db.parentProfile.upsert({
    where: { userId: user.id },
    update: { address: d.address },
    create: { userId: user.id, address: d.address, childrenCount: d.childIds.length || d.childrenCount },
  });
  redirect(`/bookings/${result.data!.id}?requested=1`);
}
