import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { servicesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import {
  CreateServiceBody,
  UpdateServiceBody,
  ListServicesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/services", async (req, res) => {
  const query = ListServicesQueryParams.safeParse(req.query);
  const filters = [];

  if (query.success) {
    if (query.data.locationId) filters.push(eq(servicesTable.locationId, query.data.locationId));
    if (query.data.category) filters.push(eq(servicesTable.category, query.data.category as "STANDARD" | "HIGH_VALUE"));
    if (query.data.activeOnly) filters.push(eq(servicesTable.isActive, true));
  }

  const services = await db
    .select()
    .from(servicesTable)
    .where(filters.length > 0 ? and(...filters) : undefined);

  res.json(services);
});

router.post("/services", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = CreateServiceBody.parse(req.body);
  const [service] = await db.insert(servicesTable).values(body).returning();
  res.status(201).json(service);
});

router.get("/services/:id", async (req, res) => {
  const [service] = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.id, req.params.id));
  if (!service) {
    res.status(404).json({ error: "Service not found" });
    return;
  }
  res.json(service);
});

router.put("/services/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = UpdateServiceBody.parse(req.body);
  const [updated] = await db
    .update(servicesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(servicesTable.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Service not found" });
    return;
  }
  res.json(updated);
});

router.delete("/services/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  await db
    .update(servicesTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(servicesTable.id, req.params.id));
  res.status(204).send();
});

export default router;
