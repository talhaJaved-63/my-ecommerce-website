# Maison Velvet

A full-stack e-commerce storefront for the Maison Velvet fashion house — Express + SQLite
(`node:sqlite`) backend, dependency-light vanilla JS frontend, Stripe payments with a labeled
demo fallback, and a standalone admin console.

## Quick start

```bash
npm install        # once
npm run seed       # optional: (re)seed demo catalog — use --reset to wipe data first
npm start          # http://localhost:3000
```

| URL | Purpose |
|---|---|
| `/` | Storefront (home, shop, product, cart, checkout) |
| `/login.html` · `/register.html` | Customer auth (`?next=` deep links supported) |
| `/account.html` | Customer orders / wishlist / profile |
| `/track.html` | Public order tracking (order number + email) |
| `/admin/` | Admin console |

**Seeded accounts**

- Admin: `admin@maisonvelvet.com` / `MaisonVelvet!2026`
- Customer: `client@example.com` / `Client!2026`

## Configuration

Copy `.env.example` to `.env` (a working `.env` is included for local dev).

| Variable | Notes |
|---|---|
| `PORT` | Default `3000` |
| `SESSION_SECRET` | HMAC key for session cookies — **set a long random value in production** |
| `COOKIE_SECURE` | `true` behind HTTPS (sets the `Secure` cookie flag) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Used by the seeder only |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | When set, checkout switches from demo to live Stripe PaymentIntents; amounts are verified server-side before an order is accepted |
| `CURRENCY`, `FREE_SHIPPING_THRESHOLD_CENTS`, `FLAT_SHIPPING_CENTS` | Shipping quote rules ($150 free-shipping threshold, $8 flat below it by default) |

Without Stripe keys the checkout runs in clearly-labeled **demo mode**: payment intents are
auto-paid (`demo_*` references) so the entire order pipeline is testable end-to-end.

## Architecture

```
server.js               Express app: Helmet/CSP, static serving, route mounts, error handler
src/
  db.js                 node:sqlite schema, helpers (withTransaction, shapeProduct)
  auth.js               HMAC-signed session cookies, bcrypt passwords, CSRF origin guard,
                        login rate limiting, requireAuth/requireAdmin
  payments.js           Stripe PaymentIntents + demo fallback, shipping quote
  routes/api.js         Public store API: products, categories, cart, wishlist,
                        checkout intent, guest+member orders, public tracking
  routes/admin.js       Guarded admin API: stats, product CRUD, image uploads (multer),
                        inventory, order management (cancel = restock + mark refunded),
                        customers
  seed.js               Catalog seeder (14 products, local images in public/uploads/seed)
public/
  js/core.js            MV runtime: chrome injection, cart/wishlist stores, search modal
  js/pages/*.js         Page controllers (home/shop/product/auth/checkout/account/track)
  js/admin/admin.js     Admin console controller (standalone, no storefront chrome)
  css/                  styles.css + pages.css (storefront), admin.css (console)
data/                   maison-velvet.db (WAL mode) — created on first run
```

## Security notes

- Session cookies: `HttpOnly`, `SameSite=Lax` (`Secure` via env), HMAC-signed, 30-day expiry;
  signatures compared in constant time; tampered/expired tokens are rejected
- Passwords hashed with bcrypt (cost 10); login throttled 10 failures / 15 min per IP+email
- All writes check the `Origin` header against the host (CSRF guard)
- Admin API fully separated behind `requireAdmin`
- Uploads: extension allow-list by MIME, 5 MB/file, max 8/request, path-traversal-safe deletes;
  non-image submissions are rejected outright
- Order totals are recomputed server-side; stock decrements are transactional and guarded
  (`stock >= qty`); cancelling a paid order restocks items and marks the payment refunded
- User-supplied content is HTML-escaped at render time on all customer-facing pages

## Scripts

```bash
npm start          # start server
npm run dev        # same with --watch via dotenvx predev if configured
npm run seed       # seed demo catalog (node src/seed.js)
```

Requires Node ≥ 22.5 (uses the built-in `node:sqlite` module; no native build steps).
