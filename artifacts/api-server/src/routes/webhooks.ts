import { Router } from "express";
import { db } from "@workspace/db";
import { webhooksTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

router.get("/webhooks", async (req, res) => {
  if (!req.isAuthenticated() || !["ADMIN", "SUPER_ADMIN"].includes(req.user!.role!)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const locationId = req.query.locationId as string;
  if (!locationId) { res.status(400).json({ error: "locationId required" }); return; }

  const webhooks = await db.select().from(webhooksTable).where(eq(webhooksTable.locationId, locationId));
  res.json(webhooks.map(w => ({
    ...w,
    secret: w.secret.slice(0, 12) + "..." + w.secret.slice(-4),
  })));
});

router.post("/webhooks", async (req, res) => {
  if (!req.isAuthenticated() || !["ADMIN", "SUPER_ADMIN"].includes(req.user!.role!)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { locationId, url, events } = req.body;
  if (!locationId || !url || !Array.isArray(events) || events.length === 0) {
    res.status(400).json({ error: "locationId, url, and events[] required" });
    return;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      res.status(400).json({ error: "Webhook URL must use HTTPS" });
      return;
    }
    const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254", "[::1]"];
    if (blockedHosts.includes(parsed.hostname)) {
      res.status(400).json({ error: "Webhook URL cannot target local/internal hosts" });
      return;
    }
  } catch {
    res.status(400).json({ error: "Invalid URL format" });
    return;
  }

  const validEvents = [
    "appointment.created",
    "appointment.cancelled",
    "client.created",
    "payment.completed",
    "review.created",
  ];
  const invalidEvents = events.filter((e: string) => !validEvents.includes(e));
  if (invalidEvents.length > 0) {
    res.status(400).json({ error: `Invalid events: ${invalidEvents.join(", ")}` });
    return;
  }

  try {
    const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
    const [webhook] = await db.insert(webhooksTable).values({
      locationId,
      url,
      events,
      secret,
    }).returning();

    res.status(201).json(webhook);
  } catch (err) {
    console.error("Create webhook error:", err);
    res.status(500).json({ error: "Failed to create webhook" });
  }
});

router.patch("/webhooks/:id", async (req, res) => {
  if (!req.isAuthenticated() || !["ADMIN", "SUPER_ADMIN"].includes(req.user!.role!)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { id } = req.params;
  const { url, events, isActive } = req.body;

  const updates: Record<string, unknown> = {};
  if (url !== undefined) updates.url = url;
  if (events !== undefined) updates.events = events;
  if (isActive !== undefined) updates.isActive = isActive;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No updates provided" });
    return;
  }

  try {
    const [updated] = await db.update(webhooksTable).set(updates).where(eq(webhooksTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Webhook not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update webhook" });
  }
});

router.delete("/webhooks/:id", async (req, res) => {
  if (!req.isAuthenticated() || !["ADMIN", "SUPER_ADMIN"].includes(req.user!.role!)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { id } = req.params;
  const [deleted] = await db.delete(webhooksTable).where(eq(webhooksTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Webhook not found" }); return; }
  res.json({ success: true });
});

router.post("/webhooks/:id/test", async (req, res) => {
  if (!req.isAuthenticated() || !["ADMIN", "SUPER_ADMIN"].includes(req.user!.role!)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { id } = req.params;
  const [webhook] = await db.select().from(webhooksTable).where(eq(webhooksTable.id, id));
  if (!webhook) { res.status(404).json({ error: "Webhook not found" }); return; }

  const testPayload = {
    event: "test",
    locationId: webhook.locationId,
    data: { message: "This is a test webhook from SalonSync" },
    timestamp: new Date().toISOString(),
  };
  const body = JSON.stringify(testPayload);
  const signature = crypto.createHmac("sha256", webhook.secret).update(body).digest("hex");

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SalonSync-Signature": signature,
        "X-SalonSync-Event": "test",
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    res.json({
      success: response.ok,
      statusCode: response.status,
      statusText: response.statusText,
    });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

export default router;
