import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Serves photos stored in the database.
// - Profile photos (AVATAR) are public and can be cached forever: a new upload
//   always gets a new id.
// - Verification photos (ID_PHOTO) are private: only the sitter who uploaded
//   it and admins can open it, and browsers/proxies must not cache it.
export async function GET(_: Request, ctx: RouteContext<"/files/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{20,40}$/.test(id)) return new Response("Not found", { status: 404 });

  const file = await db.storedFile.findUnique({
    where: { id },
    select: { ownerId: true, kind: true, contentType: true, data: true },
  });
  if (!file) return new Response("Not found", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": file.contentType,
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  };

  if (file.kind === "ID_PHOTO") {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.id !== file.ownerId)) {
      return new Response("Not found", { status: 404 });
    }
    headers["Cache-Control"] = "private, no-store";
  } else {
    headers["Cache-Control"] = "public, max-age=31536000, immutable";
  }

  return new Response(new Uint8Array(file.data), { headers });
}
