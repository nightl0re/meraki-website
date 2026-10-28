import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { SignupForm } from "@/components/auth-forms";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role, user.status));
  const role = (await searchParams).role === "sitter" ? "SITTER" : "PARENT";

  return (
    <div className="mx-auto max-w-lg px-4 py-12 md:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        {role === "SITTER" ? "Start sitting with Meraki" : "Create your account"}
      </h1>
      <p className="mt-2 text-ink-3">Free to join. It takes about a minute.</p>
      <Card className="mt-8 p-6 sm:p-8">
        <SignupForm defaultRole={role} />
      </Card>
    </div>
  );
}
