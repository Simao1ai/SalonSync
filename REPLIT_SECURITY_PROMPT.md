# SalonSync — Replit AI Prompt: Security Hardening & Remaining Fixes

Copy everything below the line into Replit AI.

---

## THE PROMPT (copy everything below this line)

---

I need you to apply security hardening and remaining fixes to SalonSync. We've already added role-based access control to services/users/locations routes and added rate limiting with express-rate-limit. Now I need you to complete the remaining security and quality improvements. Follow our existing architecture patterns (Drizzle ORM, Express 5, Zod validation, TypeScript, OpenAPI-first codegen).

Work through each item sequentially. After each major change, verify the app still builds.

---

### 1. SECURE THE REMAINING UNPROTECTED ROUTES

Audit every route file in `artifacts/api-server/src/routes/` and ensure proper authorization. Here's the pattern we use (see `services.ts` and `users.ts` for reference):

```typescript
// Authentication check
if (!req.isAuthenticated()) {
  res.status(401).json({ error: "Unauthorized" });
  return;
}
// Role check
if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
  res.status(403).json({ error: "Forbidden" });
  return;
}
// Location scoping for ADMIN
if (req.user!.role === "ADMIN" && req.user!.locationId !== targetLocationId) {
  res.status(403).json({ error: "You can only access your own location" });
  return;
}
```

Apply these rules to ALL mutation endpoints:

**appointments.ts:**
- `POST /appointments` — Any authenticated user can create (clients book for themselves, admin/staff book for clients)
- `PUT /appointments/:id` — ADMIN/STAFF (own location) or SUPER_ADMIN. Clients can only update their own appointments.
- `POST /appointments/:id/cancel` — The client who owns the appointment, ADMIN/STAFF at that location, or SUPER_ADMIN
- `PATCH /appointments/:id/reschedule` — ADMIN/STAFF (own location) or SUPER_ADMIN only

**availability.ts:**
- `POST /availability` — ADMIN/STAFF (own location) or SUPER_ADMIN
- `DELETE /availability` — ADMIN/STAFF (own location) or SUPER_ADMIN

**reviews.ts:**
- `POST /reviews` — Only CLIENT role (must be the client on the appointment)

**gift-cards.ts:**
- `POST /gift-cards` — Any authenticated user can purchase

**notifications.ts:**
- `GET /notifications` — Only return notifications for the authenticated user (filter by userId)
- `PATCH /notifications/:id/read` — Only the notification owner can mark as read
- `PATCH /notifications/preferences` — Only for the authenticated user

**tips.ts:**
- `POST /tips` — Only CLIENT role (must be the client on the appointment)
- `GET /tips/staff/:id` — Only the staff member themselves, ADMIN at their location, or SUPER_ADMIN

**messages.ts:**
- All message endpoints should be scoped to the authenticated user's threads only
- Staff can only see their own threads, clients can only see their own threads

**waitlist.ts:**
- `POST /waitlist` — Only CLIENT role
- `DELETE /waitlist` — Only the client who created the entry, or ADMIN/SUPER_ADMIN

**platform.ts:**
- Verify ALL platform endpoints require SUPER_ADMIN role

---

### 2. ADD CSRF PROTECTION

Install and configure `csurf` or use the double-submit cookie pattern for CSRF protection:

- Add a CSRF token endpoint: `GET /api/auth/csrf-token` that returns a token
- Validate CSRF tokens on all state-changing requests (POST, PUT, PATCH, DELETE)
- Skip CSRF for the Stripe webhook endpoint (`/api/payments/webhook`) since it uses signature verification
- Skip CSRF for the API when requests use Bearer token auth (API clients vs browser sessions)
- Add the CSRF token to the frontend's API client so it's sent with every request

---

### 3. AI PROMPT INJECTION PROTECTION

In `artifacts/api-server/src/routes/ai.ts`:

**For risk scoring (`/ai/risk-score`):**
- Sanitize all user-provided data before including it in the Claude prompt
- Strip any instruction-like patterns from client names and service names
- Set a max length on all user inputs included in prompts (200 chars)

**For sentiment analysis (`/ai/sentiment`):**
- Sanitize the review comment before including it in the Claude prompt
- Limit comment length to 2000 characters
- Use a structured output format (JSON mode) to prevent prompt manipulation from affecting the output schema

**For AI receptionist (`/anthropic/conversations/:id/messages`):**
- Add a system prompt prefix that instructs Claude to ignore any instructions embedded in user messages that attempt to override the system prompt
- Limit message content to 5000 characters
- Sanitize message content to strip control characters

Add a shared sanitization utility:
```typescript
// artifacts/api-server/src/lib/sanitize.ts
export function sanitizeForPrompt(input: string, maxLength: number = 500): string {
  return input
    .slice(0, maxLength)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .trim();
}
```

