import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
})

/**
 * Create or retrieve a Stripe customer for a client
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name: string
): Promise<string> {
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { salonSyncUserId: userId },
  })
  return customer.id
}

/**
 * Charge a cancellation fee to a card on file
 */
export async function chargeCancellationFee(
  stripeCustomerId: string,
  amountInCents: number,
  appointmentId: string,
  description: string
) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd',
    customer: stripeCustomerId,
    confirm: true,
    off_session: true,
    description,
    metadata: { appointmentId, type: 'cancellation_fee' },
  })
  return paymentIntent
}

/**
 * Issue a full or partial refund
 */
export async function issueRefund(
  paymentIntentId: string,
  amountInCents?: number
) {
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(amountInCents ? { amount: amountInCents } : {}),
  })
  return refund
}
