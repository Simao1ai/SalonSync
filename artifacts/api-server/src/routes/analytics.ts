import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  analyticsTable,
  appointmentsTable,
  usersTable,
  reviewsTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte, sum, count, avg, sql, ne } from "drizzle-orm";

const router: IRouter = Router();

router.get("/analytics", async (req, res) => {
  const locationId = typeof req.query.locationId === "string" ? req.query.locationId : "";
  if (!locationId) {
    res.status(400).json({ error: "locationId is required" });
    return;
  }

  const startDateStr = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
  const endDateStr   = typeof req.query.endDate   === "string" ? req.query.endDate   : undefined;
  const startDate = startDateStr ? new Date(startDateStr + "T00:00:00Z") : undefined;
  const endDate   = endDateStr   ? new Date(endDateStr   + "T23:59:59Z") : undefined;

  const apptFilters = [eq(appointmentsTable.locationId, locationId)];
  if (startDate) apptFilters.push(gte(appointmentsTable.startTime, startDate));
  if (endDate)   apptFilters.push(lte(appointmentsTable.startTime, endDate));

  // ── Aggregated totals ──────────────────────────────────────────────────
  const [totals] = await db
    .select({
      totalRevenue: sum(appointmentsTable.totalPrice),
      totalAppointments: count(appointmentsTable.id),
      cancelFeeRevenue: sum(appointmentsTable.cancelFeeCharged),
      avgAppointmentValue: avg(appointmentsTable.totalPrice),
    })
    .from(appointmentsTable)
    .where(and(...apptFilters));

  const [cancelledCount] = await db
    .select({ count: count(appointmentsTable.id) })
    .from(appointmentsTable)
    .where(and(...apptFilters, eq(appointmentsTable.status, "CANCELLED")));

  const [noShowCount] = await db
    .select({ count: count(appointmentsTable.id) })
    .from(appointmentsTable)
    .where(and(...apptFilters, eq(appointmentsTable.status, "NO_SHOW")));

  // ── New vs returning clients ───────────────────────────────────────────
  // A client is "new" if they have exactly 1 appointment in the date range
  const clientCounts = await db
    .select({
      clientId: appointmentsTable.clientId,
      apptCount: count(appointmentsTable.id),
    })
    .from(appointmentsTable)
    .where(and(...apptFilters, ne(appointmentsTable.status, "CANCELLED")))
    .groupBy(appointmentsTable.clientId);

  const newClients = clientCounts.filter(c => Number(c.apptCount) === 1).length;
  const returningClients = clientCounts.filter(c => Number(c.apptCount) > 1).length;

  // ── Per-day trend data ─────────────────────────────────────────────────
  const dailyRows = await db
    .select({
      day: sql<string>`date_trunc('day', ${appointmentsTable.startTime})::date::text`,
      revenue: sum(appointmentsTable.totalPrice),
      appointments: count(appointmentsTable.id),
      cancelFees: sum(appointmentsTable.cancelFeeCharged),
    })
    .from(appointmentsTable)
    .where(and(...apptFilters))
    .groupBy(sql`date_trunc('day', ${appointmentsTable.startTime})`)
    .orderBy(sql`date_trunc('day', ${appointmentsTable.startTime})`);

  const dailyTrend = dailyRows.map(r => ({
    date: r.day,
    label: new Date(r.day + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    revenue: Number(r.revenue ?? 0),
    appointments: Number(r.appointments ?? 0),
    cancelFees: Number(r.cancelFees ?? 0),
  }));

  // ── Staff performance ──────────────────────────────────────────────────
  const staffRows = await db
    .select({
      staffId: appointmentsTable.staffId,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      appointments: count(appointmentsTable.id),
      revenue: sum(appointmentsTable.totalPrice),
    })
    .from(appointmentsTable)
    .innerJoin(usersTable, eq(appointmentsTable.staffId, usersTable.id))
    .where(and(...apptFilters, ne(appointmentsTable.status, "CANCELLED")))
    .groupBy(appointmentsTable.staffId, usersTable.firstName, usersTable.lastName)
    .orderBy(sql`sum(${appointmentsTable.totalPrice}) desc nulls last`);

  // Get avg ratings per staff — join through appointments to scope to this location
  const ratingBaseFilters = [eq(appointmentsTable.locationId, locationId)];
  if (startDate) ratingBaseFilters.push(gte(appointmentsTable.startTime, startDate));
  if (endDate)   ratingBaseFilters.push(lte(appointmentsTable.startTime, endDate));

  const ratingRows = await db
    .select({
      staffId: reviewsTable.staffId,
      avgRating: avg(reviewsTable.rating),
      reviewCount: count(reviewsTable.id),
    })
    .from(reviewsTable)
    .innerJoin(appointmentsTable, eq(reviewsTable.appointmentId, appointmentsTable.id))
    .where(and(...ratingBaseFilters))
    .groupBy(reviewsTable.staffId);

  const ratingMap = new Map(ratingRows.map(r => [r.staffId, { avgRating: Number(r.avgRating ?? 0), reviewCount: Number(r.reviewCount) }]));

  const staffPerformance = staffRows.map(s => ({
    staffId: s.staffId,
    name: [s.firstName, s.lastName].filter(Boolean).join(" ") || "Unknown",
    appointments: Number(s.appointments ?? 0),
    revenue: Number(s.revenue ?? 0),
    avgRating: ratingMap.get(s.staffId)?.avgRating ?? 0,
    reviewCount: ratingMap.get(s.staffId)?.reviewCount ?? 0,
  }));

  // ── Analytics table records (sparse daily records) ─────────────────────
  const analyticsFilters = [eq(analyticsTable.locationId, locationId)];
  if (startDate) analyticsFilters.push(gte(analyticsTable.date, startDate));
  if (endDate)   analyticsFilters.push(lte(analyticsTable.date, endDate));

  const records = await db
    .select()
    .from(analyticsTable)
    .where(and(...analyticsFilters))
    .orderBy(analyticsTable.date);

  res.json({
    locationId,
    totalRevenue: Number(totals?.totalRevenue ?? 0),
    totalAppointments: Number(totals?.totalAppointments ?? 0),
    cancelledCount: Number(cancelledCount?.count ?? 0),
    noShowCount: Number(noShowCount?.count ?? 0),
    newClients,
    returningClients,
    cancelFeeRevenue: Number(totals?.cancelFeeRevenue ?? 0),
    avgAppointmentValue: Number(totals?.avgAppointmentValue ?? 0),
    dailyTrend,
    staffPerformance,
    records,
  });
});

export default router;
