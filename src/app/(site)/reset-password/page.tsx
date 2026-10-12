import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/auth";
import { ResetPasswordForm } from "@/components/auth-forms";
import { Alert, Card } from "@/components/ui";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const token = (await searchParams).token;
  const valid =
    typeof token === "string" &&
    (await db.passwordResetToken.findFirst({
      where: { tokenHash: sha256(token), usedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    }));

  return (
    <div className="mx-auto max-w-md px-4 py-12 md:py-20">
      <h1 className="text-3xl font-bold">Choose a new password</h1>
      <Card className="mt-8 p-6 sm:p-8">
        {valid ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="space-y-4">
            <Alert>This reset link has expired or was already used.</Alert>
            <Link href="/forgot-password" className="inline-block text-accent-strong hover:underline">Send a new link</Link>
          </div>
        )}
      </Card>
    </div>
  );
}
