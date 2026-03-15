import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { giftCardsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { CreateGiftCardBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/gift-cards", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const cards = await db
    .select()
    .from(giftCardsTable)
    .where(eq(giftCardsTable.purchasedById, req.user.id));
  res.json(cards);
});

router.post("/gift-cards", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = CreateGiftCardBody.parse(req.body);
  const code = `GC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const [card] = await db.insert(giftCardsTable).values({
    code,
    initialValue: body.initialValue,
    balance: body.initialValue,
    status: "ACTIVE",
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    purchasedById: req.user.id,
  }).returning();
  res.status(201).json(card);
});

export default router;
