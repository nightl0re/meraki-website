"use client";

import { useActionState, useRef, useEffect } from "react";
import { CreditCard } from "@phosphor-icons/react";
import type { FormState } from "@/app/actions/auth";
import { addChild, applyAction, hireAction, postJob, updateFamily } from "@/app/actions/jobs";
import { SubmitButton } from "./submit-button";
import { Alert, Field, Input, Select, Textarea } from "./ui";

const TIMES = Array.from({ length: 36 }, (_, i) => 6 * 60 + i * 30); // 6:00 .. 23:30
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const label = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${h % 12 === 0 ? 12 : h % 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${h >= 12 ? "PM" : "AM"}`;
};

export function PostJobForm({ minDate, maxDate, defaultChildren, currency }: { minDate: string; maxDate: string; defaultChildren: number; currency: string }) {
  const [state, action] = useActionState<FormState, FormData>(postJob, {});
  const v = state.values;
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Title" htmlFor="title" error={err("title")} hint="Families who write a clear title get more applicants.">
        <Input id="title" name="title" maxLength={120} placeholder="Friday date night, two kids" defaultValue={v?.title} aria-invalid={!!err("title")} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Date" htmlFor="date" error={err("date")}>
          <Input id="date" name="date" type="date" min={minDate} max={maxDate} defaultValue={v?.date} aria-invalid={!!err("date")} />
        </Field>
        <Field label="From" htmlFor="start" error={err("start")}>
          <Select id="start" name="start" defaultValue={v?.start ?? "18:00"}>
            {TIMES.map((t) => <option key={t} value={hhmm(t)}>{label(t)}</option>)}
          </Select>
        </Field>
        <Field label="Until" htmlFor="end" error={err("end")}>
          <Select id="end" name="end" defaultValue={v?.end ?? "22:00"}>
            {[...TIMES.slice(2), 1440].map((t) => <option key={t} value={t === 1440 ? "24:00" : hhmm(t)}>{t === 1440 ? "Midnight" : label(t)}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Number of children" htmlFor="childrenCount" error={err("childrenCount")}>
          <Select id="childrenCount" name="childrenCount" defaultValue={v?.childrenCount ?? String(defaultChildren)}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>
        <Field label={`Hourly budget, up to (${currency})`} htmlFor="maxRate" error={err("maxRate")} hint="Only sitters at or under this rate are notified.">
          <Input id="maxRate" name="maxRate" type="number" min={10} max={100} step="1" defaultValue={v?.maxRate ?? "25"} aria-invalid={!!err("maxRate")} />
        </Field>
      </div>
      <Field label="Details for sitters" htmlFor="description" hint="Ages, routines, pets, anything that helps a sitter decide. Your address is only shared after you hire.">
        <Textarea id="description" name="description" rows={5} maxLength={2000} defaultValue={v?.description} />
      </Field>
      <SubmitButton size="lg" pendingText="Posting">Post job</SubmitButton>
    </form>
  );
}

export function ApplyForm({ jobId }: { jobId: string }) {
  const [state, action] = useActionState<FormState, FormData>(applyAction, {});
  if (state.ok) return <Alert tone="accent">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="jobId" value={jobId} />
      <Field label="Message to the family" htmlFor={`msg-${jobId}`} hint="Say hello and why you're a good fit. Keep contact details out until you're hired.">
        <Textarea id={`msg-${jobId}`} name="message" rows={4} maxLength={1000} placeholder="Hi! I'm free that evening and love..." />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      <SubmitButton pendingText="Applying">Apply for this job</SubmitButton>
    </form>
  );
}

export function HireForm({
  applicationId,
  sitterName,
  cards,
  address,
  total,
}: {
  applicationId: string;
  sitterName: string;
  cards: { id: string; label: string; isDefault: boolean }[];
  address: string;
  total: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(hireAction, {});
  if (!cards.length) {
    return <Alert tone="warn">Add a card in Payment methods before hiring.</Alert>;
  }
  return (
    <form action={action} className="space-y-4 rounded-xl border border-line-strong bg-surface p-4">
      <input type="hidden" name="applicationId" value={applicationId} />
      <Field label="Address for the sitter" htmlFor={`addr-${applicationId}`}>
        <Input id={`addr-${applicationId}`} name="address" defaultValue={address} autoComplete="street-address" />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-2">Pay with</legend>
        {cards.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-line-strong px-3 py-2.5 has-[:checked]:border-accent">
            <input type="radio" name="paymentMethodId" value={c.id} defaultChecked={c.isDefault} className="accent-[var(--accent)]" />
            <CreditCard size={18} className="text-ink-3" aria-hidden />
            <span className="text-sm">{c.label}</span>
          </label>
        ))}
      </fieldset>
      {state.error && <Alert>{state.error}</Alert>}
      <SubmitButton pendingText="Placing hold" className="w-full">Hire {sitterName}, hold {total}</SubmitButton>
      <p className="text-xs text-ink-3">Nothing is charged until after the job. Other applicants are told the job is filled.</p>
    </form>
  );
}

export function ChildForm() {
  const [state, action] = useActionState<FormState, FormData>(addChild, {});
  const ref = useRef<HTMLFormElement>(null);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const year = new Date().getFullYear();
  return (
    <form ref={ref} action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="accent">{state.message}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="childFirstName" error={err("firstName")}>
          <Input id="childFirstName" name="firstName" maxLength={60} />
        </Field>
        <Field label="Year of birth" htmlFor="birthYear" error={err("birthYear")}>
          <Select id="birthYear" name="birthYear" defaultValue={String(year - 4)}>
            {Array.from({ length: 18 }, (_, i) => year - i).map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Notes for sitters (optional)" htmlFor="childNotes" hint="Allergies, bedtime, comfort toys, special needs.">
        <Textarea id="childNotes" name="notes" rows={2} maxLength={500} />
      </Field>
      <SubmitButton variant="secondary" pendingText="Adding">Add child</SubmitButton>
    </form>
  );
}

export function FamilyForm({ about, address }: { about: string; address: string }) {
  const [state, action] = useActionState<FormState, FormData>(updateFamily, {});
  return (
    <form action={action} className="space-y-4">
      {state.ok && <Alert tone="accent">{state.message}</Alert>}
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Home address" htmlFor="address" hint="Only shared with a sitter after they accept a booking.">
        <Input id="address" name="address" defaultValue={state.values?.address ?? address} autoComplete="street-address" maxLength={200} />
      </Field>
      <Field label="About your family" htmlFor="about" hint="Shown to sitters you book or who apply to your jobs.">
        <Textarea id="about" name="about" rows={4} defaultValue={state.values?.about ?? about} maxLength={2000} />
      </Field>
      <SubmitButton pendingText="Saving">Save</SubmitButton>
    </form>
  );
}
