import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { AvailabilityForm, AvatarForm, SitterProfileForm } from "@/components/settings-forms";
import { Alert, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Profile & availability" };

export default async function SitterProfileEditPage({ searchParams }: PageProps<"/sitter/profile">) {
  const user = await requireUser(["SITTER"]);
  const welcome = (await searchParams).welcome === "1";
  const [me, skills] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { sitterProfile: { include: { skills: true, availability: true } } },
    }),
    db.skill.findMany({ orderBy: { name: "asc" } }),
  ]);
  const p = me.sitterProfile!;

  return (
    <>
      <PageHeader
        title="Profile & availability"
        description="This is what families see when they find you."
        actions={user.status === "ACTIVE" ? <Link href={`/sitters/${user.id}`} className="text-sm text-accent-strong hover:underline">View public profile</Link> : undefined}
      />
      {welcome && (
        <div className="mb-8">
          <Alert tone="accent">Welcome! Add a photo, your story and when you&apos;re free. Once it&apos;s complete our team will review your profile.</Alert>
        </div>
      )}
      <div className="space-y-8">
        <Card className="p-6">
          <h2 className="mb-5 font-semibold">Photo</h2>
          <AvatarForm user={me} />
        </Card>
        <Card className="p-6">
          <h2 className="mb-5 font-semibold">About you</h2>
          <SitterProfileForm
            allSkills={skills}
            profile={{
              headline: p.headline,
              bio: p.bio,
              hourlyRate: (p.hourlyRateCents / 100).toFixed(2),
              experienceYears: p.experienceYears,
              maxChildren: p.maxChildren,
              serviceRadiusKm: p.serviceRadiusKm,
              area: me.area,
              skills: p.skills.map((s) => s.skillId),
              languages: p.languages,
              cprCertified: p.cprCertified,
            }}
          />
        </Card>
        <Card className="p-6">
          <h2 className="font-semibold">Weekly availability</h2>
          <p className="mb-5 mt-1 text-sm text-ink-3">Families can only request times inside these hours.</p>
          <AvailabilityForm windows={p.availability.map((a) => ({ weekday: a.weekday, start: a.startMinute, end: a.endMinute }))} />
        </Card>
      </div>
    </>
  );
}
