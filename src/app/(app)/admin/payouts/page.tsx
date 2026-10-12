import type { Metadata } from "next";
import { Wallet } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatMoney, formatShortDate } from "@/lib/format";
import { runPayouts } from "@/app/actions/admin";
import { Avatar, Card, EmptyState, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = { title: "Payouts" };

export default async function PayoutsPage() {
  await requireUser(["ADMIN"]);
  const [pending, recent] = await Promise.all([
    db.payout.groupBy({ by: ["sitterId"], where: { status: "PENDING" }, _sum: { amountCents: true }, _count: true }),
    db.payout.findMany({
      where: { status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: 15,
      include: { sitter: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  const sitters = await db.user.findMany({
    where: { id: { in: pending.map((p) => p.sitterId) } },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });
  const total = pending.reduce((n, p) => n + (p._sum.amountCents ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Payouts"
        description="Money from confirmed jobs, owed to sitters. Sitters receive 100% of their rate."
        actions={pending.length > 0 ? (
          <form action={runPayouts}><SubmitButton pendingText="Sending">Send {formatMoney(total)}</SubmitButton></form>
        ) : undefined}
      />
      {pending.length === 0 ? (
        <EmptyState icon={<Wallet size={32} />} title="All sitters are paid up" />
      ) : (
        <Card className="divide-y divide-line">
          {pending.map((p) => {
            const s = sitters.find((x) => x.id === p.sitterId)!;
            return (
              <div key={p.sitterId} className="flex items-center gap-4 px-5 py-3.5">
                <Avatar src={s.avatarUrl} first={s.firstName} last={s.lastName} size={36} />
                <p className="flex-1 font-medium">{s.firstName} {s.lastName}</p>
                <p className="text-sm text-ink-3">{p._count} {p._count === 1 ? "job" : "jobs"}</p>
                <p className="w-24 text-right font-semibold tabular">{formatMoney(p._sum.amountCents ?? 0)}</p>
              </div>
            );
          })}
        </Card>
      )}
      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-semibold">Recently paid</h2>
          <Card className="divide-y divide-line text-sm">
            {recent.map((p) => (
              <div key={p.id} className="flex justify-between px-5 py-3">
                <span>{p.sitter.firstName} {p.sitter.lastName}</span>
                <span className="text-ink-3">{p.paidAt ? formatShortDate(p.paidAt) : ""}</span>
                <span className="font-medium tabular">{formatMoney(p.amountCents)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </>
  );
}
