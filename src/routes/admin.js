const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { db, now } = require("../db");
const { requireAdmin } = require("../auth");
const { shapeOrder } = require("./api");

const router = express.Router();
router.use(requireAdmin);

const UPLOAD_DIR = path.join(__dirname, "..", "..", "public", "uploads");
const MIME_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}${MIME_EXT[file.mimetype]}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (MIME_EXT[file.mimetype]) return cb(null, true);
    _req._rejectedUploads = (_req._rejectedUploads || 0) + 1;
    cb(null, false);
  },
});

/* ---------------------------------- stats --------------------------------- */

router.get("/stats", (_req, res) => {
  const count = (sql, ...p) => db.prepare(sql).get(...p).n;
  const revenue = db.prepare("SELECT COALESCE(SUM(total_cents),0) AS n FROM orders WHERE payment_status = 'paid'").get().n;
  res.json({
    revenueCents: revenue,
    ordersTotal: count("SELECT COUNT(*) AS n FROM orders"),
    ordersByStatus: Object.fromEntries(
      db.prepare("SELECT status, COUNT(*) AS n FROM orders GROUP BY status").all().map((r) => [r.status, r.n])
    ),
    customers: count("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'"),
    productsActive: count("SELECT COUNT(*) AS n FROM products WHERE status = 'active'"),
    lowStock: db
      .prepare("SELECT id, name, sku, stock FROM products WHERE stock < 6 AND status = 'active' ORDER BY stock ASC LIMIT 8")
      .all(),
    recentOrders: db
      .prepare("SELECT id, number, full_name AS fullName, total_cents AS totalCents, status, payment_status AS paymentStatus, created_at AS placedAt FROM orders ORDER BY id DESC LIMIT 8")
      .all(),
    topSellers: db
      .prepare(
        `SELECT oi.name, SUM(oi.qty) AS units, SUM(oi.qty * oi.price_cents) AS revenueCents
         FROM order_items oi JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
         GROUP BY oi.product_id, oi.name ORDER BY units DESC LIMIT 5`
      )
      .all(),
  });
});

/* --------------------------------- products -------------------------------- */

function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function uniqueSlug(name, excludeId = null) {
  const base = slugify(name) || "product";
  let slug = base;
  let i = 2;
  while (
    (excludeId
      ? db.prepare("SELECT id FROM products WHERE slug = ? AND id != ?").get(slug, excludeId)
      : db.prepare("SELECT id FROM products WHERE slug = ?").get(slug))
  ) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

function readProductBody(body, existingId = null) {
  const name = String(body?.name || "").trim();
  if (name.length < 2 || name.length > 120) throw badRequest("Product name is required (2–120 characters).");
  const priceCents = toInt(body?.priceCents, 0, "Price must be a positive number.");
  if (priceCents <= 0) throw badRequest("Price must be greater than zero.");
  const saleRaw = body?.salePriceCents === "" || body?.salePriceCents == null ? null : toInt(body.salePriceCents, null);
  if (saleRaw !== null && saleRaw <= 0) throw badRequest("Sale price must be greater than zero.");
  if (saleRaw !== null && saleRaw >= priceCents) throw badRequest("Sale price must be lower than the regular price.");
  const badge = body?.badge ? String(body.badge) : null;
  if (badge && !["New", "Trending", "Best Seller", "Limited"].includes(badge)) throw badRequest("Invalid badge.");
  const status = ["draft", "active", "archived"].includes(body?.status) ? body.status : "draft";
  const dept = ["women", "men", "unisex"].includes(body?.dept) ? body.dept : "unisex";
  let categoryId = body?.categoryId == null || body.categoryId === "" ? null : toInt(body.categoryId, null);
  if (categoryId && !db.prepare("SELECT id FROM categories WHERE id = ?").get(categoryId)) categoryId = null;
  const images = (Array.isArray(body?.images) ? body.images : [])
    .map((u) => String(u).trim())
    .filter((u) => /^https?:\/\/.+/i.test(u) || (u.startsWith("/") && u.includes("/uploads/")))
    .slice(0, 8);
  const colors = (Array.isArray(body?.colors) ? body.colors : [])
    .slice(0, 10)
    .map((c) => ({ name: String(c?.name || "").slice(0, 24), hex: /^#[0-9a-f]{3,8}$/i.test(c?.hex || "") ? c.hex : "#cccccc" }))
    .filter((c) => c.name);
  const sizes = (Array.isArray(body?.sizes) ? body.sizes : []).map((s) => String(s).slice(0, 12)).filter(Boolean).slice(0, 15);
  return {
    name,
    description: String(body?.description || "").slice(0, 4000),
    categoryId,
    dept,
    priceCents,
    salePriceCents: saleRaw,
    badge,
    status,
    isTrending: body?.isTrending ? 1 : 0,
    isNew: body?.isNew ? 1 : 0,
    stock: Math.max(toInt(body?.stock ?? 0, -1), 0),
    sizes: JSON.stringify(sizes),
    colors: JSON.stringify(colors),
    images: JSON.stringify(images),
    rating: Math.min(Math.max(parseFloat(body?.rating ?? 0) || 0, 0), 5),
    reviewsCount: Math.max(toInt(body?.reviewsCount ?? 0, -1), 0),
    ...(existingId ? {} : { sku: String(body?.sku || "").trim() }),
  };
}

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400, expose: true });
}
function toInt(v, fallback, message) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) {
    if (message) throw badRequest(message);
    return fallback ?? 0;
  }
  return n;
}

