"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { refundPayment, resolveDispute } from "@/lib/bookings";
import { audit, notify } from "@/lib/notify";
import { formatMoney } from "@/lib/format";
import type { FormState } from "./auth";

export async function reviewSitter(form: FormData) {
  const admin = await requireUser(["ADMIN"]);
  const id = String(form.get("userId") ?? "");
  const decision = form.get("decision") === "approve" ? "approve" : "reject";
  const sitter = await db.user.findFirst({ where: { id, role: "SITTER" } });
  if (!sitter) return;
  if (decision === "approve") {
    await db.$transaction([
      db.user.update({ where: { id }, data: { status: "ACTIVE" } }),
      db.sitterProfile.update({
        where: { userId: id },
        data: { verifiedAt: new Date(), ...(form.get("backgroundCheck") === "on" ? { backgroundCheckAt: new Date() } : {}) },
      }),
    ]);
    await notify(id, "You're verified!", "Your profile is now live. Families nearby can find and book you.", "/sitter");
  } else {
    await db.user.update({ where: { id }, data: { status: "REJECTED" } });
  }
  await audit(admin.id, `sitter.${decision}`, "User", id);
  revalidatePath("/admin/sitters");
  revalidatePath("/admin");
}

export async function setUserStatus(form: FormData) {
  const admin = await requireUser(["ADMIN"]);
  const id = String(form.get("userId") ?? "");
  const status = form.get("status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
  if (id === admin.id) return;
  const target = await db.user.findUnique({ where: { id } });
  if (!target || target.role === "ADMIN") return;
  await db.user.update({ where: { id }, data: { status } });
  if (status === "SUSPENDED") await db.session.deleteMany({ where: { userId: id } });
  await audit(admin.id, `user.${status.toLowerCase()}`, "User", id);
  revalidatePath("/admin/users");
}

export async function resolveDisputeAction(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireUser(["ADMIN"]);
  const id = String(form.get("bookingId") ?? "");
  const refund = Math.round(Number(form.get("refund") ?? 0) * 100);
  if (!Number.isFinite(refund) || refund < 0) return { error: "Enter a refund amount of 0 or more." };
  const r = await resolveDispute(admin, id, refund, String(form.get("note") ?? ""));
  revalidatePath("/admin/disputes");
  revalidatePath("/admin");
  return r.ok ? { ok: true, message: "Dispute resolved." } : { error: r.error };
}

export async function refundAction(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireUser(["ADMIN"]);
  const id = String(form.get("bookingId") ?? "");
  const cents = Math.round(Number(form.get("amount") ?? 0) * 100);
  const r = await refundPayment(admin, id, cents);
  revalidatePath("/admin/bookings");
  return r.ok ? { ok: true, message: `Refunded ${formatMoney(cents)}.` } : { error: r.error };
}

// Marks every pending payout as sent. With a real provider this is where
// transfers to the sitters' bank accounts would be created.
export async function runPayouts() {
  const admin = await requireUser(["ADMIN"]);
  // Settle exactly the rows we read, so a payout created meanwhile isn't
  // marked paid without its sitter being told.
  const rows = await db.payout.findMany({ where: { status: "PENDING" }, select: { id: true, sitterId: true, amountCents: true } });
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.sitterId, (totals.get(r.sitterId) ?? 0) + r.amountCents);
  const pending = [...totals].map(([sitterId, cents]) => ({ sitterId, _sum: { amountCents: cents } }));
  await db.payout.updateMany({ where: { id: { in: rows.map((r) => r.id) }, status: "PENDING" }, data: { status: "PAID", paidAt: new Date() } });
  for (const p of pending) {
    await notify(p.sitterId, "Payout sent", `${formatMoney(p._sum.amountCents ?? 0)} is on its way to your bank account.`, "/sitter/earnings");
  }
  await audit(admin.id, "payouts.run", "Payout", "batch", `${pending.length} sitters`);
  revalidatePath("/admin/payouts");
  revalidatePath("/admin");
}
