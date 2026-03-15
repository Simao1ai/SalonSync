import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { locationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  CreateLocationBody,
  UpdateLocationBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/locations", async (_req, res) => {
  const locations = await db.select().from(locationsTable).where(eq(locationsTable.isActive, true));
  res.json(locations);
});

router.post("/locations", async (req, res) => {
  const body = CreateLocationBody.parse(req.body);
  const [location] = await db.insert(locationsTable).values(body).returning();
  res.status(201).json(location);
});

router.get("/locations/:id", async (req, res) => {
  const [location] = await db
    .select()
    .from(locationsTable)
    .where(eq(locationsTable.id, req.params.id));
  if (!location) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json(location);
});

router.put("/locations/:id", async (req, res) => {
  const body = UpdateLocationBody.parse(req.body);
  const [updated] = await db
    .update(locationsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(locationsTable.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json(updated);
});

router.delete("/locations/:id", async (req, res) => {
  await db
    .update(locationsTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(locationsTable.id, req.params.id));
  res.status(204).send();
});

export default router;
