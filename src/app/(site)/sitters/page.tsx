import type { Metadata } from "next";
import Link from "next/link";
import { MapPinArea, UsersThree } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { geocode, listAreas, type Point } from "@/lib/geo";
import { searchSitters, type SitterSearch } from "@/lib/sitters";
import { getCurrentUser } from "@/lib/auth";
import { WEEKDAYS, formatMoney } from "@/lib/format";
import { LocationSearch } from "@/components/location-search";
import { SitterCard } from "@/components/sitter-card";
import { Alert, EmptyState, LinkButton, Select, buttonClass, cn } from "@/components/ui";

export const metadata: Metadata = { title: "Find a babysitter near you" };

const RADII = [3, 5, 10, 15, 25];

export default async function SittersPage({ searchParams }: PageProps<"/sitters">) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  const nearText = str("near");
  const area = str("area");
  const radius = RADII.includes(Number(str("radius"))) ? Number(str("radius")) : 10;
  const user = await getCurrentUser();

  // Work out the search centre: explicit coordinates, typed address, or the
  // signed-in parent's saved home area.
  let centre: (Point & { label: string }) | null = null;
  let geocodeFailed = false;
  const lat = Number(str("lat"));
  const lng = Number(str("lng"));
  if (str("lat") && str("lng") && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    centre = { lat, lng, label: nearText || "Your location" };
  } else if (nearText) {
    centre = await geocode(nearText);
    geocodeFailed = !centre;
  } else if (!area && user?.role === "PARENT") {
    const me = await db.user.findUnique({ where: { id: user.id }, select: { latitude: true, longitude: true, area: true } });
    if (me?.latitude != null && me.longitude != null) centre = { lat: me.latitude, lng: me.longitude, label: me.area || "your home" };
  }

  const weekday = str("day") !== "" && Number(str("day")) >= 0 && Number(str("day")) <= 6 ? Number(str("day")) : undefined;
  const search: SitterSearch = {
    near: centre ?? undefined,
    radiusKm: radius,
    area: centre ? undefined : area || undefined,
    skill: str("skill") || undefined,
    maxRateCents: Number(str("maxRate")) > 0 ? Number(str("maxRate")) * 100 : undefined,
    minRating: Number(str("minRating")) > 0 ? Number(str("minRating")) : undefined,
    weekday,
    sort: (["distance", "rating", "price_asc", "price_desc"] as const).find((s) => s === str("sort")),
  };

  const [results, areas, skills] = await Promise.all([
    searchSitters(search),
    listAreas(),
    db.skill.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Params to keep when changing filters.
  const keep: Record<string, string> = {};
  if (centre) {
    keep.lat = centre.lat.toFixed(4);
    keep.lng = centre.lng.toFixed(4);
    keep.near = centre.label;
  } else if (area) keep.area = area;

  const heading = centre
    ? `Sitters near ${centre.label}`
    : area
      ? `Sitters in ${area}`
      : "Babysitters near you";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-12">
      <div className="max-w-2xl">
        <LocationSearch defaultValue={centre?.label ?? ""} size="md" extraParams={{ radius: String(radius) }} />
      </div>

      {/* Area chips */}
      <nav aria-label="Neighborhoods" className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Link
          href="/sitters"
          className={chip(!area && !centre)}
        >
          All areas
        </Link>
        {areas.map((a) => (
          <Link key={a.area} href={`/sitters?area=${encodeURIComponent(a.area)}`} className={chip(!centre && area.toLowerCase() === a.area.toLowerCase())}>
            {a.area} <span className="text-ink-3 tabular">{a.count}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        {/* Filters (plain GET form: works without JavaScript) */}
        <aside>
          <form method="get" className="space-y-5 rounded-xl border border-line bg-surface p-5 lg:sticky lg:top-24">
            {Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <h2 className="font-semibold">Filters</h2>
            {centre && (
              <FilterField label="Distance" id="radius">
                <Select id="radius" name="radius" defaultValue={String(radius)}>
                  {RADII.map((r) => <option key={r} value={r}>Within {r} km</option>)}
                </Select>
              </FilterField>
            )}
            <FilterField label="Available on" id="day">
              <Select id="day" name="day" defaultValue={weekday != null ? String(weekday) : ""}>
                <option value="">Any day</option>
                {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}s</option>)}
              </Select>
            </FilterField>
            <FilterField label="Skill" id="skill">
              <Select id="skill" name="skill" defaultValue={str("skill")}>
                <option value="">Any</option>
                {skills.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Max hourly rate" id="maxRate">
              <Select id="maxRate" name="maxRate" defaultValue={str("maxRate")}>
                <option value="">No limit</option>
                {[18, 20, 22, 25, 30].map((r) => <option key={r} value={r}>Up to {formatMoney(r * 100)}/hr</option>)}
              </Select>
            </FilterField>
            <FilterField label="Rating" id="minRating">
              <Select id="minRating" name="minRating" defaultValue={str("minRating")}>
                <option value="">Any</option>
                <option value="4">4.0 and up</option>
                <option value="4.5">4.5 and up</option>
              </Select>
            </FilterField>
            <FilterField label="Sort by" id="sort">
              <Select id="sort" name="sort" defaultValue={search.sort ?? (centre ? "distance" : "rating")}>
                {centre && <option value="distance">Nearest</option>}
                <option value="rating">Top rated</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </Select>
            </FilterField>
            <div className="flex gap-2 pt-1">
              <button className={buttonClass("primary", "md", "flex-1")}>Apply</button>
              <Link href={`/sitters?${new URLSearchParams(keep)}`} className={buttonClass("ghost", "md")}>Reset</Link>
            </div>
          </form>
        </aside>

        <section aria-labelledby="results-heading">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h1 id="results-heading" className="text-2xl font-semibold tracking-tight">{heading}</h1>
            <p className="shrink-0 text-sm text-ink-3 tabular">{results.length} {results.length === 1 ? "sitter" : "sitters"}</p>
          </div>

          {geocodeFailed && (
            <div className="mb-5">
              <Alert tone="warn">
                We couldn&apos;t find &ldquo;{nearText}&rdquo;. Try a postcode, a street address, or pick a neighborhood above.
              </Alert>
            </div>
          )}
          {centre && (
            <p className="-mt-3 mb-5 text-sm text-ink-3">
              Showing sitters within {radius} km who travel to this location. Exact addresses are never shown.
            </p>
          )}

          {results.length === 0 ? (
            <EmptyState
              icon={centre ? <MapPinArea size={32} /> : <UsersThree size={32} />}
              title={centre ? "No sitters cover this spot yet" : "No sitters match these filters"}
              body={centre ? "Try a larger distance, or browse a nearby neighborhood." : "Loosen a filter or two and try again."}
              action={
                centre && radius < 25 ? (
                  <LinkButton href={`/sitters?${new URLSearchParams({ ...keep, radius: "25" })}`} variant="secondary">
                    Search within 25 km
                  </LinkButton>
                ) : (
                  <LinkButton href="/sitters" variant="secondary">See all sitters</LinkButton>
                )
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {results.map((s) => <SitterCard key={s.id} s={s} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function chip(active: boolean) {
  return cn(
    "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm transition-colors",
    active ? "border-accent bg-accent-soft text-accent-strong" : "border-line-strong bg-surface hover:border-ink-3",
  );
}

function FilterField({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-2">{label}</label>
      {children}
    </div>
  );
}
