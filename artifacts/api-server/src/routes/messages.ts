import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  directMessageThreadsTable,
  directMessagesTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, or, and, ne, sql, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { sendNewMessageNotification } from "../services/notifications";

const router: IRouter = Router();

// ── SSE connection store ──────────────────────────────────────────────────
// threadId -> Set of active SSE response objects
const sseClients = new Map<string, Set<Response>>();

function addSseClient(threadId: string, res: Response) {
  if (!sseClients.has(threadId)) sseClients.set(threadId, new Set());
  sseClients.get(threadId)!.add(res);
}

function removeSseClient(threadId: string, res: Response) {
  sseClients.get(threadId)?.delete(res);
}

function broadcastToThread(threadId: string, payload: object) {
  const clients = sseClients.get(threadId);
  if (!clients) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try { res.write(data); } catch { /* client disconnected */ }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
async function enrichThread(thread: typeof directMessageThreadsTable.$inferSelect) {
  const [staff] = await db.select({
    id: usersTable.id, firstName: usersTable.firstName,
    lastName: usersTable.lastName, profileImageUrl: usersTable.profileImageUrl,
    role: usersTable.role,
  }).from(usersTable).where(eq(usersTable.id, thread.staffId));

  const [client] = await db.select({
    id: usersTable.id, firstName: usersTable.firstName,
    lastName: usersTable.lastName, profileImageUrl: usersTable.profileImageUrl,
    role: usersTable.role,
  }).from(usersTable).where(eq(usersTable.id, thread.clientId));

  const [lastMsg] = await db
    .select()
    .from(directMessagesTable)
    .where(eq(directMessagesTable.threadId, thread.id))
    .orderBy(desc(directMessagesTable.sentAt))
    .limit(1);

  return { ...thread, staff: staff ?? null, client: client ?? null, lastMessage: lastMsg ?? null };
}

// ── Routes ────────────────────────────────────────────────────────────────

// GET /api/messages/unread-count
router.get("/messages/unread-count", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Find all threads this user is part of
  const threads = await db
    .select({ id: directMessageThreadsTable.id })
    .from(directMessageThreadsTable)
    .where(
      or(
        eq(directMessageThreadsTable.staffId, req.user.id),
        eq(directMessageThreadsTable.clientId, req.user.id),
      )
    );

  if (threads.length === 0) { res.json({ count: 0 }); return; }

  const threadIds = threads.map(t => t.id);
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(directMessagesTable)
    .where(
      and(
        sql`${directMessagesTable.threadId} = ANY(${threadIds}::text[])`,
        eq(directMessagesTable.isRead, false),
        ne(directMessagesTable.senderId, req.user.id),
      )
    );

  res.json({ count: result[0]?.count ?? 0 });
});

// GET /api/messages/threads
router.get("/messages/threads", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const threads = await db
    .select()
    .from(directMessageThreadsTable)
    .where(
      or(
        eq(directMessageThreadsTable.staffId, req.user.id),
        eq(directMessageThreadsTable.clientId, req.user.id),
      )
    )
    .orderBy(desc(directMessageThreadsTable.lastMessageAt));

  const enriched = await Promise.all(threads.map(enrichThread));
  res.json(enriched);
});

// POST /api/messages/threads
const CreateThreadBody = z.object({
  staffId: z.string(),
  clientId: z.string(),
  appointmentId: z.string().optional(),
});

router.post("/messages/threads", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = CreateThreadBody.parse(req.body);

  // Return existing thread if one already exists for this pair
  const [existing] = await db
    .select()
    .from(directMessageThreadsTable)
    .where(
      and(
        eq(directMessageThreadsTable.staffId, body.staffId),
        eq(directMessageThreadsTable.clientId, body.clientId),
      )
    )
    .limit(1);

  if (existing) {
    res.json(await enrichThread(existing));
    return;
  }

  const [thread] = await db
    .insert(directMessageThreadsTable)
    .values({
      staffId: body.staffId,
      clientId: body.clientId,
      appointmentId: body.appointmentId,
    })
    .returning();

  res.status(201).json(await enrichThread(thread));
});

// GET /api/messages/threads/:id
router.get("/messages/threads/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [thread] = await db
    .select()
    .from(directMessageThreadsTable)
    .where(eq(directMessageThreadsTable.id, req.params.id));

  if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }

  // Verify user is a participant
  if (thread.staffId !== req.user.id && thread.clientId !== req.user.id && req.user.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const msgs = await db
    .select()
    .from(directMessagesTable)
    .where(eq(directMessagesTable.threadId, thread.id))
    .orderBy(directMessagesTable.sentAt);

  res.json({ thread: await enrichThread(thread), messages: msgs });
});

// POST /api/messages/threads/:id/messages
const SendMessageBody = z.object({ content: z.string().min(1).max(4000) });

router.post("/messages/threads/:id/messages", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = SendMessageBody.parse(req.body);

  const [thread] = await db
    .select()
    .from(directMessageThreadsTable)
    .where(eq(directMessageThreadsTable.id, req.params.id));

  if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }
  if (thread.staffId !== req.user.id && thread.clientId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [msg] = await db
    .insert(directMessagesTable)
    .values({
      threadId: thread.id,
      senderId: req.user.id,
      content: body.content,
    })
    .returning();

  // Update thread lastMessageAt
  await db
    .update(directMessageThreadsTable)
    .set({ lastMessageAt: new Date() })
    .where(eq(directMessageThreadsTable.id, thread.id));

  // Broadcast via SSE to all listeners on this thread
  broadcastToThread(thread.id, { type: "message", message: msg });

  // Notify recipient async — don't block
  const recipientId = req.user.id === thread.staffId ? thread.clientId : thread.staffId;
  const [sender] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(usersTable).where(eq(usersTable.id, req.user.id));
  const senderName = [sender?.firstName, sender?.lastName].filter(Boolean).join(" ") || "Someone";
  sendNewMessageNotification(recipientId, senderName).catch(() => {});

  res.status(201).json(msg);
});

// POST /api/messages/threads/:id/read
router.post("/messages/threads/:id/read", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  await db
    .update(directMessagesTable)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(directMessagesTable.threadId, req.params.id),
        ne(directMessagesTable.senderId, req.user.id),
        eq(directMessagesTable.isRead, false),
      )
    );

  res.json({ success: true });
});

// GET /api/messages/threads/:id/sse — real-time stream
router.get("/messages/threads/:id/sse", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [thread] = await db
    .select()
    .from(directMessageThreadsTable)
    .where(eq(directMessageThreadsTable.id, req.params.id));

  if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }
  if (thread.staffId !== req.user.id && thread.clientId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Send heartbeat to keep connection alive
  res.write(`data: ${JSON.stringify({ type: "connected", threadId: thread.id })}\n\n`);

  addSseClient(thread.id, res);

  const heartbeat = setInterval(() => {
    try { res.write(`data: ${JSON.stringify({ type: "ping" })}\n\n`); } catch { /* gone */ }
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeSseClient(thread.id, res);
  });
});

export default router;
