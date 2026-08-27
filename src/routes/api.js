const express = require("express");
const { db, now, parseJSON, withTransaction, wrapAsync } = require("../db");
const {
  setSession,
  clearSession,
  requireAuth,
  rateLimitLogin,
  recordFailedLogin,
  clearLogins,
  verifyPassword,
  hashPassword,
} = require("../auth");
const payments = require("../payments");

const router = express.Router();
const money = (c) => c / 100;

router.get("/config", (_req, res) => {
  res.json({
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    demoPayments: !payments.isConfigured(),
    freeShippingThresholdCents: payments.FREE_SHIPPING_THRESHOLD_CENTS,
  });
});

/* ---------------------------------- auth ---------------------------------- */

router.post("/auth/register", wrapAsync(async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (name.length < 2) return res.status(400).json({ error: "Please enter your full name." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: "Please enter a valid email address." });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email))
    return res.status(409).json({ error: "An account with this email already exists." });
  const info = db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'customer')").run(name, email, await hashPassword(password));
  const user = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(info.lastInsertRowid);
  setSession(res, user);
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

router.post("/auth/login", rateLimitLogin, wrapAsync(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  const ok = row && (await verifyPassword(password, row.password_hash));
  if (!ok) {
    recordFailedLogin(res.locals.loginKey);
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  clearLogins(res.locals.loginKey);
  setSession(res, row);
  res.json({ user: { id: row.id, name: row.name, email: row.email, role: row.role } });
}));

