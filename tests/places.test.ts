// Built-in Klang Valley places and repairing accounts without a location.

import { assertLocalDatabase } from "../prisma/local-only";
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { lookupMalaysianPlace } from "@/lib/places-my";
import { repairMissingLocation } from "@/lib/geo";

assertLocalDatabase("the tests");
// These tests are about the Malaysian launch list, whatever the local .env says.
process.env.GEOCODER_COUNTRY = "my";

const created: string[] = [];
after(async () => {
  await db.user.deleteMany({ where: { id: { in: created } } });
  await db.$disconnect();
});

describe("built-in Malaysian places", () => {
  test("finds neighbourhoods by name, alias and postcode", () => {
    assert.match(lookupMalaysianPlace("Bangsar")!.label, /^Bangsar,/);
    assert.match(lookupMalaysianPlace("ttdi")!.label, /^Taman Tun Dr Ismail/);
    assert.match(lookupMalaysianPlace("59100")!.label, /^Bangsar,/);
    assert.match(lookupMalaysianPlace("Mont' Kiara")!.label, /^Mont Kiara/);
  });

  test("finds the area inside a full address", () => {
    assert.match(lookupMalaysianPlace("No. 12, Jalan Telawi 3, Bangsar, Kuala Lumpur")!.label, /^Bangsar,/);
    assert.match(lookupMalaysianPlace("No. 8, Jalan SS2/24, 47300 Petaling Jaya")!.label, /^Petaling Jaya/);
  });

  test("prefers the most specific match", () => {
    assert.match(lookupMalaysianPlace("Bangsar South")!.label, /^Bangsar South/);
    assert.match(lookupMalaysianPlace("Damansara Heights")!.label, /^Damansara Heights/);
  });

  test("falls back to the postcode region, and returns null for unknown places", () => {
    assert.match(lookupMalaysianPlace("56999")!.label, /^Cheras/);
    assert.equal(lookupMalaysianPlace("Atlantis"), null);
  });
});

describe("repairing missing locations", () => {
  test("fills in coordinates from the saved neighbourhood", async () => {
    const u = await db.user.create({
      data: { email: `nolocation.${Date.now()}@test.local`, passwordHash: "x", role: "SITTER", firstName: "N", lastName: "L", area: "Mont Kiara" },
    });
    created.push(u.id);
    assert.equal(await repairMissingLocation(u.id), true);
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    assert.ok(after.latitude != null && Math.abs(after.latitude - 3.171) < 0.01);
    // Already located: nothing to do.
    assert.equal(await repairMissingLocation(u.id), false);
  });
});
