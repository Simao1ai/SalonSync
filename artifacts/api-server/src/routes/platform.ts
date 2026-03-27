import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, locationsTable, appointmentsTable, paymentsTable, reviewsTable, servicesTable, announcementsTable, subscriptionsTable } from "@workspace/db";
import { eq, count, sum, avg, desc, and, gte, ne, sql } from "drizzle-orm";
import { createSession, getSessionId, getSession, deleteSession, SESSION_COOKIE, SESSION_TTL, type SessionData } from "../lib/auth";

const router: IRouter = Router();

const VALID_PLANS = ["free", "starter", "professional", "enterprise"] as const;
const VALID_SUB_STATUSES = ["active", "cancelled", "past_due", "trialing"] as const;
const VALID_ANN_TYPES = ["info", "warning", "alert", "update"] as const;
const VALID_TARGET_ROLES = ["ADMIN", "STAFF", "CLIENT"] as const;

function auditLog(action: string, actorId: string, details: Record<string, unknown>) {
  console.log(JSON.stringify({ audit: true, action, actorId, ...details, timestamp: new Date().toISOString() }));
}

function requireSuperAdmin(req: Request, res: Response): boolean {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  if (req.user.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Super admin access required" });
    return false;
  }
  return true;
}

router.get("/platform/stats", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const [locationCount] = await db.select({ count: count() }).from(locationsTable);
    const [userCount] = await db.select({ count: count() }).from(usersTable);
    const [aptCount] = await db.select({ count: count() }).from(appointmentsTable);

    const adminCount = await db
      .select({ count: count() })
      .from(usersTable)
      .where(eq(usersTable.role, "ADMIN"));

    const staffCount = await db
      .select({ count: count() })
      .from(usersTable)
      .where(eq(usersTable.role, "STAFF"));

    const clientCount = await db
      .select({ count: count() })
      .from(usersTable)
      .where(eq(usersTable.role, "CLIENT"));

    const revenueResult = await db
      .select({ total: sum(paymentsTable.amount) })
      .from(paymentsTable);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayApts] = await db
      .select({ count: count() })
      .from(appointmentsTable)
      .where(gte(appointmentsTable.startTime, today));

    const [completedApts] = await db
      .select({ count: count() })
      .from(appointmentsTable)
      .where(eq(appointmentsTable.status, "COMPLETED"));

    const [avgRating] = await db
      .select({ avg: avg(reviewsTable.rating) })
      .from(reviewsTable);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyRevenue = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YY') AS month,
        COALESCE(SUM(amount::numeric), 0) AS revenue,
        COUNT(*) AS transactions
      FROM payments
      WHERE created_at >= ${sixMonthsAgo.toISOString()}
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at)
    `);

    res.json({
      locations: locationCount.count,
      totalUsers: userCount.count,
      admins: adminCount[0].count,
      staff: staffCount[0].count,
      clients: clientCount[0].count,
      totalAppointments: aptCount.count,
      todayAppointments: todayApts.count,
      completedAppointments: completedApts.count,
      totalRevenue: Number(revenueResult[0]?.total ?? 0),
      avgRating: Number(avgRating.avg ?? 0).toFixed(1),
      monthlyRevenue: monthlyRevenue.rows,
    });
  } catch (err) {
    console.error("platform stats error", err);
    res.status(500).json({ error: "Failed to fetch platform stats" });
  }
});

router.get("/platform/tenants", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const locations = await db.select().from(locationsTable).orderBy(locationsTable.name);

    const results = await Promise.all(locations.map(async (loc) => {
      const [aptCount] = await db
        .select({ count: count() })
        .from(appointmentsTable)
        .where(eq(appointmentsTable.locationId, loc.id));

      const [staffCnt] = await db
        .select({ count: count() })
        .from(usersTable)
        .where(and(eq(usersTable.locationId, loc.id), eq(usersTable.role, "STAFF")));

      const [clientCnt] = await db
        .select({ count: count() })
        .from(usersTable)
        .where(and(eq(usersTable.locationId, loc.id), eq(usersTable.role, "CLIENT")));

      const revenueResult = await db
        .select({ total: sum(paymentsTable.amount) })
        .from(paymentsTable)
        .innerJoin(appointmentsTable, eq(paymentsTable.appointmentId, appointmentsTable.id))
        .where(eq(appointmentsTable.locationId, loc.id));

      const [avgRatingResult] = await db
        .select({ avg: avg(reviewsTable.rating) })
        .from(reviewsTable)
        .innerJoin(appointmentsTable, eq(reviewsTable.appointmentId, appointmentsTable.id))
        .where(eq(appointmentsTable.locationId, loc.id));

      const [serviceCnt] = await db
        .select({ count: count() })
        .from(servicesTable)
        .where(eq(servicesTable.locationId, loc.id));

      const [lastApt] = await db
        .select({ startTime: appointmentsTable.startTime })
        .from(appointmentsTable)
        .where(eq(appointmentsTable.locationId, loc.id))
        .orderBy(desc(appointmentsTable.startTime))
        .limit(1);

      const [sub] = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.locationId, loc.id))
        .limit(1);

      return {
        ...loc,
        appointments: Number(aptCount.count),
        staff: Number(staffCnt.count),
        clients: Number(clientCnt.count),
        revenue: Number(revenueResult[0]?.total ?? 0),
        avgRating: Number(avgRatingResult?.avg ?? 0).toFixed(1),
        services: Number(serviceCnt.count),
        lastActivity: lastApt?.startTime ?? null,
        subscription: sub ?? null,
        status: "active",
      };
    }));

    res.json(results);
  } catch (err) {
    console.error("platform tenants error", err);
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});

router.post("/platform/tenants", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const { name, address, phone, email, timezone } = req.body as {
      name: string;
      address?: string;
      phone?: string;
      email?: string;
      timezone?: string;
    };

    if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 200) {
      res.status(400).json({ error: "Salon name is required (max 200 characters)" });
      return;
    }
    if (email && typeof email === "string" && !email.includes("@")) {
      res.status(400).json({ error: "Invalid email address" });
      return;
    }

    const location = await db.transaction(async (tx) => {
      const [loc] = await tx.insert(locationsTable).values({
        name: name.trim(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        timezone: timezone?.trim() || "America/New_York",
      }).returning();

      await tx.insert(subscriptionsTable).values({
        locationId: loc.id,
        plan: "free",
        status: "active",
        monthlyAmount: 0,
      });

      return loc;
    });

    auditLog("CREATE_TENANT", req.user!.id, { locationId: location.id, name: location.name });
    res.json(location);
  } catch (err) {
    console.error("platform create tenant error", err);
    res.status(500).json({ error: "Failed to create salon" });
  }
});

router.get("/platform/users", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const { role, search } = req.query as { role?: string; search?: string };

    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        role: usersTable.role,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
        locationId: usersTable.locationId,
        locationName: locationsTable.name,
      })
      .from(usersTable)
      .leftJoin(locationsTable, eq(usersTable.locationId, locationsTable.id))
      .where(ne(usersTable.role, "SUPER_ADMIN"))
      .orderBy(desc(usersTable.createdAt))
      .limit(200);

    let filtered = users;
    if (role) filtered = filtered.filter(u => u.role === role);
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(u =>
        u.email?.toLowerCase().includes(s) ||
        u.firstName?.toLowerCase().includes(s) ||
        u.lastName?.toLowerCase().includes(s)
      );
    }

    res.json(filtered);
  } catch (err) {
    console.error("platform users error", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/platform/activity", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const recent = await db
      .select({
        id: appointmentsTable.id,
        status: appointmentsTable.status,
        startTime: appointmentsTable.startTime,
        riskScore: appointmentsTable.riskScore,
        locationId: appointmentsTable.locationId,
        locationName: locationsTable.name,
        clientFirstName: usersTable.firstName,
        clientLastName: usersTable.lastName,
        clientEmail: usersTable.email,
      })
      .from(appointmentsTable)
      .leftJoin(locationsTable, eq(appointmentsTable.locationId, locationsTable.id))
      .leftJoin(usersTable, eq(appointmentsTable.clientId, usersTable.id))
      .orderBy(desc(appointmentsTable.startTime))
      .limit(50);

    const [highRiskCount] = await db
      .select({ count: count() })
      .from(appointmentsTable)
      .where(and(
        eq(appointmentsTable.riskScore, "HIGH"),
        eq(appointmentsTable.status, "PENDING")
      ));

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const [cancelledCount] = await db
      .select({ count: count() })
      .from(appointmentsTable)
      .where(and(
        eq(appointmentsTable.status, "CANCELLED"),
        gte(appointmentsTable.startTime, thirtyDaysAgo)
      ));
    const [totalRecentCount] = await db
      .select({ count: count() })
      .from(appointmentsTable)
      .where(gte(appointmentsTable.startTime, thirtyDaysAgo));

    const cancelRate = totalRecentCount.count > 0
      ? Math.round((Number(cancelledCount.count) / Number(totalRecentCount.count)) * 100)
      : 0;

    res.json({
      appointments: recent,
      highRiskPending: Number(highRiskCount.count),
      cancellationRate: cancelRate,
      totalRecent: Number(totalRecentCount.count),
    });
  } catch (err) {
    console.error("platform activity error", err);
    res.status(500).json({ error: "Failed to fetch activity" });
  }
});

router.patch("/platform/tenants/:id/status", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const { id } = req.params;
    const { active } = req.body as { active: boolean };

    const [loc] = await db
      .update(locationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(locationsTable.id, id))
      .returning();

    res.json({ success: true, location: loc });
  } catch (err) {
    console.error("platform tenant status error", err);
    res.status(500).json({ error: "Failed to update tenant status" });
  }
});

router.get("/platform/announcements", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const announcements = await db
      .select({
        id: announcementsTable.id,
        title: announcementsTable.title,
        message: announcementsTable.message,
        type: announcementsTable.type,
        targetRole: announcementsTable.targetRole,
        createdAt: announcementsTable.createdAt,
        createdByFirstName: usersTable.firstName,
        createdByLastName: usersTable.lastName,
      })
      .from(announcementsTable)
      .leftJoin(usersTable, eq(announcementsTable.createdBy, usersTable.id))
      .orderBy(desc(announcementsTable.createdAt))
      .limit(50);

    res.json(announcements);
  } catch (err) {
    console.error("platform announcements error", err);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

router.post("/platform/announcements", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const { title, message, type, targetRole } = req.body as {
      title: string;
      message: string;
      type?: string;
      targetRole?: string;
    };

    if (!title || typeof title !== "string" || title.trim().length === 0 || title.trim().length > 255) {
      res.status(400).json({ error: "Title is required (max 255 characters)" });
      return;
    }
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ error: "Message is required" });
      return;
    }
    const annType = type && (VALID_ANN_TYPES as readonly string[]).includes(type) ? type : "info";
    const annTarget = targetRole && (VALID_TARGET_ROLES as readonly string[]).includes(targetRole) ? targetRole : null;

    const [announcement] = await db.insert(announcementsTable).values({
      title: title.trim(),
      message: message.trim(),
      type: annType,
      targetRole: annTarget,
      createdBy: req.user!.id,
    }).returning();

    auditLog("CREATE_ANNOUNCEMENT", req.user!.id, { announcementId: announcement.id, title: announcement.title });

    res.json(announcement);
  } catch (err) {
    console.error("platform create announcement error", err);
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

router.delete("/platform/announcements/:id", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("platform delete announcement error", err);
    res.status(500).json({ error: "Failed to delete announcement" });
  }
});

router.get("/platform/subscriptions", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const subs = await db
      .select({
        id: subscriptionsTable.id,
        locationId: subscriptionsTable.locationId,
        locationName: locationsTable.name,
        plan: subscriptionsTable.plan,
        status: subscriptionsTable.status,
        monthlyAmount: subscriptionsTable.monthlyAmount,
        startDate: subscriptionsTable.startDate,
        currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
        createdAt: subscriptionsTable.createdAt,
      })
      .from(subscriptionsTable)
      .leftJoin(locationsTable, eq(subscriptionsTable.locationId, locationsTable.id))
      .orderBy(desc(subscriptionsTable.createdAt));

    res.json(subs);
  } catch (err) {
    console.error("platform subscriptions error", err);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

router.patch("/platform/subscriptions/:id", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const { id } = req.params;
    const { plan, status, monthlyAmount, currentPeriodEnd } = req.body as {
      plan?: string;
      status?: string;
      monthlyAmount?: number;
      currentPeriodEnd?: string;
    };

    if (plan && !(VALID_PLANS as readonly string[]).includes(plan)) {
      res.status(400).json({ error: `Invalid plan. Must be one of: ${VALID_PLANS.join(", ")}` });
      return;
    }
    if (status && !(VALID_SUB_STATUSES as readonly string[]).includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_SUB_STATUSES.join(", ")}` });
      return;
    }
    if (monthlyAmount !== undefined && (typeof monthlyAmount !== "number" || monthlyAmount < 0)) {
      res.status(400).json({ error: "Monthly amount must be a non-negative number" });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (plan) updates.plan = plan;
    if (status) updates.status = status;
    if (monthlyAmount !== undefined) updates.monthlyAmount = monthlyAmount;
    if (currentPeriodEnd) updates.currentPeriodEnd = new Date(currentPeriodEnd);

    const [sub] = await db
      .update(subscriptionsTable)
      .set(updates)
      .where(eq(subscriptionsTable.id, id))
      .returning();

    res.json(sub);
  } catch (err) {
    console.error("platform update subscription error", err);
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

router.post("/platform/impersonate/:userId", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const { userId } = req.params;
    const originalSid = getSessionId(req);
    if (!originalSid) {
      res.status(400).json({ error: "No active session" });
      return;
    }

    const [targetUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (targetUser.role === "SUPER_ADMIN") {
      res.status(403).json({ error: "Cannot impersonate another super admin" });
      return;
    }

    const impersonateSession: SessionData = {
      user: {
        id: targetUser.id,
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        profileImageUrl: targetUser.profileImageUrl,
        role: targetUser.role,
        locationId: targetUser.locationId,
      },
      access_token: "impersonated",
      impersonatorSid: originalSid,
    };

    const newSid = await createSession(impersonateSession);

    auditLog("IMPERSONATE_START", req.user!.id, {
      targetUserId: targetUser.id,
      targetEmail: targetUser.email,
      targetRole: targetUser.role,
    });

    res.cookie(SESSION_COOKIE, newSid, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL,
    });

    res.json({
      success: true,
      user: impersonateSession.user,
      redirectTo: targetUser.role === "ADMIN" ? "/admin/dashboard" : targetUser.role === "STAFF" ? "/staff/dashboard" : "/client/dashboard",
    });
  } catch (err) {
    console.error("platform impersonate error", err);
    res.status(500).json({ error: "Failed to impersonate user" });
  }
});

router.post("/platform/stop-impersonation", async (req: Request, res: Response) => {
  if (!req.isAuthenticated() || !req.impersonatorSid) {
    res.status(400).json({ error: "Not currently impersonating" });
    return;
  }

  try {
    const currentSid = getSessionId(req);
    const originalSession = await getSession(req.impersonatorSid);

    if (!originalSession) {
      res.status(400).json({ error: "Original session expired. Please log in again." });
      return;
    }

    auditLog("IMPERSONATE_STOP", originalSession.user.id, {
      impersonatedUserId: req.user!.id,
      impersonatedEmail: req.user!.email,
    });

    if (currentSid) {
      await deleteSession(currentSid);
    }

    res.cookie(SESSION_COOKIE, req.impersonatorSid, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL,
    });

    res.json({
      success: true,
      user: originalSession.user,
      redirectTo: "/platform/dashboard",
    });
  } catch (err) {
    console.error("platform stop impersonation error", err);
    res.status(500).json({ error: "Failed to stop impersonation" });
  }
});

export default router;
