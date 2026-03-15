import { db } from "@workspace/db";
import {
  locationsTable,
  servicesTable,
} from "@workspace/db/schema";

async function seed() {
  const existing = await db.select().from(locationsTable);
  if (existing.length > 0) {
    console.log("Already seeded. Location:", existing[0].id);
    process.exit(0);
  }

  const [location] = await db.insert(locationsTable).values({
    name: "SalonSync Downtown",
    address: "123 Luxury Ave",
    city: "Beverly Hills",
    state: "CA",
    zip: "90210",
    phone: "(310) 555-0100",
    email: "hello@salonsync.com",
    timezone: "America/Los_Angeles",
    cancellationWindowHours: 48,
    standardCancelFeePercent: 50,
    highValueCancelFeePercent: 100,
    isActive: true,
  }).returning();

  console.log("Created location:", location.id);

  await db.insert(servicesTable).values([
    {
      name: "Classic Cut & Style",
      category: "STANDARD",
      basePrice: 85,
      durationMinutes: 60,
      description: "Precision cut with blowout finish",
      locationId: location.id,
      isActive: true,
    },
    {
      name: "Color Treatment",
      category: "HIGH_VALUE",
      basePrice: 225,
      durationMinutes: 150,
      description: "Full color with toner and gloss",
      locationId: location.id,
      isActive: true,
    },
    {
      name: "Balayage",
      category: "HIGH_VALUE",
      basePrice: 350,
      durationMinutes: 210,
      description: "Hand-painted highlights for sun-kissed look",
      locationId: location.id,
      isActive: true,
    },
    {
      name: "Deep Conditioning",
      category: "STANDARD",
      basePrice: 65,
      durationMinutes: 45,
      description: "Intensive moisture treatment",
      locationId: location.id,
      isActive: true,
    },
    {
      name: "Blowout",
      category: "STANDARD",
      basePrice: 55,
      durationMinutes: 45,
      description: "Professional blowdry & style",
      locationId: location.id,
      isActive: true,
    },
    {
      name: "Keratin Smoothing",
      category: "HIGH_VALUE",
      basePrice: 400,
      durationMinutes: 240,
      description: "Frizz-free smoothing treatment",
      locationId: location.id,
      isActive: true,
    },
  ]);

  console.log("Seeded 6 services. Done!");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
