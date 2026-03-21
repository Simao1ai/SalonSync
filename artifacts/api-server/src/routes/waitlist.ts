import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  waitlistTable,
  usersTable,
  servicesTable,
  locationsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const CreateWaitlistBody = z.object({
  serviceId: z.string().min(1),
  staffId: z.string().optional(),
  locationId: z.string().min(1),
  preferredDayOfWeek: z.number().int().min(0).max(6).optional(),
  preferredTimeRange: z.enum(["MORNING", "AFTERNOON", "EVENING"]).optional(),
});

async function enrichWaitlistEntry(entry: typeof waitlistTable.$inferSelect) {
  const [client] = await db.select({
    id: usersTable.id,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    email: usersTable.email,
    phone: usersTable.phone,
  }).from(usersTable).where(eq(usersTable.id, entry.clientId));

  const [service] = await db.select({
    id: servicesTable.id,
    name: servicesTable.name,
    basePrice: servicesTable.basePrice,
    durationMinutes: servicesTable.durationMinutes,
  }).from(servicesTable).where(eq(servicesTable.id, entry.serviceId));

  let staff = null;
  if (entry.staffId) {
    const [s] = await db.select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    }).from(usersTable).where(eq(usersTable.id, entry.staffId));
    staff = s ?? null;
  }

  const [location] = await db.select({ id: locationsTable.id, name: locationsTable.name })
    .from(locationsTable).where(eq(locationsTable.id, entry.locationId));

  return { ...entry, client, service, staff, location };
}

// POST /api/waitlist — join the waitlist
router.post("/waitlist", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = CreateWaitlistBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  // Check for existing active entry for same client+service+location
  const existing = await db.select().from(waitlistTable).where(
    and(
      eq(waitlistTable.clientId, req.user.id),
      eq(waitlistTable.serviceId, body.data.serviceId),
      eq(waitlistTable.locationId, body.data.locationId),
    )
  );
  const active = existing.filter(e => e.status === "WAITING" || e.status === "NOTIFIED");
  if (active.length > 0) {
    res.status(409).json({ error: "You are already on the waitlist for this service." });
    return;
  }

  const [entry] = await db.insert(waitlistTable).values({
    clientId: req.user.id,
    serviceId: body.data.serviceId,
    staffId: body.data.staffId ?? null,
    locationId: body.data.locationId,
    preferredDayOfWeek: body.data.preferredDayOfWeek ?? null,
    preferredTimeRange: body.data.preferredTimeRange ?? null,
    status: "WAITING",
  }).returning();

  res.status(201).json(await enrichWaitlistEntry(entry));
});

// GET /api/waitlist — list entries (my own if CLIENT, all if ADMIN/STAFF)
router.get("/waitlist", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const locationId = req.query.locationId as string | undefined;

  let rows;
  if (req.user.role === "ADMIN" || req.user.role === "STAFF") {
    const conditions = locationId ? [eq(waitlistTable.locationId, locationId)] : [];
    rows = conditions.length
      ? await db.select().from(waitlistTable).where(and(...conditions as [any]))
      : await db.select().from(waitlistTable);
  } else {
    rows = await db.select().from(waitlistTable).where(eq(waitlistTable.clientId, req.user.id));
  }

  const enriched = await Promise.all(rows.map(enrichWaitlistEntry));
  res.json(enriched);
});

// GET /api/waitlist/:id — single entry
router.get("/waitlist/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [entry] = await db.select().from(waitlistTable).where(eq(waitlistTable.id, req.params.id));
  if (!entry) { res.status(404).json({ error: "Not found" }); return; }
  if (req.user.role === "CLIENT" && entry.clientId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  res.json(await enrichWaitlistEntry(entry));
});

// DELETE /api/waitlist/:id — remove from waitlist
router.delete("/waitlist/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [entry] = await db.select().from(waitlistTable).where(eq(waitlistTable.id, req.params.id));
  if (!entry) { res.status(404).json({ error: "Not found" }); return; }
  if (req.user.role === "CLIENT" && entry.clientId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.delete(waitlistTable).where(eq(waitlistTable.id, req.params.id));
  res.status(204).end();
});

// PATCH /api/waitlist/:id — update status (admin)
router.patch("/waitlist/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role === "CLIENT") { res.status(403).json({ error: "Forbidden" }); return; }

  const StatusBody = z.object({ status: z.enum(["WAITING", "NOTIFIED", "BOOKED", "EXPIRED"]) });
  const body = StatusBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid status" }); return; }

  const [updated] = await db
    .update(waitlistTable)
    .set({ status: body.data.status, notifiedAt: body.data.status === "NOTIFIED" ? new Date() : undefined })
    .where(eq(waitlistTable.id, req.params.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  res.json(await enrichWaitlistEntry(updated));
});

export default router;
