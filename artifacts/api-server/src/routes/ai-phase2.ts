import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  appointmentsTable,
  usersTable,
  servicesTable,
  appointmentServicesTable,
  availabilityTable,
  waitlistTable,
  reviewsTable,
  analyticsTable,
  campaignsTable,
  campaignAnalyticsTable,
  aiInsightsHistoryTable,
  locationsTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte, sql, desc, ne, isNull, or, lt } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { z } from "zod";

const router: IRouter = Router();

function extractJSON(text: string): any {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = codeBlock ? codeBlock[1].trim() : text;
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
    const fixed = match[0].replace(/,\s*([}\]])/g, "$1").replace(/\n/g, " ");
    try { return JSON.parse(fixed); } catch {}
  }
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch {}
  }
  return JSON.parse(raw);
}

function getUserLocationId(req: any): string | null {
  const user = req.user as any;
  return user?.locationId || null;
}

function requireAdminRole(req: any, res: any): boolean {
  const user = req.user as any;
  if (!["ADMIN", "SUPER_ADMIN"].includes(user?.role)) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

const ALLOWED_SQL_TABLES = ["locations", "users", "services", "appointments", "appointment_services", "payments", "reviews", "analytics", "waitlist", "tips", "gift_cards", "availability"];
const FORBIDDEN_SQL_PATTERNS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC|EXECUTE|INTO|SET\s|COPY|pg_|information_schema)\b/i;

function validateReadOnlySQL(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed.toUpperCase().startsWith("SELECT")) return false;
  if (FORBIDDEN_SQL_PATTERNS.test(trimmed)) return false;
  if (trimmed.includes(";") && trimmed.indexOf(";") < trimmed.length - 1) return false;
  return true;
}

