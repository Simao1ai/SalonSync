import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  appointmentsTable,
  appointmentServicesTable,
  servicesTable,
  usersTable,
  availabilityTable,
  productsTable,
  locationsTable,
  reviewsTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte, sum, count, avg, sql, ne, desc } from "drizzle-orm";

const router: IRouter = Router();

function parseDateRange(req: Request) {
  const from = typeof req.query.from === "string" ? new Date(req.query.from + "T00:00:00Z") : undefined;
  const to   = typeof req.query.to   === "string" ? new Date(req.query.to   + "T23:59:59Z") : undefined;
  return { from, to };
}

function apptFilters(locationId: string, from?: Date, to?: Date) {
  const f = [eq(appointmentsTable.locationId, locationId)];
  if (from) f.push(gte(appointmentsTable.startTime, from));
  if (to)   f.push(lte(appointmentsTable.startTime, to));
  return f;
}

// ── GET /api/analytics/stylist-productivity ────────────────────────────────
router.get("/analytics/stylist-productivity", async (req: Request, res: Response) => {
  if (!req.isAuthenticated() || req.user.role !== "ADMIN") {
    res.status(403).json({ error: "Admin only" }); return;
  }
  const locationId = typeof req.query.locationId === "string" ? req.query.locationId : "";
  if (!locationId) { res.status(400).json({ error: "locationId required" }); return; }
  const { from, to } = parseDateRange(req);
  const baseFilters = apptFilters(locationId, from, to);

  // Per-staff aggregates
  const rows = await db
    .select({
      staffId: appointmentsTable.staffId,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      total: count(appointmentsTable.id),
      revenue: sum(appointmentsTable.totalPrice),
      cancelled: count(
        sql`CASE WHEN ${appointmentsTable.status} = 'CANCELLED' THEN 1 END`
      ),
      noShow: count(
        sql`CASE WHEN ${appointmentsTable.status} = 'NO_SHOW' THEN 1 END`
      ),
    })
    .from(appointmentsTable)
    .innerJoin(usersTable, eq(appointmentsTable.staffId, usersTable.id))
    .where(and(...baseFilters))
    .groupBy(appointmentsTable.staffId, usersTable.firstName, usersTable.lastName)
    .orderBy(desc(sum(appointmentsTable.totalPrice)));

  const result = rows.map(r => {
    const total    = Number(r.total);
    const revenue  = Number(r.revenue ?? 0);
    const cancelled = Number(r.cancelled ?? 0);
    const noShow   = Number(r.noShow ?? 0);
    const completed = total - cancelled - noShow;
    return {
      staffId: r.staffId,
      name: [r.firstName, r.lastName].filter(Boolean).join(" ") || "Unknown",
      totalAppointments: total,
      completedAppointments: completed,
      revenue,
      avgTicket: completed > 0 ? revenue / completed : 0,
      cancellationRate: total > 0 ? (cancelled / total) * 100 : 0,
      noShowRate: total > 0 ? (noShow / total) * 100 : 0,
    };
  });

  res.json(result);
});

// ── GET /api/analytics/revenue-per-chair ──────────────────────────────────
router.get("/analytics/revenue-per-chair", async (req: Request, res: Response) => {
  if (!req.isAuthenticated() || req.user.role !== "ADMIN") {
    res.status(403).json({ error: "Admin only" }); return;
  }
  const locationId = typeof req.query.locationId === "string" ? req.query.locationId : "";
  if (!locationId) { res.status(400).json({ error: "locationId required" }); return; }
  const { from, to } = parseDateRange(req);
  const baseFilters = apptFilters(locationId, from, to);

  // Revenue per staff
  const revenueRows = await db
    .select({
      staffId: appointmentsTable.staffId,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      revenue: sum(appointmentsTable.totalPrice),
      appointmentCount: count(appointmentsTable.id),
      bookedMinutes: sum(
        sql<number>`EXTRACT(EPOCH FROM (${appointmentsTable.endTime} - ${appointmentsTable.startTime})) / 60`
      ),
    })
    .from(appointmentsTable)
    .innerJoin(usersTable, eq(appointmentsTable.staffId, usersTable.id))
    .where(and(...baseFilters, ne(appointmentsTable.status, "CANCELLED")))
    .groupBy(appointmentsTable.staffId, usersTable.firstName, usersTable.lastName)
    .orderBy(desc(sum(appointmentsTable.totalPrice)));

  // Total available minutes per staff (from availability table work hours)
  // Default: 8am–8pm = 720 min/day. If availability records exist, use those.
  const availRows = await db
    .select()
    .from(availabilityTable)
    .where(
      and(
        from ? gte(availabilityTable.blockDate, from) : sql`1=1`,
        to   ? lte(availabilityTable.blockDate, to)   : sql`1=1`,
      )
    );

  // Days in range
  const dayCount = from && to
    ? Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)))
    : 30;
  const defaultAvailMinutes = 720; // 8am–8pm

  const result = revenueRows.map(r => {
    const staffAvail = availRows.filter(a => a.userId === r.staffId && !a.isBlocked);
    const blockedMins = availRows
      .filter(a => a.userId === r.staffId && a.isBlocked)
      .length * defaultAvailMinutes;

    const totalAvailMins = (staffAvail.length > 0
      ? staffAvail.reduce((sum, a) => {
          if (!a.startTime || !a.endTime) return sum + defaultAvailMinutes;
          const [sh, sm] = a.startTime.split(":").map(Number);
          const [eh, em] = a.endTime.split(":").map(Number);
          return sum + (eh * 60 + em) - (sh * 60 + sm);
        }, 0)
      : dayCount * defaultAvailMinutes) - blockedMins;

    const bookedMins = Number(r.bookedMinutes ?? 0);
    const utilization = totalAvailMins > 0 ? Math.min(100, (bookedMins / totalAvailMins) * 100) : 0;

    return {
      staffId: r.staffId,
      name: [r.firstName, r.lastName].filter(Boolean).join(" ") || "Unknown",
      revenue: Number(r.revenue ?? 0),
      appointmentCount: Number(r.appointmentCount ?? 0),
      bookedMinutes: bookedMins,
      availableMinutes: totalAvailMins,
      utilizationPct: Math.round(utilization),
    };
  });

  res.json(result);
});

