import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { appointmentsTable, reviewsTable, servicesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  ScoreAppointmentRiskBody,
  AnalyzeReviewSentimentBody,
  AiReceptionistChatBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/ai/risk-score", async (req, res) => {
  const body = ScoreAppointmentRiskBody.parse(req.body);

  const appointmentDate = new Date(body.startTime);
  const dayOfWeek = appointmentDate.toLocaleDateString("en-US", { weekday: "long" });
  const timeOfDay = appointmentDate.getHours();

  const clientHistory = body.clientHistory ?? { totalAppointments: 0, cancelledCount: 0, noShowCount: 0 };
  const cancelRate = clientHistory.totalAppointments > 0
    ? ((clientHistory.cancelledCount + clientHistory.noShowCount) / clientHistory.totalAppointments * 100).toFixed(1)
    : "0";

  const prompt = `You are analyzing the cancellation risk for a hair salon appointment.

Client history:
- Total appointments: ${clientHistory.totalAppointments}
- Cancelled: ${clientHistory.cancelledCount}
- No-shows: ${clientHistory.noShowCount}
- Cancellation rate: ${cancelRate}%

Appointment details:
- Day: ${dayOfWeek}
- Hour: ${timeOfDay}:00
- Services: ${body.serviceIds.length} service(s)

Based on this data, assess the cancellation risk as LOW, MEDIUM, or HIGH.
Return a JSON object with:
{
  "riskScore": "LOW" | "MEDIUM" | "HIGH",
  "riskFactors": ["reason1", "reason2"]
}
Only return the JSON, no other text.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    const text = block.type === "text" ? block.text.trim() : '{"riskScore":"LOW","riskFactors":[]}';
    const result = JSON.parse(text);

    // Update appointment risk score
    await db
      .update(appointmentsTable)
      .set({ riskScore: result.riskScore, riskFactors: result.riskFactors })
      .where(eq(appointmentsTable.id, body.appointmentId))
      .catch(() => {});

    res.json(result);
  } catch {
    res.json({ riskScore: "LOW", riskFactors: [] });
  }
});

router.post("/ai/sentiment", async (req, res) => {
  const body = AnalyzeReviewSentimentBody.parse(req.body);

  const prompt = `Analyze the sentiment of this salon review.

Rating: ${body.rating}/5
Comment: "${body.comment ?? "No comment provided"}"

Return a JSON object with:
{
  "sentimentScore": 0.0 to 1.0 (where 1.0 is very positive),
  "sentimentTags": ["tag1", "tag2"] (e.g. "friendly staff", "great haircut", "long wait")
}
Only return the JSON, no other text.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    const text = block.type === "text" ? block.text.trim() : '{"sentimentScore":0.5,"sentimentTags":[]}';
    const result = JSON.parse(text);

    // Update review with sentiment
    await db
      .update(reviewsTable)
      .set({ sentimentScore: result.sentimentScore, sentimentTags: result.sentimentTags, isPublished: true })
      .where(eq(reviewsTable.id, body.reviewId))
      .catch(() => {});

    res.json(result);
  } catch {
    res.json({ sentimentScore: 0.5, sentimentTags: [] });
  }
});

router.post("/ai/chat", async (req, res) => {
  const body = AiReceptionistChatBody.parse(req.body);

  // Fetch location services for context
  const services = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.locationId, body.locationId))
    .catch(() => []);

  const serviceList = services
    .filter(s => s.isActive)
    .map(s => `- ${s.name}: $${s.basePrice}, ${s.durationMinutes} min`)
    .join("\n");

  const systemPrompt = `You are a friendly and professional AI receptionist for a hair salon. 
You help clients with questions about services, pricing, booking information, and general salon queries.

Available services:
${serviceList || "No services listed yet."}

Be concise, warm, and helpful. If asked to book an appointment, guide them to use the booking system.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: systemPrompt,
      messages: body.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    const block = message.content[0];
    const response = block.type === "text" ? block.text : "I'm here to help! Please let me know what you need.";

    res.json({ response });
  } catch {
    res.json({ response: "I'm having trouble responding right now. Please try again shortly." });
  }
});

export default router;
