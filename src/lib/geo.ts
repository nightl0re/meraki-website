import "server-only";
import { db } from "./db";
import { lookupMalaysianPlace } from "./places-my";

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
  if (cached?.latitude != null && cached.longitude != null) {
    return { lat: cached.latitude, lng: cached.longitude, label: cached.label };
  }

  const country = process.env.GEOCODER_COUNTRY ?? "my"; // ISO country code(s), e.g. "my" or "my,sg"

  // Built-in Klang Valley neighbourhoods and postcodes: no network needed, so
  // this works even when the public geocoder blocks cloud servers.
  if (country.split(",").includes("my")) {
    const local = lookupMalaysianPlace(query);
    if (local) return local;
  }

  // A neighborhood that sitters already use resolves without a network call.
  const area = await areaCentre(query);
  if (area) return area;

  if (cached) return null; // looked up before and not found
  const bias = country ? `&countrycodes=${country}` : "";
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1${bias}&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      // Nominatim's policy requires an identifying User-Agent; anonymous
      // requests get HTTP 403.
      headers: { "User-Agent": process.env.GEOCODER_USER_AGENT ?? `Meraki/1.0 (+${process.env.APP_URL ?? "https://github.com/nightl0re/meraki-website"})` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[geocode] OpenStreetMap answered HTTP ${res.status} for "${query.slice(0, 60)}"`);
      return null; // don't cache server errors
    }
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
  } catch (e) {
    console.warn(`[geocode] lookup failed for "${query.slice(0, 60)}": ${(e as Error).message}`);
    return null; // offline or timed out: caller shows a friendly message
  }
}

function shortLabel(displayName: string) {
  return displayName.split(",").slice(0, 3).join(",").trim();
}

// Neighborhoods with at least one bookable sitter, with a centre point.
export async function listAreas() {
  const rows = await db.user.groupBy({
    by: ["area"],
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
  // One entry per neighborhood, even if sitters typed it with different
  // capitalisation ("Bangsar" / "bangsar"); counts and centres are merged.
  const merged = new Map<string, { area: string; count: number; lat: number; lng: number }>();
  for (const r of rows) {
    const key = r.area.trim().toLowerCase();
    const prev = merged.get(key);
    const lat = r._avg.latitude ?? 0;
    const lng = r._avg.longitude ?? 0;
    if (!prev) {
      merged.set(key, { area: r.area.trim(), count: r._count, lat, lng });
    } else {
      const total = prev.count + r._count;
      prev.lat = (prev.lat * prev.count + lat * r._count) / total;
      prev.lng = (prev.lng * prev.count + lng * r._count) / total;
      prev.count = total;
    }
  }
  return [...merged.values()];
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

// Accounts created while the geocoder was unreachable have an area name but
// no coordinates, which hides them from "near me" search and the job board.
// Fill them in from the area text; safe to call often (one small query).
export async function repairMissingLocation(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { area: true, city: true, latitude: true } });
  if (!u || u.latitude != null || !u.area.trim()) return false;
  const place = await geocode([u.area, u.city].filter(Boolean).join(", "));
  if (!place) return false;
  await db.user.update({ where: { id: userId }, data: { latitude: place.lat, longitude: place.lng } });
  return true;
}
