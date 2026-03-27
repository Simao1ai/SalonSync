import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  locationsTable,
  servicesTable,
  reviewsTable,
  appointmentsTable,
  usersTable,
  galleryTable,
  availabilityTable,
} from "@workspace/db/schema";
import { eq, avg, count, desc, and, gte, lte, sql, or, ilike } from "drizzle-orm";

const router: IRouter = Router();

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.get("/explore/locations", async (req: Request, res: Response) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const sort = typeof req.query.sort === "string" ? req.query.sort : "rating";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
  const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
  const maxDistance = req.query.maxDistance ? parseFloat(req.query.maxDistance as string) : undefined;
  const minRating = req.query.minRating ? parseFloat(req.query.minRating as string) : undefined;
  const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
  const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;

  try {
    const locations = await db.select().from(locationsTable).where(eq(locationsTable.isActive, true));

    const enriched = await Promise.all(
      locations.map(async (loc) => {
        const [ratingRow] = await db
          .select({ avgRating: avg(reviewsTable.rating), reviewCount: count(reviewsTable.id) })
          .from(reviewsTable)
          .innerJoin(appointmentsTable, eq(reviewsTable.appointmentId, appointmentsTable.id))
          .where(eq(appointmentsTable.locationId, loc.id));

        const serviceConditions = [eq(servicesTable.locationId, loc.id), eq(servicesTable.isActive, true)];
        if (category) serviceConditions.push(eq(servicesTable.category, category as any));

        const allServices = await db
          .select({
            id: servicesTable.id,
            name: servicesTable.name,
            basePrice: servicesTable.basePrice,
            durationMinutes: servicesTable.durationMinutes,
            category: servicesTable.category,
          })
          .from(servicesTable)
          .where(and(...serviceConditions))
          .orderBy(servicesTable.basePrice);

        const staff = await db
          .select({
            id: usersTable.id,
            firstName: usersTable.firstName,
            lastName: usersTable.lastName,
            profileImageUrl: usersTable.profileImageUrl,
            specialties: usersTable.specialties,
          })
          .from(usersTable)
          .where(and(eq(usersTable.locationId, loc.id), eq(usersTable.role, "STAFF"), eq(usersTable.isActive, true)));

        const gallery = await db
          .select()
          .from(galleryTable)
          .where(eq(galleryTable.locationId, loc.id))
          .orderBy(galleryTable.sortOrder)
          .limit(6);

        const distance =
          lat !== undefined && lng !== undefined && loc.latitude && loc.longitude
            ? haversineDistance(lat, lng, loc.latitude, loc.longitude)
            : null;

        return {
          id: loc.id,
          name: loc.brandName || loc.name,
          address: loc.address,
          city: loc.city,
          state: loc.state,
          zip: loc.zip,
          phone: loc.phone,
          email: loc.email,
          timezone: loc.timezone,
          latitude: loc.latitude,
          longitude: loc.longitude,
          description: loc.description,
          logoUrl: loc.logoUrl,
          primaryColor: loc.primaryColor,
          tagline: loc.tagline,
          avgRating: ratingRow?.avgRating ? Number(ratingRow.avgRating) : null,
          reviewCount: Number(ratingRow?.reviewCount ?? 0),
          topServices: allServices.slice(0, 5),
          allServiceCount: allServices.length,
          staffCount: staff.length,
          staffPreview: staff.slice(0, 4),
          gallery: gallery.map((g) => ({ id: g.id, imageUrl: g.imageUrl, caption: g.caption })),
          distance,
        };
      })
    );

    let filtered = enriched;

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (loc) =>
          loc.name.toLowerCase().includes(q) ||
          loc.address?.toLowerCase().includes(q) ||
          loc.city?.toLowerCase().includes(q) ||
          loc.topServices.some((s) => s.name.toLowerCase().includes(q)) ||
          loc.staffPreview.some(
            (s) =>
              s.firstName?.toLowerCase().includes(q) ||
              s.lastName?.toLowerCase().includes(q) ||
              s.specialties?.some((sp: string) => sp.toLowerCase().includes(q))
          )
      );
    }

    if (minRating) filtered = filtered.filter((l) => (l.avgRating ?? 0) >= minRating);
    if (minPrice !== undefined)
      filtered = filtered.filter((l) => l.topServices.some((s) => Number(s.basePrice) >= minPrice));
    if (maxPrice !== undefined)
      filtered = filtered.filter((l) => l.topServices.some((s) => Number(s.basePrice) <= maxPrice));
    if (maxDistance && lat !== undefined && lng !== undefined)
      filtered = filtered.filter((l) => l.distance !== null && l.distance <= maxDistance);

    filtered.sort((a, b) => {
      if (sort === "distance" && a.distance !== null && b.distance !== null) return a.distance - b.distance;
      if (sort === "price") {
        const aMin = Number(a.topServices[0]?.basePrice ?? 999);
        const bMin = Number(b.topServices[0]?.basePrice ?? 999);
        return aMin - bMin;
      }
      return (b.avgRating ?? 0) - (a.avgRating ?? 0);
    });

    res.json(filtered);
  } catch (e: any) {
    console.error("Explore locations error:", e?.message);
    res.status(500).json({ error: "Failed to load salons" });
  }
});

