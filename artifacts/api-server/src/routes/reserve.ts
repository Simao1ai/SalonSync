import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  locationsTable,
  servicesTable,
  availabilityTable,
  appointmentsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte, inArray, or } from "drizzle-orm";

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

    // Fetch all availability records (both regular and blocked)
    const regularAvailability = await db.select({
      id: availabilityTable.id,
      dayOfWeek: availabilityTable.dayOfWeek,
      startTime: availabilityTable.startTime,
      endTime: availabilityTable.endTime,
      userId: availabilityTable.userId,
    }).from(availabilityTable)
      .innerJoin(usersTable, eq(availabilityTable.userId, usersTable.id))
      .where(and(eq(usersTable.locationId, locationId), eq(availabilityTable.isBlocked, false)));

    // Fetch blocked dates (vacations, time off)
    const blockedDates = await db.select({
      userId: availabilityTable.userId,
      blockDate: availabilityTable.blockDate,
    }).from(availabilityTable)
      .innerJoin(usersTable, eq(availabilityTable.userId, usersTable.id))
      .where(and(eq(usersTable.locationId, locationId), eq(availabilityTable.isBlocked, true)));

    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + 14 * 86400000);

    // Include both CONFIRMED and PENDING appointments, and catch appointments
    // that overlap the window (not just those starting within it)
    const existingAppointments = await db.select({
      staffId: appointmentsTable.staffId,
      startTime: appointmentsTable.startTime,
      endTime: appointmentsTable.endTime,
    }).from(appointmentsTable).where(and(
      eq(appointmentsTable.locationId, locationId),
      lte(appointmentsTable.startTime, twoWeeksOut),
      gte(appointmentsTable.endTime, now),
      inArray(appointmentsTable.status, ["CONFIRMED", "PENDING"]),
    ));

    const slots: any[] = [];

    for (let d = 0; d < 14; d++) {
      const date = new Date(now.getTime() + d * 86400000);
      const dow = date.getDay();
      const dayAvailability = regularAvailability.filter((a) => a.dayOfWeek === dow);

      for (const avail of dayAvailability) {
        if (!avail.startTime || !avail.endTime) continue;

        // Check if this staff member has a blocked date for this day
        const dateStr = date.toISOString().slice(0, 10);
        const isBlocked = blockedDates.some((b) =>
          b.userId === avail.userId &&
          b.blockDate &&
          new Date(b.blockDate).toISOString().slice(0, 10) === dateStr
        );
        if (isBlocked) continue;

        const [startH, startM] = avail.startTime.split(":").map(Number);
        const [endH, endM] = avail.endTime.split(":").map(Number);

        for (let h = startH; h < endH; h++) {
          for (const m of [0, 30]) {
            if (h === startH && m < startM) continue;
            // Allow last slot if it fits before end time
            const slotEndMinute = h * 60 + m + 30;
            const endMinute = endH * 60 + endM;
            if (slotEndMinute > endMinute) continue;

            const slotStart = new Date(date);
            slotStart.setHours(h, m, 0, 0);

            const slotEnd = new Date(slotStart.getTime() + 30 * 60000);

            // Only include the staff member who owns this availability record
            const availStaff = staff.find((s) => s.id === avail.userId);
            if (!availStaff) continue;

            const hasConflict = existingAppointments.some(
              (a) =>
                a.staffId === availStaff.id &&
                new Date(a.startTime) < slotEnd &&
                new Date(a.endTime!) > slotStart
            );
            if (hasConflict) continue;

            // Merge into existing slot at same time or create new one
            const existingSlot = slots.find(
              (s) => s.startTime === slotStart.toISOString() && s.endTime === slotEnd.toISOString()
            );
            if (existingSlot) {
              if (!existingSlot.availableStaff.some((s: any) => s.staffId === availStaff.id)) {
                existingSlot.availableStaff.push({
                  staffId: availStaff.id,
                  staffName: `${availStaff.firstName} ${availStaff.lastName}`,
                });
              }
            } else {
              slots.push({
                startTime: slotStart.toISOString(),
                endTime: slotEnd.toISOString(),
                availableStaff: [{
                  staffId: availStaff.id,
                  staffName: `${availStaff.firstName} ${availStaff.lastName}`,
                }],
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