---

### 4. STRUCTURED AUDIT LOGGING

Replace all `console.log` audit entries with a proper database-backed audit log:

**Add audit_logs table to the DB schema (`lib/db/src/schema/`):**
```typescript
export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => usersTable.id),
  action: text("action").notNull(), // e.g., "CREATE_SERVICE", "UPDATE_USER", "DELETE_LOCATION", "LOGIN", "IMPERSONATE"
  resourceType: text("resource_type").notNull(), // e.g., "service", "user", "location", "appointment"
  resourceId: text("resource_id"),
  details: jsonb("details"), // JSON with before/after values or additional context
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Create an audit logging service (`artifacts/api-server/src/services/audit.ts`):**
```typescript
export async function logAudit(params: {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  await db.insert(auditLogsTable).values(params);
}
```

**Add audit logging to these actions:**
- User login/logout
- Impersonation start/stop (already partially logged, move to DB)
- Service create/update/delete
- Appointment create/cancel/reschedule
- Location create/update/deactivate
- User role changes
- Payment processing (create intent, confirm, refund)
- Failed authorization attempts (403 responses)

**Add a Super Admin audit log viewer:**
- `GET /api/platform/audit-logs` — paginated, filterable by action, resourceType, userId, date range
- New page: `/platform/audit-logs` — table view with filters, matching the existing platform violet/indigo theme

---

### 5. ADD INPUT SANITIZATION TO ALL ENDPOINTS

Create a shared middleware that sanitizes string inputs to prevent XSS:

```typescript
// artifacts/api-server/src/middlewares/sanitize.ts
import { type Request, type Response, type NextFunction } from "express";

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitizeValue(v)])
    );
  }
  return value;
}

export function sanitizeInputs(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  next();
}
```

Add this middleware in `app.ts` after `express.json()` but before routes. Skip it for the Stripe webhook endpoint (needs raw body).

---

### 6. ADD ERROR BOUNDARY MIDDLEWARE

Add a global error handler that catches unhandled errors and returns safe responses:

```typescript
// Add to app.ts after all routes
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  // Log the error (but never expose stack traces to clients)
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err.message);

  // Zod validation errors
  if (err.name === "ZodError") {
    res.status(400).json({ error: "Invalid input", details: (err as any).errors });
    return;
  }

  // Generic server error (never expose internals)
  res.status(500).json({ error: "Internal server error" });
});
```

---

### 7. SECURE CORS CONFIGURATION

In `app.ts`, replace the permissive CORS config:

```typescript
// BEFORE (too permissive):
app.use(cors({ credentials: true, origin: true }));

// AFTER (restrict to known origins):
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : null,
  process.env.NODE_ENV === "development" ? "http://localhost:5173" : null,
].filter(Boolean) as string[];

app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
}));
```

---

### 8. ADD SECURITY HEADERS

Install and configure `helmet` for security headers:

```bash
pnpm --filter @workspace/api-server add helmet
```

```typescript
import helmet from "helmet";

// Add after CORS, before routes
app.use(helmet({
  contentSecurityPolicy: false, // Let frontend handle CSP
  crossOriginEmbedderPolicy: false, // Allow embedded resources
}));
```

This adds: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Strict-Transport-Security, and more.

---

### 9. NOTIFICATION RETRY LOGIC

In `artifacts/api-server/src/services/notifications.ts`, add retry logic for failed SMS/email deliveries:

- On Twilio/SendGrid failure, retry up to 3 times with exponential backoff (2s, 4s, 8s)
- After 3 failures, mark the notification as `FAILED` in the database
- Add a `deliveryStatus` field to the notifications table: `PENDING | SENT | DELIVERED | FAILED`
- Add a `deliveryAttempts` integer field (default 0)
- Add a `lastError` text field for debugging
- The scheduler should pick up `FAILED` notifications with `deliveryAttempts < 3` and retry them

---

### 10. GET /users/:id AUTHORIZATION

In `users.ts`, the `GET /users/:id` endpoint is currently unprotected — anyone can look up any user by ID. Add:

- Require authentication
- CLIENT can only get their own profile
- STAFF can get their own profile + clients at their location
- ADMIN can get any user at their location
- SUPER_ADMIN can get any user

---

### IMPLEMENTATION GUIDELINES

- Follow existing patterns in `services.ts`, `users.ts`, and `locations.ts` for role checks
- Keep all auth checks at the top of route handlers (fail fast)
- Use descriptive error messages in 403 responses so the frontend can display them
- Update the OpenAPI spec and run codegen after adding new endpoints
- Push DB schema after adding new tables: `pnpm --filter @workspace/db run push`
- Test each route change by switching between user roles in the dev switcher

Start with item 1 (securing remaining routes) since it has the highest security impact, then work through sequentially.
