import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { LoginForm } from "@/components/auth-forms";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const next = (await searchParams).next;

  return (
    <div className="mx-auto max-w-md px-4 py-12 md:py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-ink-3">
        New to Meraki? <Link href="/signup" className="font-medium text-accent-strong hover:underline">Create an account</Link>
      </p>
      <Card className="mt-8 p-6 sm:p-8">
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </Card>
      {process.env.NODE_ENV !== "production" && (
        <p className="mt-6 text-sm text-ink-3">
          Demo accounts: parent@meraki.test, sitter@meraki.test, admin@meraki.test. Password: Meraki-demo-2026
        </p>
      )}
    </div>
  );
}
