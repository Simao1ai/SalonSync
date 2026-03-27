import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  locationsTable,
  servicesTable,
  availabilityTable,
  appointmentsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

const router: IRouter = Router();

router.get("/reserve/availability-feed", async (req: Request, res: Response) => {
  const locationId = req.query.locationId as string;
  if (!locationId) { res.status(400).json({ error: "locationId required" }); return; }

  try {
    const [location] = await db.select().from(locationsTable).where(eq(locationsTable.id, locationId));
    if (!location) { res.status(404).json({ error: "Location not found" }); return; }

    const services = await db.select().from(servicesTable)
      .where(and(eq(servicesTable.locationId, locationId), eq(servicesTable.isActive, true)));

    const staff = await db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable)
      .where(and(eq(usersTable.locationId, locationId), eq(usersTable.role, "STAFF"), eq(usersTable.isActive, true)));

    const availability = await db.select({
      id: availabilityTable.id,
      dayOfWeek: availabilityTable.dayOfWeek,
      startTime: availabilityTable.startTime,
      endTime: availabilityTable.endTime,
      userId: availabilityTable.userId,
    }).from(availabilityTable)
      .innerJoin(usersTable, eq(availabilityTable.userId, usersTable.id))
      .where(and(eq(usersTable.locationId, locationId), eq(availabilityTable.isBlocked, false)));

    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + 14 * 86400000);

    const existingAppointments = await db.select({
      staffId: appointmentsTable.staffId,
      startTime: appointmentsTable.startTime,
      endTime: appointmentsTable.endTime,
    }).from(appointmentsTable).where(and(
      eq(appointmentsTable.locationId, locationId),
      gte(appointmentsTable.startTime, now),
      lte(appointmentsTable.startTime, twoWeeksOut),
      eq(appointmentsTable.status, "CONFIRMED"),
    ));

    const slots: any[] = [];

    for (let d = 0; d < 14; d++) {
      const date = new Date(now.getTime() + d * 86400000);
      const dow = date.getDay();
      const dayAvailability = availability.filter((a) => a.dayOfWeek === dow);

      for (const avail of dayAvailability) {
        if (!avail.startTime || !avail.endTime) continue;
        const [startH, startM] = avail.startTime.split(":").map(Number);
        const [endH, endM] = avail.endTime.split(":").map(Number);

        for (let h = startH; h < endH; h++) {
          for (const m of [0, 30]) {
            if (h === startH && m < startM) continue;
            if (h === endH - 1 && m >= endM) continue;

            const slotStart = new Date(date);
            slotStart.setHours(h, m, 0, 0);

            const slotEnd = new Date(slotStart.getTime() + 30 * 60000);

            const staffForSlot = staff.filter((s) => {
              const conflicts = existingAppointments.filter(
                (a) =>
                  a.staffId === s.id &&
                  new Date(a.startTime) < slotEnd &&
                  new Date(a.endTime!) > slotStart
              );
              return conflicts.length === 0;
            });

            if (staffForSlot.length > 0) {
              slots.push({
                startTime: slotStart.toISOString(),
                endTime: slotEnd.toISOString(),
                availableStaff: staffForSlot.map((s) => ({
                  staffId: s.id,
                  staffName: `${s.firstName} ${s.lastName}`,
                })),
              });
            }
          }
        }
      }
    }

    res.json({
      merchantId: locationId,
      merchantName: location.brandName || location.name,
      lastUpdated: new Date().toISOString(),
      slots: slots.slice(0, 500),
    });
  } catch (e: any) {
    console.error("Reserve availability error:", e?.message);
    res.status(500).json({ error: "Failed to generate availability feed" });
  }
});

router.get("/reserve/service-feed", async (req: Request, res: Response) => {
  const locationId = req.query.locationId as string;
  if (!locationId) { res.status(400).json({ error: "locationId required" }); return; }

  try {
    const [location] = await db.select().from(locationsTable).where(eq(locationsTable.id, locationId));
    if (!location) { res.status(404).json({ error: "Location not found" }); return; }

    const services = await db.select().from(servicesTable)
      .where(and(eq(servicesTable.locationId, locationId), eq(servicesTable.isActive, true)));

    res.json({
      merchantId: locationId,
      merchantName: location.brandName || location.name,
      address: {
        streetAddress: location.address,
        city: location.city,
        state: location.state,
        postalCode: location.zip,
        country: "US",
      },
      phone: location.phone,
      website: process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/explore/${locationId}` : null,
      geo: location.latitude && location.longitude ? { latitude: location.latitude, longitude: location.longitude } : null,
      services: services.map((s) => ({
        serviceId: s.id,
        name: s.name,
        category: s.category,
        price: {
          amount: Number(s.basePrice),
          currency: "USD",
        },
        durationMinutes: s.durationMinutes,
      })),
    });
  } catch (e: any) {
    console.error("Reserve service feed error:", e?.message);
    res.status(500).json({ error: "Failed to generate service feed" });
  }
});

export default router;
