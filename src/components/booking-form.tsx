"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { CreditCard, LockSimple } from "@phosphor-icons/react";
import { requestBooking } from "@/app/actions/parent";
import type { FormState } from "@/app/actions/auth";
import { quote } from "@/lib/pricing";
import { formatMinutes, formatMoney, WEEKDAYS } from "@/lib/format";
import { SubmitButton } from "./submit-button";
import { Alert, Card, Field, Input, Select, Textarea, cn } from "./ui";

type Window = { weekday: number; start: number; end: number };

type Props = {
  sitter: { id: string; firstName: string; rateCents: number; maxChildren: number; availability: Window[] };
  cards: { id: string; label: string; exp: string; isDefault: boolean }[];
  defaults: { date: string; address: string; childrenCount: number };
  limits: { minDate: string; maxDate: string; freeCancelHours: number; responseHours: number };
};

const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fromHHMM = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
// Weekday of a calendar date, independent of the browser's time zone.
const weekdayOf = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export function BookingForm({ sitter, cards, defaults, limits }: Props) {
  const [state, action] = useActionState<FormState, FormData>(requestBooking, {});
  const v = state.values;
  const err = (k: string) => state.fieldErrors?.[k]?.[0];

  const [date, setDate] = useState(v?.date ?? defaults.date);
  const [start, setStart] = useState(v?.start ?? "");
  const [end, setEnd] = useState(v?.end ?? "");

  const windows = useMemo(
    () => (date ? sitter.availability.filter((w) => w.weekday === weekdayOf(date)) : []),
    [date, sitter.availability],
  );
  const availableDays = [...new Set(sitter.availability.map((w) => w.weekday))].sort();

  // Start options: every 30 min inside a window, leaving room for 1 hour.
  const startOptions = windows.flatMap((w) => {
    const out: number[] = [];
    for (let t = w.start; t + 60 <= w.end; t += 30) out.push(t);
    return out;
  });
  const startMin = start ? fromHHMM(start) : null;
  const activeWindow = startMin != null ? windows.find((w) => w.start <= startMin && w.end >= startMin + 60) : undefined;
  const endOptions: number[] = [];
  if (activeWindow && startMin != null) {
    for (let t = startMin + 60; t <= Math.min(activeWindow.end, startMin + 12 * 60); t += 30) endOptions.push(t);
  }
  const endMin = end ? fromHHMM(end) : null;
  const minutes = startMin != null && endMin != null && endMin > startMin ? endMin - startMin : 0;
  const q = minutes ? quote(sitter.rateCents, minutes) : null;

  return (
    <form action={action} className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]" noValidate>
      <input type="hidden" name="sitterId" value={sitter.id} />
      <div className="space-y-8">
        {state.error && <Alert>{state.error}</Alert>}

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">When</legend>
          <Field label="Date" htmlFor="date" error={err("date")}>
            <Input
              id="date" name="date" type="date" min={limits.minDate} max={limits.maxDate}
              value={date}
              onChange={(e) => { setDate(e.target.value); setStart(""); setEnd(""); }}
              aria-invalid={!!err("date")}
              required
            />
          </Field>
          {date && (
            windows.length ? (
              <p className="text-sm text-ink-3">
                {sitter.firstName} is available {windows.map((w) => `${formatMinutes(w.start)} to ${formatMinutes(w.end)}`).join(" and ")} on {WEEKDAYS[weekdayOf(date)]}s.
              </p>
            ) : (
              <Alert tone="warn">
                {sitter.firstName} doesn&apos;t work on {WEEKDAYS[weekdayOf(date)]}s.
                {availableDays.length > 0 && <> Try a {availableDays.map((d) => WEEKDAYS[d]).join(", ")}.</>}
              </Alert>
            )
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start" htmlFor="start" error={err("start")}>
              <Select id="start" name="start" value={start} disabled={!startOptions.length}
                onChange={(e) => { setStart(e.target.value); setEnd(""); }} required>
                <option value="">Select</option>
                {startOptions.map((t) => <option key={t} value={toHHMM(t)}>{formatMinutes(t)}</option>)}
              </Select>
            </Field>
            <Field label="End" htmlFor="end" error={err("end")}>
              <Select id="end" name="end" value={end} disabled={!endOptions.length}
                onChange={(e) => setEnd(e.target.value)} required>
                <option value="">Select</option>
                {endOptions.map((t) => (
                  <option key={t} value={toHHMM(t)}>{formatMinutes(t % 1440)} ({(t - startMin!) / 60} h)</option>
                ))}
              </Select>
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">Where and who</legend>
          <Field label="Address" htmlFor="address" error={err("address")} hint="Only shared with the sitter once they accept.">
            <Input id="address" name="address" autoComplete="street-address" defaultValue={v?.address ?? defaults.address} aria-invalid={!!err("address")} required />
          </Field>
          <Field label="Number of children" htmlFor="childrenCount" error={err("childrenCount")} className="max-w-48">
            <Select id="childrenCount" name="childrenCount" defaultValue={v?.childrenCount ?? String(defaults.childrenCount)}>
              {Array.from({ length: sitter.maxChildren }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Field>
          <Field label="Notes for the sitter" htmlFor="notes" hint="Ages, bedtime, allergies, anything they should know.">
            <Textarea id="notes" name="notes" rows={4} defaultValue={v?.notes} maxLength={2000} />
          </Field>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-lg font-semibold">Pay with</legend>
          {err("paymentMethodId") && <p className="text-sm text-danger">{err("paymentMethodId")}</p>}
          {cards.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-line-strong bg-surface px-4 py-3 has-[:checked]:border-accent has-[:checked]:ring-4 has-[:checked]:ring-accent/15">
              <input type="radio" name="paymentMethodId" value={c.id} defaultChecked={v?.paymentMethodId ? v.paymentMethodId === c.id : c.isDefault} className="accent-[var(--accent)]" />
              <CreditCard size={20} className="text-ink-3" aria-hidden />
              <span className="flex-1">{c.label}</span>
              <span className="text-sm text-ink-3 tabular">{c.exp}</span>
            </label>
          ))}
          <Link href="/settings/payment" className="inline-block text-sm text-accent-strong hover:underline">Add another card</Link>
        </fieldset>
      </div>

      {/* Summary */}
      <aside>
        <Card className="p-6 lg:sticky lg:top-24">
          <h2 className="font-semibold">Price</h2>
          <dl className="mt-4 space-y-2.5 text-sm tabular">
            <div className="flex justify-between">
              <dt className="text-ink-2">{q ? `${formatMoney(sitter.rateCents)} x ${q.hours} h` : `${formatMoney(sitter.rateCents)} per hour`}</dt>
              <dd>{q ? formatMoney(q.subtotalCents) : "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Service fee</dt>
              <dd>{q ? formatMoney(q.serviceFeeCents) : "-"}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
              <dt>Total</dt>
              <dd>{q ? formatMoney(q.totalCents) : "-"}</dd>
            </div>
          </dl>
          <div className={cn("mt-5 rounded-[10px] bg-accent-soft p-3.5 text-sm text-accent-strong", !q && "opacity-60")}>
            <p className="flex items-center gap-1.5 font-medium"><LockSimple size={16} aria-hidden />Nothing is charged today</p>
            <p className="mt-1 text-ink-2">
              We hold {q ? formatMoney(q.totalCents) : "the total"} on your card. {sitter.firstName} has {limits.responseHours}h to accept;
              you&apos;re charged after the job. Free cancellation until {limits.freeCancelHours}h before.
            </p>
          </div>
          <SubmitButton size="lg" className="mt-5 w-full" disabled={!q} pendingText="Placing hold">
            Request booking
          </SubmitButton>
        </Card>
      </aside>
    </form>
  );
}
