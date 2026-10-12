"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import type { FormState } from "@/app/actions/auth";
import { Star } from "@phosphor-icons/react";
import { SubmitButton } from "./submit-button";
import { Alert, Field, Textarea, buttonClass } from "./ui";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

// One button that runs a booking action, with optional confirmation step and
// a reason/notes textarea.
export function ActionForm({
  action,
  hidden,
  label,
  pendingText,
  variant = "primary",
  confirm,
  reason,
  className,
}: {
  action: Action;
  hidden: Record<string, string>;
  label: string;
  pendingText?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  confirm?: { title: string; body?: ReactNode; confirmLabel: string };
  reason?: { label: string; required?: boolean; placeholder?: string };
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, run] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await action(prev, form);
    if (result.ok) setOpen(false);
    return result;
  }, {});

  const fields = Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);

  if (!confirm) {
    return (
      <form action={run} className={className}>
        {fields}
        {state.error && <div className="mb-3"><Alert>{state.error}</Alert></div>}
        <SubmitButton variant={variant} pendingText={pendingText} className="w-full sm:w-auto">{label}</SubmitButton>
      </form>
    );
  }

  return (
    <div className={className}>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={buttonClass(variant, "md", "w-full sm:w-auto")}>
          {label}
        </button>
      ) : (
        <form action={run} className="space-y-4 rounded-xl border border-line-strong bg-surface p-5">
          {fields}
          <div>
            <p className="font-semibold">{confirm.title}</p>
            {confirm.body && <div className="mt-1 text-sm text-ink-2">{confirm.body}</div>}
          </div>
          {reason && (
            <Field label={reason.label} htmlFor={`reason-${label}`}>
              <Textarea id={`reason-${label}`} name="reason" rows={3} required={reason.required} placeholder={reason.placeholder} maxLength={2000} />
            </Field>
          )}
          {state.error && <Alert>{state.error}</Alert>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <SubmitButton variant={variant === "danger" ? "danger" : "primary"} pendingText={pendingText}>{confirm.confirmLabel}</SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>Keep booking</button>
          </div>
        </form>
      )}
    </div>
  );
}

export function MessageForm({ action, bookingId }: { action: Action; bookingId: string }) {
  const [state, run] = useActionState<FormState, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={run} className="space-y-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label htmlFor="message-body" className="sr-only">Message</label>
      <Textarea id="message-body" name="body" rows={3} placeholder="Write a message" maxLength={2000} required />
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex justify-end">
        <SubmitButton size="sm" pendingText="Sending">Send</SubmitButton>
      </div>
    </form>
  );
}

export function ReviewForm({ action, bookingId, name }: { action: Action; bookingId: string; name: string }) {
  const [state, run] = useActionState<FormState, FormData>(action, {});
  const [rating, setRating] = useState(0);
  if (state.ok) return <Alert tone="accent">{state.message}</Alert>;
  return (
    <form action={run} className="space-y-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="rating" value={rating} />
      <fieldset>
        <legend className="text-sm font-medium text-ink-2">How was {name}?</legend>
        <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={rating === i}
              aria-label={`${i} star${i > 1 ? "s" : ""}`}
              onClick={() => setRating(i)}
              className={`transition-transform active:scale-90 ${i <= rating ? "text-sun" : "text-line-strong hover:text-sun/60"}`}
            >
              <Star size={32} weight={i <= rating ? "fill" : "regular"} />
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Comment (optional)" htmlFor="review-comment">
        <Textarea id="review-comment" name="comment" rows={3} maxLength={2000} />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      <SubmitButton disabled={!rating} pendingText="Posting">Post review</SubmitButton>
    </form>
  );
}