router.post("/ai/optimize-schedule", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { locationId, weekOf } = req.body;
  if (!locationId) { res.status(400).json({ error: "locationId required" }); return; }

  const startOfWeek = weekOf ? new Date(weekOf) : new Date();
  startOfWeek.setHours(0, 0, 0, 0);
  const day = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - day);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  try {
    const [appointments, staff, availability, waitlisted, services] = await Promise.all([
      db.select().from(appointmentsTable)
        .where(and(
          eq(appointmentsTable.locationId, locationId),
          gte(appointmentsTable.startTime, startOfWeek),
          lte(appointmentsTable.startTime, endOfWeek),
          ne(appointmentsTable.status, "cancelled"),
        )),
      db.select().from(usersTable)
        .where(and(eq(usersTable.locationId, locationId), eq(usersTable.role, "STAFF"))),
      db.select().from(availabilityTable)
        .where(eq(availabilityTable.locationId, locationId)),
      db.select().from(waitlistTable)
        .where(and(eq(waitlistTable.locationId, locationId), eq(waitlistTable.status, "waiting"))),
      db.select().from(servicesTable)
        .where(eq(servicesTable.locationId, locationId)),
    ]);

    const totalAvailableMinutes = staff.length * 7 * 8 * 60;
    const bookedMinutes = appointments.reduce((sum, a) => {
      const dur = a.endTime && a.startTime ? (new Date(a.endTime).getTime() - new Date(a.startTime).getTime()) / 60000 : 60;
      return sum + dur;
    }, 0);
    const efficiencyScore = totalAvailableMinutes > 0 ? Math.round((bookedMinutes / totalAvailableMinutes) * 100) : 0;

    const apptSummary = appointments.slice(0, 30).map(a => ({
      day: new Date(a.startTime).toLocaleDateString("en-US", { weekday: "short" }),
      time: new Date(a.startTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      duration: a.endTime ? Math.round((new Date(a.endTime).getTime() - new Date(a.startTime).getTime()) / 60000) : 60,
      staffId: a.staffId,
      status: a.status,
    }));

    const staffNames = staff.map(s => `${s.firstName} ${s.lastName} (${s.id})`).join(", ");
    const waitlistSummary = waitlisted.slice(0, 10).map(w => ({
      clientId: w.clientId,
      serviceId: w.serviceId,
      preferred: `${w.preferredDayOfWeek ?? "any"} ${w.preferredTimeRange ?? "any"}`,
    }));
    const svcMap = Object.fromEntries(services.map(s => [s.id, `${s.name} (${s.durationMinutes}min)`]));

    const prompt = `You are an AI scheduling optimizer for a hair salon. Analyze the week's schedule and suggest optimizations.

Staff: ${staffNames}
Services: ${JSON.stringify(svcMap)}

Current appointments this week (${appointments.length} total):
${JSON.stringify(apptSummary)}

Waitlisted clients wanting appointments:
${JSON.stringify(waitlistSummary)}

Schedule Efficiency: ${efficiencyScore}% of available time is booked.

Analyze and return a JSON object:
{
  "efficiencyScore": ${efficiencyScore},
  "suggestions": [
    {
      "type": "gap_fill" | "waitlist_placement" | "rearrangement",
      "title": "Short title",
      "description": "What to do and why",
      "priority": "high" | "medium" | "low",
      "affectedStaffId": "staff-id or null",
      "suggestedDay": "Mon/Tue/etc",
      "suggestedTime": "HH:MM",
      "waitlistClientId": "client-id or null"
    }
  ],
  "summary": "2-3 sentence overview of the schedule health"
}
Return 3-6 actionable suggestions. Only return the JSON.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    const text = block.type === "text" ? block.text.trim() : '{"efficiencyScore":0,"suggestions":[],"summary":"Unable to analyze"}';
    const result = extractJSON(text);
    result.efficiencyScore = efficiencyScore;

    res.json(result);
  } catch (e: any) {
    console.error("Schedule optimizer error:", e?.message);
    res.json({ efficiencyScore: 0, suggestions: [], summary: "Analysis unavailable" });
  }
});

router.post("/ai/generate-campaign", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const schema = z.object({
    locationId: z.string(),
    type: z.enum(["email", "sms", "social"]),
    segment: z.string().optional(),
    goal: z.string().optional(),
  });
  const body = schema.parse(req.body);

  try {
    const [services, location] = await Promise.all([
      db.select().from(servicesTable).where(eq(servicesTable.locationId, body.locationId)),
      db.select().from(locationsTable).where(eq(locationsTable.id, body.locationId)).then(r => r[0]),
    ]);

    const salonName = (location as any)?.brandName || (location as any)?.name || "Our Salon";
    const serviceList = services.filter(s => s.isActive).map(s => `${s.name} ($${s.basePrice})`).join(", ");
    const month = new Date().toLocaleString("en-US", { month: "long" });

    const prompt = `You are a marketing expert for "${salonName}", a high-end hair salon.
Services offered: ${serviceList}
Campaign type: ${body.type}
Target segment: ${body.segment || "all clients"}
Campaign goal: ${body.goal || "increase bookings"}
Current month: ${month}

Generate marketing content. Return JSON:
{
  "subject": "Email subject line (compelling, under 60 chars)",
  "body": "Email body HTML (3-4 paragraphs, professional, with a clear CTA. Use <p>, <strong>, <em> tags)",
  "smsText": "SMS message under 160 characters with a clear CTA",
  "socialCaption": "Instagram/social post caption with emojis and hashtags (2-3 sentences)",
  "promotionIdea": "A specific seasonal promotion idea with pricing suggestion"
}
Only return the JSON.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    const text = block.type === "text" ? block.text.trim() : "{}";
    const result = extractJSON(text);
    res.json(result);
  } catch (e: any) {
    console.error("Campaign generator error:", e?.message);
    res.status(500).json({ error: "Failed to generate campaign content" });
  }
});

router.get("/campaigns", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!requireAdminRole(req, res)) return;
  const locationId = req.query.locationId as string;
  if (!locationId) { res.status(400).json({ error: "locationId required" }); return; }
  try {
    const campaigns = await db.select().from(campaignsTable).where(eq(campaignsTable.locationId, locationId)).orderBy(desc(campaignsTable.createdAt));
    res.json(campaigns);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

router.post("/campaigns", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!requireAdminRole(req, res)) return;
  const user = req.user as any;
  const body = req.body;
  if (!body.locationId || !body.type) { res.status(400).json({ error: "locationId and type required" }); return; }
  try {
    const [campaign] = await db.insert(campaignsTable).values({
      locationId: body.locationId,
      type: body.type,
      segment: body.segment,
      goal: body.goal,
      subject: body.subject,
      body: body.body,
      smsText: body.smsText,
      socialCaption: body.socialCaption,
      status: body.status || "draft",
      createdBy: user.id,
    }).returning();
    await db.insert(campaignAnalyticsTable).values({ campaignId: campaign.id });
    res.status(201).json(campaign);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

router.patch("/campaigns/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!requireAdminRole(req, res)) return;
  try {
    const [existing] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, req.params.id));
    if (!existing) { res.status(404).json({ error: "Campaign not found" }); return; }
    const updates: any = {};
    for (const key of ["subject", "body", "smsText", "socialCaption", "status", "segment", "goal"]) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (req.body.status === "sent") updates.sentAt = new Date();
    updates.updatedAt = new Date();
    const [campaign] = await db.update(campaignsTable).set(updates).where(eq(campaignsTable.id, req.params.id)).returning();
    res.json(campaign);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to update campaign" });
  }
});

