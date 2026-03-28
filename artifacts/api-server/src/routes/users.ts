import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { UpdateUserBody, ListUsersQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const query = ListUsersQueryParams.safeParse(req.query);
  const filters = [];

  if (query.success) {
    if (query.data.role) filters.push(eq(usersTable.role, query.data.role as "ADMIN" | "STAFF" | "CLIENT"));
    if (query.data.locationId) filters.push(eq(usersTable.locationId as unknown as string, query.data.locationId));
  }

  if (req.user!.role === "ADMIN" || req.user!.role === "STAFF") {
    if (req.user!.locationId) {
      filters.push(eq(usersTable.locationId as unknown as string, req.user!.locationId));
    }
  }
  if (req.user!.role === "CLIENT") {
    filters.push(eq(usersTable.id, req.user!.id));
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(filters.length > 0 ? and(...filters) : undefined);

  res.json(users);
});

router.get("/users/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const currentUser = req.user!;
  const targetId = req.params.id;

  if (currentUser.role === "CLIENT" && currentUser.id !== targetId) {
    res.status(403).json({ error: "You can only view your own profile" });
    return;
  }
  if ((currentUser.role === "ADMIN" || currentUser.role === "STAFF") && currentUser.id !== targetId) {
    const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
    if (!targetUser || targetUser.locationId !== currentUser.locationId) {
      res.status(403).json({ error: "You can only view users at your own location" });
      return;
    }
    res.json(targetUser);
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, targetId));
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
  const targetId = req.params.id;
  const currentUser = req.user!;

  if (currentUser.role === "CLIENT" || currentUser.role === "STAFF") {
    if (currentUser.id !== targetId) {
      res.status(403).json({ error: "You can only update your own profile" });
      return;
    }
  }
  if (currentUser.role === "ADMIN") {
    if (currentUser.id !== targetId) {
      const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
      if (!targetUser || targetUser.locationId !== currentUser.locationId) {
        res.status(403).json({ error: "You can only update users at your own location" });
        return;
      }
    }
  }

  const body = UpdateUserBody.parse(req.body);

  if (currentUser.role !== "SUPER_ADMIN") {
    delete (body as any).role;
    delete (body as any).locationId;
    delete (body as any).isActive;
  }
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
