import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { analyticsTable, appointmentsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, sum, count, avg } from "drizzle-orm";
import { GetAnalyticsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/analytics", async (req, res) => {
  const query = GetAnalyticsQueryParams.safeParse(req.query);
  if (!query.success || !query.data.locationId) {
    res.status(400).json({ error: "locationId is required" });
    return;
  }

  const { locationId, startDate, endDate } = query.data;
  const filters = [eq(analyticsTable.locationId, locationId)];
  if (startDate) filters.push(gte(analyticsTable.date, new Date(startDate)));
  if (endDate) filters.push(lte(analyticsTable.date, new Date(endDate)));

  const records = await db
    .select()
    .from(analyticsTable)
    .where(and(...filters))
    .orderBy(analyticsTable.date);

  // Compute aggregated totals from appointments if analytics is sparse
  const apptFilters = [eq(appointmentsTable.locationId, locationId)];
  if (startDate) apptFilters.push(gte(appointmentsTable.startTime, new Date(startDate)));
  if (endDate) apptFilters.push(lte(appointmentsTable.startTime, new Date(endDate)));

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

  res.json({
    locationId,
    totalRevenue: Number(totals?.totalRevenue ?? 0),
    totalAppointments: Number(totals?.totalAppointments ?? 0),
    cancelledCount: Number(cancelledCount?.count ?? 0),
    noShowCount: Number(noShowCount?.count ?? 0),
    newClients: 0,
    returningClients: 0,
    cancelFeeRevenue: Number(totals?.cancelFeeRevenue ?? 0),
    avgAppointmentValue: Number(totals?.avgAppointmentValue ?? 0),
    records,
  });
});

export default router;
