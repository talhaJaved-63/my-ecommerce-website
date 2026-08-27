const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { db } = require("./db");

const COOKIE = "mv_session";
const MAX_AGE = 30 * 24 * 60 * 60;

function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(__dirname, "..", "data", ".session-secret");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    const s = crypto.randomBytes(48).toString("hex");
    fs.writeFileSync(file, s, { mode: 0o600 });
    return s;
  }
}

const sign = (data) => crypto.createHmac("sha256", secret()).update(data).digest("base64url");

function serialize(user) {
  const payload = Buffer.from(
    JSON.stringify({ uid: user.id, role: user.role, exp: Date.now() + MAX_AGE * 1000 })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function deserialize(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function setSession(res, user) {
  res.cookie(COOKIE, serialize(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: MAX_AGE * 1000,
    path: "/",
  });
}

function clearSession(res) {
  res.clearCookie(COOKIE, { path: "/" });
}

const userById = db.prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?");

function attachUser(req, _res, next) {
  req.user = null;
  const data = deserialize(req.cookies?.[COOKIE]);
  if (data) {
    const row = userById.get(data.uid);
    if (row) req.user = { id: row.id, name: row.name, email: row.email, role: row.role };
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Please sign in to continue." });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentication required." });
  if (req.user.role !== "admin") return res.status(403).json({ error: "Administrator access required." });
  next();
}

const attempts = new Map();
function rateLimitLogin(req, res, next) {
  const key = `${req.ip}:${(req.body?.email || "").toLowerCase()}`;
  const nowMs = Date.now();
  const rec = attempts.get(key);
  if (rec && rec.count >= 10 && nowMs - rec.first < 15 * 60 * 1000) {
    return res.status(429).json({ error: "Too many attempts. Please wait 15 minutes and try again." });
  }
  res.locals.loginKey = key;
  next();
}
function recordFailedLogin(key) {
  const rec = attempts.get(key);
  if (!rec || Date.now() - rec.first > 15 * 60 * 1000) attempts.set(key, { first: Date.now(), count: 1 });
  else rec.count++;
}
function clearLogins(key) {
  attempts.delete(key);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

const hashPassword = (password) => bcrypt.hash(password, 10);

function csrfGuard(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  try {
    if (new URL(origin).host === req.headers.host) return next();
  } catch {}
  res.status(403).json({ error: "Request origin rejected." });
}

module.exports = {
  COOKIE,
  setSession,
  clearSession,
  attachUser,
  requireAuth,
  requireAdmin,
  rateLimitLogin,
  recordFailedLogin,
  clearLogins,
  verifyPassword,
  hashPassword,
  csrfGuard,
};
