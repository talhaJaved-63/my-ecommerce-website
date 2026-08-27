require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const path = require("path");

const { attachUser, csrfGuard } = require("./src/auth");
const { router: apiRoutes } = require("./src/routes/api");
const adminRoutes = require("./src/routes/admin");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://js.stripe.com"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(attachUser);
app.use(csrfGuard);

app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: "1h",
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}uploads${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    },
  })
);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.get(["/admin", "/admin/"], (_req, res) => res.redirect("/admin/login.html"));

app.use("/api", apiRoutes);
app.use("/api/admin", adminRoutes);

app.use("/api", (_req, res) => res.status(404).json({ error: "Endpoint not found." }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Payload too large." });
  res.status(err.status || 500).json({ error: err.expose ? err.message : "Something went wrong. Please try again." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const demo = require("./src/payments").isConfigured() ? "Stripe live" : "DEMO payments (set STRIPE_SECRET_KEY to go live)";
  console.log("──────────────────────────────────────────────");
  console.log(`  MAISON VELVET  ·  http://localhost:${PORT}`);
  console.log(`  Admin dashboard : /admin/`);
  console.log(`  Payments        : ${demo}`);
  console.log("──────────────────────────────────────────────");
});