router.delete("/campaigns/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!requireAdminRole(req, res)) return;
  try {
    const [existing] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, req.params.id));
    if (!existing) { res.status(404).json({ error: "Campaign not found" }); return; }
    await db.delete(campaignAnalyticsTable).where(eq(campaignAnalyticsTable.campaignId, req.params.id));
    await db.delete(campaignsTable).where(eq(campaignsTable.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to delete campaign" });
  }
});

router.get("/campaigns/:id/analytics", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!requireAdminRole(req, res)) return;
  try {
    const [analytics] = await db.select().from(campaignAnalyticsTable).where(eq(campaignAnalyticsTable.campaignId, req.params.id));
    res.json(analytics ?? { sent: 0, opened: 0, clicked: 0, booked: 0 });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

router.post("/ai/insights", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = req.user as any;
  if (!["ADMIN", "SUPER_ADMIN"].includes(user?.role)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const { query, locationId } = req.body;
  if (!query || !locationId) { res.status(400).json({ error: "query and locationId required" }); return; }

  const schemaContext = `Database schema (PostgreSQL):
- locations(id varchar PK, name, address, city, state, phone, email, cancellation_window_hours int)
- users(id varchar PK, email, first_name, last_name, role varchar, phone, location_id, specialties text[])
- services(id varchar PK, name, category, base_price numeric, duration_minutes int, location_id, is_active bool)
- appointments(id varchar PK, client_id, staff_id, location_id, start_time timestamp, end_time timestamp, status varchar, total_price numeric, risk_score varchar, created_at timestamp)
- appointment_services(id varchar PK, appointment_id, service_id, price numeric)
- payments(id varchar PK, appointment_id, amount numeric, status varchar, method varchar, created_at timestamp)
- reviews(id varchar PK, appointment_id, client_id, staff_id, location_id, rating int, comment text, sentiment_score double, created_at timestamp)
- analytics(id varchar PK, location_id, date date, total_revenue numeric, total_appointments int, cancellations int, no_shows int)
- waitlist(id varchar PK, client_id, service_id, location_id, status varchar, preferred_day_of_week varchar, preferred_time_range varchar)
- tips(id varchar PK, appointment_id, client_id, staff_id, amount numeric, created_at timestamp)
- gift_cards(id varchar PK, code varchar, balance numeric, original_amount numeric, is_active bool)

IMPORTANT: Only generate SELECT statements. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, or any write operations.
Always filter by location_id = '${locationId}' when the table has a location_id column.
For user names, use first_name || ' ' || last_name.`;

  const prompt = `You are a business analytics AI for a hair salon. A salon admin asks: "${query}"

${schemaContext}

Generate a safe read-only SQL query to answer this question, execute the mental model of results, then provide a clear answer.

Return JSON:
{
  "sql": "SELECT ... (the query)",
  "answer": "A clear, friendly, data-driven answer in 2-4 sentences. Include specific numbers. If you're making assumptions about what the data might look like, say so.",
  "chartType": "bar" | "line" | "number" | "table" | null,
  "chartData": [{"label": "x", "value": y}] or null
}
Only return the JSON.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    const text = block.type === "text" ? block.text.trim() : "{}";
    const aiResult = extractJSON(text);

    let answer = aiResult.answer || "I couldn't generate an answer for that question.";
    let queryResult: any = null;
    const generatedSql = aiResult.sql || "";

    if (generatedSql && validateReadOnlySQL(generatedSql)) {
      try {
        const dbResult = await db.execute(sql.raw(`${generatedSql.replace(/;+\s*$/, "")} LIMIT 100`));
        queryResult = dbResult.rows ?? dbResult;
        if (Array.isArray(queryResult) && queryResult.length > 0) {
          const reanswerPrompt = `The salon admin asked: "${query}"
SQL query executed: ${generatedSql}
Results: ${JSON.stringify(queryResult.slice(0, 20))}

Provide a clear, friendly answer using the ACTUAL data above. Include specific numbers and names. Be concise (2-4 sentences). Do not mention SQL or technical details.`;

          const reanswerMsg = await anthropic.messages.create({
            model: "claude-haiku-4-5",
            max_tokens: 512,
            messages: [{ role: "user", content: reanswerPrompt }],
          });
          const reBlock = reanswerMsg.content[0];
          if (reBlock.type === "text") answer = reBlock.text.trim();
        }
      } catch (sqlErr: any) {
        answer = `I generated a query but it encountered an error. Let me try to answer based on my analysis: ${aiResult.answer || "Please try rephrasing your question."}`;
      }
    }

    await db.insert(aiInsightsHistoryTable).values({
      userId: user.id,
      locationId,
      query,
      answer,
      sqlGenerated: generatedSql,
    }).catch(() => {});

    res.json({
      answer,
      sql: generatedSql,
      data: queryResult?.slice?.(0, 50) ?? null,
      chartType: aiResult.chartType,
      chartData: aiResult.chartData,
    });
  } catch (e: any) {
    console.error("AI Insights error:", e?.message);
    res.status(500).json({ error: "Failed to process your question. Please try again." });
  }
});

router.get("/ai/insights/history", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = req.user as any;
  const locationId = req.query.locationId as string;
  const history = await db.select().from(aiInsightsHistoryTable)
    .where(and(eq(aiInsightsHistoryTable.userId, user.id), locationId ? eq(aiInsightsHistoryTable.locationId, locationId) : undefined))
    .orderBy(desc(aiInsightsHistoryTable.createdAt))
    .limit(20);
  res.json(history);
});

router.post("/ai/churn-prediction", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { locationId } = req.body;
  if (!locationId) { res.status(400).json({ error: "locationId required" }); return; }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const clients = await db.select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      phone: usersTable.phone,
    }).from(usersTable)
      .where(and(eq(usersTable.role, "CLIENT")));

    const clientAnalysis = [];

    for (const client of clients.slice(0, 50)) {
      const [allAppts, recentAppts, cancelledAppts, reviews] = await Promise.all([
        db.select().from(appointmentsTable)
          .where(and(eq(appointmentsTable.clientId, client.id), eq(appointmentsTable.locationId, locationId))),
        db.select().from(appointmentsTable)
          .where(and(
            eq(appointmentsTable.clientId, client.id),
            eq(appointmentsTable.locationId, locationId),
            gte(appointmentsTable.startTime, ninetyDaysAgo),
          )),
        db.select().from(appointmentsTable)
          .where(and(
            eq(appointmentsTable.clientId, client.id),
            eq(appointmentsTable.locationId, locationId),
            eq(appointmentsTable.status, "cancelled"),
          )),
        db.select().from(reviewsTable)
          .where(and(eq(reviewsTable.clientId, client.id), eq(reviewsTable.locationId, locationId)))
          .orderBy(desc(reviewsTable.createdAt))
          .limit(3),
      ]);

      if (allAppts.length === 0) continue;

      const sortedAppts = allAppts.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      const lastVisit = sortedAppts[0]?.startTime;
      const daysSinceLastVisit = lastVisit ? Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86400000) : 999;
      const totalSpend = allAppts.reduce((sum, a) => sum + (Number(a.totalPrice) || 0), 0);
      const avgSpend = allAppts.length > 0 ? totalSpend / allAppts.length : 0;
      const cancelRate = allAppts.length > 0 ? cancelledAppts.length / allAppts.length : 0;
      const recentVisitCount = recentAppts.filter(a => a.status === "completed").length;
      const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
      const hasLowRating = reviews.some(r => r.rating <= 2);

      clientAnalysis.push({
        id: client.id,
        name: `${client.firstName} ${client.lastName}`,
        email: client.email,
        phone: client.phone,
        totalAppointments: allAppts.length,
        daysSinceLastVisit,
        recentVisitCount,
        cancelRate: Math.round(cancelRate * 100),
        avgSpend: Math.round(avgSpend * 100) / 100,
        hasLowRating,
        avgRating,
      });
    }

    const atRiskClients = clientAnalysis.filter(c =>
      c.daysSinceLastVisit > 45 || c.cancelRate > 30 || c.hasLowRating || (c.totalAppointments > 3 && c.recentVisitCount === 0)
    );

    if (atRiskClients.length === 0) {
      res.json({ clients: [], summary: "No clients currently at high churn risk." });
      return;
    }

    const prompt = `You are analyzing client churn risk for a hair salon. Evaluate these at-risk clients:

${JSON.stringify(atRiskClients.slice(0, 15))}

For each client, determine churn risk (LOW/MEDIUM/HIGH) and suggest a specific re-engagement action.

Return JSON:
{
  "clients": [
    {
      "clientId": "id",
      "name": "name",
      "riskLevel": "LOW" | "MEDIUM" | "HIGH",
      "riskFactors": ["factor1", "factor2"],
      "suggestedAction": "Specific re-engagement action",
      "actionType": "email" | "sms" | "call" | "discount"
    }
  ],
  "summary": "2-3 sentence overview"
}
Only return the JSON.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    const text = block.type === "text" ? block.text.trim() : '{"clients":[],"summary":"Analysis unavailable"}';
    const result = extractJSON(text);

    const enriched = (result.clients ?? []).map((c: any) => {
      const orig = atRiskClients.find(ac => ac.id === c.clientId);
      return { ...c, email: orig?.email, phone: orig?.phone, daysSinceLastVisit: orig?.daysSinceLastVisit, avgSpend: orig?.avgSpend };
    });

    res.json({ clients: enriched, summary: result.summary });
  } catch (e: any) {
    console.error("Churn prediction error:", e?.message);
    res.json({ clients: [], summary: "Analysis unavailable" });
  }
});

