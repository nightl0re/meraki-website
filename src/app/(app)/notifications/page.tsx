import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { Card, EmptyState, PageHeader, cn } from "@/components/ui";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const unread = items.some((n) => !n.readAt);
  // Opening the page counts as reading them; this render still highlights what was new.
  if (unread) await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
      />
      {items.length === 0 ? (
        <EmptyState icon={<Bell size={32} />} title="No notifications yet" body="Booking updates, messages and payment receipts show up here." />
      ) : (
        <Card className="divide-y divide-line">
          {items.map((n) => {
            const body = (
              <>
                <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={cn(!n.readAt && "font-semibold")}>{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-ink-2">{n.body}</p>}
                </div>
                <time className="shrink-0 text-xs text-ink-3" dateTime={n.createdAt.toISOString()}>{timeAgo(n.createdAt)}</time>
              </>
            );
            return n.href ? (
              <Link key={n.id} href={n.href} className="flex gap-3 px-5 py-4 hover:bg-surface-2">{body}</Link>
            ) : (
              <div key={n.id} className="flex gap-3 px-5 py-4">{body}</div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
