import "server-only";
import { db } from "./db";

export type Point = { lat: number; lng: number };

export function distanceKm(a: Point, b: Point) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Rectangle around a point, used to pre-filter rows with an index before the
// exact distance check.
export function boundingBox(p: Point, km: number) {
  const dLat = km / 111.32;
  const dLng = km / (111.32 * Math.max(0.01, Math.cos((p.lat * Math.PI) / 180)));
  return { minLat: p.lat - dLat, maxLat: p.lat + dLat, minLng: p.lng - dLng, maxLng: p.lng + dLng };
}

export function formatDistance(km: number) {
  if (km < 1) return "Under 1 km away";
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

const normalise = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 191);

// Address / postcode / neighborhood -> coordinates.
// Uses OpenStreetMap Nominatim (free, ~1 req/s, needs an identifying
// User-Agent). Results, including misses, are cached in the database.
export async function geocode(query: string): Promise<(Point & { label: string }) | null> {
  const key = normalise(query);
  if (key.length < 2) return null;

  const cached = await db.geocodeCache.findUnique({ where: { query: key } });
  if (cached) {
    return cached.latitude != null && cached.longitude != null
      ? { lat: cached.latitude, lng: cached.longitude, label: cached.label }
      : null;
  }

  // A neighborhood that sitters already use resolves without a network call.
  const area = await areaCentre(query);
  if (area) return area;

  const bias = process.env.GEOCODER_COUNTRY ? `&countrycodes=${process.env.GEOCODER_COUNTRY}` : "";
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1${bias}&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": process.env.GEOCODER_USER_AGENT ?? "Meraki/1.0 (babysitting marketplace)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null; // don't cache server errors
    const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    const hit = rows[0];
    const label = hit ? shortLabel(hit.display_name) : query;
    await db.geocodeCache.upsert({
      where: { query: key },
      update: {},
      create: {
        query: key,
        label,
        latitude: hit ? Number(hit.lat) : null,
        longitude: hit ? Number(hit.lon) : null,
      },
    });
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), label } : null;
  } catch {
    return null; // offline or timed out: caller shows a friendly message
  }
}

function shortLabel(displayName: string) {
  return displayName.split(",").slice(0, 3).join(",").trim();
}

// Neighborhoods with at least one bookable sitter, with a centre point.
export async function listAreas() {
  const rows = await db.user.groupBy({
    by: ["area", "city"],
    where: {
      role: "SITTER",
      status: "ACTIVE",
      area: { not: "" },
      latitude: { not: null },
      sitterProfile: { verifiedAt: { not: null } },
    },
    _avg: { latitude: true, longitude: true },
    _count: true,
    orderBy: { area: "asc" },
  });
  return rows.map((r) => ({
    area: r.area,
    city: r.city,
    count: r._count,
    lat: r._avg.latitude ?? 0,
    lng: r._avg.longitude ?? 0,
  }));
}

async function areaCentre(query: string) {
  const name = query.trim().split(",")[0].trim();
  const agg = await db.user.aggregate({
    where: { role: "SITTER", area: { equals: name, mode: "insensitive" }, latitude: { not: null } },
    _avg: { latitude: true, longitude: true },
  });
  if (agg._avg.latitude == null || agg._avg.longitude == null) return null;
  return { lat: agg._avg.latitude, lng: agg._avg.longitude, label: name };
}
