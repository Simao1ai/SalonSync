import { Router, type IRouter, type Request, type Response } from "express";
import Stripe from "stripe";
import { z } from "zod/v4";

import { db } from "@workspace/db";
import { appointmentsTable, paymentsTable, usersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

function getStripe(): Stripe | null {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-01-27.acacia" });
}

const CreateIntentBody = z.object({
  appointmentId: z.string(),
  paymentType: z.enum(["DEPOSIT", "FULL"]).default("FULL"),
});

const ConfirmBody = z.object({
  appointmentId: z.string(),
  paymentIntentId: z.string(),
});

const RefundBody = z.object({
  appointmentId: z.string(),
  reason: z.string().optional(),
});

// POST /api/payments/create-intent
router.post("/payments/create-intent", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parse = CreateIntentBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { appointmentId, paymentType } = parse.data;

  const [appointment] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, appointmentId));

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  if (appointment.clientId !== req.user.id && req.user.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Calculate charge amount (in cents)
  const isDeposit = paymentType === "DEPOSIT" && appointment.isHighValue && (appointment.depositAmount ?? 0) > 0;
  const amountDollars = isDeposit ? (appointment.depositAmount ?? 0) : appointment.totalPrice;
  const amountCents = Math.round(amountDollars * 100);

  if (amountCents < 50) {
    res.status(400).json({ error: "Amount too small for payment processing" });
    return;
  }

  const stripe = getStripe();

  if (!stripe) {
    // Dev mode — return mock intent so UI can be tested without live keys
    res.json({
      clientSecret: "pi_test_mock_secret_for_development",
      paymentIntentId: "pi_test_mock",
      amount: amountDollars,
      currency: "usd",
      mode: "test_no_key",
    });
    return;
  }

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
    metadata: {
      appointmentId,
      paymentType,
      userId: req.user.id,
    },
    automatic_payment_methods: { enabled: true },
  });

  // Store pending payment record
  await db.insert(paymentsTable).values({
    amount: amountDollars,
    type: isDeposit ? "DEPOSIT" : "FULL_PAYMENT",
    stripeId: intent.id,
    status: "pending",
    appointmentId,
  });

  // Save stripePaymentId on appointment
  await db
    .update(appointmentsTable)
    .set({ stripePaymentId: intent.id })
    .where(eq(appointmentsTable.id, appointmentId));

  res.json({
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    amount: amountDollars,
    currency: "usd",
    mode: "live",
  });
});

// POST /api/payments/confirm
router.post("/payments/confirm", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parse = ConfirmBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { appointmentId, paymentIntentId } = parse.data;

  const [appointment] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, appointmentId));

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  const stripe = getStripe();

  // Determine new payment status
  let newPaymentStatus: "DEPOSIT_PAID" | "FULLY_PAID" = "FULLY_PAID";

  if (stripe && paymentIntentId !== "pi_test_mock") {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== "succeeded") {
      res.status(400).json({ error: "Payment not yet succeeded", status: intent.status });
      return;
    }
    const paidAmountDollars = intent.amount / 100;
    if (paidAmountDollars < appointment.totalPrice) {
      newPaymentStatus = "DEPOSIT_PAID";
    }
  }

  // Update appointment payment status
  await db
    .update(appointmentsTable)
    .set({ paymentStatus: newPaymentStatus, status: "CONFIRMED" })
    .where(eq(appointmentsTable.id, appointmentId));

  // Update payment record
  await db
    .update(paymentsTable)
    .set({ status: "succeeded" })
    .where(eq(paymentsTable.appointmentId, appointmentId));

  const [updated] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, appointmentId));

  res.json({ success: true, appointment: updated, paymentStatus: newPaymentStatus });
});

// POST /api/payments/webhook — raw body required (set in app.ts)
router.post("/payments/webhook", async (req: Request, res: Response) => {
  const stripe = getStripe();
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];

  if (!stripe || !webhookSecret || !sig) {
    res.json({ received: true });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err) {
    res.status(400).json({ error: `Webhook signature verification failed` });
    return;
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const { appointmentId } = intent.metadata;
      if (appointmentId) {
        const paidDollars = intent.amount / 100;
        const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, appointmentId));
        const status = appt && paidDollars < appt.totalPrice ? "DEPOSIT_PAID" : "FULLY_PAID";
        await db.update(appointmentsTable)
          .set({ paymentStatus: status, status: "CONFIRMED" })
          .where(eq(appointmentsTable.id, appointmentId));
        await db.update(paymentsTable)
          .set({ status: "succeeded" })
          .where(eq(paymentsTable.appointmentId, appointmentId));
      }
      break;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const { appointmentId } = intent.metadata;
      if (appointmentId) {
        await db.update(paymentsTable)
          .set({ status: "failed" })
          .where(eq(paymentsTable.appointmentId, appointmentId));
      }
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentIntentId) {
        const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.stripePaymentId, paymentIntentId));
        if (appt) {
          await db.update(paymentsTable)
            .set({ status: "refunded" })
            .where(eq(paymentsTable.appointmentId, appt.id));
        }
      }
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
});

// POST /api/payments/refund
router.post("/payments/refund", async (req: Request, res: Response) => {
  if (!req.isAuthenticated() || req.user.role !== "ADMIN") {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const parse = RefundBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { appointmentId, reason } = parse.data;

  const [appointment] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, appointmentId));

  if (!appointment || !appointment.stripePaymentId) {
    res.status(404).json({ error: "No payment found for this appointment" });
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }

  const refund = await stripe.refunds.create({
    payment_intent: appointment.stripePaymentId,
    reason: "requested_by_customer",
    metadata: { appointmentId, reason: reason ?? "refund" },
  });

  await db
    .update(appointmentsTable)
    .set({ paymentStatus: "REFUNDED" })
    .where(eq(appointmentsTable.id, appointmentId));

  await db
    .update(paymentsTable)
    .set({ status: "refunded" })
    .where(eq(paymentsTable.appointmentId, appointmentId));

  res.json({ success: true, refundId: refund.id, status: refund.status });
});

// GET /api/payments/history
router.get("/payments/history", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const isAdmin = req.user.role === "ADMIN";
  const payments = await db
    .select({
      payment: paymentsTable,
      appointment: appointmentsTable,
    })
    .from(paymentsTable)
    .leftJoin(appointmentsTable, eq(paymentsTable.appointmentId, appointmentsTable.id))
    .where(isAdmin ? undefined : eq(appointmentsTable.clientId, req.user.id))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(50);

  res.json(payments);
});

export default router;
