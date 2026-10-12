import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { boundingBox, distanceKm, type Point } from "./geo";

export type SitterSearch = {
  near?: Point;
  radiusKm?: number;
  area?: string;
  skill?: string;
  maxRateCents?: number;
  minRating?: number;
  weekday?: number;
  sort?: "distance" | "rating" | "price_asc" | "price_desc";
};

export const bookableSitter: Prisma.UserWhereInput = {
  role: "SITTER",
  status: "ACTIVE",
  sitterProfile: { verifiedAt: { not: null } },
};

export async function searchSitters(s: SitterSearch) {
  const radius = s.radiusKm ?? 10;
  const profile: Prisma.SitterProfileWhereInput = { verifiedAt: { not: null } };
  if (s.maxRateCents) profile.hourlyRateCents = { lte: s.maxRateCents };
  if (s.minRating) profile.ratingAvg = { gte: s.minRating };
  if (s.skill) profile.skills = { some: { skill: { slug: s.skill } } };
  if (s.weekday != null) profile.availability = { some: { weekday: s.weekday } };

  const where: Prisma.UserWhereInput = { role: "SITTER", status: "ACTIVE", sitterProfile: profile };
  if (s.area) where.area = s.area;
  if (s.near) {
    const box = boundingBox(s.near, radius);
    where.latitude = { gte: box.minLat, lte: box.maxLat };
    where.longitude = { gte: box.minLng, lte: box.maxLng };
  }

  const rows = await db.user.findMany({
    where,
    take: 200,
    select: {
      id: true, firstName: true, lastName: true, avatarUrl: true, city: true, area: true,
      latitude: true, longitude: true,
      sitterProfile: {
        select: {
          headline: true, hourlyRateCents: true, experienceYears: true, ratingAvg: true,
          ratingCount: true, completedJobs: true, serviceRadiusKm: true, acceptingBookings: true,
          skills: { select: { skill: { select: { name: true, slug: true } } } },
        },
      },
    },
  });

  let results = rows.map((r) => {
    const p = r.sitterProfile!;
    const km =
      s.near && r.latitude != null && r.longitude != null
        ? distanceKm(s.near, { lat: r.latitude, lng: r.longitude })
        : null;
    return {
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      avatarUrl: r.avatarUrl,
      area: r.area,
      city: r.city,
      distanceKm: km,
      headline: p.headline,
      hourlyRateCents: p.hourlyRateCents,
      experienceYears: p.experienceYears,
      ratingAvg: p.ratingAvg,
      ratingCount: p.ratingCount,
      completedJobs: p.completedJobs,
      acceptingBookings: p.acceptingBookings,
      serviceRadiusKm: p.serviceRadiusKm,
      skills: p.skills.map((x) => x.skill),
    };
  });

  // Inside the parent's search radius AND within the distance the sitter travels.
  if (s.near) {
    results = results.filter((r) => r.distanceKm != null && r.distanceKm <= radius && r.distanceKm <= r.serviceRadiusKm);
  }

  const sort = s.sort ?? (s.near ? "distance" : "rating");
  results.sort((a, b) => {
    if (sort === "distance") return (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9);
    if (sort === "price_asc") return a.hourlyRateCents - b.hourlyRateCents;
    if (sort === "price_desc") return b.hourlyRateCents - a.hourlyRateCents;
    // rating: weight by number of reviews so one 5-star review doesn't top the list
    const score = (x: typeof a) => (x.ratingAvg * x.ratingCount + 4 * 3) / (x.ratingCount + 3);
    return score(b) - score(a);
  });

  return results.slice(0, 60);
}

export type SitterCard = Awaited<ReturnType<typeof searchSitters>>[number];
