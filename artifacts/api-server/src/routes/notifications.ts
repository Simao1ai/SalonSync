import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

router.get("/notifications", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, req.user.id))
    .orderBy(notificationsTable.createdAt);
  res.json(notifications);
});

router.post("/notifications/:id/read", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [notification] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(
      and(
        eq(notificationsTable.id, req.params.id),
        eq(notificationsTable.userId, req.user.id),
      )
    )
    .returning();
  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json(notification);
});

// PATCH /api/notifications/preferences — update sms/email opt-in for current user
const PrefsBody = z.object({
  smsEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
});

router.patch("/notifications/preferences", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = PrefsBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const updates: Record<string, boolean> = {};
  if (body.data.smsEnabled !== undefined) updates.smsEnabled = body.data.smsEnabled;
  if (body.data.emailEnabled !== undefined) updates.emailEnabled = body.data.emailEnabled;

  if (Object.keys(updates).length === 0) { res.json({ success: true }); return; }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, req.user.id));
  res.json({ success: true });
});

// GET /api/notifications/preferences — fetch current user prefs
router.get("/notifications/preferences", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [user] = await db.select({
    smsEnabled: usersTable.smsEnabled,
    emailEnabled: usersTable.emailEnabled,
    phone: usersTable.phone,
    email: usersTable.email,
  }).from(usersTable).where(eq(usersTable.id, req.user.id));

  res.json(user ?? { smsEnabled: true, emailEnabled: true, phone: null, email: null });
});

export default router;
