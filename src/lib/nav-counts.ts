import "server-only";
import { cache } from "react";
import { db } from "./db";
import type { CurrentUser } from "./auth";
import type { NavBadge } from "./nav";
import { jobsNear } from "./jobs";

// Counts shown as badges next to sidebar items. Cached per request.
export const navCounts = cache(async (user: CurrentUser): Promise<Partial<Record<NavBadge, number>>> => {
  const now = new Date();
  const notifications = db.notification.count({ where: { userId: user.id, readAt: null } });
  if (user.role === "PARENT") {
    const [n, action, applicants] = await Promise.all([
      notifications,
      db.booking.count({ where: { parentId: user.id, status: "ACCEPTED", endsAt: { lte: now } } }),
      db.jobApplication.count({ where: { status: "APPLIED", job: { parentId: user.id, status: "OPEN" } } }),
    ]);
    return { notifications: n, bookingsAction: action, jobApplicants: applicants };
  }
  if (user.role === "SITTER") {
    const [n, requests, jobs] = await Promise.all([
      notifications,
      db.booking.count({ where: { sitterId: user.id, status: "REQUESTED" } }),
      user.status === "ACTIVE" ? jobsNear(user.id).then((j) => j.filter((x) => !x.myApplication).length) : Promise.resolve(0),
    ]);
    return { notifications: n, requests, jobsNear: jobs };
  }
  const [n, pendingSitters, disputes] = await Promise.all([
    notifications,
    db.user.count({ where: { role: "SITTER", status: "PENDING_REVIEW" } }),
    db.booking.count({ where: { status: "DISPUTED" } }),
  ]);
  return { notifications: n, pendingSitters, disputes };
});
