import Link from "next/link";
import { MapPin, SealCheck } from "@phosphor-icons/react/ssr";
import { formatRate } from "@/lib/format";
import { formatDistance } from "@/lib/geo";
import type { SitterCard as SitterCardData } from "@/lib/sitters";
import { Avatar, Badge, Rating } from "./ui";

export function SitterCard({ s }: { s: SitterCardData }) {
  return (
    <Link
      href={`/sitters/${s.id}`}
      className="group flex flex-col rounded-xl border border-line bg-surface p-5 shadow-card transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong"
    >
      <div className="flex items-start gap-4">
        <Avatar src={s.avatarUrl} first={s.firstName} last={s.lastName} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-semibold">
              {s.firstName} {s.lastName.charAt(0)}.
            </p>
            <SealCheck size={16} weight="fill" className="shrink-0 text-info" aria-label="Verified" />
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-3">
            <MapPin size={14} aria-hidden />
            <span className="truncate">
              {s.distanceKm != null ? `${formatDistance(s.distanceKm)}, ${s.area}` : s.area || s.city}
            </span>
          </p>
          <div className="mt-1.5">
            <Rating avg={s.ratingAvg} count={s.ratingCount} />
          </div>
        </div>
        <p className="text-right font-semibold tabular">{formatRate(s.hourlyRateCents)}</p>
      </div>
      <p className="mt-4 line-clamp-2 text-sm text-ink-2">{s.headline}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {s.skills.slice(0, 3).map((k) => (
          <Badge key={k.slug}>{k.name}</Badge>
        ))}
        {!s.acceptingBookings && <Badge tone="warn">Not taking bookings</Badge>}
      </div>
    </Link>
  );
}
