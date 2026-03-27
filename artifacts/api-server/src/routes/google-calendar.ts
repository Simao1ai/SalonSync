import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  getAuthUrl,
  handleCallback,
  disconnectCalendar,
  syncGoogleBlocksToAvailability,
  isGoogleCalendarConfigured,
} from "../services/google-calendar";

const router: IRouter = Router();

router.get("/google-calendar/status", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db.select({
    googleCalendarId: usersTable.googleCalendarId,
    googleAccessToken: usersTable.googleAccessToken,
  }).from(usersTable).where(eq(usersTable.id, req.user.id));

  res.json({
    configured: isGoogleCalendarConfigured(),
    connected: !!(user?.googleAccessToken),
    calendarId: user?.googleCalendarId ?? null,
  });
});

router.get("/google-calendar/connect", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const url = getAuthUrl();
  if (!url) {
    res.status(503).json({ error: "Google Calendar integration is not configured" });
    return;
  }

  res.json({ url });
});

router.get("/google-calendar/callback", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const code = req.query.code as string;
  if (!code) {
    res.status(400).json({ error: "Missing authorization code" });
    return;
  }

  const success = await handleCallback(code, req.user.id);
  if (success) {
    res.json({ success: true, message: "Google Calendar connected successfully" });
  } else {
    res.status(500).json({ error: "Failed to connect Google Calendar" });
  }
});

router.post("/google-calendar/disconnect", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  await disconnectCalendar(req.user.id);
  res.json({ success: true, message: "Google Calendar disconnected" });
});

router.post("/google-calendar/sync", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const synced = await syncGoogleBlocksToAvailability(req.user.id);
  res.json({ success: true, synced });
});

export default router;
