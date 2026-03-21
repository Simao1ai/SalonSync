import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getSession,
  getSessionId,
  updateSession,
} from "../lib/auth";

const router: IRouter = Router();

const VALID_ROLES = ["ADMIN", "STAFF", "CLIENT"] as const;
type Role = (typeof VALID_ROLES)[number];

router.post("/dev/switch-role", async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { role } = req.body as { role?: string };
  if (!role || !VALID_ROLES.includes(role as Role)) {
    res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
    return;
  }

  const sid = getSessionId(req);
  if (!sid) {
    res.status(400).json({ error: "No session found" });
    return;
  }

  const session = await getSession(sid);
  if (!session) {
    res.status(400).json({ error: "Session expired" });
    return;
  }

  await db
    .update(usersTable)
    .set({ role: role as Role, updatedAt: new Date() })
    .where(eq(usersTable.id, req.user.id));

  await updateSession(sid, {
    ...session,
    user: {
      ...session.user,
      role: role as Role,
    },
  });

  res.json({ success: true, role });
});

export default router;
