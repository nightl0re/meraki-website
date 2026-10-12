import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");

// --- throttling ---------------------------------------------------------------

// Fixed-window limiter stored in the database, so limits survive restarts and
// apply across several server instances. Returns false when over the limit.
export async function rateLimit(key: string, max: number, windowMs: number) {
  const now = new Date();
  const k = key.slice(0, 191);
  return db.$transaction(async (tx) => {
    const row = await tx.rateLimit.findUnique({ where: { key: k } });
    if (!row || row.resetAt < now) {
      await tx.rateLimit.upsert({
        where: { key: k },
        update: { count: 1, resetAt: new Date(now.getTime() + windowMs) },
        create: { key: k, count: 1, resetAt: new Date(now.getTime() + windowMs) },
      });
      return true;
    }
    const updated = await tx.rateLimit.update({ where: { key: k }, data: { count: { increment: 1 } } });
    return updated.count <= max;
  });
}

