"use client";

import { useActionState, useEffect, useRef } from "react";
import { addPaymentMethod } from "@/app/actions/parent";
import type { FormState } from "@/app/actions/auth";
import { SubmitButton } from "./submit-button";
import { Alert, Field, Input } from "./ui";

// Card numbers are sent once to the server, tokenized by the payment provider
// and discarded. With a real provider this form would be replaced by its hosted
// fields so the number never touches our server at all.
export function CardForm({ onDone }: { onDone?: () => void }) {
  const [state, action] = useActionState<FormState, FormData>(addPaymentMethod, {});
  const form = useRef<HTMLFormElement>(null);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];

  useEffect(() => {
    if (state.ok) {
      form.current?.reset();
      onDone?.();
    }
  }, [state, onDone]);

  return (
    <form ref={form} action={action} className="space-y-4" noValidate>
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && state.message && <Alert tone="accent">{state.message}</Alert>}
      <Field label="Name on card" htmlFor="holderName" error={err("holderName")}>
        <Input id="holderName" name="holderName" autoComplete="cc-name" defaultValue={state.values?.holderName} aria-invalid={!!err("holderName")} required />
      </Field>
      <Field label="Card number" htmlFor="number" error={err("number")} hint="Test card: 4242 4242 4242 4242">
        <Input
          id="number"
          name="number"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="1234 5678 9012 3456"
          maxLength={23}
          aria-invalid={!!err("number")}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 19);
            e.target.value = digits.replace(/(.{4})/g, "$1 ").trim();
          }}
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Expiry" htmlFor="expiry" error={err("expiry")}>
          <Input
            id="expiry"
            name="expiry"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            maxLength={5}
            defaultValue={state.values?.expiry}
            aria-invalid={!!err("expiry")}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 4);
              e.target.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
            }}
            required
          />
        </Field>
        <Field label="Security code" htmlFor="cvc" error={err("cvc")}>
          <Input id="cvc" name="cvc" inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={4} aria-invalid={!!err("cvc")} required />
        </Field>
      </div>
      <SubmitButton pendingText="Saving card" className="w-full">Save card</SubmitButton>
      <p className="text-xs text-ink-3">
        Payments are simulated in this build, so please use a test card, never a real one. 4000 0000 0000 0002
        simulates a decline.
      </p>
    </form>
  );
}
