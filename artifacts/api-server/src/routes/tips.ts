import { Router, type IRouter, type Request, type Response } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  tipsTable,
  appointmentsTable,
  usersTable,
  notificationsTable,
} from "@workspace/db/schema";
import { eq, and, sum, count, desc } from "drizzle-orm";

const router: IRouter = Router();

function getStripe(): Stripe | null {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-01-27.acacia" });
}

const CreateTipBody = z.object({
  appointmentId: z.string().min(1),
  amount: z.number().positive(),
});

// POST /api/tips — charge a tip via Stripe (or mock) and record it
router.post("/tips", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "CLIENT") { res.status(403).json({ error: "Only clients can tip" }); return; }

  const parse = CreateTipBody.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.message }); return; }
  const { appointmentId, amount } = parse.data;

  // Validate appointment
  const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, appointmentId));
  if (!appt) { res.status(404).json({ error: "Appointment not found" }); return; }
  if (appt.clientId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  if (appt.status !== "COMPLETED") { res.status(400).json({ error: "Can only tip on completed appointments" }); return; }

  // Check not already tipped
  const [existing] = await db.select().from(tipsTable).where(
    and(eq(tipsTable.appointmentId, appointmentId), eq(tipsTable.clientId, req.user.id))
  );
  if (existing) { res.status(409).json({ error: "You have already tipped for this appointment" }); return; }

  const amountCents = Math.round(amount * 100);
  if (amountCents < 50) { res.status(400).json({ error: "Minimum tip is $0.50" }); return; }

  const stripe = getStripe();
  let stripePaymentId: string | null = null;

  if (stripe) {
    // Get or create Stripe customer
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
    let customerId = dbUser?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: dbUser?.email ?? undefined,
        name: [dbUser?.firstName, dbUser?.lastName].filter(Boolean).join(" ") || undefined,
        metadata: { userId: req.user.id },
      });
      customerId = customer.id;
      await db.update(usersTable).set({ stripeCustomerId: customerId }).where(eq(usersTable.id, req.user.id));
    }

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: customerId,
      confirm: false,
      metadata: { type: "tip", appointmentId, clientId: req.user.id, staffId: appt.staffId },
      automatic_payment_methods: { enabled: true },
    });
    stripePaymentId = intent.id;

    // For real Stripe, return client_secret so the frontend can confirm
    // In tip flow we return the secret and let the frontend confirm
    const [tip] = await db.insert(tipsTable).values({
      appointmentId,
      clientId: req.user.id,
      staffId: appt.staffId,
      amount,
      stripePaymentId: intent.id,
    }).returning();

    // Thank-you notification for client
    await db.insert(notificationsTable).values({
      type: "TIP_SENT",
      title: "Thank you for the tip!",
      message: `Your $${amount.toFixed(2)} tip has been sent. We appreciate your generosity!`,
      userId: req.user.id,
    }).catch(() => {});

    // Notification for staff
    const [client] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, req.user.id));
    const clientName = [client?.firstName, client?.lastName].filter(Boolean).join(" ") || "A client";

    await db.insert(notificationsTable).values({
      type: "TIP_RECEIVED",
      title: "You received a tip! 🎉",
      message: `${clientName} sent you a $${amount.toFixed(2)} tip. Great work!`,
      userId: appt.staffId,
    }).catch(() => {});

    res.status(201).json({ tip, clientSecret: intent.client_secret, mode: "live" });
    return;
  }

  // ── Mock mode (no Stripe key) ──────────────────────────────────────────
  const [tip] = await db.insert(tipsTable).values({
    appointmentId,
    clientId: req.user.id,
    staffId: appt.staffId,
    amount,
    stripePaymentId: "pi_mock_tip_" + Date.now(),
  }).returning();

  // Thank-you notification for client
  await db.insert(notificationsTable).values({
    type: "TIP_SENT",
    title: "Thank you for the tip!",
    message: `Your $${amount.toFixed(2)} tip has been sent. We appreciate your generosity!`,
    userId: req.user.id,
  }).catch(() => {});

  // Notification for staff
  const [client] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(usersTable).where(eq(usersTable.id, req.user.id));
  const clientName = [client?.firstName, client?.lastName].filter(Boolean).join(" ") || "A client";

  await db.insert(notificationsTable).values({
    type: "TIP_RECEIVED",
    title: "You received a tip!",
    message: `${clientName} sent you a $${amount.toFixed(2)} tip. Great work!`,
    userId: appt.staffId,
  }).catch(() => {});

  res.status(201).json({ tip, mode: "test_no_key" });
});

// GET /api/tips/staff/:id — tips received by a staff member
router.get("/tips/staff/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const staffId = req.params.id;
  if (req.user.role === "STAFF" && req.user.id !== staffId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [totals] = await db.select({
    totalTips: sum(tipsTable.amount),
    tipCount: count(tipsTable.id),
  }).from(tipsTable).where(eq(tipsTable.staffId, staffId));

  const recent = await db
    .select({
      tip: tipsTable,
      client: {
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      },
    })
    .from(tipsTable)
    .innerJoin(usersTable, eq(tipsTable.clientId, usersTable.id))
    .where(eq(tipsTable.staffId, staffId))
    .orderBy(desc(tipsTable.createdAt))
    .limit(20);

  res.json({
    staffId,
    totalTips: Number(totals?.totalTips ?? 0),
    tipCount: Number(totals?.tipCount ?? 0),
    recent: recent.map(r => ({
      ...r.tip,
      clientName: [r.client.firstName, r.client.lastName].filter(Boolean).join(" ") || "Client",
    })),
  });
});

// GET /api/tips — all tips for a location (admin)
router.get("/tips", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role === "CLIENT") { res.status(403).json({ error: "Forbidden" }); return; }

  const rows = await db
    .select({
      tip: tipsTable,
      client: {
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      },
    })
    .from(tipsTable)
    .innerJoin(usersTable, eq(tipsTable.clientId, usersTable.id))
    .orderBy(desc(tipsTable.createdAt))
    .limit(200);

  const [totals] = await db.select({
    total: sum(tipsTable.amount),
    count: count(tipsTable.id),
  }).from(tipsTable);

  res.json({
    totalTips: Number(totals?.total ?? 0),
    tipCount: Number(totals?.count ?? 0),
    tips: rows.map(r => ({
      ...r.tip,
      clientName: [r.client.firstName, r.client.lastName].filter(Boolean).join(" ") || "Client",
    })),
  });
});

// GET /api/tips/appointment/:id — check if client already tipped for an appointment
router.get("/tips/appointment/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [tip] = await db.select().from(tipsTable).where(
    and(
      eq(tipsTable.appointmentId, req.params.id),
      eq(tipsTable.clientId, req.user.id),
    )
  );
  res.json({ tipped: !!tip, tip: tip ?? null });
});

export default router;
