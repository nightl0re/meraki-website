import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth-forms";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12 md:py-20">
      <h1 className="text-3xl font-bold">Forgot your password?</h1>
      <p className="mt-2 text-ink-2">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      <Card className="mt-8 p-6 sm:p-8">
        <ForgotPasswordForm />
      </Card>
      <p className="mt-6 text-sm">
        <Link href="/login" className="text-accent-strong hover:underline">Back to log in</Link>
      </p>
    </div>
  );
}
