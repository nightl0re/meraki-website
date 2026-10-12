import type { Metadata } from "next";
import { Heart } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { SitterCard } from "@/components/sitter-card";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Saved sitters" };

export default async function FavoritesPage() {
  const user = await requireUser(["PARENT"]);
  const favorites = await db.favorite.findMany({
    where: { parentId: user.id, sitter: { status: "ACTIVE" } },
    orderBy: { createdAt: "desc" },
    include: {
      sitter: {
        select: {
          id: true, firstName: true, lastName: true, avatarUrl: true, area: true, city: true,
          sitterProfile: {
            select: {
              headline: true, hourlyRateCents: true, experienceYears: true, ratingAvg: true, ratingCount: true,
              completedJobs: true, acceptingBookings: true, serviceRadiusKm: true,
              skills: { select: { skill: { select: { name: true, slug: true } } } },
            },
          },
        },
      },
    },
  });

  return (
    <>
      <PageHeader title="Saved sitters" />
      {favorites.length === 0 ? (
        <EmptyState icon={<Heart size={32} />} title="Nobody saved yet" body="Save sitters you like so you can rebook them quickly." action={<LinkButton href="/sitters">Find a sitter</LinkButton>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {favorites.map(({ sitter: s }) => (
            <SitterCard
              key={s.id}
              s={{
                id: s.id, firstName: s.firstName, lastName: s.lastName, avatarUrl: s.avatarUrl, area: s.area, city: s.city,
                distanceKm: null, ...s.sitterProfile!, skills: s.sitterProfile!.skills.map((x) => x.skill),
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
