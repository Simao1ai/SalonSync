import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { locationsTable, usersTable, subscriptionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createSession, SESSION_COOKIE, SESSION_TTL } from "../lib/auth";

const router: IRouter = Router();

const OnboardingBody = z.object({
  salonName: z.string().min(1, "Salon name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(1, "ZIP code is required"),
  salonPhone: z.string().optional(),
  salonEmail: z.string().email("Valid email is required").optional(),
  ownerFirstName: z.string().min(1, "First name is required"),
  ownerLastName: z.string().min(1, "Last name is required"),
  ownerEmail: z.string().email("Valid email is required"),
  ownerPhone: z.string().optional(),
  description: z.string().optional(),
});

router.post("/onboarding", async (req, res) => {
  try {
    const parsed = OnboardingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") });
      return;
    }

    const d = parsed.data;

    const existingUser = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, d.ownerEmail))
      .limit(1);

    if (existingUser.length > 0) {
      res.status(409).json({ error: "An account with this email already exists. Please sign in instead." });
      return;
    }

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);

    const result = await db.transaction(async (tx) => {
      const [location] = await tx.insert(locationsTable).values({
        name: d.salonName,
        address: d.address,
        city: d.city,
        state: d.state,
        zip: d.zip,
        phone: d.salonPhone || null,
        email: d.salonEmail || null,
        description: d.description || null,
        brandName: d.salonName,
        isActive: true,
      }).returning();

      const [user] = await tx.insert(usersTable).values({
        id: crypto.randomUUID(),
        firstName: d.ownerFirstName,
        lastName: d.ownerLastName,
        email: d.ownerEmail,
        phone: d.ownerPhone || null,
        role: "ADMIN",
        locationId: location.id,
        isActive: true,
      }).returning();

      await tx.insert(subscriptionsTable).values({
        locationId: location.id,
        plan: "trial",
        status: "active",
        monthlyAmount: 0,
        trialEndsAt: trialEnd,
        currentPeriodEnd: trialEnd,
      });

      return { location, user };
    });

    const sid = await createSession({
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role as "ADMIN",
        locationId: result.user.locationId,
        profileImageUrl: null,
      },
      access_token: "onboarding-session",
    });

    res.cookie(SESSION_COOKIE, sid, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: SESSION_TTL,
      path: "/",
    });

    res.status(201).json({
      user: {
        id: result.user.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: result.user.email,
        role: result.user.role,
        locationId: result.location.id,
      },
      location: {
        id: result.location.id,
        name: result.location.name,
      },
      trialEndsAt: trialEnd.toISOString(),
    });
  } catch (err: unknown) {
    console.error("Onboarding error:", err);
    res.status(500).json({ error: "Something went wrong during signup. Please try again." });
  }
});

router.get("/onboarding/trial-status", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const locationId = req.user!.locationId;
  if (!locationId) {
    res.json({ onTrial: false, trialEndsAt: null, daysRemaining: null });
    return;
  }

  const [sub] = await db.select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.locationId, locationId))
    .limit(1);

  if (!sub || sub.plan !== "trial" || !sub.trialEndsAt) {
    res.json({ onTrial: false, trialEndsAt: null, daysRemaining: null });
    return;
  }

  const now = new Date();
  const end = new Date(sub.trialEndsAt);
  const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const expired = daysRemaining <= 0;

  res.json({
    onTrial: true,
    trialEndsAt: sub.trialEndsAt,
    daysRemaining,
    expired,
  });
});

export default router;
