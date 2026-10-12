import type { Metadata } from "next";
import { Baby, Trash } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { childAge } from "@/lib/format";
import { removeChild } from "@/app/actions/jobs";
import { ChildForm, FamilyForm } from "@/components/job-forms";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Family profile" };

export default async function FamilyPage() {
  const user = await requireUser(["PARENT"]);
  const [children, profile] = await Promise.all([
    db.child.findMany({ where: { parentId: user.id }, orderBy: { birthYear: "desc" } }),
    db.parentProfile.findUnique({ where: { userId: user.id } }),
  ]);

  return (
    <>
      <PageHeader title="Family profile" description="Sitters see your children's first names and ages once they accept a booking, so they arrive prepared." />
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <Card className="p-6">
            <h2 className="font-semibold">Your children</h2>
            {children.length === 0 ? (
              <div className="mt-4">
                <EmptyState icon={<Baby size={32} />} title="No children added yet" body="Add them below. You can pick who's being looked after on each booking." />
              </div>
            ) : (
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {children.map((c) => (
                  <li key={c.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-4">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-strong">
                      {c.firstName.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{c.firstName}</p>
                      <p className="text-sm text-ink-3">{childAge(c.birthYear)}</p>
                      {c.notes && <p className="mt-1 text-sm text-ink-2">{c.notes}</p>}
                    </div>
                    <form action={removeChild}>
                      <input type="hidden" name="childId" value={c.id} />
                      <button className="rounded-full p-2 text-ink-3 hover:bg-danger-soft hover:text-danger" aria-label={`Remove ${c.firstName}`}>
                        <Trash size={18} />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 border-t border-line pt-6">
              <h3 className="mb-4 font-semibold">Add a child</h3>
              <ChildForm />
            </div>
          </Card>
        </div>
        <Card className="h-fit p-6">
          <h2 className="mb-4 font-semibold">Home and family</h2>
          <FamilyForm about={profile?.about ?? ""} address={profile?.address ?? ""} />
        </Card>
      </div>
    </>
  );
}
