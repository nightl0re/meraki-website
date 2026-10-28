import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser, homeFor, roleLabel } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { LoginForm } from "@/components/auth-forms";
import { Alert, Avatar, Card, LinkButton, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  const next = typeof sp.next === "string" ? sp.next : undefined;

  // Already signed in: say which account is active and offer to switch,
  // instead of silently sending the visitor to that account's dashboard.
  if (user) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 md:py-20">
        <h1 className="text-3xl font-bold">You&apos;re already signed in</h1>
        <Card className="mt-8 p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <Avatar src={user.avatarUrl} first={user.firstName} last={user.lastName} size={56} />
            <div>
              <p className="font-semibold">{user.firstName} {user.lastName}</p>
              <p className="text-sm text-ink-3">{user.email}</p>
              <p className="mt-1 inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold capitalize text-accent-strong">
                {roleLabel(user.role)} account
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <LinkButton href={homeFor(user.role, user.status)} size="lg">Continue as {user.firstName}</LinkButton>
            <form action={logout}>
              <button className={buttonClass("secondary", "lg", "w-full")}>Log out and use another account</button>
            </form>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 md:py-20">
      <h1 className="text-3xl font-bold">Welcome back</h1>
      <p className="mt-2 text-ink-3">
        New to Meraki? <Link href="/signup" className="font-semibold text-accent-strong hover:underline">Create an account</Link>
      </p>
      <div className="mt-6 space-y-3">
        {sp.signedOut === "1" && <Alert tone="info">You&apos;ve been logged out.</Alert>}
        {sp.reset === "1" && <Alert tone="accent">Your password was changed. Log in with your new password.</Alert>}
      </div>
      <Card className="mt-6 p-6 sm:p-8">
        <LoginForm next={next} />
        <p className="mt-5 text-center text-sm">
          <Link href="/forgot-password" className="text-accent-strong hover:underline">Forgot your password?</Link>
        </p>
      </Card>
      {process.env.NODE_ENV !== "production" && (
        <p className="mt-6 text-sm text-ink-3">
          Demo accounts: parent@meraki.test, sitter@meraki.test, admin@meraki.test. Password: Meraki-demo-2026
        </p>
      )}
    </div>
  );
}
