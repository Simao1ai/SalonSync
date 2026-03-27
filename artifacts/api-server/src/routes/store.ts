import { Router } from "express";
import { db } from "@workspace/db";
import {
  productsTable,
  ordersTable,
  orderItemsTable,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { fireWebhooks } from "../services/webhook-dispatcher";

const router = Router();

router.get("/store/products", async (req, res) => {
  const locationId = req.query.locationId as string;
  if (!locationId) { res.status(400).json({ error: "locationId required" }); return; }

  const products = await db.select().from(productsTable)
    .where(and(eq(productsTable.locationId, locationId), eq(productsTable.inStock, true)))
    .orderBy(productsTable.category, productsTable.name);

  res.json(products);
});

router.get("/store/products/all", async (req, res) => {
  if (!req.isAuthenticated() || !["ADMIN", "SUPER_ADMIN"].includes(req.user!.role!)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const locationId = req.query.locationId as string;
  if (!locationId) { res.status(400).json({ error: "locationId required" }); return; }

  const products = await db.select().from(productsTable)
    .where(eq(productsTable.locationId, locationId))
    .orderBy(desc(productsTable.createdAt));

  res.json(products);
});

router.post("/store/products", async (req, res) => {
  if (!req.isAuthenticated() || !["ADMIN", "SUPER_ADMIN"].includes(req.user!.role!)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { name, description, price, imageUrl, category, sku, quantity, locationId, inStock } = req.body;
  if (!name || !price || !locationId) {
    res.status(400).json({ error: "name, price, and locationId required" });
    return;
  }

  try {
    const [product] = await db.insert(productsTable).values({
      name,
      description: description || null,
      price: parseFloat(price),
      imageUrl: imageUrl || null,
      category: category || null,
      sku: sku || null,
      quantity: quantity ? parseInt(quantity) : 0,
      locationId,
      inStock: inStock !== false,
    }).returning();

    res.status(201).json(product);
  } catch (err) {
    console.error("Create product error:", err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.patch("/store/products/:id", async (req, res) => {
  if (!req.isAuthenticated() || !["ADMIN", "SUPER_ADMIN"].includes(req.user!.role!)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { id } = req.params;
  const { name, description, price, imageUrl, category, sku, quantity, inStock } = req.body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = parseFloat(price);
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;
  if (category !== undefined) updates.category = category;
  if (sku !== undefined) updates.sku = sku;
  if (quantity !== undefined) updates.quantity = parseInt(quantity);
  if (inStock !== undefined) updates.inStock = inStock;

  try {
    const [updated] = await db.update(productsTable).set(updates).where(eq(productsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Product not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/store/products/:id", async (req, res) => {
  if (!req.isAuthenticated() || !["ADMIN", "SUPER_ADMIN"].includes(req.user!.role!)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const [deleted] = await db.delete(productsTable).where(eq(productsTable.id, req.params.id)).returning();
  if (!deleted) { res.status(404).json({ error: "Product not found" }); return; }
  res.json({ success: true });
});

router.post("/store/orders", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Login required" }); return; }

  const { locationId, items, shippingAddress, notes } = req.body;
  if (!locationId || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "locationId and items[] required" });
    return;
  }

  try {
    const products = await db.select().from(productsTable)
      .where(eq(productsTable.locationId, locationId));
    const productMap = new Map(products.map((p) => [p.id, p]));

    let totalAmount = 0;
    const orderItems: { productId: string; quantity: number; priceAtTime: number }[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) { res.status(400).json({ error: `Product ${item.productId} not found at this location` }); return; }
      if (!product.inStock) { res.status(400).json({ error: `${product.name} is out of stock` }); return; }

      const qty = item.quantity || 1;
      if (product.quantity !== null && product.quantity !== undefined && qty > product.quantity) {
        res.status(400).json({ error: `Only ${product.quantity} of ${product.name} available` });
        return;
      }

      totalAmount += product.price * qty;
      orderItems.push({ productId: product.id, quantity: qty, priceAtTime: product.price });
    }

    const [order] = await db.insert(ordersTable).values({
      locationId,
      clientId: req.user!.id!,
      totalAmount,
      shippingAddress: shippingAddress || null,
      notes: notes || null,
      status: "pending",
    }).returning();

    for (const item of orderItems) {
      await db.insert(orderItemsTable).values({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        priceAtTime: item.priceAtTime,
      });

      const product = productMap.get(item.productId);
      if (product && product.quantity !== null && product.quantity !== undefined) {
        const newQty = Math.max(0, product.quantity - item.quantity);
        await db.update(productsTable).set({
          quantity: newQty,
          inStock: newQty > 0,
        }).where(eq(productsTable.id, item.productId));
      }
    }

    fireWebhooks("payment.completed", locationId, {
      orderId: order.id,
      totalAmount,
      clientId: req.user!.id,
      type: "store_purchase",
    }).catch(() => {});

    res.status(201).json(order);
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

router.get("/store/orders", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Login required" }); return; }

  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user!.role!);
  const locationId = req.query.locationId as string;

  let orders;
  if (isAdmin && locationId) {
    orders = await db.select().from(ordersTable)
      .where(eq(ordersTable.locationId, locationId))
      .orderBy(desc(ordersTable.createdAt));
  } else {
    orders = await db.select().from(ordersTable)
      .where(eq(ordersTable.clientId, req.user!.id!))
      .orderBy(desc(ordersTable.createdAt));
  }

  const ordersWithItems = await Promise.all(
    orders.map(async (order) => {
      const items = await db.select({
        id: orderItemsTable.id,
        quantity: orderItemsTable.quantity,
        priceAtTime: orderItemsTable.priceAtTime,
        productName: productsTable.name,
        productImage: productsTable.imageUrl,
      }).from(orderItemsTable)
        .innerJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
        .where(eq(orderItemsTable.orderId, order.id));
      return { ...order, items };
    })
  );

  res.json(ordersWithItems);
});

router.patch("/store/orders/:id/status", async (req, res) => {
  if (!req.isAuthenticated() || !["ADMIN", "SUPER_ADMIN"].includes(req.user!.role!)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { status } = req.body;
  const validStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `Status must be one of: ${validStatuses.join(", ")}` });
    return;
  }

  const [updated] = await db.update(ordersTable).set({
    status,
    updatedAt: new Date(),
  }).where(eq(ordersTable.id, req.params.id)).returning();

  if (!updated) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(updated);
});

export default router;
