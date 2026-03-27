import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { intakeFormsTable, intakeFormResponsesTable, usersTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const FieldSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "textarea", "select", "checkbox", "date", "signature", "file"]),
  label: z.string(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  helpText: z.string().optional(),
});

const FormBody = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  fields: z.array(FieldSchema).min(1),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
  hipaaCompliant: z.boolean().optional(),
  locationId: z.string(),
});

router.get("/intake-forms", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const locationId = req.query.locationId as string;
  const forms = locationId
    ? await db.select().from(intakeFormsTable)
        .where(eq(intakeFormsTable.locationId, locationId))
        .orderBy(desc(intakeFormsTable.createdAt))
    : await db.select().from(intakeFormsTable).orderBy(desc(intakeFormsTable.createdAt));

  res.json(forms);
});

router.get("/intake-forms/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [form] = await db.select().from(intakeFormsTable).where(eq(intakeFormsTable.id, req.params.id));
  if (!form) {
    res.status(404).json({ error: "Form not found" });
    return;
  }
  res.json(form);
});

router.post("/intake-forms", async (req, res) => {
  if (!req.isAuthenticated() || !["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const body = FormBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body", details: body.error.issues });
    return;
  }

  const [form] = await db.insert(intakeFormsTable).values({
    name: body.data.name,
    description: body.data.description ?? null,
    fields: body.data.fields,
    isRequired: body.data.isRequired ?? false,
    isActive: body.data.isActive ?? true,
    hipaaCompliant: body.data.hipaaCompliant ?? false,
    locationId: body.data.locationId,
  }).returning();

  res.status(201).json(form);
});

router.put("/intake-forms/:id", async (req, res) => {
  if (!req.isAuthenticated() || !["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const body = FormBody.partial().safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const updates: Record<string, any> = {};
  if (body.data.name !== undefined) updates.name = body.data.name;
  if (body.data.description !== undefined) updates.description = body.data.description;
  if (body.data.fields !== undefined) updates.fields = body.data.fields;
  if (body.data.isRequired !== undefined) updates.isRequired = body.data.isRequired;
  if (body.data.isActive !== undefined) updates.isActive = body.data.isActive;
  if (body.data.hipaaCompliant !== undefined) updates.hipaaCompliant = body.data.hipaaCompliant;

  const [form] = await db.update(intakeFormsTable)
    .set(updates)
    .where(eq(intakeFormsTable.id, req.params.id))
    .returning();

  if (!form) {
    res.status(404).json({ error: "Form not found" });
    return;
  }
  res.json(form);
});

router.delete("/intake-forms/:id", async (req, res) => {
  if (!req.isAuthenticated() || !["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [deleted] = await db.delete(intakeFormsTable)
    .where(eq(intakeFormsTable.id, req.params.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Form not found" });
    return;
  }
  res.json({ success: true });
});

const ResponseBody = z.object({
  formId: z.string(),
  appointmentId: z.string().optional(),
  responses: z.record(z.any()),
  signatureDataUrl: z.string().optional(),
});

router.post("/intake-forms/responses", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = ResponseBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const [response] = await db.insert(intakeFormResponsesTable).values({
    formId: body.data.formId,
    clientId: req.user.id,
    appointmentId: body.data.appointmentId ?? null,
    responses: body.data.responses,
    signatureDataUrl: body.data.signatureDataUrl ?? null,
  }).returning();

  res.status(201).json(response);
});

router.get("/intake-forms/:formId/responses", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userRole = (req.user as any)?.role;
  if (!["ADMIN", "SUPER_ADMIN"].includes(userRole)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const responses = await db.select({
    response: intakeFormResponsesTable,
    client: {
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
    },
  })
    .from(intakeFormResponsesTable)
    .leftJoin(usersTable, eq(intakeFormResponsesTable.clientId, usersTable.id))
    .where(eq(intakeFormResponsesTable.formId, req.params.formId))
    .orderBy(desc(intakeFormResponsesTable.submittedAt));

  res.json(responses);
});

router.get("/appointments/:appointmentId/intake-responses", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const responses = await db.select({
    response: intakeFormResponsesTable,
    form: {
      name: intakeFormsTable.name,
      fields: intakeFormsTable.fields,
    },
  })
    .from(intakeFormResponsesTable)
    .leftJoin(intakeFormsTable, eq(intakeFormResponsesTable.formId, intakeFormsTable.id))
    .where(eq(intakeFormResponsesTable.appointmentId, req.params.appointmentId));

  res.json(responses);
});

router.get("/clients/:clientId/intake-responses", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = req.user as any;
  if (!["ADMIN", "SUPER_ADMIN", "STAFF"].includes(user?.role) && user?.id !== req.params.clientId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const responses = await db.select({
    response: intakeFormResponsesTable,
    form: {
      name: intakeFormsTable.name,
      fields: intakeFormsTable.fields,
    },
  })
    .from(intakeFormResponsesTable)
    .leftJoin(intakeFormsTable, eq(intakeFormResponsesTable.formId, intakeFormsTable.id))
    .where(eq(intakeFormResponsesTable.clientId, req.params.clientId))
    .orderBy(desc(intakeFormResponsesTable.submittedAt));

  res.json(responses);
});

export default router;
