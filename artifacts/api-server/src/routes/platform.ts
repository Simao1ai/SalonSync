import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, locationsTable, appointmentsTable, paymentsTable, reviewsTable } from "@workspace/db";
import { eq, count, sum, avg, desc, and, gte, ne, sql } from "drizzle-orm";

const router: IRouter = Router();

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

// GET /api/platform/stats — overall platform KPIs
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

    // Total revenue from payments
    const revenueResult = await db
      .select({ total: sum(paymentsTable.amount) })
      .from(paymentsTable);

    // Appointments today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayApts] = await db
      .select({ count: count() })
      .from(appointmentsTable)
      .where(gte(appointmentsTable.startTime, today));

    // Completed appointments
    const [completedApts] = await db
      .select({ count: count() })
      .from(appointmentsTable)
      .where(eq(appointmentsTable.status, "COMPLETED"));

    // Avg rating across platform
    const [avgRating] = await db
      .select({ avg: avg(reviewsTable.rating) })
      .from(reviewsTable);

    // Monthly revenue (last 6 months)
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

// GET /api/platform/tenants — all salon locations with metrics
router.get("/platform/tenants", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const locations = await db.select().from(locationsTable).orderBy(locationsTable.name);

    const results = await Promise.all(locations.map(async (loc) => {
      const [aptCount] = await db
        .select({ count: count() })
        .from(appointmentsTable)
        .where(eq(appointmentsTable.locationId, loc.id));

      const [staffCount] = await db
        .select({ count: count() })
        .from(usersTable)
        .where(and(eq(usersTable.locationId, loc.id), eq(usersTable.role, "STAFF")));

      const [clientCount] = await db
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
        .where(eq(reviewsTable.locationId, loc.id));

      const [serviceCount] = await db
        .select({ count: count() })
        .from(servicesTable)
        .where(eq(servicesTable.locationId, loc.id));

      // Last appointment date
      const [lastApt] = await db
        .select({ startTime: appointmentsTable.startTime })
        .from(appointmentsTable)
        .where(eq(appointmentsTable.locationId, loc.id))
        .orderBy(desc(appointmentsTable.startTime))
        .limit(1);

      return {
        ...loc,
        appointments: Number(aptCount.count),
        staff: Number(staffCount.count),
        clients: Number(clientCount.count),
        revenue: Number(revenueResult[0]?.total ?? 0),
        avgRating: Number(avgRatingResult?.avg ?? 0).toFixed(1),
        services: Number(serviceCount.count),
        lastActivity: lastApt?.startTime ?? null,
        status: "active",
      };
    }));

    res.json(results);
  } catch (err) {
    console.error("platform tenants error", err);
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});

// GET /api/platform/users — all users with optional role filter
router.get("/platform/users", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const { role, search } = req.query as { role?: string; search?: string };

    let query = db
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

    const users = await query;

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

// GET /api/platform/activity — recent appointments across all locations
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

    // High-risk count
    const [highRiskCount] = await db
      .select({ count: count() })
      .from(appointmentsTable)
      .where(and(
        eq(appointmentsTable.riskScore, "HIGH"),
        eq(appointmentsTable.status, "PENDING")
      ));

    // Cancellation rate (last 30 days)
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

// PATCH /api/platform/tenants/:id/status — toggle location active state
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

export default router;
