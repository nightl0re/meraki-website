import "server-only";
import { db } from "./db";

// What still has to be done before the application can be sent for review.
export async function applicationMissing(userId: string) {
  const u = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      avatarUrl: true, phone: true, latitude: true,
      sitterProfile: { select: { idPhotoId: true, headline: true, bio: true, _count: { select: { availability: true } } } },
    },
  });
  const p = u.sitterProfile!;
  const missing: string[] = [];
  if (!p.idPhotoId) missing.push("Take your verification photo");
  if (!u.avatarUrl) missing.push("Add a profile photo");
  if (p.headline.length < 10 || p.bio.length < 80 || u.latitude == null) missing.push("Fill in “About you” and save it");
  if (p._count.availability === 0) missing.push("Set your weekly availability");
  if (!u.phone) missing.push("Add your phone number");
  return missing;
}
