"use client";

import { useActionState } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { submitApplication } from "@/app/actions/sitter";
import type { FormState } from "@/app/actions/auth";
import { SubmitButton } from "./submit-button";
import { Alert } from "./ui";

export function SubmitApplication({ ready }: { ready: boolean }) {
  const [state, action] = useActionState<FormState>(submitApplication, {});
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="accent">{state.message}</Alert>}
      <SubmitButton size="lg" disabled={!ready} pendingText="Sending">
        <PaperPlaneTilt size={20} aria-hidden /> Submit for review
      </SubmitButton>
    </form>
  );
}
