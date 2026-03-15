import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { availabilityTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { CreateAvailabilityBody, ListAvailabilityQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/availability", async (req, res) => {
  const query = ListAvailabilityQueryParams.safeParse(req.query);
  const filters = [];

  if (query.success && query.data.userId) {
    filters.push(eq(availabilityTable.userId, query.data.userId));
  }

  const availability = await db
    .select()
    .from(availabilityTable)
    .where(filters.length > 0 ? and(...filters) : undefined);

  res.json(availability);
});

router.post("/availability", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = CreateAvailabilityBody.parse(req.body);
  const [slot] = await db.insert(availabilityTable).values({
    ...body,
    blockDate: body.blockDate ? new Date(body.blockDate) : undefined,
  }).returning();
  res.status(201).json(slot);
});

router.delete("/availability/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  await db.delete(availabilityTable).where(eq(availabilityTable.id, req.params.id));
  res.status(204).send();
});

export default router;
