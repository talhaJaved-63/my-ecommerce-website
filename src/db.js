const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(__dirname, "..", "public", "uploads"), { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "maison-velvet.db"));
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  sku              TEXT    NOT NULL UNIQUE,
  name             TEXT    NOT NULL,
  slug             TEXT    NOT NULL UNIQUE,
  description      TEXT    NOT NULL DEFAULT '',
  category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  dept             TEXT    NOT NULL DEFAULT 'unisex' CHECK (dept IN ('women','men','unisex')),
  price_cents      INTEGER NOT NULL CHECK (price_cents >= 0),
  sale_price_cents INTEGER CHECK (sale_price_cents IS NULL OR sale_price_cents >= 0),
  badge            TEXT    CHECK (badge IN ('New','Trending','Best Seller','Limited') OR badge IS NULL),
  status           TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
  is_trending      INTEGER NOT NULL DEFAULT 0,
  is_new           INTEGER NOT NULL DEFAULT 0,
  stock            INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sizes            TEXT    NOT NULL DEFAULT '[]',
  colors           TEXT    NOT NULL DEFAULT '[]',
  images           TEXT    NOT NULL DEFAULT '[]',
  rating           REAL    NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  reviews_count    INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

CREATE TABLE IF NOT EXISTS wishlists (
  user_id    INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS carts (
  user_id    INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty        INTEGER NOT NULL CHECK (qty > 0),
  size       TEXT    NOT NULL DEFAULT '',
  color      TEXT    NOT NULL DEFAULT '',
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, product_id, size, color)
);

CREATE TABLE IF NOT EXISTS orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  number           TEXT    NOT NULL UNIQUE,
  user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email            TEXT    NOT NULL,
  full_name        TEXT    NOT NULL,
  phone            TEXT    NOT NULL DEFAULT '',
  address1         TEXT    NOT NULL,
  address2         TEXT    NOT NULL DEFAULT '',
  city             TEXT    NOT NULL,
  region           TEXT    NOT NULL DEFAULT '',
  postal           TEXT    NOT NULL,
  country          TEXT    NOT NULL,
  shipping_method  TEXT    NOT NULL DEFAULT 'standard',
  subtotal_cents   INTEGER NOT NULL,
  shipping_cents   INTEGER NOT NULL,
  total_cents      INTEGER NOT NULL,
  status           TEXT    NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','processing','shipped','delivered','cancelled')),
  payment_status   TEXT    NOT NULL DEFAULT 'unpaid'
                   CHECK (payment_status IN ('unpaid','paid','failed','refunded')),
  payment_provider TEXT    NOT NULL DEFAULT 'demo',
  payment_ref      TEXT    NOT NULL DEFAULT '',
  carrier          TEXT    NOT NULL DEFAULT '',
  tracking_number  TEXT    NOT NULL DEFAULT '',
  notes            TEXT    NOT NULL DEFAULT '',
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_user    ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_email   ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name        TEXT    NOT NULL,
  image       TEXT    NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL,
  qty         INTEGER NOT NULL CHECK (qty > 0),
  size        TEXT    NOT NULL DEFAULT '',
  color       TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`);

const now = () => new Date().toISOString().replace("T", " ").slice(0, 19);
const parseJSON = (s, fallback = []) => {
  try {
    return JSON.parse(s ?? "") ?? fallback;
  } catch {
    return fallback;
  }
};

function shapeProduct(row, { withDescription = false } = {}) {
  if (!row) return null;
  const cat = row.category_id
    ? db.prepare("SELECT id, name, slug FROM categories WHERE id = ?").get(row.category_id)
    : null;
  const base = {
    id: row.id,
    sku: row.sku,
    name: row.name,
    slug: row.slug,
    category: cat ? { id: cat.id, name: cat.name, slug: cat.slug } : null,
    dept: row.dept,
    priceCents: row.price_cents,
    salePriceCents: row.sale_price_cents ?? null,
    badge: row.badge ?? null,
    status: row.status,
    isTrending: !!row.is_trending,
    isNew: !!row.is_new,
    stock: row.stock,
    sizes: parseJSON(row.sizes),
    colors: parseJSON(row.colors),
    images: parseJSON(row.images),
    rating: row.rating,
    reviewsCount: row.reviews_count,
    createdAt: row.created_at,
  };
  if (withDescription) base.description = row.description;
  return base;
}

function withTransaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

const wrapAsync = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { db, now, parseJSON, shapeProduct, withTransaction, wrapAsync };
