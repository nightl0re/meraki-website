import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatLongDate, formatMoney, formatShortDate, formatTimeRange } from "@/lib/format";
import { Logo } from "@/components/logo";
import { Card } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: PageProps<"/bookings/[id]/receipt">) {
  const user = await requireUser(["PARENT", "ADMIN"]);
  const { id } = await params;
  const b = await db.booking.findUnique({
    where: { id },
    include: {
      parent: true,
      sitter: true,
      payment: { include: { paymentMethod: true } },
    },
  });
  if (!b || !b.payment || (user.role !== "ADMIN" && b.parentId !== user.id)) notFound();
  const p = b.payment;
  if (p.capturedCents === 0) notFound();

  const net = p.capturedCents - p.refundedCents;
  const lateFeeOnly = b.status === "CANCELLED";

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/bookings/${b.id}`} className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
          <ArrowLeft size={16} aria-hidden /> Back to booking
        </Link>
        <PrintButton />
      </div>
      <Card className="p-8 print:border-0 print:shadow-none">
        <div className="flex items-start justify-between">
          <Logo />
          <div className="text-right text-sm">
            <p className="font-semibold">Receipt</p>
            <p className="font-mono text-ink-3">{b.code}</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-ink-3">Billed to</p>
            <p className="mt-1 font-medium">{b.parent.firstName} {b.parent.lastName}</p>
            <p className="text-ink-2">{b.parent.email}</p>
          </div>
          <div>
            <p className="text-ink-3">Paid on</p>
            <p className="mt-1 font-medium">{p.capturedAt ? formatShortDate(p.capturedAt) : "-"}</p>
            <p className="text-ink-2">{p.paymentMethod.brand} ending {p.paymentMethod.last4}</p>
          </div>
        </div>
        <div className="mt-8 border-t border-line pt-6 text-sm">
          <p className="font-medium">
            {lateFeeOnly ? "Late cancellation" : "Babysitting"} with {b.sitter.firstName} {b.sitter.lastName}
          </p>
          <p className="text-ink-3">{formatLongDate(b.startsAt)}, {formatTimeRange(b.startsAt, b.endsAt)}</p>
          <dl className="mt-5 space-y-2.5 tabular">
            {lateFeeOnly ? (
              <Row label="Late-cancellation fee" value={formatMoney(p.capturedCents)} />
            ) : p.capturedCents === b.totalCents ? (
              <>
                <Row label={`${formatMoney(b.hourlyRateCents)} x ${Number(b.hours)} hours`} value={formatMoney(b.subtotalCents)} />
                <Row label="Service fee" value={formatMoney(b.serviceFeeCents)} />
              </>
            ) : (
              <Row label="Amount charged after review" value={formatMoney(p.capturedCents)} />
            )}
            {p.refundedCents > 0 && <Row label="Refunded" value={`-${formatMoney(p.refundedCents)}`} />}
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
              <dt>Total paid</dt>
              <dd>{formatMoney(net)}</dd>
            </div>
          </dl>
        </div>
        <p className="mt-8 text-xs text-ink-3">Payment reference {p.providerRef}. Payments in this build are simulated.</p>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-2">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