router.post("/ai/pricing-suggestions", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { locationId } = req.body;
  if (!locationId) { res.status(400).json({ error: "locationId required" }); return; }

  try {
    const [services, appointments, analytics] = await Promise.all([
      db.select().from(servicesTable).where(and(eq(servicesTable.locationId, locationId), eq(servicesTable.isActive, true))),
      db.select().from(appointmentsTable).where(and(
        eq(appointmentsTable.locationId, locationId),
        gte(appointmentsTable.startTime, new Date(Date.now() - 90 * 86400000)),
      )),
      db.select().from(analyticsTable).where(and(
        eq(analyticsTable.locationId, locationId),
        gte(analyticsTable.date, new Date(Date.now() - 90 * 86400000)),
      )),
    ]);

    const apptServices = appointments.length > 0
      ? await db.select().from(appointmentServicesTable)
          .where(sql`${appointmentServicesTable.appointmentId} IN (${sql.join(appointments.map(a => sql`${a.id}`), sql`, `)})`)
          .catch(() => [])
      : [];

    const serviceBookings: Record<string, number> = {};
    for (const as of apptServices) {
      serviceBookings[as.serviceId] = (serviceBookings[as.serviceId] || 0) + 1;
    }

    const hourDistribution: Record<number, number> = {};
    for (const a of appointments) {
      const hour = new Date(a.startTime).getHours();
      hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
    }

    const serviceSummary = services.map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      price: Number(s.basePrice),
      duration: s.durationMinutes,
      bookings90d: serviceBookings[s.id] || 0,
    }));

    const prompt = `You are a pricing strategy AI for a hair salon. Analyze current services and demand patterns.

Services with 90-day booking data:
${JSON.stringify(serviceSummary)}

Hourly demand distribution (last 90 days):
${JSON.stringify(hourDistribution)}

Total appointments last 90 days: ${appointments.length}
Average daily revenue: $${analytics.length > 0 ? (analytics.reduce((s, a) => s + Number(a.totalRevenue || 0), 0) / analytics.length).toFixed(0) : "N/A"}

Analyze and return JSON:
{
  "suggestions": [
    {
      "serviceId": "id",
      "serviceName": "name",
      "currentPrice": 100,
      "suggestedPrice": 110,
      "changePercent": 10,
      "reason": "Why this change",
      "type": "increase or decrease or happy_hour or premium_peak",
      "confidence": "high or medium or low"
    }
  ],
  "happyHourSuggestion": {
    "enabled": true,
    "hours": "2PM-4PM Tue-Wed",
    "discount": 15,
    "reason": "Why"
  },
  "peakPricingSuggestion": {
    "enabled": true,
    "hours": "10AM-1PM Sat",
    "premium": 10,
    "reason": "Why"
  },
  "summary": "2-3 sentence overview of pricing strategy"
}
Only return the JSON.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    const text = block.type === "text" ? block.text.trim() : "{}";
    try {
      const result = extractJSON(text);
      res.json(result);
    } catch (parseErr) {
      res.json({
        suggestions: [],
        happyHourSuggestion: { enabled: false },
        peakPricingSuggestion: { enabled: false },
        summary: "Unable to parse pricing analysis. Please try again.",
      });
    }
  } catch (e: any) {
    console.error("Pricing suggestions error:", e?.message);
    res.status(500).json({ error: "Failed to generate pricing suggestions" });
  }
});

export default router;
