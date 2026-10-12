// Demo data. Run with `npm run db:seed` (wipes and refills the database).
//
// Demo accounts (password for all: Meraki-demo-2026)
//   parent:  parent@meraki.test
//   sitter:  sitter@meraki.test
//   admin:   admin@meraki.test

import { PrismaClient, type BookingStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const PASSWORD = "Meraki-demo-2026";
const HOUR = 3_600_000;

// Small deterministic PRNG so every seed run produces the same data.
let state = 20261012;
const rand = () => ((state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const jitter = () => (rand() - 0.5) * 0.012;

const AREAS: Record<string, [number, number]> = {
  "Park Slope": [40.671, -73.9814],
  Williamsburg: [40.7081, -73.9571],
  "Brooklyn Heights": [40.696, -73.9937],
  "Upper West Side": [40.787, -73.9754],
  "Upper East Side": [40.7736, -73.9566],
  Harlem: [40.8116, -73.9465],
  Chelsea: [40.7465, -74.0014],
  Tribeca: [40.7163, -74.0086],
  Astoria: [40.7644, -73.9235],
  "Long Island City": [40.7447, -73.9485],
};

const SKILLS = [
  "Infant Care", "Toddler Care", "Homework Help", "CPR Certified", "First Aid",
  "Cooking", "Arts & Crafts", "Music", "Swimming", "Special Needs",
  "Bilingual", "School Age", "Outdoors", "Sports",
];
const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-");

const LANGUAGES: Record<string, string> = {
  Lucía: "English, Spanish", Chloe: "English, French", Priya: "English, Tamil", Noor: "English, Arabic",
  Sofia: "English, Italian", Yuki: "English, Japanese", Elena: "English, Romanian", Mateo: "English, Spanish",
};

const SITTERS = [
  ["Amara", "Okafor", "women/44", "Pediatric nursing student, calm with newborns", "Park Slope"],
  ["Lucía", "Fernández", "women/68", "Bilingual sitter, Spanish and English at home", "Williamsburg"],
  ["Hannah", "Lindqvist", "women/21", "Former preschool teacher with 6 years in classrooms", "Upper West Side"],
  ["Priya", "Raman", "women/90", "Homework help and science projects for school-age kids", "Long Island City"],
  ["Mateo", "Reyes", "men/32", "Soccer coach who keeps active kids busy outdoors", "Astoria"],
  ["Grace", "Whitfield", "women/12", "Certified in infant CPR, overnight care available", "Brooklyn Heights"],
  ["Noor", "Haddad", "women/33", "Art student who brings a craft project every visit", "Chelsea"],
  ["Ruth", "Abernathy", "women/79", "Retired nurse and grandmother of five", "Upper East Side"],
  ["Daniel", "Kowalski", "men/52", "Music teacher, piano and guitar basics", "Harlem"],
  ["Sofia", "Marchetti", "women/57", "Montessori-trained, great with toddlers", "Tribeca"],
  ["Jamal", "Carter", "men/15", "Special-needs experience, patient and structured", "Harlem"],
  ["Yuki", "Tanaka", "women/26", "Swim instructor in summer, sitter all year", "Park Slope"],
  ["Elena", "Popescu", "women/62", "Evening and weekend sitter, cooks healthy dinners", "Astoria"],
  ["Chloe", "Dubois", "women/8", "Early-childhood education student, French speaker", "Upper West Side"],
  ["Marcus", "Bell", "men/71", "Big brother of four, loves board games and Lego", "Williamsburg"],
  ["Isabel", "Moreno", "women/48", "Infant and toddler specialist, 8 years experience", "Brooklyn Heights"],
] as const;

const PARENTS = [
  ["Olivia", "Bennett", "women/3", "Park Slope", "parent@meraki.test"],
  ["Ethan", "Novak", "men/45", "Upper West Side", "ethan.novak@meraki.test"],
  ["Zara", "Hussain", "women/36", "Williamsburg", "zara.hussain@meraki.test"],
  ["Liam", "O'Connell", "men/22", "Astoria", "liam.oconnell@meraki.test"],
] as const;

const REVIEW_TEXT = [
  "Our kids were asking when she can come back before she even left.",
  "On time, organised, and sent us a photo update halfway through. Exactly what we needed.",
  "Bedtime went smoothly for the first time in weeks.",
  "Great with our toddler and very tidy. Highly recommend.",
  "Handled a little fever calmly and kept us posted. We felt completely at ease.",
  "Homework done, dinner eaten, kids happy. Will book again.",
  "Friendly and reliable. The kids loved the craft project.",
];

async function main() {
  console.log("Clearing tables...");
  await db.$transaction([
    db.jobApplication.deleteMany(), db.job.deleteMany(), db.bookingChild.deleteMany(), db.child.deleteMany(),
    db.rateLimit.deleteMany(), db.passwordResetToken.deleteMany(),
    db.auditLog.deleteMany(), db.notification.deleteMany(), db.message.deleteMany(),
    db.review.deleteMany(), db.payout.deleteMany(), db.payment.deleteMany(),
    db.booking.deleteMany(), db.paymentMethod.deleteMany(), db.favorite.deleteMany(),
    db.availability.deleteMany(), db.sitterSkill.deleteMany(), db.skill.deleteMany(),
    db.sitterProfile.deleteMany(), db.parentProfile.deleteMany(), db.session.deleteMany(),
    db.user.deleteMany(), db.geocodeCache.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const skills = await Promise.all(
    SKILLS.map((name) => db.skill.create({ data: { name, slug: slug(name) } })),
  );

  await db.user.create({
    data: {
      email: "admin@meraki.test", passwordHash, role: "ADMIN", status: "ACTIVE",
      firstName: "Iris", lastName: "Mendel", city: "New York",
    },
  });

  // --- sitters ---------------------------------------------------------------
  const sitterIds: string[] = [];
  for (let i = 0; i < SITTERS.length; i++) {
    const [first, last, photo, headline, area] = SITTERS[i];
    const [lat, lng] = AREAS[area];
    const rate = 1600 + Math.round(rand() * 14) * 100;
    const mySkills = [...skills].sort(() => rand() - 0.5).slice(0, 3 + Math.floor(rand() * 3));
    const email = i === 0 ? "sitter@meraki.test" : `${first}.${last}`.toLowerCase().normalize("NFD").replace(/[^a-z.]/g, "") + "@meraki.test";
    const user = await db.user.create({
      data: {
        email, passwordHash, role: "SITTER", status: "ACTIVE",
        firstName: first, lastName: last, city: "New York", area,
        latitude: lat + jitter(), longitude: lng + jitter(),
        phone: `+1 (917) ${String(200 + i * 37).padStart(3, "0")}-${String(1000 + i * 613).slice(0, 4)}`,
        avatarUrl: `https://randomuser.me/api/portraits/${photo}.jpg`,
        sitterProfile: {
          create: {
            headline,
            bio: `${headline}. I've been looking after children for years and treat every family like my own. I keep parents updated with a quick message during the evening, follow your routines closely, and always leave the house as tidy as I found it.`,
            hourlyRateCents: rate,
            experienceYears: 1 + Math.floor(rand() * 9),
            maxChildren: 2 + Math.floor(rand() * 3),
            serviceRadiusKm: i === 0 ? 10 : pick([5, 8, 10, 12, 15]),
            verifiedAt: new Date(Date.now() - (60 + i) * 24 * HOUR),
            backgroundCheckAt: i % 3 !== 2 ? new Date(Date.now() - (55 + i) * 24 * HOUR) : null,
            cprCertified: i % 2 === 0,
            languages: LANGUAGES[first] ?? "English",
            skills: { create: mySkills.map((s) => ({ skillId: s.id })) },
            availability: {
              create: [
                ...[1, 2, 3, 4, 5].filter(() => rand() > 0.25).map((weekday) => ({
                  weekday, startMinute: pick([8 * 60, 14 * 60, 15 * 60, 16 * 60]), endMinute: pick([21 * 60, 22 * 60, 23 * 60]),
                })),
                ...[0, 6].filter(() => rand() > 0.35).map((weekday) => ({
                  weekday, startMinute: 8 * 60, endMinute: 23 * 60,
                })),
              ],
            },
          },
        },
      },
    });
    sitterIds.push(user.id);
  }

  // Two sitters waiting for verification, for the admin queue.
  for (const [first, last, photo, area] of [
    ["Tess", "Gallagher", "women/15", "Chelsea"],
    ["Omar", "Siddiqui", "men/41", "Astoria"],
  ] as const) {
    const [lat, lng] = AREAS[area];
    await db.user.create({
      data: {
        email: `${first}.${last}@meraki.test`.toLowerCase(), passwordHash, role: "SITTER", status: "PENDING_REVIEW",
        firstName: first, lastName: last, city: "New York", area, latitude: lat + jitter(), longitude: lng + jitter(),
        avatarUrl: `https://randomuser.me/api/portraits/${photo}.jpg`,
        sitterProfile: {
          create: {
            headline: "New to Meraki, experienced with ages 2 to 10",
            bio: "I have three years of after-school care experience and a current first-aid certificate.",
            hourlyRateCents: 2000, experienceYears: 3,
            availability: { create: [{ weekday: 2, startMinute: 900, endMinute: 1320 }, { weekday: 4, startMinute: 900, endMinute: 1320 }] },
          },
        },
      },
    });
  }

  // --- parents -----------------------------------------------------------------
  const parentIds: string[] = [];
  for (const [first, last, photo, area, email] of PARENTS) {
    const [lat, lng] = AREAS[area];
    const user = await db.user.create({
      data: {
        email, passwordHash, role: "PARENT", status: "ACTIVE",
        firstName: first, lastName: last, city: "New York", area,
        latitude: lat + jitter(), longitude: lng + jitter(),
        avatarUrl: `https://randomuser.me/api/portraits/${photo}.jpg`,
        parentProfile: {
          create: {
            childrenCount: 1 + Math.floor(rand() * 3),
            address: `${100 + Math.floor(rand() * 400)} ${pick(["5th Ave", "Berkeley Pl", "Bedford Ave", "W 86th St", "31st St"])}, ${area}, New York`,
            about: "Two curious kids who love stories and being outside.",
          },
        },
        paymentMethods: {
          create: {
            providerRef: `pm_sim_seed_${first.toLowerCase()}`, brand: "Visa", last4: "4242",
            expMonth: 8, expYear: 2029, holderName: `${first} ${last}`, isDefault: true,
          },
        },
      },
      include: { paymentMethods: true, parentProfile: true },
    });
    parentIds.push(user.id);
  }

  // --- children -----------------------------------------------------------------
  const year = new Date().getFullYear();
  const KIDS: [string, number, string][][] = [
    [["Mia", year - 6, "Peanut allergy: no nuts at all. Loves drawing."], ["Leo", year - 3, "Naps 1-3 PM, needs his blue blanket."]],
    [["Ava", year - 8, ""]],
    [["Noah", year - 5, "Bedtime 7:30 PM, two stories."], ["Ella", year - 2, ""]],
    [["Sam", year - 10, "Homework before screen time."]],
  ];
  for (let i = 0; i < parentIds.length; i++) {
    for (const [firstName, birthYear, notes] of KIDS[i]) {
      await db.child.create({ data: { parentId: parentIds[i], firstName, birthYear, notes } });
    }
    await db.parentProfile.update({ where: { userId: parentIds[i] }, data: { childrenCount: KIDS[i].length } });
  }

  // --- bookings in every state --------------------------------------------------
  const now = Date.now();
  const atHour = (daysFromNow: number, hour: number) => {
    const d = new Date(now + daysFromNow * 24 * HOUR);
    d.setUTCHours(hour + 4, 0, 0, 0); // roughly New York evening in UTC
    return d;
  };

  let codeN = 1000;
  async function booking(parentIdx: number, sitterIdx: number, start: Date, hours: number, status: BookingStatus, review?: number) {
    const parent = await db.user.findUniqueOrThrow({ where: { id: parentIds[parentIdx] }, include: { paymentMethods: true, parentProfile: true } });
    const sitter = await db.sitterProfile.findUniqueOrThrow({ where: { userId: sitterIds[sitterIdx] } });
    const subtotal = sitter.hourlyRateCents * hours;
    const fee = Math.max(250, Math.round(subtotal * 0.1));
    const total = subtotal + fee;
    const end = new Date(start.getTime() + hours * HOUR);
    const captured = status === "COMPLETED";
    const voided = ["DECLINED", "EXPIRED", "CANCELLED"].includes(status);
    const b = await db.booking.create({
      data: {
        code: `MK-D${codeN++}`, parentId: parent.id, sitterId: sitter.userId,
        startsAt: start, endsAt: end, childrenCount: parent.parentProfile!.childrenCount,
        address: parent.parentProfile!.address, notes: "Bedtime is 8:30. Snacks are in the left cupboard.",
        status, hourlyRateCents: sitter.hourlyRateCents, hours, subtotalCents: subtotal,
        serviceFeeCents: fee, totalCents: total,
        respondBy: new Date(Math.min(start.getTime(), now + 20 * HOUR)),
        respondedAt: status === "REQUESTED" ? null : new Date(start.getTime() - 72 * HOUR),
        confirmedAt: captured ? new Date(end.getTime() + 2 * HOUR) : null,
        createdAt: new Date(start.getTime() - 96 * HOUR),
        payment: {
          create: {
            paymentMethodId: parent.paymentMethods[0].id, providerRef: `pi_sim_seed_${codeN}`,
            amountCents: total, status: captured ? "CAPTURED" : voided ? "VOIDED" : "AUTHORIZED",
            capturedCents: captured ? total : 0, capturedAt: captured ? new Date(end.getTime() + 2 * HOUR) : null,
          },
        },
      },
    });
    if (captured) {
      await db.payout.create({
        data: {
          sitterId: sitter.userId, bookingId: b.id, amountCents: subtotal,
          status: start.getTime() < now - 10 * 24 * HOUR ? "PAID" : "PENDING",
          paidAt: start.getTime() < now - 10 * 24 * HOUR ? new Date(start.getTime() + 7 * 24 * HOUR) : null,
        },
      });
      await db.sitterProfile.update({ where: { userId: sitter.userId }, data: { completedJobs: { increment: 1 } } });
    }
    if (review) {
      await db.review.create({
        data: {
          bookingId: b.id, authorId: parent.id, subjectId: sitter.userId, direction: "PARENT_TO_SITTER",
          rating: review, comment: pick(REVIEW_TEXT), createdAt: new Date(end.getTime() + 5 * HOUR),
        },
      });
    }
    return b;
  }

  // History with reviews across many sitters.
  for (let i = 0; i < 34; i++) {
    const s = i % SITTERS.length;
    await booking(i % parentIds.length, s, atHour(-(4 + i * 2), 14 + (i % 4)), 3 + (i % 3), "COMPLETED", rand() > 0.15 ? 5 : 4);
  }
  // The demo parent's current situation.
  await booking(0, 0, atHour(3, 15), 4, "ACCEPTED"); // upcoming
  await booking(0, 2, atHour(6, 14), 3, "REQUESTED"); // waiting for sitter
  await booking(0, 5, atHour(-1, 13), 4, "ACCEPTED"); // ended, awaiting confirmation
  await booking(0, 3, atHour(-12, 15), 3, "CANCELLED");
  // The demo sitter's inbox.
  await booking(1, 0, atHour(5, 16), 3, "REQUESTED");
  await booking(2, 0, atHour(9, 13), 5, "ACCEPTED");
  // A dispute for the admin.
  await booking(3, 4, atHour(-2, 14), 4, "DISPUTED");
  await db.booking.updateMany({ where: { status: "DISPUTED" }, data: { disputeReason: "The sitter arrived 50 minutes late and left early." } });

  // Rating aggregates.
  for (const id of sitterIds) {
    const agg = await db.review.aggregate({ where: { subjectId: id }, _avg: { rating: true }, _count: true });
    await db.sitterProfile.update({ where: { userId: id }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count } });
  }

  // Link children to the demo parent's open bookings so sitters see names and ages.
  const oliviaKids = await db.child.findMany({ where: { parentId: parentIds[0] } });
  for (const b of await db.booking.findMany({ where: { parentId: parentIds[0], status: { in: ["REQUESTED", "ACCEPTED"] } } })) {
    await db.bookingChild.createMany({ data: oliviaKids.map((c) => ({ bookingId: b.id, childId: c.id })) });
  }

  // --- job board -------------------------------------------------------------------
  const parents = await db.user.findMany({ where: { id: { in: parentIds } } });
  const byEmail = (e: string) => parents.find((p) => p.email === e)!;
  const job = async (email: string, daysAhead: number, startHour: number, hours: number, title: string, description: string, maxRate: number, kids: number) => {
    const p = byEmail(email);
    const startsAt = atHour(daysAhead, startHour);
    return db.job.create({
      data: {
        parentId: p.id, title, description, startsAt, endsAt: new Date(startsAt.getTime() + hours * HOUR),
        childrenCount: kids, maxRateCents: maxRate * 100, area: p.area, latitude: p.latitude, longitude: p.longitude,
        createdAt: new Date(now - 5 * HOUR),
      },
    });
  };
  const dateNight = await job("parent@meraki.test", 8, 18, 5, "Date night, two kids",
    "Dinner, bath and bedtime for Mia (6) and Leo (3). Mia has a nut allergy. We have a friendly cat.", 25, 2);
  await job("zara.hussain@meraki.test", 4, 11, 4, "After-school pickup and homework help",
    "Pick up Noah from school at 3:15, snack, homework, play until we're home around 7.", 24, 2);
  await job("zara.hussain@meraki.test", 11, 9, 8, "Full day with a toddler and a 5-year-old",
    "Park in the morning, lunch, nap time for Ella. Experience with toddlers needed.", 26, 2);
  await job("liam.oconnell@meraki.test", 6, 15, 4, "Evening sitter in Astoria", "Homework and dinner for Sam (10).", 22, 1);
  for (const [i, message] of [
    [11, "Hi Olivia! I'm free that evening and I'm a swim instructor, so bath time is my specialty. I always check allergies twice."],
    [15, "Hello! I've looked after toddlers for 8 years and love bedtime stories. I live a few minutes away in Brooklyn Heights."],
  ] as const) {
    await db.jobApplication.create({ data: { jobId: dateNight.id, sitterId: sitterIds[i], message, createdAt: new Date(now - 2 * HOUR) } });
  }
  await db.notification.create({ data: { userId: parentIds[0], title: "New applicant", body: "Isabel applied to “Date night, two kids”.", href: `/jobs/${dateNight.id}` } });
  await db.notification.create({ data: { userId: sitterIds[0], title: "New job near you", body: "After-school pickup and homework help in Williamsburg.", href: "/sitter/jobs" } });

  await db.favorite.createMany({
    data: [0, 2, 5].map((i) => ({ parentId: parentIds[0], sitterId: sitterIds[i] })),
  });

  await db.notification.create({
    data: {
      userId: parentIds[0], title: "Welcome to Meraki",
      body: "Find a sitter near you, request a time, and you're only charged after the job.", href: "/sitters",
    },
  });

  console.log(`Seeded ${sitterIds.length} sitters, ${parentIds.length} parents. Password: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
