import { CheckCircle, Circle, WarningCircle, XCircle } from "@phosphor-icons/react/ssr";
import type { Booking, Payment } from "@prisma/client";
import { formatMoney, formatShortDate, formatTime } from "@/lib/format";
import { cn } from "./ui";

type B = Pick<
  Booking,
  "status" | "createdAt" | "respondedAt" | "sitterDoneAt" | "confirmedAt" | "paymentApprovedAt" | "cancelledAt" | "totalCents"
> & { payment: Pick<Payment, "status" | "capturedCents"> | null };

const at = (d: Date | null) => (d ? `${formatShortDate(d)}, ${formatTime(d)}` : "");

// The five steps of a booking, with when each happened. Shown to the parent,
// the sitter and admins on the booking page.
export function BookingTimeline({ b }: { b: B }) {
  const stopped = ["DECLINED", "EXPIRED", "CANCELLED"].includes(b.status);
  const steps = [
    { label: "Booked by parent", detail: `Card held for ${formatMoney(b.totalCents)}`, when: b.createdAt },
    { label: "Accepted by sitter", when: b.respondedAt && b.status !== "DECLINED" ? b.respondedAt : null },
    { label: "Marked completed by sitter", when: b.sitterDoneAt },
    { label: "Confirmed by parent", when: b.confirmedAt },
    {
      label: "Payment approved by Meraki",
      detail: b.payment?.status === "CAPTURED" || b.payment?.status?.includes("REFUNDED") ? `Charged ${formatMoney(b.payment.capturedCents)}` : undefined,
      when: b.paymentApprovedAt,
    },
  ];
  // The first step without a date is the current one.
  const current = steps.findIndex((s) => !s.when);

  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const done = !!s.when;
        const isCurrent = i === current && !stopped && b.status !== "DISPUTED";
        return (
          <li key={s.label} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 && <span className={cn("absolute left-[11px] top-6 h-[calc(100%-18px)] w-0.5", done ? "bg-info/40" : "bg-line")} aria-hidden />}
            <span className="relative z-10 mt-0.5 bg-surface">
              {done ? <CheckCircle size={24} weight="fill" className="text-info" aria-hidden />
                : isCurrent ? <Circle size={24} weight="duotone" className="text-brand" aria-hidden />
                : <Circle size={24} className="text-line-strong" aria-hidden />}
            </span>
            <div>
              <p className={cn("font-medium", !done && !isCurrent && "text-ink-3")}>
                {s.label}
                {isCurrent && <span className="ml-2 text-xs font-semibold text-brand">Next</span>}
              </p>
              {done && <p className="text-sm text-ink-3">{at(s.when)}{s.detail && `. ${s.detail}`}</p>}
            </div>
          </li>
        );
      })}
      {b.status === "DISPUTED" && (
        <li className="mt-4 flex items-center gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger">
          <WarningCircle size={20} weight="fill" aria-hidden /> Problem reported. Payment paused until an admin decides.
        </li>
      )}
      {stopped && (
        <li className="mt-4 flex items-center gap-2 rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
          <XCircle size={20} aria-hidden />
          {b.status === "DECLINED" ? "Declined by the sitter." : b.status === "EXPIRED" ? "Expired: the sitter didn't answer in time." : `Cancelled${b.cancelledAt ? ` ${at(b.cancelledAt)}` : ""}.`}
        </li>
      )}
    </ol>
  );
}
