import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { config } from "./config";

const COOKIE = "meraki_session";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

// The cookie holds a random token; the database only keeps its hash, so a
// leaked database row can't be used to sign in.
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.sessionDays * 86_400_000);
  const ua = (await headers()).get("user-agent") ?? "";
  await db.session.create({
    data: { tokenHash: sha256(token), userId, expiresAt, userAgent: ua.slice(0, 255) },
  });
  (await cookies()).set(COOKIE, token, {
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
  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.status === "SUSPENDED" || session.user.status === "REJECTED") return null;
  return session.user;
});

// Use at the top of every protected page and server action.
export async function requireUser(roles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export function homeFor(role: Role) {
  return role === "ADMIN" ? "/admin" : role === "SITTER" ? "/sitter" : "/parent";
}

// Simple in-memory limiter for login/signup attempts. Fine for one server;
// swap for Redis or similar when running several instances.
const attempts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max = 8, windowMs = 15 * 60_000) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
}
