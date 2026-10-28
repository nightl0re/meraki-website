// Babysitter sign-up verification: routing for unapproved sitters, private
// photo storage, and the application checklist. Runs against the local database.

import { assertLocalDatabase } from "../prisma/local-only";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { homeFor, isPendingSitter } from "@/lib/roles";
import { deleteFileByUrl, saveImage } from "@/lib/files";
import { applicationMissing } from "@/lib/sitter-application";

assertLocalDatabase("the tests");

const tag = `a${Date.now()}`;
let sitterId = "";
let otherId = "";

// Smallest valid JPEG header bytes are enough for the type check.
const jpeg = (size = 64) => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(size).fill(0)])], "x.jpg", { type: "image/jpeg" });

before(async () => {
  const s = await db.user.create({
    data: {
      email: `sitter.${tag}@test.local`, passwordHash: "x", role: "SITTER", status: "PENDING_REVIEW",
      firstName: "New", lastName: "Sitter", sitterProfile: { create: {} },
    },
  });
  const o = await db.user.create({ data: { email: `other.${tag}@test.local`, passwordHash: "x", role: "PARENT", firstName: "O", lastName: "P" } });
  sitterId = s.id;
  otherId = o.id;
});

after(async () => {
  await db.user.deleteMany({ where: { id: { in: [sitterId, otherId] } } });
  await db.$disconnect();
});

describe("routing for babysitters waiting for approval", () => {
  test("unapproved sitters are sent to their application, approved ones to the dashboard", () => {
    assert.equal(homeFor("SITTER", "PENDING_REVIEW"), "/sitter/application");
    assert.equal(homeFor("SITTER", "ACTIVE"), "/sitter");
    assert.equal(homeFor("PARENT", "ACTIVE"), "/parent");
    assert.equal(homeFor("ADMIN", "ACTIVE"), "/admin");
    assert.equal(isPendingSitter({ role: "SITTER", status: "PENDING_REVIEW" }), true);
    assert.equal(isPendingSitter({ role: "SITTER", status: "ACTIVE" }), false);
    assert.equal(isPendingSitter({ role: "PARENT", status: "PENDING_REVIEW" }), false);
  });
});

describe("photo storage", () => {
  test("rejects files that aren't real images or are too big", async () => {
    const fake = new File([new TextEncoder().encode("<script>alert(1)</script>")], "x.jpg", { type: "image/jpeg" });
    assert.equal((await saveImage(sitterId, "ID_PHOTO", fake)).ok, false);
    const gif = new File([new Uint8Array([0x47, 0x49, 0x46])], "x.gif", { type: "image/gif" });
    assert.equal((await saveImage(sitterId, "ID_PHOTO", gif)).ok, false);
    assert.equal((await saveImage(sitterId, "ID_PHOTO", jpeg(2 * 1024 * 1024 + 1))).ok, false);
  });

  test("stores the photo in the database and returns a /files URL", async () => {
    const r = await saveImage(sitterId, "ID_PHOTO", jpeg());
    assert.ok(r.ok);
    assert.match(r.url, /^\/files\/[a-z0-9]+$/);
    const row = await db.storedFile.findUniqueOrThrow({ where: { id: r.id } });
    assert.equal(row.kind, "ID_PHOTO");
    assert.equal(row.ownerId, sitterId);
    assert.equal(row.contentType, "image/jpeg");
    assert.equal(row.data[0], 0xff);
  });

  test("only the owner can delete their photo", async () => {
    const r = await saveImage(sitterId, "AVATAR", jpeg());
    assert.ok(r.ok);
    await deleteFileByUrl(otherId, r.url); // someone else: no effect
    assert.ok(await db.storedFile.findUnique({ where: { id: r.id } }));
    await deleteFileByUrl(sitterId, r.url);
    assert.equal(await db.storedFile.findUnique({ where: { id: r.id } }), null);
  });
});

describe("application checklist", () => {
  test("lists what's missing until everything is done", async () => {
    const missing = await applicationMissing(sitterId);
    assert.ok(missing.some((m) => m.includes("verification photo")));
    assert.ok(missing.some((m) => m.includes("availability")));

    const photo = await saveImage(sitterId, "ID_PHOTO", jpeg());
    const avatar = await saveImage(sitterId, "AVATAR", jpeg());
    assert.ok(photo.ok && avatar.ok);
    await db.user.update({ where: { id: sitterId }, data: { avatarUrl: avatar.url, phone: "+60 12-345 6789", latitude: 3.13, longitude: 101.67 } });
    await db.sitterProfile.update({
      where: { userId: sitterId },
      data: {
        idPhotoId: photo.id,
        headline: "Kind and experienced sitter",
        bio: "I have looked after children for five years, including toddlers and school-age kids, and I hold a first-aid certificate.",
        availability: { create: [{ weekday: 1, startMinute: 900, endMinute: 1260 }] },
      },
    });
    assert.deepEqual(await applicationMissing(sitterId), []);
  });
});
