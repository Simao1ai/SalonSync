import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { socialBookingLinksTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

router.post("/social-booking/generate", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = req.user as any;
  if (!["ADMIN", "SUPER_ADMIN"].includes(user?.role)) { res.status(403).json({ error: "Admin access required" }); return; }

  const { locationId, platform } = req.body;
  if (!locationId || !platform) { res.status(400).json({ error: "locationId and platform required" }); return; }

  const validPlatforms = ["instagram", "facebook", "tiktok", "twitter", "linkedin", "other"];
  if (!validPlatforms.includes(platform)) { res.status(400).json({ error: `Invalid platform. Must be one of: ${validPlatforms.join(", ")}` }); return; }

  try {
    const trackingCode = `${platform}-${locationId.slice(0, 8)}-${Date.now().toString(36)}`;
    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://salonsync.replit.app";
    const url = `${baseUrl}/api/social-booking/track/${trackingCode}`;

    const [link] = await db.insert(socialBookingLinksTable).values({
      locationId,
      platform,
      trackingCode,
      url,
    }).returning();

    res.status(201).json(link);
  } catch (e: any) {
    console.error("Social booking generate error:", e?.message);
    res.status(500).json({ error: "Failed to generate booking link" });
  }
});

router.get("/social-booking/links", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = req.user as any;
  if (!["ADMIN", "SUPER_ADMIN"].includes(user?.role)) { res.status(403).json({ error: "Admin access required" }); return; }

  const locationId = req.query.locationId as string;
  if (!locationId) { res.status(400).json({ error: "locationId required" }); return; }

  try {
    const links = await db.select().from(socialBookingLinksTable)
      .where(eq(socialBookingLinksTable.locationId, locationId))
      .orderBy(socialBookingLinksTable.createdAt);
    res.json(links);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch links" });
  }
});

router.get("/social-booking/track/:code", async (req: Request, res: Response) => {
  try {
    const [link] = await db.select().from(socialBookingLinksTable)
      .where(eq(socialBookingLinksTable.trackingCode, req.params.code));

    if (!link) { res.redirect("/explore"); return; }

    await db.update(socialBookingLinksTable)
      .set({ clicks: sql`${socialBookingLinksTable.clicks} + 1` })
      .where(eq(socialBookingLinksTable.id, link.id));

    res.redirect(`/client/book?ref=${link.platform}&loc=${link.locationId}`);
  } catch (e) {
    res.redirect("/explore");
  }
});

router.delete("/social-booking/links/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = req.user as any;
  if (!["ADMIN", "SUPER_ADMIN"].includes(user?.role)) { res.status(403).json({ error: "Admin access required" }); return; }

  try {
    await db.delete(socialBookingLinksTable).where(eq(socialBookingLinksTable.id, req.params.id));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete link" });
  }
});

export default router;
