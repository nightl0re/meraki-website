import type { Metadata } from "next";
import Link from "next/link";
import { Scales } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { formatLongDate, formatMoney, formatTimeRange, timeAgo } from "@/lib/format";
import { ResolveDisputeForm } from "@/components/admin-forms";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Disputes" };

export default async function DisputesPage() {
  await requireUser(["ADMIN"]);
  const disputes = await db.booking.findMany({
    where: { status: "DISPUTED" },
    orderBy: { updatedAt: "asc" },
    include: {
      parent: { select: { firstName: true, lastName: true, email: true, phone: true } },
      sitter: { select: { firstName: true, lastName: true, email: true, phone: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 3, include: { sender: { select: { firstName: true } } } },
    },
  });

  return (
    <>
      <PageHeader title="Disputes" description="The parent's card is still on hold. Decide how much, if any, to refund." />
      {disputes.length === 0 ? (
        <EmptyState icon={<Scales size={32} />} title="No open disputes" />
      ) : (
        <div className="space-y-4">
          {disputes.map((b) => (
            <Card key={b.id} className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr_340px]">
              <div>
                <Link href={`/bookings/${b.id}`} className="font-mono text-xs text-ink-3 hover:underline">{b.code}</Link>
                <h2 className="mt-1 text-lg font-semibold">{b.parent.firstName} {b.parent.lastName} vs {b.sitter.firstName} {b.sitter.lastName}</h2>
                <p className="text-sm text-ink-3">{formatLongDate(b.startsAt)}, {formatTimeRange(b.startsAt, b.endsAt)}. Total {formatMoney(b.totalCents)} (sitter {formatMoney(b.subtotalCents)}).</p>
                <blockquote className="mt-4 rounded-xl bg-danger-soft p-4 text-ink">“{b.disputeReason}”</blockquote>
                <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-ink-3">Parent</dt><dd>{b.parent.email}{b.parent.phone && `, ${b.parent.phone}`}</dd></div>
                  <div><dt className="text-ink-3">Sitter</dt><dd>{b.sitter.email}{b.sitter.phone && `, ${b.sitter.phone}`}</dd></div>
                </dl>
                {b.messages.length > 0 && (
                  <div className="mt-4 text-sm">
                    <p className="text-ink-3">Latest messages</p>
                    <ul className="mt-1 space-y-1">
                      {b.messages.map((m) => <li key={m.id}><span className="font-medium">{m.sender.firstName}:</span> {m.body} <span className="text-xs text-ink-3">{timeAgo(m.createdAt)}</span></li>)}
                    </ul>
                  </div>
                )}
              </div>
              <ResolveDisputeForm bookingId={b.id} totalCents={b.totalCents} currency={config.currency} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
