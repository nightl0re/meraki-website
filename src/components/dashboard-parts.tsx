import Link from "next/link";
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { formatTime, timeAgo, WEEKDAYS } from "@/lib/format";
import { zonedParts } from "@/lib/time";
import { cn } from "./ui";

export function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-surface p-5 shadow-card", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="text-sm font-semibold text-accent-strong hover:underline">{children}</Link>;
}

export async function NotificationsPanel({ userId }: { userId: string }) {
  const items = await db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5 });
  return (
    <Panel title="Notifications" action={<PanelLink href="/notifications">View all</PanelLink>}>
      {items.length === 0 ? (
        <p className="text-sm text-ink-3">You&apos;re all caught up.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id}>
              <Link href={n.href || "/notifications"} className="flex gap-2.5 rounded-lg p-1 hover:bg-surface-2">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-line-strong" : "bg-brand")} aria-hidden />
                <span className="min-w-0">
                  <span className={cn("block text-sm", !n.readAt && "font-semibold")}>{n.title}</span>
                  <span className="block truncate text-xs text-ink-3">{n.body}</span>
                  <span className="block text-xs text-ink-3">{timeAgo(n.createdAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function StatTile({ label, value, hint, tone = "plain" }: { label: string; value: string; hint?: string; tone?: "plain" | "peach" | "teal" | "sun" }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        tone === "plain" && "border-line bg-surface",
        tone === "peach" && "border-brand/20 bg-accent-soft",
        tone === "teal" && "border-info/15 bg-info-soft",
        tone === "sun" && "border-warn/15 bg-warn-soft",
      )}
    >
      <p className="text-sm text-ink-2">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

// Month grid with booked days highlighted, like the desktop app's schedule.
export function MonthCalendar({
  year,
  month,
  events,
  today,
}: {
  year: number;
  month: number; // 1-12
  events: { id: string; startsAt: Date; label: string; status: string }[];
  today: { year: number; month: number; day: number };
}) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const byDay = new Map<number, typeof events>();
  for (const e of events) {
    const p = zonedParts(e.startsAt);
    if (p.year === year && p.month === month) byDay.set(p.day, [...(byDay.get(p.day) ?? []), e]);
  }
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthName = first.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-ink-2">{monthName}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-3">
        {WEEKDAYS.map((d) => <span key={d} className="py-1">{d.slice(0, 2)}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const ev = byDay.get(d) ?? [];
          const isToday = today.year === year && today.month === month && today.day === d;
          const inner = (
            <>
              <span className={cn("text-sm tabular", isToday && "font-bold text-accent-strong")}>{d}</span>
              {ev.length > 0 && (
                <span className="mt-0.5 flex justify-center gap-0.5">
                  {ev.slice(0, 3).map((e) => (
                    <span key={e.id} className={cn("size-1.5 rounded-full", e.status === "REQUESTED" ? "bg-sun" : e.status === "COMPLETED" ? "bg-line-strong" : "bg-brand")} />
                  ))}
                </span>
              )}
            </>
          );
          const base = cn(
            "flex aspect-square flex-col items-center justify-center rounded-lg",
            ev.length ? "bg-accent-soft hover:bg-brand/20" : "hover:bg-surface-2",
            isToday && "ring-2 ring-brand/50",
          );
          return ev.length ? (
            <Link key={d} href={`/bookings/${ev[0].id}`} className={base} title={ev.map((e) => `${formatTime(e.startsAt)} ${e.label}`).join("\n")}>
              {inner}
            </Link>
          ) : (
            <span key={d} className={base}>{inner}</span>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-3">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand" />Confirmed</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-sun" />Request</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-line-strong" />Completed</span>
      </div>
    </div>
  );
}
