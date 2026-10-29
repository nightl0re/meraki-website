import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney, formatShortDate } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Earnings" };

export default async function EarningsPage() {
  const user = await requireUser(["SITTER"]);
  const [payouts, pending, paid] = await Promise.all([
    db.payout.findMany({
      where: { sitterId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { booking: { select: { id: true, code: true, startsAt: true, hours: true, parent: { select: { lastName: true } } } } },
    }),
    db.payout.aggregate({ where: { sitterId: user.id, status: "PENDING" }, _sum: { amountCents: true } }),
    db.payout.aggregate({ where: { sitterId: user.id, status: "PAID" }, _sum: { amountCents: true } }),
  ]);

  return (
    <>
      <PageHeader title="Earnings" description="You keep 100% of your hourly rate. Payouts are sent every Monday." />
      <dl className="mb-8 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
        <div className="bg-accent-soft p-6">
          <dt className="text-sm text-ink-2">In your next payout</dt>
          <dd className="mt-1 text-3xl font-bold tabular">{formatMoney(pending._sum.amountCents ?? 0)}</dd>
        </div>
        <div className="bg-surface p-6">
          <dt className="text-sm text-ink-2">Paid out so far</dt>
          <dd className="mt-1 text-3xl font-bold tabular">{formatMoney(paid._sum.amountCents ?? 0)}</dd>
        </div>
      </dl>
      {payouts.length === 0 ? (
        <EmptyState icon={<Wallet size={32} />} title="No earnings yet" body="When a job you marked completed is confirmed and approved, your pay appears here." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                <th className="px-5 py-3 font-medium">Job</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3">
                    <Link href={`/bookings/${p.booking.id}`} className="hover:underline">{p.booking.parent.lastName} family</Link>
                    <span className="ml-2 font-mono text-xs text-ink-3">{p.booking.code}</span>
                  </td>
                  <td className="px-5 py-3 text-ink-2">{formatDate(p.booking.startsAt)}</td>
                  <td className="px-5 py-3">
                    {p.status === "PAID"
                      ? <Badge tone="info">Paid {p.paidAt ? formatShortDate(p.paidAt) : ""}</Badge>
                      : p.status === "PENDING" ? <Badge tone="warn">Pending</Badge> : <Badge>Cancelled</Badge>}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold tabular">{formatMoney(p.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
