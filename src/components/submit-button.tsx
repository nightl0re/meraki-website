"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { buttonClass } from "./ui";

type Props = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  pendingText?: string;
};

export function SubmitButton({ variant, size, className, pendingText, children, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      aria-busy={pending}
      className={buttonClass(variant, size, className)}
      {...props}
    >
      {pending && (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
      )}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