router.post("/auth/logout", (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get("/auth/me", (req, res) => res.json({ user: req.user }));

/* ------------------------------- categories ------------------------------- */

router.get("/categories", (_req, res) => {
  res.json({
    categories: db.prepare("SELECT id, name, slug FROM categories ORDER BY name").all(),
  });
});

/* -------------------------------- products -------------------------------- */

function buildProductQuery(q) {
  const where = ["p.status = 'active'"];
  const params = [];
  if (q.cat) {
    where.push("c.slug = ?");
    params.push(String(q.cat));
  }
  if (q.dept) {
    where.push("p.dept IN (?, 'unisex')");
    params.push(String(q.dept));
  }
  if (q.sale === "1") where.push("p.sale_price_cents IS NOT NULL");
  if (q.trending === "1") where.push("p.is_trending = 1");
  if (q.new === "1") where.push("p.is_new = 1");
  if (q.q) {
    where.push("(p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)");
    const like = `%${String(q.q)}%`;
    params.push(like, like, like);
  }
  if (q.ids) {
    const ids = String(q.ids)
      .split(",")
      .map((n) => parseInt(n, 10))
      .filter(Number.isInteger);
    if (ids.length) {
      where.push(`p.id IN (${ids.map(() => "?").join(",")})`);
      params.push(...ids);
    }
  }
  return { whereSql: where.join(" AND "), params };
}

router.get("/products", (req, res) => {
  const { whereSql, params } = buildProductQuery(req.query);
  const limit = Math.min(parseInt(req.query.limit || "24", 10) || 24, 60);
  const offset = Math.max(parseInt(req.query.offset || "0", 10) || 0, 0);
  const base = `FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${whereSql}`;
  const total = db.prepare(`SELECT COUNT(*) AS n ${base}`).get(...params).n;
  const rows = db
    .prepare(
      `SELECT p.* ${base} ORDER BY p.is_new DESC, p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);
  res.json({ total, products: rows.map((r) => require("../db").shapeProduct(r)) });
});

router.get("/products/:idOrSlug", (req, res) => {
  const key = req.params.idOrSlug;
  const row = /^\d+$/.test(key)
    ? db.prepare("SELECT * FROM products WHERE id = ?").get(parseInt(key, 10))
    : db.prepare("SELECT * FROM products WHERE slug = ?").get(key);
  if (!row || row.status !== "active") return res.status(404).json({ error: "Product not found." });
  res.json({ product: require("../db").shapeProduct(row, { withDescription: true }) });
});

/* ------------------------------ cart & wishlist ---------------------------- */

const cartSelect = `
  SELECT ct.qty, ct.size, ct.color, p.id AS productId, p.stock
  FROM carts ct JOIN products p ON p.id = ct.product_id
  WHERE ct.user_id = ? AND p.status = 'active'
  ORDER BY ct.updated_at DESC`;

router.get("/cart", requireAuth, (req, res) => {
  res.json({ items: db.prepare(cartSelect).all(req.user.id) });
});

router.put("/cart", requireAuth, (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const clean = [];
  for (const it of items.slice(0, 60)) {
    const pid = parseInt(it?.productId, 10);
    const qty = Math.min(Math.max(parseInt(it?.qty, 10) || 0, 1), 20);
    if (!Number.isInteger(pid)) continue;
    clean.push({ pid, qty, size: String(it.size || "").slice(0, 16), color: String(it.color || "").slice(0, 32) });
  }
  const exists = db.prepare("SELECT id FROM products WHERE id = ? AND status = 'active'");
  withTransaction(() => {
    db.prepare("DELETE FROM carts WHERE user_id = ?").run(req.user.id);
    const ins = db.prepare(
      "INSERT OR REPLACE INTO carts (user_id, product_id, qty, size, color, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const c of clean) if (exists.get(c.pid)) ins.run(req.user.id, c.pid, c.qty, c.size, c.color, now());
  });
  res.json({ ok: true });
});

router.get("/wishlist", requireAuth, (req, res) => {
  res.json({
    productIds: db.prepare("SELECT product_id AS id FROM wishlists WHERE user_id = ?").all(req.user.id).map((r) => r.id),
  });
});

router.put("/wishlist", requireAuth, (req, res) => {
  const ids = (Array.isArray(req.body?.productIds) ? req.body.productIds : [])
    .map((n) => parseInt(n, 10))
    .filter(Number.isInteger)
    .slice(0, 200);
  withTransaction(() => {
    db.prepare("DELETE FROM wishlists WHERE user_id = ?").run(req.user.id);
    const ins = db.prepare("INSERT OR IGNORE INTO wishlists (user_id, product_id) VALUES (?, ?)");
    for (const id of new Set(ids)) ins.run(req.user.id, id);
  });
  res.json({ ok: true });
});

router.post("/wishlist/toggle", requireAuth, (req, res) => {
  const pid = parseInt(req.body?.productId, 10);
  if (!Number.isInteger(pid)) return res.status(400).json({ error: "Invalid product." });
  const has = db.prepare("SELECT 1 AS x FROM wishlists WHERE user_id = ? AND product_id = ?").get(req.user.id, pid);
  if (has) db.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").run(req.user.id, pid);
  else db.prepare("INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)").run(req.user.id, pid);
  res.json({ active: !has });
});

/* --------------------------------- checkout -------------------------------- */

function resolveItems(rawItems) {
  const errors = [];
  const resolved = [];
  let subtotalCents = 0;
  const get = db.prepare(
    `SELECT p.*, c.slug AS cat_slug FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`
  );
  for (const it of rawItems.slice(0, 60)) {
    const pid = parseInt(it?.productId, 10);
    const qty = Math.min(Math.max(parseInt(it?.qty, 10) || 0, 1), 20);
    const row = Number.isInteger(pid) ? get.get(pid) : null;
    if (!row || row.status !== "active") {
      errors.push("An item in your bag is no longer available.");
      continue;
    }
    const unit = row.sale_price_cents ?? row.price_cents;
    subtotalCents += unit * qty;
    resolved.push({ row, qty, unit, size: String(it.size || "").slice(0, 16), color: String(it.color || "").slice(0, 32) });
  }
  return { resolved, subtotalCents, errors };
}

router.post("/checkout/intent", wrapAsync(async (req, res) => {
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!rawItems.length) return res.status(400).json({ error: "Your bag is empty." });
  const { resolved, subtotalCents, errors } = resolveItems(rawItems);
  if (!resolved.length) return res.status(409).json({ error: errors[0] || "Items unavailable." });
  const q = payments.quote(subtotalCents);
  let intent = null;
  try {
    intent = await payments.createPaymentIntent({
      amountCents: q.totalCents,
      metadata: { store: "maison-velvet" },
    });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "Payment gateway unavailable. Please try again." });
  }
  res.json({
    mode: intent.demo ? "demo" : "stripe",
    intentId: intent.id,
    clientSecret: intent.clientSecret,
    summary: { subtotalCents, shippingCents: q.shippingCents, totalCents: q.totalCents },
    items: resolved.map((r) => ({
      productId: r.row.id,
      name: r.row.name,
      image: parseJSON(r.row.images)[0] || "",
      unitPriceCents: r.unit,
      qty: r.qty,
      size: r.size,
      color: r.color,
    })),
  });
}));

const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];

router.post("/orders", wrapAsync(async (req, res) => {
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const c = req.body?.customer || {};
  const email = String(c.email || "").trim().toLowerCase();
  const fullName = String(c.fullName || "").trim();
  const requiredAddress = [c.address1, c.city, c.postal, c.country].every((v) => String(v || "").trim());
  if (!rawItems.length) return res.status(400).json({ error: "Your bag is empty." });
  if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !requiredAddress)
    return res.status(400).json({ error: "Please complete all required delivery details." });

  const { resolved, subtotalCents, errors } = resolveItems(rawItems);
  if (!resolved.length) return res.status(409).json({ error: errors[0] || "Items unavailable." });

  const outOfStock = resolved.find((r) => r.row.stock < r.qty);
  if (outOfStock) return res.status(409).json({ error: `Only ${outOfStock.row.stock} × “${outOfStock.row.name}” left in stock.` });

  const q = payments.quote(subtotalCents);

  let paymentStatus = "paid";
  let provider = "demo";
  if (payments.isConfigured()) {
    provider = "stripe";
    const intent = await payments.retrieveIntent(String(req.body?.paymentRef || ""));
    if (!intent || intent.status !== "succeeded" || intent.amountReceived !== q.totalCents) {
      paymentStatus = "failed";
      return res.status(402).json({ error: "Payment could not be verified. Please try again." });
    }
  }

  const number =
    "MV-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random().toString(36).slice(2, 5).toUpperCase();

  const createOrder = () => withTransaction(() => {
    for (const r of resolved) {
      const upd = db.prepare("UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ?").run(r.qty, now(), r.row.id, r.qty);
      if (upd.changes !== 1) throw Object.assign(new Error(`“${r.row.name}” just sold out.`), { status: 409 });
    }
    const info = db
      .prepare(
        `INSERT INTO orders (number, user_id, email, full_name, phone, address1, address2, city, region, postal, country,
          subtotal_cents, shipping_cents, total_cents, status, payment_status, payment_provider, payment_ref)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
      )
      .run(
        number, req.user?.id ?? null, email, fullName, String(c.phone || "").slice(0, 32),
        String(c.address1).trim(), String(c.address2 || "").trim(), String(c.city).trim(), String(c.region || "").trim(),
        String(c.postal).trim(), String(c.country).trim(), subtotalCents, q.shippingCents, q.totalCents,
        paymentStatus, provider, req.body?.paymentRef ? String(req.body.paymentRef).slice(0, 120) : ""
      );
    const orderId = info.lastInsertRowid;
    const insItem = db.prepare(
      "INSERT INTO order_items (order_id, product_id, name, image, price_cents, qty, size, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const r of resolved)
      insItem.run(orderId, r.row.id, r.row.name, parseJSON(r.row.images)[0] || "", r.unit, r.qty, r.size, r.color);
    if (req.user) db.prepare("DELETE FROM carts WHERE user_id = ?").run(req.user.id);
    return orderId;
  });

  try {
    const orderId = createOrder();
    const order = shapeOrder(db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId));
    res.status(201).json({ order });
  } catch (e) {
    if (e.status === 409) return res.status(409).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: "Could not place the order. Please try again." });
  }
}));

