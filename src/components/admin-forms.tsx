"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions/auth";
import { refundAction, resolveDisputeAction } from "@/app/actions/admin";
import { SubmitButton } from "./submit-button";
import { Alert, Field, Input, Textarea } from "./ui";

export function ResolveDisputeForm({ bookingId, totalCents, currency }: { bookingId: string; totalCents: number; currency: string }) {
  const [state, action] = useActionState<FormState, FormData>(resolveDisputeAction, {});
  const [refund, setRefund] = useState("0");
  const total = totalCents / 100;
  if (state.ok) return <Alert tone="accent">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Pay sitter in full", v: "0" },
          { label: "Refund half", v: (total / 2).toFixed(2) },
          { label: "Refund everything", v: total.toFixed(2) },
        ].map((o) => (
          <button key={o.label} type="button" onClick={() => setRefund(o.v)}
            className="rounded-full border border-line-strong px-3 py-1.5 text-sm hover:border-accent hover:text-accent-strong">
            {o.label}
          </button>
        ))}
      </div>
      <Field label={`Refund to parent (${currency}, max ${total.toFixed(2)})`} htmlFor={`refund-${bookingId}`}>
        <Input id={`refund-${bookingId}`} name="refund" type="number" min={0} max={total} step="0.01" value={refund} onChange={(e) => setRefund(e.target.value)} className="max-w-48" />
      </Field>
      <Field label="Note for the record" htmlFor={`note-${bookingId}`}>
        <Textarea id={`note-${bookingId}`} name="note" rows={2} maxLength={400} />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      <SubmitButton pendingText="Resolving">Resolve dispute</SubmitButton>
    </form>
  );
}

export function RefundForm({ bookingId, maxCents }: { bookingId: string; maxCents: number }) {
  const [state, action] = useActionState<FormState, FormData>(refundAction, {});
  if (state.ok) return <span className="text-sm text-info">{state.message}</span>;
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label className="sr-only" htmlFor={`amt-${bookingId}`}>Refund amount</label>
      <Input id={`amt-${bookingId}`} name="amount" type="number" min={0.01} max={maxCents / 100} step="0.01" defaultValue={(maxCents / 100).toFixed(2)} className="h-8 w-24 px-2 text-sm" />
      <SubmitButton size="sm" variant="secondary" pendingText="...">Refund</SubmitButton>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
