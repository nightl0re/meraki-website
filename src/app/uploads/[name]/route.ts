import path from "node:path";
import { readFile } from "node:fs/promises";
import { UPLOAD_DIR } from "@/lib/uploads";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_: Request, ctx: RouteContext<"/uploads/[name]">) {
  const { name } = await ctx.params;
  // Only plain generated file names; no paths.
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(name)) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(path.join(UPLOAD_DIR, name));
    return new Response(data, {
      headers: {
        "Content-Type": TYPES[name.split(".").pop()!],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