function shapeOrder(o, withCustomer = false) {
  const items = db
    .prepare("SELECT product_id AS productId, name, image, price_cents, qty, size, color FROM order_items WHERE order_id = ?")
    .all(o.id)
    .map((i) => ({ ...i, priceCents: i.price_cents }));
  const base = {
    id: o.id,
    number: o.number,
    userId: o.user_id,
    status: o.status,
    paymentStatus: o.payment_status,
    paymentProvider: o.payment_provider,
    carrier: o.carrier,
    trackingNumber: o.tracking_number,
    notes: o.notes,
    subtotalCents: o.subtotal_cents,
    shippingCents: o.shipping_cents,
    totalCents: o.total_cents,
    placedAt: o.created_at,
    updatedAt: o.updated_at,
    items,
  };
  if (withCustomer)
    Object.assign(base, {
      email: o.email,
      fullName: o.full_name,
      phone: o.phone,
      address: [o.address1, o.address2].filter(Boolean).join(", "),
      city: o.city,
      region: o.region,
      postal: o.postal,
      country: o.country,
    });
  return base;
}

router.get("/orders", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50").all(req.user.id);
  res.json({ orders: rows.map((o) => shapeOrder(o, true)) });
});

router.get("/track", (req, res) => {
  const number = String(req.query.number || "").trim().toUpperCase();
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!number || !email) return res.status(400).json({ error: "Enter your order number and email." });
  const row = db.prepare("SELECT * FROM orders WHERE UPPER(number) = ? AND LOWER(email) = ?").get(number, email);
  if (!row) return res.status(404).json({ error: "No order found for those details." });
  res.json({ order: shapeOrder(row, true) });
});

module.exports = { router, shapeOrder };
