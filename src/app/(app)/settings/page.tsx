import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { AccountForm, AvatarForm, PasswordForm } from "@/components/settings-forms";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Account settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Account settings" />
      <div className="space-y-8">
        {user.role !== "SITTER" && (
          <Card className="p-6">
            <h2 className="mb-5 font-semibold">Photo</h2>
            <AvatarForm user={me} />
          </Card>
        )}
        <Card className="p-6">
          <h2 className="mb-5 font-semibold">Personal details</h2>
          <AccountForm user={me} />
        </Card>
        {user.role === "PARENT" && (
          <Card className="flex items-center justify-between p-6">
            <div>
              <h2 className="font-semibold">Payment methods</h2>
              <p className="text-sm text-ink-3">Manage the cards you book with.</p>
            </div>
            <Link href="/settings/payment" className="text-sm font-medium text-accent-strong hover:underline">Manage</Link>
          </Card>
        )}
        <Card className="p-6">
          <h2 className="mb-5 font-semibold">Password</h2>
          <PasswordForm />
        </Card>
      </div>
    </div>
  );
}
