import type { Metadata } from "next";
import { CreditCard } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatMoney, formatShortDate } from "@/lib/format";
import { makeDefaultPaymentMethod, removePaymentMethod } from "@/app/actions/parent";
import { CardForm } from "@/components/card-form";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Payment methods" };

export default async function PaymentSettingsPage({ searchParams }: PageProps<"/settings/payment">) {
  const user = await requireUser(["PARENT"]);
  const sp = await searchParams;
  const [cards, history] = await Promise.all([
    db.paymentMethod.findMany({
      where: { userId: user.id, removedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      include: { _count: { select: { payments: { where: { status: "AUTHORIZED" } } } } },
    }),
    db.payment.findMany({
      where: { booking: { parentId: user.id }, capturedCents: { gt: 0 } },
      orderBy: { capturedAt: "desc" },
      take: 10,
      include: { booking: { select: { id: true, code: true, sitter: { select: { firstName: true } } } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Payment methods" description="Cards are tokenized by our payment provider. We never store full card numbers." />
      {sp.error === "in-use" && <div className="mb-6"><Alert>That card is holding money for an open booking, so it can&apos;t be removed yet.</Alert></div>}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_360px]">
        <section className="space-y-3">
          {cards.length === 0 ? (
            <EmptyState icon={<CreditCard size={32} />} title="No cards yet" body="Add a card to start booking." />
          ) : (
            cards.map((c) => (
              <Card key={c.id} className="flex flex-wrap items-center gap-4 p-4">
                <CreditCard size={28} className="text-ink-3" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.brand} ending {c.last4} {c.isDefault && <Badge tone="accent">Default</Badge>}</p>
                  <p className="text-sm text-ink-3 tabular">
                    {c.holderName}, expires {String(c.expMonth).padStart(2, "0")}/{c.expYear}
                    {c._count.payments > 0 && `, holding ${c._count.payments} booking${c._count.payments > 1 ? "s" : ""}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  {!c.isDefault && (
                    <form action={makeDefaultPaymentMethod}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="rounded-full px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2">Make default</button>
                    </form>
                  )}
                  <form action={removePaymentMethod}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="rounded-full px-3 py-1.5 text-sm text-danger hover:bg-danger-soft">Remove</button>
                  </form>
                </div>
              </Card>
            ))
          )}

          {history.length > 0 && (
            <div className="pt-6">
              <h2 className="mb-3 font-semibold">Recent charges</h2>
              <Card className="divide-y divide-line">
                {history.map((p) => (
                  <a key={p.id} href={`/bookings/${p.booking.id}/receipt`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-surface-2">
                    <span>
                      {p.booking.sitter.firstName} <span className="font-mono text-xs text-ink-3">{p.booking.code}</span>
                    </span>
                    <span className="text-ink-3">{p.capturedAt ? formatShortDate(p.capturedAt) : ""}</span>
                    <span className="font-medium tabular">{formatMoney(p.capturedCents - p.refundedCents)}</span>
                  </a>
                ))}
              </Card>
            </div>
          )}
        </section>
        <aside>
          <Card className="p-6">
            <h2 className="mb-5 font-semibold">Add a card</h2>
            <CardForm />
          </Card>
        </aside>
      </div>
    </div>
  );
}