router.get("/explore/locations/:id", async (req: Request, res: Response) => {
  try {
    const [loc] = await db.select().from(locationsTable).where(eq(locationsTable.id, req.params.id));
    if (!loc) { res.status(404).json({ error: "Salon not found" }); return; }

    const [ratingRow] = await db
      .select({ avgRating: avg(reviewsTable.rating), reviewCount: count(reviewsTable.id) })
      .from(reviewsTable)
      .innerJoin(appointmentsTable, eq(reviewsTable.appointmentId, appointmentsTable.id))
      .where(eq(appointmentsTable.locationId, loc.id));

    const services = await db
      .select()
      .from(servicesTable)
      .where(and(eq(servicesTable.locationId, loc.id), eq(servicesTable.isActive, true)))
      .orderBy(servicesTable.basePrice);

    const staff = await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        profileImageUrl: usersTable.profileImageUrl,
        bio: usersTable.bio,
        specialties: usersTable.specialties,
      })
      .from(usersTable)
      .where(and(eq(usersTable.locationId, loc.id), eq(usersTable.role, "STAFF"), eq(usersTable.isActive, true)));

    const staffWithRatings = await Promise.all(
      staff.map(async (s) => {
        const [r] = await db
          .select({ avgRating: avg(reviewsTable.rating), reviewCount: count(reviewsTable.id) })
          .from(reviewsTable)
          .where(eq(reviewsTable.staffId, s.id));
        return {
          ...s,
          avgRating: r?.avgRating ? Number(r.avgRating) : null,
          reviewCount: Number(r?.reviewCount ?? 0),
        };
      })
    );

    const reviewRows = await db
      .select({
        id: reviewsTable.id,
        rating: reviewsTable.rating,
        comment: reviewsTable.comment,
        sentimentScore: reviewsTable.sentimentScore,
        createdAt: reviewsTable.createdAt,
        clientId: reviewsTable.clientId,
        staffId: reviewsTable.staffId,
      })
      .from(reviewsTable)
      .innerJoin(appointmentsTable, eq(reviewsTable.appointmentId, appointmentsTable.id))
      .where(eq(appointmentsTable.locationId, loc.id))
      .orderBy(desc(reviewsTable.createdAt))
      .limit(20);

    const reviewsWithNames = await Promise.all(
      reviewRows.map(async (r) => {
        const [client] = r.clientId
          ? await db
              .select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
              .from(usersTable)
              .where(eq(usersTable.id, r.clientId))
          : [null];
        const [staffMember] = r.staffId
          ? await db
              .select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
              .from(usersTable)
              .where(eq(usersTable.id, r.staffId))
          : [null];
        return {
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          sentimentScore: r.sentimentScore,
          createdAt: r.createdAt,
          clientName: client ? `${client.firstName ?? ""} ${client.lastName?.charAt(0) ?? ""}`.trim() : "Anonymous",
          staffName: staffMember ? `${staffMember.firstName ?? ""} ${staffMember.lastName ?? ""}`.trim() : null,
        };
      })
    );

    const gallery = await db
      .select()
      .from(galleryTable)
      .where(eq(galleryTable.locationId, loc.id))
      .orderBy(galleryTable.sortOrder);

    const availability = await db
      .select({
        dayOfWeek: availabilityTable.dayOfWeek,
        startTime: availabilityTable.startTime,
        endTime: availabilityTable.endTime,
      })
      .from(availabilityTable)
      .innerJoin(usersTable, eq(availabilityTable.userId, usersTable.id))
      .where(and(eq(usersTable.locationId, loc.id), eq(availabilityTable.isBlocked, false)));

    const todayDow = new Date().getDay();
    const hasAvailabilityToday = availability.some((a) => a.dayOfWeek === todayDow);

    res.json({
      id: loc.id,
      name: loc.brandName || loc.name,
      address: loc.address,
      city: loc.city,
      state: loc.state,
      zip: loc.zip,
      phone: loc.phone,
      email: loc.email,
      description: loc.description,
      logoUrl: loc.logoUrl,
      primaryColor: loc.primaryColor,
      tagline: loc.tagline,
      latitude: loc.latitude,
      longitude: loc.longitude,
      avgRating: ratingRow?.avgRating ? Number(ratingRow.avgRating) : null,
      reviewCount: Number(ratingRow?.reviewCount ?? 0),
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        basePrice: Number(s.basePrice),
        durationMinutes: s.durationMinutes,
      })),
      staff: staffWithRatings,
      reviews: reviewsWithNames,
      gallery: gallery.map((g) => ({
        id: g.id,
        imageUrl: g.imageUrl,
        caption: g.caption,
        staffId: g.staffId,
        serviceId: g.serviceId,
      })),
      hasAvailabilityToday,
    });
  } catch (e: any) {
    console.error("Salon detail error:", e?.message);
    res.status(500).json({ error: "Failed to load salon details" });
  }
});

