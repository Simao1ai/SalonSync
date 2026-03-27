import { db } from "@workspace/db";
import { webhooksTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";

export type WebhookEvent =
  | "appointment.created"
  | "appointment.cancelled"
  | "client.created"
  | "payment.completed"
  | "review.created";

interface WebhookPayload {
  event: WebhookEvent;
  locationId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function fireWebhooks(
  event: WebhookEvent,
  locationId: string,
  data: Record<string, unknown>
) {
  try {
    const webhooks = await db
      .select()
      .from(webhooksTable)
      .where(eq(webhooksTable.locationId, locationId));

    const activeWebhooks = webhooks.filter(
      (w) => w.isActive && Array.isArray(w.events) && w.events.includes(event)
    );

    const payload: WebhookPayload = {
      event,
      locationId,
      data,
      timestamp: new Date().toISOString(),
    };

    const body = JSON.stringify(payload);

    await Promise.allSettled(
      activeWebhooks.map(async (webhook) => {
        const signature = signPayload(body, webhook.secret);

        try {
          const response = await fetch(webhook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-SalonSync-Signature": signature,
              "X-SalonSync-Event": event,
            },
            body,
            signal: AbortSignal.timeout(10000),
          });

          await db
            .update(webhooksTable)
            .set({
              lastTriggeredAt: new Date(),
              failCount: response.ok ? "0" : String(parseInt(webhook.failCount || "0") + 1),
            })
            .where(eq(webhooksTable.id, webhook.id));

          if (!response.ok) {
            console.error(
              `Webhook ${webhook.id} failed: ${response.status} ${response.statusText}`
            );
          }
        } catch (err) {
          await db
            .update(webhooksTable)
            .set({
              lastTriggeredAt: new Date(),
              failCount: String(parseInt(webhook.failCount || "0") + 1),
            })
            .where(eq(webhooksTable.id, webhook.id));
          console.error(`Webhook ${webhook.id} error:`, err);
        }
      })
    );
  } catch (err) {
    console.error("fireWebhooks error:", err);
  }
}
