import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  locationsTable,
  servicesTable,
  reviewsTable,
  appointmentsTable,
} from "@workspace/db/schema";
import { eq, avg, count, desc, and } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/explore/locations — public, no auth required
router.get("/explore/locations", async (req: Request, res: Response) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const sort = typeof req.query.sort === "string" ? req.query.sort : "rating";

  // Fetch all active locations
  const locations = await db.select().from(locationsTable);

  // For each location: avg rating + top 3 services
  const enriched = await Promise.all(
    locations.map(async (loc) => {
      // Avg rating (via appointments at this location)
      const [ratingRow] = await db
        .select({ avgRating: avg(reviewsTable.rating), reviewCount: count(reviewsTable.id) })
        .from(reviewsTable)
        .innerJoin(appointmentsTable, eq(reviewsTable.appointmentId, appointmentsTable.id))
        .where(eq(appointmentsTable.locationId, loc.id));

      // Top 3 services at this location
      let serviceQuery = db
        .select({
          id: servicesTable.id,
          name: servicesTable.name,
          basePrice: servicesTable.basePrice,
          durationMinutes: servicesTable.durationMinutes,
          category: servicesTable.category,
        })
        .from(servicesTable)
        .where(
          and(
            eq(servicesTable.locationId, loc.id),
            eq(servicesTable.isActive, true),
          )
        )
        .orderBy(servicesTable.basePrice)
        .limit(3);

      if (category) {
        serviceQuery = db
          .select({
            id: servicesTable.id,
            name: servicesTable.name,
            basePrice: servicesTable.basePrice,
            durationMinutes: servicesTable.durationMinutes,
            category: servicesTable.category,
          })
          .from(servicesTable)
          .where(
            and(
              eq(servicesTable.locationId, loc.id),
              eq(servicesTable.isActive, true),
              eq(servicesTable.category, category as "STANDARD" | "HIGH_VALUE"),
            )
          )
          .orderBy(servicesTable.basePrice)
          .limit(3);
      }

      const topServices = await serviceQuery;

      return {
        ...loc,
        avgRating: ratingRow?.avgRating ? Number(ratingRow.avgRating) : null,
        reviewCount: Number(ratingRow?.reviewCount ?? 0),
        topServices,
      };
    })
  );

  // Sort
  const sorted = [...enriched].sort((a, b) => {
    if (sort === "price") {
      const aMin = a.topServices[0]?.basePrice ?? 0;
      const bMin = b.topServices[0]?.basePrice ?? 0;
      return aMin - bMin;
    }
    return (b.avgRating ?? 0) - (a.avgRating ?? 0);
  });

  res.json(sorted);
});

export default router;
