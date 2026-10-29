import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "@phosphor-icons/react/ssr";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney, formatTimeRange, timeAgo } from "@/lib/format";
import { approvePaymentAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { Avatar, BookingStatus, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Payments to approve" };

const include = {
  parent: { select: { firstName: true, lastName: true, avatarUrl: true } },
  sitter: { select: { firstName: true, lastName: true, avatarUrl: true } },
  payment: { select: { status: true, paymentMethod: { select: { brand: true, last4: true } } } },
} satisfies Prisma.BookingInclude;

export default async function AdminPaymentsPage() {
  await requireUser(["ADMIN"]);
  const now = new Date();
  const [ready, waitingParent, inProgress] = await Promise.all([
    db.booking.findMany({ where: { status: "AWAITING_PAYMENT" }, orderBy: { confirmedAt: "asc" }, include }),
    db.booking.findMany({ where: { status: "AWAITING_CONFIRMATION" }, orderBy: { sitterDoneAt: "asc" }, include }),
    db.booking.findMany({ where: { status: "ACCEPTED", startsAt: { lte: now } }, orderBy: { startsAt: "asc" }, include, take: 50 }),
  ]);
  const total = ready.reduce((n, b) => n + b.totalCents, 0);

  return (
    <>
      <PageHeader
        title="Payments to approve"
        description="A payment is ready once the sitter has marked the job completed and the family has confirmed it. Approving charges the family's card and queues the sitter's payout."
      />

      <section aria-labelledby="ready">
        <h2 id="ready" className="mb-3 font-semibold">
          Ready to approve {ready.length > 0 && <span className="text-ink-3">({ready.length}, {formatMoney(total)})</span>}
        </h2>
        {ready.length === 0 ? (
          <EmptyState icon={<CreditCard size={32} />} title="Nothing to approve" body="Confirmed jobs appear here." />
        ) : (
          <div className="space-y-3">
            {ready.map((b) => (
              <Card key={b.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
                <People b={b} />
                <div className="text-sm text-ink-2 md:w-48">
                  <p>Confirmed by family {b.confirmedAt ? timeAgo(b.confirmedAt) : ""}</p>
                  <p className="text-ink-3">{b.payment?.paymentMethod.brand} ending {b.payment?.paymentMethod.last4}</p>
                </div>
                <div className="text-right md:w-32">
                  <p className="text-lg font-bold tabular">{formatMoney(b.totalCents)}</p>
                  <p className="text-xs text-ink-3 tabular">sitter gets {formatMoney(b.subtotalCents)}</p>
                </div>
                <ActionForm action={approvePaymentAction} hidden={{ bookingId: b.id }} label="Approve payment"
                  confirm={{ title: `Charge ${formatMoney(b.totalCents)}?`, body: `The family's card is charged and ${formatMoney(b.subtotalCents)} is queued for ${b.sitter.firstName}.`, confirmLabel: "Approve and charge" }}
                  pendingText="Charging" />
              </Card>
            ))}
          </div>
        )}
      </section>

      <Section title="Waiting for the family to confirm" hint="The sitter marked these completed. If the family doesn't respond, they're confirmed automatically after 48 hours." rows={waitingParent} />
      <Section title="Waiting for the sitter to mark completed" hint="Accepted bookings that have started." rows={inProgress} />
    </>
  );
}

type Row = Prisma.BookingGetPayload<{ include: typeof include }>;

function People({ b }: { b: Row }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar src={b.parent.avatarUrl} first={b.parent.firstName} last={b.parent.lastName} size={40} />
      <div className="min-w-0">
        <Link href={`/bookings/${b.id}`} className="font-semibold hover:underline">
          {b.parent.firstName} {b.parent.lastName} with {b.sitter.firstName} {b.sitter.lastName}
        </Link>
        <p className="text-sm text-ink-3">
          <span className="font-mono text-xs">{b.code}</span> {formatDate(b.startsAt)}, {formatTimeRange(b.startsAt, b.endsAt)}
        </p>
      </div>
    </div>
  );
}

function Section({ title, hint, rows }: { title: string; hint: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  const now = new Date();
  return (
    <section className="mt-10">
      <h2 className="font-semibold">{title} <span className="text-ink-3">({rows.length})</span></h2>
      <p className="mb-3 text-sm text-ink-3">{hint}</p>
      <Card className="divide-y divide-line">
        {rows.map((b) => (
          <div key={b.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <People b={b} />
            <BookingStatus status={b.status} ended={b.endsAt <= now} />
            <p className="w-24 text-right font-semibold tabular">{formatMoney(b.totalCents)}</p>
          </div>
        ))}
      </Card>
    </section>
  );
}
