import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/ssr";
import { formatDate, formatMoney, formatTimeRange } from "@/lib/format";
import { Avatar, BookingStatus } from "./ui";

export type BookingRowData = {
  id: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  totalCents: number;
  subtotalCents: number;
  person: { firstName: string; lastName: string; avatarUrl: string | null };
};

export function BookingRow({ b, viewer }: { b: BookingRowData; viewer: "PARENT" | "SITTER" | "ADMIN" }) {
  const ended = b.endsAt <= new Date();
  return (
    <li>
      <Link
        href={`/bookings/${b.id}`}
        className="flex items-center gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-surface-2 sm:px-4"
      >
        <Avatar src={b.person.avatarUrl} first={b.person.firstName} last={b.person.lastName} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {viewer === "SITTER" ? `${b.person.lastName} family` : `${b.person.firstName} ${b.person.lastName.charAt(0)}.`}
          </p>
          <p className="truncate text-sm text-ink-3">
            {formatDate(b.startsAt)}, {formatTimeRange(b.startsAt, b.endsAt)}
          </p>
        </div>
        <div className="hidden sm:block">
          <BookingStatus status={b.status} ended={ended} />
        </div>
        <p className="w-20 text-right text-sm font-medium tabular">
          {formatMoney(viewer === "SITTER" ? b.subtotalCents : b.totalCents)}
        </p>
        <CaretRight size={16} className="text-ink-3" aria-hidden />
      </Link>
    </li>
  );
}
