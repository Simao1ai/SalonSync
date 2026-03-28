import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { UpdateUserBody, ListUsersQueryParams } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.post("/users", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Only admins can create staff members" });
    return;
  }
  try {
    const { firstName, lastName, email, phone, role, locationId, specialties } = req.body;
    if (!firstName || !lastName || !email) {
      res.status(400).json({ error: "First name, last name, and email are required" });
      return;
    }
    const allowedRoles = ["STAFF", "CLIENT"];
    if (req.user!.role === "SUPER_ADMIN") allowedRoles.push("ADMIN");
    const assignedRole = (role && allowedRoles.includes(role)) ? role : "STAFF";
    const assignedLocation = req.user!.role === "ADMIN" ? req.user!.locationId : (locationId || req.user!.locationId);
    const [user] = await db.insert(usersTable).values({
      id: randomUUID(),
      firstName,
      lastName,
      email,
      phone: phone || null,
      role: assignedRole,
      locationId: assignedLocation,
      specialties: specialties || [],
    }).returning();
    res.status(201).json(user);
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
    console.error("Create user error:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

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

  const safeFields: Record<string, unknown> = {};
  if (body.phone !== undefined) safeFields.phone = body.phone;
  if (body.bio !== undefined) safeFields.bio = body.bio;
  if (body.specialties !== undefined) safeFields.specialties = body.specialties;
  if (currentUser.role === "SUPER_ADMIN") {
    if (body.role !== undefined) safeFields.role = body.role;
    if (body.locationId !== undefined) safeFields.locationId = body.locationId;
    if (body.isActive !== undefined) safeFields.isActive = body.isActive;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ ...safeFields, updatedAt: new Date() })
    .where(eq(usersTable.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(updated);
});

export default router;
