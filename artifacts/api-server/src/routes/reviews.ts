import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reviewsTable, appointmentsTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { CreateReviewBody, ListReviewsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/reviews", async (req, res) => {
  const query = ListReviewsQueryParams.safeParse(req.query);
  const filters = [];

  if (query.success) {
    if (query.data.staffId) filters.push(eq(reviewsTable.staffId, query.data.staffId));
    if (query.data.publishedOnly) filters.push(eq(reviewsTable.isPublished, true));
  }

  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(reviewsTable.createdAt);

  res.json(reviews);
});

router.post("/reviews", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = CreateReviewBody.parse(req.body);

  // Verify the appointment was completed
  const [appointment] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, body.appointmentId));

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  if (appointment.status !== "COMPLETED") {
    res.status(400).json({ error: "Can only review completed appointments" });
    return;
  }

  const [review] = await db.insert(reviewsTable).values({
    ...body,
    isPublished: false,
  }).returning();

  // Trigger sentiment analysis async
  fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:" + process.env.PORT}/api/ai/sentiment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewId: review.id, comment: body.comment, rating: body.rating }),
  }).catch(() => {});

  res.status(201).json(review);
});

export default router;
