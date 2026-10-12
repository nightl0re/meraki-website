"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  acceptBooking, cancelBooking, confirmCompletion, declineBooking, reportProblem, sendMessage, submitReview,
  type Result,
} from "@/lib/bookings";
import type { FormState } from "./auth";

// All booking actions share one shape so a single client form component can
// drive them: (prevState, formData) -> { error } | { ok }.

function toState(r: Result, okMessage?: string): FormState {
  return r.ok ? { ok: true, message: okMessage } : { error: r.error };
}

function done(id: string) {
  revalidatePath(`/bookings/${id}`);
  revalidatePath("/bookings");
  revalidatePath("/parent");
  revalidatePath("/sitter");
}

const field = (form: FormData, k: string) => String(form.get(k) ?? "");

export async function acceptAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["SITTER"]);
  const id = field(form, "bookingId");
  const r = await acceptBooking(user, id);
  done(id);
  return toState(r, "Booking accepted. The family has been notified.");
}

export async function declineAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["SITTER"]);
  const id = field(form, "bookingId");
  const r = await declineBooking(user, id, field(form, "reason"));
  done(id);
  return toState(r);
}

export async function cancelAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["PARENT", "SITTER"]);
  const id = field(form, "bookingId");
  const r = await cancelBooking(user, id, field(form, "reason"));
  done(id);
  return toState(r);
}

export async function confirmAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["PARENT"]);
  const id = field(form, "bookingId");
  const r = await confirmCompletion(user, id);
  done(id);
  return toState(r, "Thanks! Your card has been charged and your receipt is ready.");
}

export async function reportAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["PARENT"]);
  const id = field(form, "bookingId");
  const r = await reportProblem(user, id, field(form, "reason"));
  done(id);
  return toState(r, "We've received your report. Your card won't be charged until it's resolved.");
}

export async function messageAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["PARENT", "SITTER"]);
  const id = field(form, "bookingId");
  const r = await sendMessage(user, id, field(form, "body"));
  revalidatePath(`/bookings/${id}`);
  return toState(r);
}

export async function reviewAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["PARENT", "SITTER"]);
  const id = field(form, "bookingId");
  const r = await submitReview(user, id, Number(form.get("rating")), field(form, "comment"));
  done(id);
  return toState(r, "Thanks for your review!");
}
