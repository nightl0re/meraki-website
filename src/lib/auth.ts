import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { config } from "./config";
import { randomToken, sha256 } from "./security";
import { SITTER_APPLICATION, homeFor, isPendingSitter } from "./roles";

const COOKIE = "meraki_session";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export { rateLimit, randomToken, sha256 } from "./security";

// --- sessions ------------------------------------------------------------------

// The cookie holds a random token; the database only keeps its hash, so a
// leaked database row can't be used to sign in. Any previous session in this
// browser is removed first (session rotation on login).
export async function createSession(userId: string) {
  const jar = await cookies();
  const previous = jar.get(COOKIE)?.value;
  if (previous) await db.session.deleteMany({ where: { tokenHash: sha256(previous) } });

  const token = randomToken();
  const expiresAt = new Date(Date.now() + config.sessionDays * 86_400_000);
  const ua = (await headers()).get("user-agent") ?? "";
  await db.session.create({
    data: { tokenHash: sha256(token), userId, expiresAt, userAgent: ua.slice(0, 255) },
  });
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(COOKIE);
}

export type CurrentUser = {
  id: string;
  role: Role;
  status: "ACTIVE" | "PENDING_REVIEW" | "REJECTED" | "SUSPENDED";
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
};

const IDLE_TIMEOUT_MS = config.sessionIdleDays * 86_400_000;

// Cached per request, so every component can call it freely.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        select: {
          id: true, role: true, status: true, firstName: true,
          lastName: true, email: true, avatarUrl: true,
        },
      },
    },
  });
  const now = Date.now();
  if (!session || session.expiresAt.getTime() < now) return null;
  // Sessions unused for a while expire even if the absolute lifetime hasn't.
  if (now - session.lastSeenAt.getTime() > IDLE_TIMEOUT_MS) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.user.status === "SUSPENDED" || session.user.status === "REJECTED") return null;
  if (now - session.lastSeenAt.getTime() > 5 * 60_000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return session.user;
});

// Use at the top of every protected page and server action.
// Babysitters who aren't approved yet can only use their application page
// (and the actions it calls); everything else sends them back there.
export async function requireUser(roles?: Role[], opts: { allowPendingSitter?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(homeFor(user.role, user.status));
  if (isPendingSitter(user) && !opts.allowPendingSitter) redirect(SITTER_APPLICATION);
  return user;
}

export { SITTER_APPLICATION, homeFor, isPendingSitter } from "./roles";

export const roleLabel = (role: Role) => (role === "ADMIN" ? "admin" : role === "SITTER" ? "babysitter" : "parent");

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
}

// Old limiter rows are useless once their window has passed.
export async function pruneSecurityTables() {
  const now = new Date();
  await db.rateLimit.deleteMany({ where: { resetAt: { lt: now } } });
  await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } });
}