router.get("/products", (req, res) => {
  const where = [];
  const params = [];
  if (req.query.q) {
    where.push("(p.name LIKE ? OR p.sku LIKE ?)");
    params.push(`%${req.query.q}%`, `%${req.query.q}%`);
  }
  if (req.query.status && ["draft", "active", "archived"].includes(req.query.status)) {
    where.push("p.status = ?");
    params.push(req.query.status);
  }
  if (req.query.lowstock === "1") where.push("p.stock < 6");
  const rows = db
    .prepare(
      `SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY p.updated_at DESC, p.id DESC LIMIT 200`
    )
    .all(...params);
  res.json({ products: rows.map(shapeAdminProduct) });
});

function shapeAdminProduct(r) {
  return {
    id: r.id,
    sku: r.sku,
    name: r.name,
    slug: r.slug,
    description: r.description,
    categoryId: r.category_id,
    categoryName: r.category_name ?? null,
    dept: r.dept,
    priceCents: r.price_cents,
    salePriceCents: r.sale_price_cents,
    badge: r.badge,
    status: r.status,
    isTrending: !!r.is_trending,
    isNew: !!r.is_new,
    stock: r.stock,
    sizes: JSON.parse(r.sizes || "[]"),
    colors: JSON.parse(r.colors || "[]"),
    images: JSON.parse(r.images || "[]"),
    rating: r.rating,
    reviewsCount: r.reviews_count,
    updatedAt: r.updated_at,
  };
}

router.post("/products", (req, res) => {
  const b = readProductBody(req.body);
  const sku = b.sku || `MV-${Date.now().toString(36).toUpperCase()}`;
  if (db.prepare("SELECT id FROM products WHERE sku = ?").get(sku)) throw badRequest("SKU already exists.");
  const slug = uniqueSlug(b.name);
  const info = db
    .prepare(
      `INSERT INTO products (sku, name, slug, description, category_id, dept, price_cents, sale_price_cents, badge,
        status, is_trending, is_new, stock, sizes, colors, images, rating, reviews_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      sku, b.name, slug, b.description, b.categoryId, b.dept, b.priceCents, b.salePriceCents, b.badge,
      b.status, b.isTrending, b.isNew, b.stock, b.sizes, b.colors, b.images, b.rating, b.reviewsCount
    );
  res.status(201).json({ product: shapeAdminProduct(db.prepare("SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id = ?").get(info.lastInsertRowid)) });
});

router.put("/products/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Product not found." });
  const merged = { ...shapeAdminProduct(existing), ...req.body };
  delete merged.sku;
  const b = readProductBody(merged, id);
  const sku = existing.sku;
  const slug = req.body?.name ? uniqueSlug(req.body.name, id) : existing.slug;
  db.prepare(
    `UPDATE products SET name=?, slug=?, description=?, category_id=?, dept=?, price_cents=?, sale_price_cents=?,
      badge=?, status=?, is_trending=?, is_new=?, stock=?, sizes=?, colors=?, images=?, rating=?, reviews_count=?, updated_at=?
     WHERE id=?`
  ).run(
    b.name, slug, b.description, b.categoryId, b.dept, b.priceCents, b.salePriceCents, b.badge, b.status,
    b.isTrending, b.isNew, b.stock, b.sizes, b.colors, b.images, b.rating, b.reviewsCount, now(), id
  );
  res.json({ product: shapeAdminProduct(db.prepare("SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id = ?").get(id)) });
});

router.patch("/products/:id/stock", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = db.prepare("SELECT id, stock FROM products WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Product not found." });
  const nextStock =
    req.body?.delta != null
      ? Math.max(row.stock + parseInt(req.body.delta, 10), 0)
      : Math.max(parseInt(req.body?.stock, 10) || 0, 0);
  db.prepare("UPDATE products SET stock = ?, updated_at = ? WHERE id = ?").run(nextStock, now(), id);
  res.json({ ok: true, stock: nextStock });
});

router.delete("/products/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const referenced = db.prepare("SELECT 1 AS x FROM order_items WHERE product_id = ? LIMIT 1").get(id);
  if (referenced && req.query.force !== "1") {
    db.prepare("UPDATE products SET status = 'archived', updated_at = ? WHERE id = ?").run(now(), id);
    return res.json({ ok: true, archived: true, message: "Product has order history and was archived instead of deleted." });
  }
  db.prepare("DELETE FROM products WHERE id = ?").run(id);
  res.json({ ok: true });
});

/* ---------------------------------- upload --------------------------------- */

router.post("/upload", (req, res) => {
  upload.array("files", 8)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "Each image must be under 5 MB." : "Upload failed." });
    if (!req.files?.length && req._rejectedUploads > 0)
      return res.status(400).json({ error: "Only JPG, PNG, WebP or AVIF images are allowed." });
    const urls = (req.files || []).map((f) => `/uploads/${f.filename}`);
    res.status(201).json({ urls });
  });
});

router.delete("/upload", (req, res) => {
  const url = String(req.query.url || "");
  if (!url.startsWith("/uploads/")) return res.status(400).json({ error: "Only uploaded files can be removed." });
  const target = path.normalize(path.join(UPLOAD_DIR, path.basename(url)));
  if (!target.startsWith(UPLOAD_DIR)) return res.status(400).json({ error: "Invalid path." });
  fs.promises.unlink(target).catch(() => {});
  res.json({ ok: true });
});

/* ---------------------------------- orders --------------------------------- */

router.get("/orders", (req, res) => {
  const where = [];
  const params = [];
  if (req.query.status && ["pending", "processing", "shipped", "delivered", "cancelled"].includes(req.query.status)) {
    where.push("status = ?");
    params.push(req.query.status);
  }
  if (req.query.payment && ["unpaid", "paid", "failed", "refunded"].includes(req.query.payment)) {
    where.push("payment_status = ?");
    params.push(req.query.payment);
  }
  if (req.query.q) {
    where.push("(number LIKE ? OR email LIKE ? OR full_name LIKE ?)");
    params.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`);
  }
  const rows = db
    .prepare(
      `SELECT o.*, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_lines,
        (SELECT COALESCE(SUM(qty),0) FROM order_items oi WHERE oi.order_id = o.id) AS unit_count
       FROM orders o ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY o.id DESC LIMIT 200`
    )
    .all(...params);
  res.json({ orders: rows.map((o) => shapeOrder(o, true)) });
});

