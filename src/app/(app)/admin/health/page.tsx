import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { lookupMalaysianPlace } from "@/lib/places-my";
import { fixLocationsAction } from "@/app/actions/admin";
import { Badge, Card, PageHeader, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "System check" };

async function testOpenStreetMap() {
  try {
    const res = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=my&q=Bangsar", {
      headers: { "User-Agent": process.env.GEOCODER_USER_AGENT ?? `Meraki/1.0 (+${process.env.APP_URL ?? "https://github.com/nightl0re/meraki-website"})` },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    return res.ok ? { ok: true, text: "Reachable" } : { ok: false, text: `Blocked or failing (HTTP ${res.status})` };
  } catch (e) {
    return { ok: false, text: `Unreachable (${(e as Error).message})` };
  }
}

export default async function HealthPage() {
  await requireUser(["ADMIN"]);
  const [osm, unlocated, openJobs, applications, applicationsByStatus, activeSitters, locatedSitters] = await Promise.all([
    testOpenStreetMap(),
    db.user.findMany({
      where: { latitude: null, role: { in: ["PARENT", "SITTER"] } },
      select: { id: true, firstName: true, lastName: true, role: true, area: true, email: true },
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
    db.job.count({ where: { status: "OPEN" } }),
    db.jobApplication.count(),
    db.jobApplication.groupBy({ by: ["status"], _count: true }),
    db.user.count({ where: { role: "SITTER", status: "ACTIVE" } }),
    db.user.count({ where: { role: "SITTER", status: "ACTIVE", latitude: { not: null } } }),
  ]);
  const builtIn = lookupMalaysianPlace("Bangsar");

  const checks = [
    { label: "Built-in Klang Valley places", ok: !!builtIn, text: builtIn ? "Working (no internet needed)" : "Not working" },
    { label: "OpenStreetMap geocoder (for places not in the built-in list)", ok: osm.ok, text: osm.text },
    { label: "Accounts with a map location", ok: unlocated.length === 0, text: unlocated.length ? `${unlocated.length} without a location` : "All located" },
    { label: "Active sitters visible in “near me” search", ok: activeSitters === locatedSitters, text: `${locatedSitters} of ${activeSitters}` },
    { label: "Scheduled job (CRON_SECRET)", ok: !!process.env.CRON_SECRET, text: process.env.CRON_SECRET ? "Set" : "Missing: requests won't expire overnight" },
    { label: "Site address (APP_URL)", ok: !!process.env.APP_URL, text: process.env.APP_URL ?? "Missing: password-reset links point to localhost" },
  ];

  return (
    <>
      <PageHeader title="System check" description="Settings and data problems that stop bookings or the job board from working." />

      <Card className="divide-y divide-line">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-3 px-5 py-3.5">
            {c.ok ? <CheckCircle size={22} weight="fill" className="shrink-0 text-info" aria-hidden /> : <WarningCircle size={22} weight="fill" className="shrink-0 text-warn" aria-hidden />}
            <p className="flex-1 font-medium">{c.label}</p>
            <p className={c.ok ? "text-sm text-ink-3" : "text-sm font-semibold text-warn"}>{c.text}</p>
          </div>
        ))}
      </Card>

      <section className="mt-8">
        <h2 className="font-semibold">Settings in use</h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {[
            ["Time zone", config.timeZone],
            ["Currency", config.currency],
            ["Locale", config.locale],
            ["Geocoder country", process.env.GEOCODER_COUNTRY ?? "my (default)"],
            ["Early completion (testing)", config.allowEarlyCompletion ? "On: sitters can mark jobs done any time" : "Off"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 rounded-xl bg-surface-2 px-4 py-2.5">
              <dt className="text-ink-3">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Job board</h2>
        <p className="mt-1 text-sm text-ink-2">
          {openJobs} open {openJobs === 1 ? "job" : "jobs"}, {applications} {applications === 1 ? "application" : "applications"} in total
          {applicationsByStatus.length > 0 && <> ({applicationsByStatus.map((a) => `${a._count} ${a.status.toLowerCase()}`).join(", ")})</>}.
        </p>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Accounts without a map location</h2>
          {unlocated.length > 0 && (
            <form action={fixLocationsAction}>
              <button className={buttonClass("primary", "sm")}>Fix locations now</button>
            </form>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-3">
          These people don&apos;t appear in &ldquo;near me&rdquo; search and can&apos;t see or post jobs. &ldquo;Fix&rdquo; looks their
          neighbourhood up again. If it still fails, ask them to enter a neighbourhood or postcode in Settings.
        </p>
        {unlocated.length === 0 ? (
          <p className="mt-3 text-sm text-info">Everyone has a location.</p>
        ) : (
          <Card className="mt-3 divide-y divide-line">
            {unlocated.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="font-medium">{u.firstName} {u.lastName}</span>
                <Badge>{u.role.toLowerCase()}</Badge>
                <span className="text-ink-3">{u.email}</span>
                <span className="ml-auto text-ink-2">{u.area ? `“${u.area}”` : "No neighbourhood entered"}</span>
              </div>
            ))}
          </Card>
        )}
        <p className="mt-4 text-sm"><Link href="/admin/bookings" className="text-accent-strong hover:underline">See all bookings by stage</Link></p>
      </section>
    </>
  );
}