router.get("/explore/staff/:id", async (req: Request, res: Response) => {
  try {
    const [staff] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, req.params.id), eq(usersTable.role, "STAFF")));
    if (!staff) { res.status(404).json({ error: "Staff not found" }); return; }

    const [ratingRow] = await db
      .select({ avgRating: avg(reviewsTable.rating), reviewCount: count(reviewsTable.id) })
      .from(reviewsTable)
      .where(eq(reviewsTable.staffId, staff.id));

    const reviews = await db
      .select({
        id: reviewsTable.id,
        rating: reviewsTable.rating,
        comment: reviewsTable.comment,
        sentimentScore: reviewsTable.sentimentScore,
        createdAt: reviewsTable.createdAt,
      })
      .from(reviewsTable)
      .where(eq(reviewsTable.staffId, staff.id))
      .orderBy(desc(reviewsTable.createdAt))
      .limit(10);

    const portfolio = await db
      .select()
      .from(galleryTable)
      .where(eq(galleryTable.staffId, staff.id))
      .orderBy(desc(galleryTable.createdAt))
      .limit(12);

    const [location] = staff.locationId
      ? await db.select({ name: locationsTable.name, brandName: locationsTable.brandName }).from(locationsTable).where(eq(locationsTable.id, staff.locationId))
      : [null];

    const apptCount = await db
      .select({ count: count(appointmentsTable.id) })
      .from(appointmentsTable)
      .where(and(eq(appointmentsTable.staffId, staff.id), eq(appointmentsTable.status, "COMPLETED")));

    res.json({
      id: staff.id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      profileImageUrl: staff.profileImageUrl,
      bio: staff.bio,
      specialties: staff.specialties,
      locationId: staff.locationId,
      locationName: location?.brandName || location?.name || null,
      avgRating: ratingRow?.avgRating ? Number(ratingRow.avgRating) : null,
      reviewCount: Number(ratingRow?.reviewCount ?? 0),
      completedAppointments: Number(apptCount[0]?.count ?? 0),
      reviews,
      portfolio: portfolio.map((g) => ({ id: g.id, imageUrl: g.imageUrl, caption: g.caption })),
    });
  } catch (e: any) {
    console.error("Staff profile error:", e?.message);
    res.status(500).json({ error: "Failed to load staff profile" });
  }
});

router.get("/gallery", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const locationId = req.query.locationId as string;
  if (!locationId) { res.status(400).json({ error: "locationId required" }); return; }
  try {
    const images = await db.select().from(galleryTable).where(eq(galleryTable.locationId, locationId)).orderBy(galleryTable.sortOrder);
    res.json(images);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch gallery" });
  }
});

router.post("/gallery", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = req.user as any;
  if (!["ADMIN", "SUPER_ADMIN"].includes(user?.role)) { res.status(403).json({ error: "Admin access required" }); return; }
  const { locationId, imageUrl, caption, staffId, serviceId, sortOrder } = req.body;
  if (!locationId || !imageUrl) { res.status(400).json({ error: "locationId and imageUrl required" }); return; }
  try {
    const [img] = await db.insert(galleryTable).values({ locationId, imageUrl, caption, staffId, serviceId, sortOrder: sortOrder ?? 0 }).returning();
    res.status(201).json(img);
  } catch (e) {
    res.status(500).json({ error: "Failed to add image" });
  }
});

router.delete("/gallery/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = req.user as any;
  if (!["ADMIN", "SUPER_ADMIN"].includes(user?.role)) { res.status(403).json({ error: "Admin access required" }); return; }
  try {
    await db.delete(galleryTable).where(eq(galleryTable.id, req.params.id));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete image" });
  }
});

export default router;
