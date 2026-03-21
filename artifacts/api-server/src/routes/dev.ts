import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  createSession,
  getSession,
  getSessionId,
  updateSession,
  SESSION_COOKIE,
  SESSION_TTL,
} from "../lib/auth";

const router: IRouter = Router();

const VALID_ROLES = ["ADMIN", "STAFF", "CLIENT"] as const;
type Role = (typeof VALID_ROLES)[number];

const DEV_REDIRECT: Record<Role, string> = {
  ADMIN: "/admin/dashboard",
  STAFF: "/staff/dashboard",
  CLIENT: "/client/dashboard",
};

function devOnly(req: Request, res: Response): boolean {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found" });
    return false;
  }
  return true;
}

// GET /api/dev/login?role=ADMIN  — create an instant dev session and redirect (single HTTP hop)
router.get("/dev/login", async (req: Request, res: Response) => {
  if (!devOnly(req, res)) return;

  const { role } = req.query as { role?: string };
  if (!role || !VALID_ROLES.includes(role as Role)) {
    res.status(400).send(`role must be one of: ${VALID_ROLES.join(", ")}`);
    return;
  }

  const devRole = role as Role;

  // Map roles to the seeded demo users
  const DEV_USER_ID: Record<Role, string> = {
    ADMIN:  "seed-admin-001",
    STAFF:  "seed-staff-001",
    CLIENT: "seed-client-001",
  };

  const devUserId = DEV_USER_ID[devRole];

  // Ensure the user exists (fallback upsert in case demo seed hasn't run)
  const [user] = await db
    .insert(usersTable)
    .values({
      id: devUserId,
      email: `dev-${devRole.toLowerCase()}@salonsync.local`,
      firstName: "Dev",
      lastName: devRole.charAt(0) + devRole.slice(1).toLowerCase(),
      role: devRole,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { updatedAt: new Date() },
    })
    .returning();

  const sessionData = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: null,
      role: user.role,
      locationId: user.locationId,
    },
    access_token: "dev-token",
    refresh_token: undefined,
    expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  };

  const sid = await createSession(sessionData);

  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });

  // Set cookie for normal API calls; also return sessionId so the client can
  // store it as a Bearer token — works regardless of iframe cookie restrictions
  res.json({ success: true, user: sessionData.user, sessionId: sid });
});

// POST /api/dev/switch-role — swap role on an existing session
router.post("/dev/switch-role", async (req: Request, res: Response) => {
  if (!devOnly(req, res)) return;

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
  if (!sid) { res.status(400).json({ error: "No session found" }); return; }

  const session = await getSession(sid);
  if (!session) { res.status(400).json({ error: "Session expired" }); return; }

  await db
    .update(usersTable)
    .set({ role: role as Role, updatedAt: new Date() })
    .where(eq(usersTable.id, req.user.id));

  await updateSession(sid, {
    ...session,
    user: { ...session.user, role: role as Role },
  });

  res.json({ success: true, role, redirect: DEV_REDIRECT[role as Role] });
});

export default router;
