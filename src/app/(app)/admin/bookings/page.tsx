import type { Metadata } from "next";
import Link from "next/link";
import type { BookingStatus as Status, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { RefundForm } from "@/components/admin-forms";
import { BookingStatus, Card, Input, PageHeader, Select, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "All bookings" };

const STATUSES: Status[] = ["REQUESTED", "ACCEPTED", "COMPLETED", "DISPUTED", "CANCELLED", "DECLINED", "EXPIRED"];

export default async function AdminBookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = STATUSES.find((s) => s === sp.status);

  const where: Prisma.BookingWhereInput = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { code: { contains: q.toUpperCase() } },
      { parent: { OR: [{ lastName: { contains: q } }, { email: { contains: q } }] } },
      { sitter: { OR: [{ lastName: { contains: q } }, { firstName: { contains: q } }] } },
    ];
  }

  const bookings = await db.booking.findMany({
    where,
    orderBy: { startsAt: "desc" },
    take: 100,
    include: {
      parent: { select: { firstName: true, lastName: true } },
      sitter: { select: { firstName: true, lastName: true } },
      payment: true,
    },
  });

  return (
    <>
      <PageHeader title="Bookings" />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">Search</label>
        <Input id="q" name="q" defaultValue={q} placeholder="Code, name or email" className="h-10 max-w-xs" />
        <label htmlFor="status" className="sr-only">Status</label>
        <Select id="status" name="status" defaultValue={status ?? ""} className="h-10 w-44">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </Select>
        <button className={buttonClass("secondary")}>Filter</button>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-3">
              <th className="px-4 py-3 font-medium">Booking</th>
              <th className="px-4 py-3 font-medium">Parent / sitter</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Refund</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {bookings.map((b) => {
              const refundable = b.payment ? b.payment.capturedCents - b.payment.refundedCents : 0;
              return (
                <tr key={b.id} className="align-middle">
                  <td className="px-4 py-3">
                    <Link href={`/bookings/${b.id}`} className="font-mono text-xs hover:underline">{b.code}</Link>
                    <p className="text-ink-3">{formatDate(b.startsAt)}</p>
                  </td>
                  <td className="px-4 py-3">
                    {b.parent.firstName} {b.parent.lastName}
                    <p className="text-ink-3">{b.sitter.firstName} {b.sitter.lastName}</p>
                  </td>
                  <td className="px-4 py-3"><BookingStatus status={b.status} ended={b.endsAt <= new Date()} /></td>
                  <td className="px-4 py-3 text-ink-2">
                    {b.payment ? b.payment.status.toLowerCase().replace("_", " ") : "-"}
                    {b.payment && b.payment.refundedCents > 0 && <p className="text-xs text-ink-3">refunded {formatMoney(b.payment.refundedCents)}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular">{formatMoney(b.totalCents)}</td>
                  <td className="px-4 py-3">{refundable > 0 ? <RefundForm bookingId={b.id} maxCents={refundable} /> : <span className="text-ink-3">-</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {bookings.length === 0 && <p className="p-6 text-center text-ink-3">No bookings match.</p>}
      </Card>
    </>
  );
}
