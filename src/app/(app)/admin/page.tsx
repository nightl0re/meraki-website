import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatMoney, timeAgo } from "@/lib/format";
import { zonedParts, zonedToUtc } from "@/lib/time";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverview() {
  await requireUser(["ADMIN"]);
  const now = new Date();
  const p = zonedParts(now);
  const monthStart = zonedToUtc(`${p.year}-${String(p.month).padStart(2, "0")}-01`, "00:00")!;

  const [captured, bookingsMonth, pendingSitters, disputes, pendingPayouts, parents, sitters, log, byMonth, toApprove] = await Promise.all([
    db.payment.aggregate({
      where: { capturedAt: { gte: monthStart } },
      _sum: { capturedCents: true, refundedCents: true },
    }),
    db.booking.groupBy({ by: ["status"], where: { createdAt: { gte: monthStart } }, _count: true }),
    db.user.count({ where: { role: "SITTER", status: "PENDING_REVIEW", sitterProfile: { submittedAt: { not: null } } } }),
    db.booking.count({ where: { status: "DISPUTED" } }),
    db.payout.aggregate({ where: { status: "PENDING" }, _sum: { amountCents: true } }),
    db.user.count({ where: { role: "PARENT" } }),
    db.user.count({ where: { role: "SITTER", status: "ACTIVE" } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { actor: { select: { firstName: true, role: true } } } }),
    db.payment.findMany({
      where: { capturedAt: { gte: new Date(now.getTime() - 183 * 86_400_000) } },
      select: { capturedAt: true, capturedCents: true, refundedCents: true, booking: { select: { status: true, totalCents: true, serviceFeeCents: true } } },
    }),
    db.booking.aggregate({ where: { status: "AWAITING_PAYMENT" }, _count: true, _sum: { totalCents: true } }),
  ]);

  const gmv = (captured._sum.capturedCents ?? 0) - (captured._sum.refundedCents ?? 0);
  const totalBookings = bookingsMonth.reduce((n, r) => n + r._count, 0);
  // Bucket by calendar month in the app time zone (same as the stat above).
  const buckets = new Map<string, { gmv: number; fees: number }>();
  for (const pay of byMonth) {
    const z = zonedParts(pay.capturedAt!);
    const ym = `${z.year}-${String(z.month).padStart(2, "0")}`;
    const m = buckets.get(ym) ?? { gmv: 0, fees: 0 };
    m.gmv += pay.capturedCents - pay.refundedCents;
    if (pay.capturedCents === pay.booking.totalCents) m.fees += pay.booking.serviceFeeCents;
    buckets.set(ym, m);
  }
  const months = [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([ym, v]) => ({ ym, ...v }));
  const max = Math.max(1, ...months.map((m) => m.gmv));

  return (
    <>
      <PageHeader title="Overview" description="This month at a glance." />
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
        <Stat label="Charged this month" value={formatMoney(gmv)} />
        <Stat label="Bookings this month" value={String(totalBookings)} />
        <Stat label="Owed to sitters" value={formatMoney(pendingPayouts._sum.amountCents ?? 0)} href="/admin/payouts" />
        <Stat label="Parents / active sitters" value={`${parents} / ${sitters}`} />
      </dl>

      {(pendingSitters > 0 || disputes > 0 || toApprove._count > 0) && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {toApprove._count > 0 && (
            <Link href="/admin/payments" className="rounded-2xl border border-info/25 bg-info-soft p-5 hover:border-info/50">
              <p className="text-2xl font-bold text-info tabular">{toApprove._count}</p>
              <p className="text-sm text-ink-2">{toApprove._count === 1 ? "payment" : "payments"} ready to approve ({formatMoney(toApprove._sum.totalCents ?? 0)})</p>
            </Link>
          )}
          {pendingSitters > 0 && (
            <Link href="/admin/sitters" className="rounded-2xl border border-warn/25 bg-warn-soft p-5 hover:border-warn/50">
              <p className="text-2xl font-bold text-warn tabular">{pendingSitters}</p>
              <p className="text-sm text-ink-2">sitter {pendingSitters === 1 ? "profile" : "profiles"} waiting for review</p>
            </Link>
          )}
          {disputes > 0 && (
            <Link href="/admin/disputes" className="rounded-2xl border border-danger/25 bg-danger-soft p-5 hover:border-danger/50">
              <p className="text-2xl font-bold text-danger tabular">{disputes}</p>
              <p className="text-sm text-ink-2">open {disputes === 1 ? "dispute" : "disputes"} with payment on hold</p>
            </Link>
          )}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[1.2fr_1fr]">
        <Card className="p-6">
          <h2 className="font-semibold">Charged per month</h2>
          <p className="text-sm text-ink-3">Net of refunds. Darker part is Meraki&apos;s service fee.</p>
          {months.length === 0 ? (
            <p className="mt-6 text-sm text-ink-3">No payments yet.</p>
          ) : (
            <ul className="mt-6 space-y-3">
              {months.map((m) => (
                <li key={m.ym} className="grid grid-cols-[64px_1fr_90px] items-center gap-3 text-sm">
                  <span className="text-ink-3 tabular">{m.ym}</span>
                  <span className="flex h-3 overflow-hidden rounded-full" style={{ width: `${(m.gmv / max) * 100}%` }}>
                    <span className="bg-brand/45" style={{ width: `${m.gmv ? ((m.gmv - m.fees) / m.gmv) * 100 : 0}%` }} />
                    <span className="flex-1 bg-accent" />
                  </span>
                  <span className="text-right font-medium tabular">{formatMoney(m.gmv)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold">Recent activity</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {log.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span>
                  <span className="font-medium">{l.actor?.firstName ?? "System"}</span>{" "}
                  <span className="text-ink-2">{l.action.replace(".", " ")}</span>
                  {l.detail && <span className="text-ink-3"> ({l.detail})</span>}
                </span>
                <span className="shrink-0 text-xs text-ink-3">{timeAgo(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const inner = (
    <>
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tracking-tight tabular">{value}</dd>
    </>
  );
  return href ? (
    <Link href={href} className="block bg-surface p-5 hover:bg-surface-2">{inner}</Link>
  ) : (
    <div className="bg-surface p-5">{inner}</div>
  );
}
