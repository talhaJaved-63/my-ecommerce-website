require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { db } = require("./db");
const { hashPassword } = require("./auth");

const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads", "seed");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const IMG = (id) => `https://images.unsplash.com/photo-${id}?q=80&w=900&auto=format&fit=crop`;

async function download(url, file) {
  const dest = path.join(UPLOAD_DIR, file);
  if (fs.existsSync(dest)) return `/uploads/seed/${file}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(res.status);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    return `/uploads/seed/${file}`;
  } catch {
    return url;
  }
}

const CATEGORIES = [
  ["Dresses", "dresses"], ["Outerwear", "outerwear"], ["Knitwear", "knitwear"], ["Denim", "denim"],
  ["Accessories", "accessories"], ["Footwear", "footwear"], ["Tailoring", "tailoring"],
  ["Essentials", "essentials"], ["Tops", "tops"], ["Bottoms", "bottoms"],
];

const SIZES_APPAREL = ["XS", "S", "M", "L", "XL"];
const SIZES_SHOES = ["38", "39", "40", "41", "42"];

const PRODUCTS = [
  {
    sku: "MV-DRE-001", name: "Silk Wrap Midi Dress", cat: "Dresses", dept: "women",
    price: 18900, sale: 24000, badge: "Limited", trending: 1, stock: 14,
    sizes: SIZES_APPAREL, colors: [["Bordeaux", "#8a3b2e"], ["Noir", "#161513"], ["Champagne", "#c9b99b"]],
    imgs: [IMG("1595777457583-95e059d581b8"), IMG("1572804013309-59a88b7e92f1")],
    rating: 4.8, reviews: 214,
    description: "A fluid silk-blend wrap dress with a self-tie waist and softly draped skirt. Cut on the bias for movement, it transitions effortlessly from day to evening.",
  },
  {
    sku: "MV-OUT-002", name: "Oversized Wool Coat", cat: "Outerwear", dept: "women",
    price: 32000, sale: null, badge: "Best Seller", trending: 1, stock: 8,
    sizes: SIZES_APPAREL, colors: [["Camel", "#8b7355"], ["Noir", "#161513"]],
    imgs: [IMG("1539109136881-3be0616acf4b"), IMG("1487222477894-8943e31ef7b2")],
    rating: 4.9, reviews: 168,
    description: "Our signature cocoon coat in a double-faced Italian wool blend. Dropped shoulders, hidden closures and a clean collarless neckline define quiet luxury.",
  },
  {
    sku: "MV-KNI-003", name: "Ribbed Knit Sweater", cat: "Knitwear", dept: "women",
    price: 9800, sale: null, badge: "Trending", trending: 1, stock: 32,
    sizes: SIZES_APPAREL, colors: [["Oat", "#d8cfc0"], ["Noir", "#161513"], ["Taupe", "#7a6c58"]],
    imgs: [IMG("1434389677669-e08b4cac3105"), IMG("1520975954732-35dd22299614")],
    rating: 4.6, reviews: 342,
    description: "An everyday essential in a fine-gauge merino rib. Designed with a relaxed body and slightly cropped sleeve for effortless layering.",
  },
  {
    sku: "MV-DEN-004", name: "High-Rise Straight Jeans", cat: "Denim", dept: "women",
    price: 12800, sale: 16000, badge: "Best Seller", trending: 1, stock: 21,
    sizes: SIZES_APPAREL, colors: [["Indigo", "#3b5378"], ["Light Wash", "#8ea4bf"], ["Noir", "#161513"]],
    imgs: [IMG("1542272604-787c3835535d"), IMG("1541099649105-f69ad21f3246")],
    rating: 4.7, reviews: 289,
    description: "Rigid-feel denim with just enough stretch, cut high at the waist and straight through the leg. A modern classic that pairs with everything.",
  },
  {
    sku: "MV-ACC-005", name: "Leather Crossbody Bag", cat: "Accessories", dept: "unisex",
    price: 24500, sale: null, badge: "Limited", trending: 1, stock: 6,
    sizes: [], colors: [["Cognac", "#5b3a29"], ["Noir", "#161513"]],
    imgs: [IMG("1548036328-c9fa89d128fa"), IMG("1584917865442-de89df76afd3")],
    rating: 4.9, reviews: 127,
    description: "Hand-finished full-grain leather with brushed hardware and an adjustable strap. Sized for essentials, finished to last decades.",
  },
  {
    sku: "MV-FTW-006", name: "Classic Court Sneakers", cat: "Footwear", dept: "unisex",
    price: 13500, sale: null, badge: "Trending", trending: 1, stock: 27,
    sizes: SIZES_SHOES, colors: [["Ivory", "#f4f1ea"], ["Noir", "#161513"]],
    imgs: [IMG("1560769629-975ec94e6a86"), IMG("1549298916-b41d501d3772")],
    rating: 4.5, reviews: 456,
    description: "A minimalist court silhouette in smooth leather with a natural gum sole. Cushioned, versatile, quietly iconic.",
  },
  {
    sku: "MV-TAI-007", name: "Linen Blend Blazer", cat: "Tailoring", dept: "men",
    price: 21000, sale: null, badge: "Trending", trending: 1, stock: 11,
    sizes: SIZES_APPAREL, colors: [["Sand", "#c9b99b"], ["Noir", "#161513"]],
    imgs: [IMG("1591047139829-d91aecb6caea"), IMG("1507003211169-0a1dd7228f2d")],
    rating: 4.7, reviews: 96,
    description: "Softly structured tailoring in a breathable linen-viscose blend. Unfinished cuffs can be worn turned or tailored to length.",
  },
  {
    sku: "MV-KNI-008", name: "Cashmere Crew Neck", cat: "Knitwear", dept: "men",
    price: 17500, sale: 22000, badge: "Best Seller", trending: 1, stock: 15,
    sizes: SIZES_APPAREL, colors: [["Stone", "#b0a190"], ["Charcoal", "#2b2b2b"], ["Umber", "#8c6f5a"]],
    imgs: [IMG("1503341504253-dff4815485f1"), IMG("1556821840-3a63f95609a7")],
    rating: 4.8, reviews: 203,
    description: "Grade-A Mongolian cashmere in a mid-weight gauge. Softened over time, never pilled, endlessly wearable.",
  },
  {
    sku: "MV-DRE-009", name: "Satin Slip Dress", cat: "Dresses", dept: "women",
    price: 16500, sale: null, badge: "New", isNew: 1, stock: 18,
    sizes: SIZES_APPAREL, colors: [["Gold", "#d4b483"], ["Noir", "#161513"], ["Merlot", "#7c2f3e"]],
    imgs: [IMG("1496747611176-843222e1e57c"), IMG("1509631179647-0177331693ae")],
    rating: 4.7, reviews: 58,
    description: "Bias-cut satin with a delicate cowl neck and adjustable straps. The after-dark staple of the season.",
  },
  {
    sku: "MV-OUT-010", name: "Tailored Trench Coat", cat: "Outerwear", dept: "women",
    price: 29500, sale: null, badge: "New", isNew: 1, stock: 9,
    sizes: SIZES_APPAREL, colors: [["Classic Stone", "#c3b091"], ["Noir", "#161513"]],
    imgs: [IMG("1445205170230-053b83016050"), IMG("1529139574466-a303027c1d8b")],
    rating: 4.9, reviews: 41,
    description: "A refined take on the classic trench — water-repellent cotton gabardine, storm flap and a detachable belt.",
  },
  {
    sku: "MV-ESS-011", name: "Organic Cotton Tee", cat: "Essentials", dept: "men",
    price: 4500, sale: null, badge: "New", isNew: 1, stock: 60,
    sizes: SIZES_APPAREL, colors: [["White", "#ffffff"], ["Noir", "#161513"], ["Slate", "#9aa5b1"]],
    imgs: [IMG("1521572163474-6864f9cf17ab"), IMG("1583743814966-8936f5b7be1a")],
    rating: 4.6, reviews: 512,
    description: "Heavyweight GOTS-certified organic cotton with a boxy fit and ribbed collar. The perfect tee, perfected.",
  },
  {
    sku: "MV-BOT-012", name: "Pleated Midi Skirt", cat: "Bottoms", dept: "women",
    price: 11500, sale: null, badge: "New", isNew: 1, stock: 22,
    sizes: SIZES_APPAREL, colors: [["Marigold", "#d9a441"], ["Noir", "#161513"]],
    imgs: [IMG("1490481651871-ab68de25d43d"), IMG("1483985988355-763728e1935b")],
    rating: 4.5, reviews: 73,
    description: "Sunray pleats in a fluid recycled satin that catches the light with every step. Elastic-backed waist for all-day ease.",
  },
  {
    sku: "MV-FTW-013", name: "Minimal Leather Loafers", cat: "Footwear", dept: "women",
    price: 18000, sale: null, badge: "New", isNew: 1, stock: 12,
    sizes: SIZES_SHOES, colors: [["Chocolate", "#4a2f23"], ["Noir", "#161513"]],
    imgs: [IMG("1543163521-1bf539c55dd2"), IMG("1595950653106-6c9ebd614d3a")],
    rating: 4.8, reviews: 64,
    description: "Hand-stitched loafers in polished calf leather with a sculpted 25mm heel. Comfort engineered into elegance.",
  },
  {
    sku: "MV-ACC-014", name: "The City Tote", cat: "Accessories", dept: "women",
    price: 22500, sale: null, badge: "New", isNew: 1, stock: 10,
    sizes: [], colors: [["Espresso", "#3a2c22"], ["Noir", "#161513"]],
    imgs: [IMG("1590874103328-eac38a683ce7"), IMG("1584917865442-de89df76afd3")],
    rating: 4.7, reviews: 39,
    description: "Structured pebbled leather tote with suede lining, laptop sleeve and magnetic closure. Your every day, elevated.",
  },
];

(async () => {
  const productCount = db.prepare("SELECT COUNT(*) AS n FROM products").get().n;
  const forceReset = process.argv.includes("--reset");

  if (forceReset) {
    console.log("Resetting data…");
    db.exec("DELETE FROM order_items; DELETE FROM orders; DELETE FROM carts; DELETE FROM wishlists; DELETE FROM products; DELETE FROM categories;");
  }

  if (db.prepare("SELECT COUNT(*) AS n FROM categories").get().n === 0) {
    const insCat = db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)");
    for (const [name, slug] of CATEGORIES) insCat.run(name, slug);
    console.log(`✓ ${CATEGORIES.length} categories`);
  }

  if (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n === 0) {
    const email = (process.env.ADMIN_EMAIL || "admin@maisonvelvet.com").toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "MaisonVelvet!2026";
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')").run(
      "Maison Velvet Admin", email, await hashPassword(password)
    );
    console.log(`✓ Admin created → ${email} / ${password}   (change this password!)`);
  }

  if (productCount === 0 || forceReset) {
    const catId = Object.fromEntries(
      db.prepare("SELECT id, slug FROM categories").all().map((c) => [c.slug, c.id])
    );
    const insProduct = db.prepare(
      `INSERT INTO products (sku, name, slug, description, category_id, dept, price_cents, sale_price_cents, badge,
        status, is_trending, is_new, stock, sizes, colors, images, rating, reviews_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    let i = 0;
    for (const p of PRODUCTS) {
      i++;
      const images = [];
      for (const [j, url] of p.imgs.entries()) images.push(await download(url, `${p.sku.toLowerCase()}-${j + 1}.jpg`));
      insProduct.run(
        p.sku, p.name, p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        p.description, catId[p.cat.toLowerCase()] ?? null, p.dept, p.price, p.sale, p.badge,
        p.trending || 0, p.isNew || 0, p.stock,
        JSON.stringify(p.sizes),
        JSON.stringify(p.colors.map(([name, hex]) => ({ name, hex }))),
        JSON.stringify(images), p.rating, p.reviews
      );
    }
    console.log(`✓ ${i} products seeded`);
  } else {
    console.log(`• Products already present (${productCount}) — skipped. Use --reset to reseed.`);
  }

  const demoCustomer = process.env.DEMO_CUSTOMER !== "off";
  if (demoCustomer && !db.prepare("SELECT id FROM users WHERE email = 'client@example.com'").get()) {
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, 'client@example.com', ?, 'customer')").run(
      "Demo Client", await hashPassword("Client!2026")
    );
    console.log("✓ Demo customer → client@example.com / Client!2026");
  }

  console.log("Seed complete.");
})();
