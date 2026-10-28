"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Baby, HandHeart } from "@phosphor-icons/react";
import { login, requestPasswordReset, resetPassword, signup, type FormState } from "@/app/actions/auth";
import { SubmitButton } from "./submit-button";
import { Alert, Field, Input, cn } from "./ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(login, {});
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  return (
    <form action={action} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Email" htmlFor="email" error={err("email")}>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} aria-invalid={!!err("email")} required />
      </Field>
      <Field label="Password" htmlFor="password" error={err("password")}>
        <Input id="password" name="password" type="password" autoComplete="current-password" aria-invalid={!!err("password")} required />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingText="Logging in">Log in</SubmitButton>
    </form>
  );
}

export function SignupForm({ defaultRole }: { defaultRole: "PARENT" | "SITTER" }) {
  const [state, action] = useActionState<FormState, FormData>(signup, {});
  const [role, setRole] = useState<"PARENT" | "SITTER">((state.values?.role as "PARENT" | "SITTER") || defaultRole);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  const v = state.values;

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && <Alert>{state.error}</Alert>}
      <fieldset>
        <legend className="font-semibold">I&apos;m signing up as</legend>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {([
            { value: "PARENT", title: "A parent", body: "Find and book sitters", Icon: Baby },
            { value: "SITTER", title: "A babysitter", body: "Get booked by families", Icon: HandHeart },
          ] as const).map(({ value, title, body, Icon }) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition-colors",
                role === value ? "border-accent bg-accent-soft" : "border-line-strong bg-surface hover:border-ink-3",
              )}
            >
              <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} className="sr-only" />
              <Icon size={28} weight={role === value ? "fill" : "regular"} className={role === value ? "text-accent-strong" : "text-ink-3"} aria-hidden />
              <span className="font-semibold">{title}</span>
              <span className="text-sm text-ink-3">{body}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-4">
        <Field label="First name" htmlFor="firstName" error={err("firstName")}>
          <Input id="firstName" name="firstName" autoComplete="given-name" defaultValue={v?.firstName} aria-invalid={!!err("firstName")} required />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={err("lastName")}>
          <Input id="lastName" name="lastName" autoComplete="family-name" defaultValue={v?.lastName} aria-invalid={!!err("lastName")} required />
        </Field>
      </div>
      <Field label="Email" htmlFor="email" error={err("email")}>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={v?.email} aria-invalid={!!err("email")} required />
      </Field>
      <Field
        label={role === "SITTER" ? "Where are you based?" : "Your neighborhood or postcode"}
        htmlFor="area"
        error={err("area")}
        hint={role === "SITTER" ? "Families see your neighborhood and distance, never your address." : "Used to show sitters near you."}
      >
        <Input id="area" name="area" autoComplete="postal-code" placeholder="e.g. Bangsar or 59100" defaultValue={v?.area} aria-invalid={!!err("area")} required />
      </Field>
      <Field label="Phone (optional)" htmlFor="phone" error={err("phone")} hint="Shared only with confirmed bookings.">
        <Input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={v?.phone} />
      </Field>
      <Field label="Password" htmlFor="password" error={err("password")} hint="At least 10 characters, with a number.">
        <Input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={!!err("password")} required />
      </Field>
      <div>
        <label className="flex items-start gap-2.5 text-sm text-ink-2">
          <input type="checkbox" name="terms" className="mt-0.5 size-4 accent-[var(--accent)]" />
          <span>I agree to the Terms of Service and Privacy Policy.</span>
        </label>
        {err("terms") && <p className="mt-1.5 text-sm text-danger">{err("terms")}</p>}
      </div>
      {role === "SITTER" && (
        <Alert tone="info">After signing up you&apos;ll complete your profile. Our team reviews every sitter before they appear in search.</Alert>
      )}
      <SubmitButton size="lg" className="w-full" pendingText="Creating account">
        {role === "SITTER" ? "Create babysitter account" : "Create parent account"}
      </SubmitButton>
      <p className="text-center text-sm text-ink-3">
        Already have an account? <Link href="/login" className="font-medium text-accent-strong hover:underline">Log in</Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});
  if (state.ok) return <Alert tone="accent">{state.message}</Alert>;
  const err = state.fieldErrors?.email?.[0];
  return (
    <form action={action} className="space-y-5" noValidate>
      <Field label="Email" htmlFor="email" error={err}>
        <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={!!err} required />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingText="Sending">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(resetPassword, {});
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="New password" htmlFor="password" error={err("password")} hint="At least 10 characters, with a number.">
        <Input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={!!err("password")} required />
      </Field>
      <Field label="Repeat new password" htmlFor="confirm" error={err("confirm")}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" aria-invalid={!!err("confirm")} required />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingText="Saving">Save new password</SubmitButton>
    </form>
  );
}
