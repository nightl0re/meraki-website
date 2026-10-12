import { timingSafeEqual } from "node:crypto";
import { sweep } from "@/lib/bookings";

// Call every few minutes from a scheduler (Vercel Cron, GitHub Actions, cron)
// with "Authorization: Bearer $CRON_SECRET". Expires unanswered requests and
// auto-confirms finished jobs even when nobody is browsing the site.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok =
    !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await sweep(true);
  return Response.json({ ok: true, at: new Date().toISOString() });
}
