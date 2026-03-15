import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { conversations as conversationsTable, messages as messagesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  CreateAnthropicConversationBody,
  SendAnthropicMessageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/anthropic/conversations", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const conversations = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.userId, req.user.id))
    .orderBy(conversationsTable.updatedAt);
  res.json(conversations);
});

router.post("/anthropic/conversations", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = CreateAnthropicConversationBody.parse(req.body);
  const [conversation] = await db
    .insert(conversationsTable)
    .values({
      userId: req.user.id,
      title: body.title ?? "New Conversation",
    })
    .returning();
  res.status(201).json(conversation);
});

router.get("/anthropic/conversations/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const cid = parseInt(req.params.id, 10);
  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, cid),
        eq(conversationsTable.userId, req.user.id),
      )
    );
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.json(conversation);
});

router.delete("/anthropic/conversations/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const cid = parseInt(req.params.id, 10);
  await db
    .delete(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, cid),
        eq(conversationsTable.userId, req.user.id),
      )
    );
  res.status(204).send();
});

router.get("/anthropic/conversations/:id/messages", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const cid = parseInt(req.params.id, 10);
  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, cid))
    .orderBy(messagesTable.createdAt);
  res.json(msgs);
});

router.post("/anthropic/conversations/:id/messages", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const cid = parseInt(req.params.id, 10);
  const body = SendAnthropicMessageBody.parse(req.body);

  // Load existing messages in this conversation
  const history = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, cid))
    .orderBy(messagesTable.createdAt);

  // Save user message
  await db.insert(messagesTable).values({
    conversationId: cid,
    role: "user",
    content: body.content,
  });

  const messages = [
    ...history.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: body.content },
  ];

  // SSE streaming response
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let fullText = "";

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are a helpful AI receptionist for a professional hair salon named SalonSync. 
You assist clients with questions about services, bookings, hair care tips, and general salon information. 
Be friendly, professional, and concise.`,
      messages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        const chunk = event.delta.text;
        fullText += chunk;
        res.write(`data: ${JSON.stringify({ type: "text", text: chunk })}\n\n`);
      }
    }

    // Save assistant message
    await db.insert(messagesTable).values({
      conversationId: cid,
      role: "assistant",
      content: fullText,
    });

    // Update conversation timestamp
    await db
      .update(conversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(conversationsTable.id, cid));

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
    res.end();
  }
});

export default router;
