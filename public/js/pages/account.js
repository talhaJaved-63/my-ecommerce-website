(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const params = new URLSearchParams(location.search);
  const TABS = ["orders", "wishlist", "profile"];

  const fmtDate = (s) => {
    try {
      return new Date(String(s).replace(" ", "T")).toLocaleDateString(undefined, {
        year: "numeric", month: "short", day: "numeric",
      });
    } catch {
      return String(s || "").slice(0, 10);
    }
  };

  const money = (c) => MV.money(c);

  /* --------------------------------- gating --------------------------------- */

  MV.bootPromise.then(() => {
    if (!MV.user) {
      const next = "/account.html" + (location.hash || "");
      location.replace(`/login.html?next=${encodeURIComponent(next)}`);
      return;
    }
    $("#account-loading").hidden = true;
    $("#account-root").hidden = false;
    initTabs();
    renderProfile();
    loadOrders();
    loadWishlist();
  });

  /* ---------------------------------- tabs ---------------------------------- */

  function initTabs() {
    const btns = [...document.querySelectorAll(".account-nav button[data-tab]")];
    const show = (name) => {
      if (!TABS.includes(name)) name = "orders";
      btns.forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
      for (const s of document.querySelectorAll(".account-tab")) s.hidden = s.id !== `tab-${name}`;
    };
    btns.forEach((b) =>
      b.addEventListener("click", () => {
        show(b.dataset.tab);
        history.replaceState(null, "", `#${b.dataset.tab}`);
      })
    );
    show(params.get("tab") || location.hash.slice(1) || "orders");
    $("#signout-btn").addEventListener("click", signOut);
  }

  async function signOut() {
    const btn = $("#signout-btn");
    btn.disabled = true;
    btn.textContent = "Signing Out…";
    try {
      await MV.api.post("/api/auth/logout");
    } catch {}
    MV.user = null;
    MV.toast("Signed out — à bientôt");
    location.replace("/");
  }

  /* --------------------------------- orders --------------------------------- */

  async function loadOrders() {
    const list = $("#orders-list");
    try {
      const res = await MV.api.get("/api/orders");
      const orders = res.orders || [];
      if (!orders.length) return renderEmpty(list, "No orders yet.", "Your future pieces will live here.", "/shop.html", "Start Shopping");
      list.innerHTML = orders.map(orderCardHTML).join("");
      list.querySelectorAll(".oc-head").forEach((head) =>
        head.addEventListener("click", () => head.closest(".order-card").classList.toggle("open"))
      );
      const first = list.querySelector(".order-card");
      if (first && orders.length === 1) first.classList.add("open");
    } catch (e) {
      list.innerHTML = `<p class="grid-empty">${e.message || "Could not load your orders."}</p>`;
    }
  }

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function orderCardHTML(o) {
    const payLabel =
      o.paymentProvider === "stripe" ? "Card · Stripe" :
      o.paymentProvider === "demo" ? "Demo Payment" : o.paymentProvider;
    return `
    <article class="order-card" data-number="${esc(o.number)}">
      <div class="oc-head">
        <div>
          <p class="oc-num">${esc(o.number)}</p>
          <p class="oc-date">Placed ${fmtDate(o.placedAt)} · ${esc(payLabel || "")}</p>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          <span class="pill ${esc(o.paymentStatus)}">${esc(o.paymentStatus)}</span>
          <span class="pill ${esc(o.status)}">${esc(o.status)}</span>
          <span class="oc-total">${money(o.totalCents)}</span>
        </div>
      </div>
      <div class="oc-body">
        <div class="oc-thumbs">
          ${o.items.slice(0, 5).map((i) => `<img src="${esc(i.image)}" alt="${esc(i.name)}" loading="lazy">`).join("")}
        </div>
        ${o.items
          .map(
            (i) => `
        <div class="summary-line">
          <img src="${esc(i.image)}" alt="" loading="lazy">
          <div>
            <p class="sum-name">${esc(i.name)}</p>
            <p class="sum-meta">${[i.size, i.color].filter(Boolean).map(esc).join(" · ") || "—"} · Qty ${i.qty}</p>
          </div>
          <span>${money(i.priceCents * i.qty)}</span>
        </div>`
          )
          .join("")}
        <div class="totals">
          <div><span>Subtotal</span><span>${money(o.subtotalCents)}</span></div>
          <div><span>Shipping</span><span>${o.shippingCents === 0 ? "Free" : money(o.shippingCents)}</span></div>
          <div class="grand"><span>Total</span><span>${money(o.totalCents)}</span></div>
        </div>
        ${
          o.carrier || o.trackingNumber
            ? `<div class="tracking-box">
                 <span>Carrier: <strong>${esc(o.carrier || "—")}</strong>${o.trackingNumber ? ` · Tracking: <strong>${esc(o.trackingNumber)}</strong>` : ""}</span>
                 <a href="/track.html?number=${encodeURIComponent(o.number)}&email=${encodeURIComponent(o.email || "")}">Track order →</a>
               </div>`
            : `<div class="tracking-box"><span>Status: <strong>${esc(o.status)}</strong></span><a href="/track.html?number=${encodeURIComponent(o.number)}&email=${encodeURIComponent(o.email || "")}">Track order →</a></div>`
        }
        <div class="addr-block">
          Ship to — ${esc(o.fullName)}, ${esc(o.address)}${o.city ? `, ${esc(o.city)}` : ""}${o.region ? `, ${esc(o.region)}` : ""} ${esc(o.postal || "")}, ${esc(o.country)}
        </div>
      </div>
    </article>`;
  }

  /* -------------------------------- wishlist -------------------------------- */

  let wishLoaded = false;

  async function loadWishlist() {
    const grid = $("#wish-grid");
    const label = $("#wish-count-label");
    try {
      if (!MV.wish.size) return renderWishEmpty();
      const res = await MV.api.get(`/api/products?ids=${[...MV.wish].join(",")}&limit=60`);
      const items = res.products || [];
      label.textContent = `${items.length} saved ${items.length === 1 ? "piece" : "pieces"}`;
      if (!items.length) return renderWishEmpty();
      grid.innerHTML = "";
      MV.renderGrid(grid, items);
      wishLoaded = true;
    } catch (e) {
      grid.innerHTML = `<p class="grid-empty">${e.message || "Could not load your wishlist."}</p>`;
    }
  }

  function renderWishEmpty() {
    $("#wish-count-label").textContent = "";
    renderEmpty($("#wish-grid"), "Your wishlist is empty.", 'Tap the heart on any piece to save it here.', "/shop.html", "Browse The Collection");
  }

  MV.on("wish", () => {
    if (!wishLoaded || !MV.booted || !MV.user) return;
    loadWishlist();
  });

  /* --------------------------------- profile -------------------------------- */

  function renderProfile() {
    const u = MV.user;
    const initials = u.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    $("#profile-body").innerHTML = `
      <div style="display:flex;align-items:center;gap:1.2rem;margin-bottom:1.6rem">
        <span class="avatar" aria-hidden="true">${initials}</span>
        <div>
          <p class="sum-name">${u.name}</p>
          <p class="sum-meta">${u.email}</p>
          ${u.role === "admin" ? '<span class="pill processing">Admin</span>' : ""}
        </div>
      </div>
      <div style="display:flex;gap:.8rem;flex-wrap:wrap">
        <button type="button" class="btn btn-solid" id="profile-signout">Sign Out</button>
        <a class="btn btn-outline" href="/shop.html">Continue Shopping</a>
      </div>`;
    $("#profile-signout").addEventListener("click", signOut);
  }

  /* ------------------------------- empty states ------------------------------ */

  function renderEmpty(el, title, sub, href, cta) {
    el.innerHTML = `
      <div class="grid-empty" style="padding:3rem 1.5rem;text-align:center">
        <p style="font-size:1.15rem;margin-bottom:.4rem">${title}</p>
        <p class="shop-meta" style="margin-bottom:1.4rem">${sub}</p>
        <a class="btn btn-solid" href="${href}">${cta}</a>
      </div>`;
  }
})();
