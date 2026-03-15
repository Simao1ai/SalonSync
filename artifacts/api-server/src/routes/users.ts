import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { UpdateUserBody, ListUsersQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users", async (req, res) => {
  const query = ListUsersQueryParams.safeParse(req.query);
  const filters = [];

  if (query.success) {
    if (query.data.role) filters.push(eq(usersTable.role, query.data.role as "ADMIN" | "STAFF" | "CLIENT"));
    if (query.data.locationId) filters.push(eq(usersTable.locationId as unknown as string, query.data.locationId));
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(filters.length > 0 ? and(...filters) : undefined);

  res.json(users);
});

router.get("/users/:id", async (req, res) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.params.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

router.put("/users/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = UpdateUserBody.parse(req.body);
  const [updated] = await db
    .update(usersTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(usersTable.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(updated);
});

export default router;
