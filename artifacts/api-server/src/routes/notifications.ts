import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notificationsTable, notificationPreferencesTable, usersTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
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
    .orderBy(desc(notificationsTable.createdAt));
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

const PrefsBody = z.object({
  smsEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  reminderHoursBefore: z.number().int().min(1).max(72).optional(),
  secondReminderHours: z.number().int().min(1).max(24).optional(),
  marketingOptIn: z.boolean().optional(),
  reviewRequestEnabled: z.boolean().optional(),
});

router.patch("/notifications/preferences", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = PrefsBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const { smsEnabled, emailEnabled, reminderHoursBefore, secondReminderHours, marketingOptIn, reviewRequestEnabled } = body.data;

  const [existing] = await db.select()
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, req.user.id));

  if (existing) {
    const updates: Record<string, any> = {};
    if (smsEnabled !== undefined) updates.smsEnabled = smsEnabled;
    if (emailEnabled !== undefined) updates.emailEnabled = emailEnabled;
    if (reminderHoursBefore !== undefined) updates.reminderHoursBefore = reminderHoursBefore;
    if (secondReminderHours !== undefined) updates.secondReminderHours = secondReminderHours;
    if (marketingOptIn !== undefined) updates.marketingOptIn = marketingOptIn;
    if (reviewRequestEnabled !== undefined) updates.reviewRequestEnabled = reviewRequestEnabled;

    if (Object.keys(updates).length > 0) {
      await db.update(notificationPreferencesTable)
        .set(updates)
        .where(eq(notificationPreferencesTable.userId, req.user.id));
    }
  } else {
    await db.insert(notificationPreferencesTable).values({
      userId: req.user.id,
      smsEnabled: smsEnabled ?? true,
      emailEnabled: emailEnabled ?? true,
      reminderHoursBefore: reminderHoursBefore ?? 24,
      secondReminderHours: secondReminderHours ?? 2,
      marketingOptIn: marketingOptIn ?? false,
      reviewRequestEnabled: reviewRequestEnabled ?? true,
    });
  }

  if (smsEnabled !== undefined || emailEnabled !== undefined) {
    const userUpdates: Record<string, boolean> = {};
    if (smsEnabled !== undefined) userUpdates.smsEnabled = smsEnabled;
    if (emailEnabled !== undefined) userUpdates.emailEnabled = emailEnabled;
    await db.update(usersTable).set(userUpdates).where(eq(usersTable.id, req.user.id));
  }

  res.json({ success: true });
});

router.get("/notifications/preferences", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [prefs] = await db.select()
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, req.user.id));

  const [user] = await db.select({
    phone: usersTable.phone,
    email: usersTable.email,
    smsEnabled: usersTable.smsEnabled,
    emailEnabled: usersTable.emailEnabled,
  }).from(usersTable).where(eq(usersTable.id, req.user.id));

  res.json({
    smsEnabled: prefs?.smsEnabled ?? user?.smsEnabled ?? true,
    emailEnabled: prefs?.emailEnabled ?? user?.emailEnabled ?? true,
    reminderHoursBefore: prefs?.reminderHoursBefore ?? 24,
    secondReminderHours: prefs?.secondReminderHours ?? 2,
    marketingOptIn: prefs?.marketingOptIn ?? false,
    reviewRequestEnabled: prefs?.reviewRequestEnabled ?? true,
    phone: user?.phone ?? null,
    email: user?.email ?? null,
  });
});

router.get("/notifications/delivery-log", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const logs = await db
    .select({
      id: notificationsTable.id,
      type: notificationsTable.type,
      title: notificationsTable.title,
      channel: notificationsTable.channel,
      deliveryStatus: notificationsTable.deliveryStatus,
      sentAt: notificationsTable.sentAt,
      createdAt: notificationsTable.createdAt,
    })
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, req.user.id))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json(logs);
});

export default router;