// ── GET /api/analytics/retail-sales ───────────────────────────────────────
router.get("/analytics/retail-sales", async (req: Request, res: Response) => {
  if (!req.isAuthenticated() || req.user.role !== "ADMIN") {
    res.status(403).json({ error: "Admin only" }); return;
  }
  const locationId = typeof req.query.locationId === "string" ? req.query.locationId : "";
  if (!locationId) { res.status(400).json({ error: "locationId required" }); return; }
  const { from, to } = parseDateRange(req);

  // Service sales — top services by booking count & revenue in this period
  const serviceFilters = [eq(appointmentsTable.locationId, locationId)];
  if (from) serviceFilters.push(gte(appointmentsTable.startTime, from));
  if (to)   serviceFilters.push(lte(appointmentsTable.startTime, to));

  const serviceRows = await db
    .select({
      serviceId: servicesTable.id,
      name: servicesTable.name,
      category: servicesTable.category,
      unitPrice: servicesTable.basePrice,
      qty: count(appointmentServicesTable.id),
      revenue: sum(appointmentServicesTable.price),
    })
    .from(appointmentServicesTable)
    .innerJoin(servicesTable, eq(appointmentServicesTable.serviceId, servicesTable.id))
    .innerJoin(appointmentsTable, eq(appointmentServicesTable.appointmentId, appointmentsTable.id))
    .where(
      and(
        ...serviceFilters,
        ne(appointmentsTable.status, "CANCELLED"),
      )
    )
    .groupBy(servicesTable.id, servicesTable.name, servicesTable.category, servicesTable.basePrice)
    .orderBy(desc(count(appointmentServicesTable.id)));

  const rows = serviceRows.map((r, i) => ({
    id: r.serviceId,
    name: r.name,
    category: r.category,
    unitPrice: Number(r.unitPrice),
    qty: Number(r.qty),
    revenue: Number(r.revenue ?? 0),
    isTopSeller: i === 0,
  }));

  // Products catalog (standalone retail items — no transactional tracking yet)
  const products = await db
    .select()
    .from(productsTable)
    .orderBy(desc(productsTable.price));

  const [totals] = await db
    .select({
      totalRevenue: sum(appointmentServicesTable.price),
      totalQty: count(appointmentServicesTable.id),
    })
    .from(appointmentServicesTable)
    .innerJoin(appointmentsTable, eq(appointmentServicesTable.appointmentId, appointmentsTable.id))
    .where(and(...serviceFilters, ne(appointmentsTable.status, "CANCELLED")));

  res.json({
    services: rows,
    products,
    totalRevenue: Number(totals?.totalRevenue ?? 0),
    totalQty: Number(totals?.totalQty ?? 0),
  });
});

// ── GET /api/analytics/multi-location ────────────────────────────────────
router.get("/analytics/multi-location", async (req: Request, res: Response) => {
  if (!req.isAuthenticated() || req.user.role !== "ADMIN") {
    res.status(403).json({ error: "Admin only" }); return;
  }
  const { from, to } = parseDateRange(req);

  const locations = await db.select().from(locationsTable);

  const data = await Promise.all(
    locations.map(async (loc) => {
      const filters = [eq(appointmentsTable.locationId, loc.id)];
      if (from) filters.push(gte(appointmentsTable.startTime, from));
      if (to)   filters.push(lte(appointmentsTable.startTime, to));

      const [totals] = await db
        .select({
          revenue:      sum(appointmentsTable.totalPrice),
          appointments: count(appointmentsTable.id),
          cancelled:    count(sql`CASE WHEN ${appointmentsTable.status} = 'CANCELLED' THEN 1 END`),
          noShows:      count(sql`CASE WHEN ${appointmentsTable.status} = 'NO_SHOW' THEN 1 END`),
        })
        .from(appointmentsTable)
        .where(and(...filters));

      const [ratingRow] = await db
        .select({ avgRating: avg(reviewsTable.rating) })
        .from(reviewsTable)
        .innerJoin(appointmentsTable, eq(reviewsTable.appointmentId, appointmentsTable.id))
        .where(eq(appointmentsTable.locationId, loc.id));

      const total = Number(totals?.appointments ?? 0);
      const cancelled = Number(totals?.cancelled ?? 0);

      return {
        locationId: loc.id,
        name: loc.name,
        address: loc.address,
        revenue: Number(totals?.revenue ?? 0),
        appointments: total,
        cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
        noShows: Number(totals?.noShows ?? 0),
        avgRating: ratingRow?.avgRating ? Number(Number(ratingRow.avgRating).toFixed(1)) : null,
      };
    })
  );

  res.json(data);
});

export default router;
