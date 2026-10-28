// Sample accounts for trying Meraki by hand: 2 parents, 2 babysitters, 1 admin.
// Run with `npm run db:samples`. Safe to re-run: accounts are created or reset
// in place, other data is left alone. Also run automatically by `npm run db:seed`.
//
//   Role       Email                       Password
//   Admin      admin.sample@meraki.test    Sample-Meraki-2026
//   Parent     sarah.parent@meraki.test    Sample-Meraki-2026
//   Parent     daniel.parent@meraki.test   Sample-Meraki-2026
//   Babysitter maya.sitter@meraki.test     Sample-Meraki-2026
//   Babysitter jonas.sitter@meraki.test    Sample-Meraki-2026
//
// These are local test accounts only. Never deploy them to production.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { assertLocalDatabase } from "./local-only";

export const SAMPLE_PASSWORD = "Sample-Meraki-2026";

export async function createSampleAccounts(db: PrismaClient) {
  const passwordHash = await bcrypt.hash(SAMPLE_PASSWORD, 12);
  const year = new Date().getFullYear();

  const base = (email: string) => ({
    passwordHash, status: "ACTIVE" as const, failedLogins: 0, lockedUntil: null, city: "Kuala Lumpur",
    email,
  });

  // Start from a clean slate for these five, so re-running resets them.
  const emails = [
    "admin.sample@meraki.test", "sarah.parent@meraki.test", "daniel.parent@meraki.test",
    "maya.sitter@meraki.test", "jonas.sitter@meraki.test",
  ];
  const existing = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = existing.map((u) => u.id);
  if (ids.length) {
    const bookings = await db.booking.findMany({ where: { OR: [{ parentId: { in: ids } }, { sitterId: { in: ids } }] }, select: { id: true } });
    const bIds = bookings.map((b) => b.id);
    await db.job.updateMany({ where: { hiredBookingId: { in: bIds } }, data: { hiredBookingId: null } });
    await db.payout.deleteMany({ where: { bookingId: { in: bIds } } });
    await db.payment.deleteMany({ where: { bookingId: { in: bIds } } });
    await db.booking.deleteMany({ where: { id: { in: bIds } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  }

  // --- admin ---
  await db.user.create({ data: { ...base(emails[0]), role: "ADMIN", firstName: "Alex", lastName: "Morgan" } });

  // --- parents ---
  await db.user.create({
    data: {
      ...base(emails[1]), role: "PARENT", firstName: "Sarah", lastName: "Tan",
      phone: "+60 12-555 0142", area: "Bangsar", latitude: 3.1290, longitude: 101.6720,
      parentProfile: { create: { address: "No. 12, Jalan Telawi 3, Bangsar, Kuala Lumpur", childrenCount: 2, about: "Two busy kids who love the park and Lego." } },
      children: { create: [
        { firstName: "Lily", birthYear: year - 5, notes: "Allergic to strawberries. Bedtime 7:30." },
        { firstName: "Max", birthYear: year - 2, notes: "Naps after lunch." },
      ] },
      paymentMethods: { create: { providerRef: "pm_sim_sample_sarah", brand: "Visa", last4: "4242", expMonth: 9, expYear: year + 3, holderName: "Sarah Tan", isDefault: true } },
    },
  });
  await db.user.create({
    data: {
      ...base(emails[2]), role: "PARENT", firstName: "Daniel", lastName: "Wong", city: "Petaling Jaya",
      phone: "+60 16-555 0187", area: "Petaling Jaya", latitude: 3.1175, longitude: 101.6230,
      parentProfile: { create: { address: "No. 8, Jalan SS2/24, Petaling Jaya, Selangor", childrenCount: 1, about: "One curious 7-year-old who loves science." } },
      children: { create: [{ firstName: "Ethan", birthYear: year - 7, notes: "Homework help needed on weekdays." }] },
      paymentMethods: { create: { providerRef: "pm_sim_sample_daniel", brand: "Mastercard", last4: "4444", expMonth: 4, expYear: year + 2, holderName: "Daniel Wong", isDefault: true } },
    },
  });

  // --- babysitters (verified and bookable) ---
  const skills = await db.skill.findMany();
  const skillIds = (names: string[]) => skills.filter((s) => names.includes(s.name)).map((s) => ({ skillId: s.id }));
  const everyEvening = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 15 * 60, endMinute: 22 * 60 }));
  const weekends = [0, 6].map((weekday) => ({ weekday, startMinute: 9 * 60, endMinute: 23 * 60 }));

  await db.user.create({
    data: {
      ...base(emails[3]), role: "SITTER", firstName: "Maya", lastName: "Lim",
      phone: "+60 11-555 0121", area: "Bangsar", latitude: 3.1310, longitude: 101.6700,
      sitterProfile: { create: {
        headline: "Early-years teacher, calm and creative with toddlers",
        bio: "I'm a qualified early-years teacher with 5 years of classroom experience and plenty of evenings babysitting. I plan simple crafts and games, follow your routines closely, and send a quick update during the evening so you can relax.",
        hourlyRateCents: 2200, experienceYears: 5, maxChildren: 3, serviceRadiusKm: 10,
        verifiedAt: new Date(), backgroundCheckAt: new Date(), cprCertified: true, languages: "English, Malay, Mandarin",
        skills: { create: skillIds(["Toddler Care", "Arts & Crafts", "First Aid", "CPR Certified", "Bilingual"]) },
        availability: { create: [...everyEvening, ...weekends] },
      } },
    },
  });
  await db.user.create({
    data: {
      ...base(emails[4]), role: "SITTER", firstName: "Jonas", lastName: "Lee",
      phone: "+60 17-555 0168", area: "Mont Kiara", latitude: 3.1710, longitude: 101.6510,
      sitterProfile: { create: {
        headline: "Student and big brother, great with school-age kids",
        bio: "I'm a university student studying education and the oldest of four, so homework, board games and bedtime battles are nothing new. I'm patient, reliable and happy to help with school pickups and cooking a simple dinner.",
        hourlyRateCents: 1900, experienceYears: 3, maxChildren: 3, serviceRadiusKm: 12,
        verifiedAt: new Date(), cprCertified: false, languages: "English, Mandarin",
        skills: { create: skillIds(["Homework Help", "School Age", "Sports", "Cooking"]) },
        availability: { create: [...everyEvening, { weekday: 6, startMinute: 10 * 60, endMinute: 22 * 60 }] },
      } },
    },
  });

  return emails;
}

// Run directly: `npm run db:samples`
if (process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/sample-accounts.ts")) {
  assertLocalDatabase("creating sample accounts");
  const db = new PrismaClient();
  createSampleAccounts(db)
    .then((emails) => console.log(`Sample accounts ready (password ${SAMPLE_PASSWORD}):\n  ${emails.join("\n  ")}`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