router.get("/orders/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(parseInt(req.params.id, 10));
  if (!row) return res.status(404).json({ error: "Order not found." });
  const customer = db
    .prepare("SELECT id, name, email, created_at FROM users WHERE id = ?")
    .get(row.user_id) || null;
  res.json({ order: { ...shapeOrder(row, true), account: customer } });
});

router.patch("/orders/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Order not found." });
  const b = req.body || {};
  const updates = {};
  if (b.status) {
    if (!["pending", "processing", "shipped", "delivered", "cancelled"].includes(b.status))
      return res.status(400).json({ error: "Invalid order status." });
    if (row.payment_status === "paid" && b.status === "cancelled") {
      for (const it of db.prepare("SELECT product_id, qty FROM order_items WHERE order_id = ? AND product_id IS NOT NULL").all(id))
        db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(it.qty, it.product_id);
      updates.payment_status = "refunded";
    }
    updates.status = b.status;
  }
  if (b.paymentStatus) {
    if (!["unpaid", "paid", "failed", "refunded"].includes(b.paymentStatus))
      return res.status(400).json({ error: "Invalid payment status." });
    updates.payment_status = b.paymentStatus;
  }
  if (b.carrier != null) updates.carrier = String(b.carrier).slice(0, 60);
  if (b.trackingNumber != null) updates.tracking_number = String(b.trackingNumber).slice(0, 80);
  if (b.notes != null) updates.notes = String(b.notes).slice(0, 1000);
  const keys = Object.keys(updates);
  if (keys.length) {
    db.prepare(`UPDATE orders SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).run(
      ...keys.map((k) => updates[k]),
      now(),
      id
    );
  }
  res.json({ order: shapeOrder(db.prepare("SELECT * FROM orders WHERE id = ?").get(id), true) });
});

/* --------------------------------- customers ------------------------------- */

router.get("/customers", (_req, res) => {
  res.json({
    customers: db
      .prepare(
        `SELECT u.id, u.name, u.email, u.created_at AS joinedAt,
           COUNT(o.id) AS orders,
           COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_cents ELSE 0 END), 0) AS spentCents
         FROM users u LEFT JOIN orders o ON o.user_id = u.id
         WHERE u.role = 'customer'
         GROUP BY u.id ORDER BY spentCents DESC, u.id DESC LIMIT 200`
      )
      .all(),
  });
});

module.exports = router;
