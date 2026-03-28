import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { locationsTable, announcementsTable } from "@workspace/db/schema";
import { eq, or, isNull, desc } from "drizzle-orm";
import {
  CreateLocationBody,
  UpdateLocationBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/locations", async (_req, res) => {
  const locations = await db.select().from(locationsTable).where(eq(locationsTable.isActive, true));
  res.json(locations);
});

router.get("/announcements", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const userRole = req.user!.role;
    const announcements = await db
      .select({
        id: announcementsTable.id,
        title: announcementsTable.title,
        message: announcementsTable.message,
        type: announcementsTable.type,
        targetRole: announcementsTable.targetRole,
        createdAt: announcementsTable.createdAt,
      })
      .from(announcementsTable)
      .where(
        or(
          isNull(announcementsTable.targetRole),
          eq(announcementsTable.targetRole, userRole)
        )
      )
      .orderBy(desc(announcementsTable.createdAt))
      .limit(20);

    res.json(announcements);
  } catch (err) {
    console.error("announcements fetch error", err);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

router.patch("/locations/:id/branding", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Only admins can update branding" });
    return;
  }
  if (req.user!.role === "ADMIN" && req.user!.locationId !== req.params.id) {
    res.status(403).json({ error: "You can only update branding for your own location" });
    return;
  }
  try {
    const body = req.body;
    if (typeof body !== "object" || body === null) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const { brandName, logoUrl, primaryColor, tagline } = body as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (brandName !== undefined) {
      if (typeof brandName !== "string") { res.status(400).json({ error: "brandName must be a string" }); return; }
      updates.brandName = brandName.slice(0, 255);
    }
    if (logoUrl !== undefined) {
      if (typeof logoUrl !== "string") { res.status(400).json({ error: "logoUrl must be a string" }); return; }
      updates.logoUrl = logoUrl.slice(0, 500);
    }
    if (primaryColor !== undefined) {
      if (typeof primaryColor !== "string") { res.status(400).json({ error: "primaryColor must be a string" }); return; }
      updates.primaryColor = primaryColor.slice(0, 20);
    }
    if (tagline !== undefined) {
      if (typeof tagline !== "string") { res.status(400).json({ error: "tagline must be a string" }); return; }
      updates.tagline = tagline.slice(0, 500);
    }

    const [updated] = await db
      .update(locationsTable)
      .set(updates)
      .where(eq(locationsTable.id, req.params.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Location not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("branding update error", err);
    res.status(500).json({ error: "Failed to update branding" });
  }
});

router.post("/locations", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user!.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Only super admins can create locations" });
    return;
  }
  const body = CreateLocationBody.parse(req.body);
  const [location] = await db.insert(locationsTable).values(body).returning();
  res.status(201).json(location);
});

router.get("/locations/:id", async (req, res) => {
  const [location] = await db
    .select()
    .from(locationsTable)
    .where(eq(locationsTable.id, req.params.id));
  if (!location) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json(location);
});

router.put("/locations/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Only admins can update locations" });
    return;
  }
  if (req.user!.role === "ADMIN" && req.user!.locationId !== req.params.id) {
    res.status(403).json({ error: "You can only update your own location" });
    return;
  }
  const body = UpdateLocationBody.parse(req.body);
  if (req.user!.role !== "SUPER_ADMIN") {
    delete (body as any).isActive;
  }
  const [updated] = await db
    .update(locationsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(locationsTable.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json(updated);
});

router.delete("/locations/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user!.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Only super admins can deactivate locations" });
    return;
  }
  await db
    .update(locationsTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(locationsTable.id, req.params.id));
  res.status(204).send();
});

export default router;
