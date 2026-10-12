import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { toDateInput } from "@/lib/time";
import { BookingForm } from "@/components/booking-form";
import { CardForm } from "@/components/card-form";
import { Avatar, Card, Rating } from "@/components/ui";

export const metadata: Metadata = { title: "Request a booking" };

export default async function BookPage({ params, searchParams }: PageProps<"/book/[sitterId]">) {
  const user = await requireUser(["PARENT"]);
  const { sitterId } = await params;
  const sp = await searchParams;

  const sitter = await db.user.findFirst({
    where: { id: sitterId, role: "SITTER", status: "ACTIVE", sitterProfile: { verifiedAt: { not: null } } },
    select: {
      id: true, firstName: true, lastName: true, avatarUrl: true, area: true,
      sitterProfile: { include: { availability: true } },
    },
  });
  if (!sitter?.sitterProfile) notFound();

  const [cards, profile] = await Promise.all([
    db.paymentMethod.findMany({
      where: { userId: user.id, removedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
    db.parentProfile.findUnique({ where: { userId: user.id } }),
  ]);

  const p = sitter.sitterProfile;
  const now = new Date();
  const minDate = toDateInput(new Date(now.getTime() + config.minLeadTimeHours * 3_600_000));
  const maxDate = toDateInput(new Date(now.getTime() + config.maxDaysAhead * 86_400_000));

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/sitters/${sitter.id}`} className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Back to profile
      </Link>

      <div className="mt-4 flex items-center gap-4">
        <Avatar src={sitter.avatarUrl} first={sitter.firstName} last={sitter.lastName} size={56} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Book {sitter.firstName}</h1>
          <p className="flex items-center gap-3 text-sm text-ink-3">
            {sitter.area} <Rating avg={p.ratingAvg} count={p.ratingCount} />
          </p>
        </div>
      </div>

      {!p.acceptingBookings ? (
        <Card className="mt-8 p-6">
          <p>{sitter.firstName} isn&apos;t taking new bookings right now. Try saving them and checking back later.</p>
        </Card>
      ) : cards.length === 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-lg font-semibold">First, add a card</h2>
            <p className="mt-2 text-ink-2">
              When you request a booking we place a temporary hold on your card. You&apos;re only charged once the job is done
              and you&apos;ve confirmed it went well.
            </p>
          </div>
          <Card className="p-6"><CardForm /></Card>
        </div>
      ) : (
        <BookingForm
          sitter={{
            id: sitter.id,
            firstName: sitter.firstName,
            rateCents: p.hourlyRateCents,
            maxChildren: p.maxChildren,
            availability: p.availability.map((a) => ({ weekday: a.weekday, start: a.startMinute, end: a.endMinute })),
          }}
          cards={cards.map((c) => ({ id: c.id, label: `${c.brand} ending ${c.last4}`, exp: `${String(c.expMonth).padStart(2, "0")}/${String(c.expYear).slice(-2)}`, isDefault: c.isDefault }))}
          defaults={{
            date: typeof sp.date === "string" ? sp.date : "",
            address: profile?.address ?? "",
            childrenCount: Math.min(profile?.childrenCount ?? 1, p.maxChildren),
          }}
          limits={{ minDate, maxDate, freeCancelHours: config.freeCancelHours, responseHours: config.sitterResponseHours }}
        />
      )}
    </div>
  );
}
