(() => {
  const MV = {
    user: null,
    config: null,
    cart: [],
    wish: new Set(),
    listeners: {},
    money(cents) {
      const v = cents / 100;
      return `$${Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(2)}`;
    },
    effectivePriceCents(p) {
      return p.salePriceCents ?? p.priceCents;
    },
    on(evt, fn) {
      (this.listeners[evt] ||= []).push(fn);
    },
    emit(evt, data) {
      (this.listeners[evt] || []).forEach((fn) => fn(data));
    },
  };

  /* ------------------------------- api helper ------------------------------ */

  MV.api = {
    async request(method, url, body) {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        credentials: "same-origin",
      });
      let data = {};
      try {
        data = await res.json();
      } catch {}
      if (!res.ok) {
        const err = new Error(data.error || `Request failed (${res.status})`);
        err.status = res.status;
        throw err;
      }
      return data;
    },
    get: (u) => MV.api.request("GET", u),
    post: (u, b) => MV.api.request("POST", u, b),
    put: (u, b) => MV.api.request("PUT", u, b),
    patch: (u, b) => MV.api.request("PATCH", u, b),
    del: (u) => MV.api.request("DELETE", u),
  };

  /* --------------------------------- toasts -------------------------------- */

  MV.toast = (msg) => {
    if (!msg) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    $("#toasts").appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 420);
    }, 2400);
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  MV.$ = $;
  MV.$$ = $$;

  /* ----------------------------- chrome injection --------------------------- */

  const CHROME_TOP = `
  <a href="#main" class="skip-link">Skip to content</a>
  <div class="announce"><p>Complimentary shipping on orders over $75&nbsp;&nbsp;·&nbsp;&nbsp;Free 30-day returns</p></div>

  <header class="site-header" id="site-header">
    <div class="container header-inner">
      <button class="icon-btn hamburger" id="menu-open" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      </button>
      <a href="/" class="logo">Maison Velvet</a>
      <nav class="nav-links" aria-label="Primary">
        
        <a class="nav-link" href="/#new-arrivals">New Arrivals</a>
        <a class="nav-link" href="/shop.html?dept=women">Women</a>
        <a class="nav-link" href="/shop.html?dept=men">Men</a>
        <a class="nav-link" href="/#collection">Collections</a>
        <a class="nav-link nav-sale" href="/shop.html?sale=1">Sale</a>
      </nav>
      <div class="header-actions">
        <button class="icon-btn hide-sm" id="search-open" aria-label="Search">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        </button>
        <a class="icon-btn hide-sm" id="account-btn" href="/login.html" aria-label="Account">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.4-3.4 4-5 7-5s5.6 1.6 7 5"/></svg>
        </a>
        <a class="icon-btn" id="wish-btn" href="/account.html#wishlist" aria-label="Wishlist">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.6 5 8.1 5c1.6 0 3 .8 3.9 2.1C12.9 5.8 14.3 5 15.9 5c2.5 0 4.6 2 4.6 4.6 0 3.7-3.5 6.9-8.5 10.9Z"/></svg>
          <span class="icon-badge" id="wish-count" hidden>0</span>
        </a>
        <button class="icon-btn" id="cart-open" aria-label="Shopping bag">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 8h12l1 13H5L6 8Z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></svg>
          <span class="icon-badge" id="cart-count" hidden>0</span>
        </button>
      </div>
    </div>
  </header>`;

  const CHROME_BOTTOM = `
  <footer class="site-footer">
    <div class="container foot-grid">
      <div class="foot-brand">
        <a href="/" class="logo logo-light">Maison Velvet</a>
        <p>A modern luxury fashion house crafting timeless essentials and considered statement pieces — made to last.</p>
        <div class="social-row">
          <a href="#" aria-label="Instagram"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/></svg></a>
          <a href="#" aria-label="Facebook"><svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M13.5 21v-7h2.4l.4-2.8h-2.8V9.4c0-.8.3-1.4 1.5-1.4h1.4V5.5c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.5v2.3H8.5V14H11v7h2.5Z"/></svg></a>
          <a href="#" aria-label="X"><svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M17.7 4h2.5l-5.4 6.2L21 20h-5l-3.9-5.1L7.6 20H5l5.8-6.6L4.5 4h5.1l3.5 4.7L17.7 4Zm-.9 14.4h1.4L8.5 5.5H7L16.8 18.4Z"/></svg></a>
          <a href="#" aria-label="YouTube"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="6.5" width="18" height="11" rx="3"/><path d="M10.5 9.8v4.4l4-2.2-4-2.2Z" fill="currentColor" stroke="none"/></svg></a>
        </div>
        <form class="mini-nl" id="footer-nl" novalidate>
          <input type="email" placeholder="Email address" aria-label="Email address for newsletter" required>
          <button type="submit" aria-label="Subscribe to newsletter"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12h15M13 6l6 6-6 6"/></svg></button>
        </form>
      </div>
      <nav class="foot-col" aria-label="Shop">
        <h4>Shop</h4>
        <ul>
          <li><a href="/shop.html?new=1">New Arrivals</a></li>
          <li><a href="/shop.html?dept=women">Women</a></li>
          <li><a href="/shop.html?dept=men">Men</a></li>
          <li><a href="/shop.html?sale=1">Sale</a></li>
          <li><a href="/track.html">Track Order</a></li>
        </ul>
      </nav>
      <nav class="foot-col" aria-label="Customer service">
        <h4>Customer Service</h4>
        <ul>
          <li><a href="#">Contact Us</a></li>
          <li><a href="#">Shipping &amp; Returns</a></li>
          <li><a href="#">Size Guide</a></li>
          <li><a href="/track.html">Track Order</a></li>
          <li><a href="#">FAQ</a></li>
        </ul>
      </nav>
      <nav class="foot-col" aria-label="About">
        <h4>About</h4>
        <ul>
          <li><a href="#">Our Story</a></li>
          <li><a href="#">Sustainability</a></li>
          <li><a href="#">Craftsmanship</a></li>
          <li><a href="#">Careers</a></li>
          <li><a href="#">Stores</a></li>
        </ul>
      </nav>
      <div class="foot-col foot-contact">
        <h4>Client Care</h4>
        <ul>
          <li><a href="mailto:care@maisonvelvet.com">care@maisonvelvet.com</a></li>
          <li><a href="tel:+33100000000">+33 1 00 00 00 00</a></li>
          <li>Mon–Fri, 9am–6pm CET</li>
        </ul>
        <div class="payments" aria-hidden="true"><span>VISA</span><span>MC</span><span>AMEX</span><span>PAYPAL</span></div>
      </div>
    </div>
    <div class="container foot-bottom">
      <p>© <span id="year">2026</span> Maison Velvet. All rights reserved.</p>
      <ul class="legal">
        <li><a href="#">Privacy Policy</a></li>
        <li><a href="#">Terms &amp; Conditions</a></li>
        <li><a href="#">Cookie Settings</a></li>
      </ul>
    </div>
  </footer>

  <div class="overlay" id="overlay" hidden></div>

  <aside class="drawer mobile-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu" hidden>
    <div class="drawer-head">
      <span class="drawer-title">Menu</span>
      <button class="icon-btn drawer-close" data-close aria-label="Close menu"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <nav class="menu-links" aria-label="Mobile primary">
      
      <a href="/shop.html?new=1">New Arrivals</a>
      <a href="/shop.html?dept=women">Women</a>
      <a href="/shop.html?dept=men">Men</a>
      <a href="/#collection">Collections</a>
      <a href="/shop.html?sale=1" class="sale">Sale</a>
    </nav>
    <div class="menu-meta">
      <a href="/account.html">My Account</a>
      <a href="/track.html">Order Tracking</a>
      <a href="#">Help &amp; FAQ</a>
    </div>
  </aside>

  <aside class="drawer cart-drawer" id="cart-drawer" role="dialog" aria-modal="true" aria-label="Shopping bag" hidden>
    <div class="drawer-head">
      <span class="drawer-title">Shopping Bag <em id="cart-head-count">(0)</em></span>
      <button class="icon-btn drawer-close" data-close aria-label="Close bag"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <div class="ship-bar"><p id="ship-msg">You’re $150 away from free shipping</p><div class="progress"><span id="ship-fill" style="width:0%"></span></div></div>
    <div class="cart-items" id="cart-items"></div>
    <div class="cart-foot">
      <div class="cart-total"><span>Subtotal</span><strong id="cart-subtotal">$0</strong></div>
      <p class="cart-note">Shipping calculated at checkout.</p>
      <a href="/checkout.html" class="btn btn-solid btn-block" id="checkout-link">Proceed to Checkout</a>
    </div>
  </aside>

  <div class="search-modal" id="search-modal" role="dialog" aria-modal="true" aria-label="Search" hidden>
    <div class="container search-inner">
      <div class="search-box">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" id="search-input" placeholder="Search products, categories…" autocomplete="off">
        <button class="icon-btn" id="search-close" aria-label="Close search"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <div class="search-tags" id="search-tags">
        <span>Popular:</span>
        <button class="tag">Dress</button>
        <button class="tag">Coat</button>
        <button class="tag">Knitwear</button>
        <button class="tag">Sneakers</button>
        <button class="tag">Bag</button>
      </div>
      <div class="search-results" id="search-results"></div>
    </div>
  </div>

  <div class="toasts" id="toasts" aria-live="polite"></div>

  <button class="to-top" id="to-top" aria-label="Back to top"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>`;

  document.body.insertAdjacentHTML("afterbegin", CHROME_TOP);
  document.body.insertAdjacentHTML("beforeend", CHROME_BOTTOM);
  $("#year").textContent = new Date().getFullYear();

  /* ------------------------------ image fallback ---------------------------- */

  const PLACEHOLDER =
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='800'><rect width='100%' height='100%' fill='#ece5d8'/><text x='50%' y='51%' text-anchor='middle' font-family='Georgia' font-size='34' letter-spacing='8' fill='#a58a5f'>MAISON VELVET</text></svg>`,
    );
  document.addEventListener(
    "error",
    (e) => {
      const t = e.target;
      if (t.tagName === "IMG" && !t.dataset.fallback) {
        t.dataset.fallback = "1";
        t.src = PLACEHOLDER;
      }
    },
    true,
  );

  /* ---------------------------------- cart ---------------------------------- */

  const FREE_AT = 15000;
  const cartKey = (i) => `${i.productId}|${i.size}|${i.color}`;

  MV.cartQty = () => MV.cart.reduce((n, i) => n + i.qty, 0);
  MV.cartSubtotalCents = () =>
    MV.cart.reduce((n, i) => n + i.priceCents * i.qty, 0);

  let syncTimer = null;
  const persistCart = () => {
    try {
      localStorage.setItem("mv-cart", JSON.stringify(MV.cart));
    } catch {}
    if (MV.user) {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(async () => {
        try {
          await MV.api.put("/api/cart", {
            items: MV.cart.map(({ productId, qty, size, color }) => ({
              productId,
              qty,
              size,
              color,
            })),
          });
        } catch {}
      }, 400);
    }
  };

  MV.addToCart = (item, { silent = false } = {}) => {
    const found = MV.cart.find((i) => cartKey(i) === cartKey(item));
    if (found) found.qty = Math.min(found.qty + item.qty, 20);
    else MV.cart.push({ ...item });
    if (found && found.qty > (found.maxStock ?? Infinity))
      found.qty = found.maxStock;
    persistCart();
    MV.emit("cart");
    if (!silent) MV.toast(`${item.name} added to bag`);
  };

  MV.removeFromCart = (key) => {
    MV.cart = MV.cart.filter((i) => cartKey(i) !== key);
    persistCart();
    MV.emit("cart");
  };

  MV.setQty = (key, qty) => {
    const item = MV.cart.find((i) => cartKey(i) === key);
    if (!item) return;
    item.qty = Math.min(Math.max(qty, 0), 20);
    if (item.qty === 0) return MV.removeFromCart(key);
    persistCart();
    MV.emit("cart");
  };

  MV.clearCart = () => {
    MV.cart = [];
    persistCart();
    MV.emit("cart");
  };

  function renderCartDrawer() {
    const wrap = $("#cart-items");
    const qty = MV.cartQty();
    $("#cart-head-count").textContent = `(${qty})`;
    if (!MV.cart.length) {
      wrap.innerHTML = `<div class="cart-empty"><strong>Your bag is empty</strong>Discover the pieces defining this season.</div>`;
      $("#cart-subtotal").textContent = MV.money(0);
      updateShipBar(0);
      return;
    }
    wrap.innerHTML = MV.cart
      .map((i) => {
        const key = cartKey(i);
        const variant = [i.size, i.color].filter(Boolean).join(" · ");
        return `
        <div class="cart-item" data-key="${encodeURIComponent(key)}">
          <img class="ci-img" src="${i.image}" alt="${i.name}" loading="lazy">
          <div>
            <p class="ci-name">${i.name}</p>
            ${variant ? `<p class="ci-meta">${variant}</p>` : ""}
            <p class="ci-price">${MV.money(i.priceCents)}</p>
            <div class="qty-controls">
              <button class="qty-btn" data-act="dec" aria-label="Decrease quantity">−</button>
              <span class="qty">${i.qty}</span>
              <button class="qty-btn" data-act="inc" aria-label="Increase quantity">+</button>
            </div>
          </div>
          <div class="ci-side">
            <button class="ci-remove" data-act="remove">Remove</button>
            <span class="ci-total">${MV.money(i.priceCents * i.qty)}</span>
          </div>
        </div>`;
      })
      .join("");
    $("#cart-subtotal").textContent = MV.money(MV.cartSubtotalCents());
    updateShipBar(MV.cartSubtotalCents());
  }

  function updateShipBar(subtotalCents) {
    $("#ship-fill").style.width =
      `${Math.min((subtotalCents / FREE_AT) * 100, 100)}%`;
    $("#ship-msg").textContent =
      subtotalCents >= FREE_AT
        ? "You’ve unlocked complimentary shipping ✦"
        : `You’re ${MV.money(FREE_AT - subtotalCents)} away from free shipping`;
  }

  $("#cart-items").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const key = decodeURIComponent(btn.closest(".cart-item").dataset.key);
    const item = MV.cart.find((i) => cartKey(i) === key);
    if (!item) return;
    if (btn.dataset.act === "inc") MV.setQty(key, item.qty + 1);
    if (btn.dataset.act === "dec") MV.setQty(key, item.qty - 1);
    if (btn.dataset.act === "remove") MV.removeFromCart(key);
  });

  /* -------------------------------- wishlist -------------------------------- */

  MV.wishHas = (id) => MV.wish.has(Number(id));

  MV.toggleWish = async (id, name = "") => {
    id = Number(id);
    if (MV.user) {
      try {
        const res = await MV.api.post("/api/wishlist/toggle", {
          productId: id,
        });
        res.active ? MV.wish.add(id) : MV.wish.delete(id);
      } catch {}
    } else {
      MV.wish.has(id) ? MV.wish.delete(id) : MV.wish.add(id);
      try {
        localStorage.setItem("mv-wish", JSON.stringify([...MV.wish]));
      } catch {}
    }
    updateBadges();
    MV.emit("wish");
    MV.toast(
      MV.wish.has(id)
        ? `${name || "Piece"} saved to wishlist`
        : `${name || "Piece"} removed from wishlist`,
    );
  };

  /* --------------------------------- badges --------------------------------- */

  function setBadge(el, n) {
    el.textContent = n > 99 ? "99+" : n;
    el.hidden = n === 0;
  }
  function updateBadges() {
    setBadge($("#cart-count"), MV.cartQty());
    setBadge($("#wish-count"), MV.wish.size);
  }

  /* ------------------------------- overlays --------------------------------- */

  const overlay = $("#overlay");
  function openPanel(el, { showOverlay = true } = {}) {
    closeAll();
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("open"));
    overlay.hidden = !showOverlay;
    if (showOverlay) requestAnimationFrame(() => overlay.classList.add("show"));
    document.body.classList.add("locked");
    $(".drawer-close", el)?.focus({ preventScroll: true });
  }
  function openModal(el) {
    closeAll();
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("open"));
    document.body.classList.add("locked");
    $("input", el)?.focus({ preventScroll: true });
  }
  function closeAll() {
    $$(".drawer.open, .search-modal.open").forEach((el) => {
      el.classList.remove("open");
      setTimeout(() => {
        if (!el.classList.contains("open")) el.hidden = true;
      }, 550);
    });
    overlay.classList.remove("show");
    setTimeout(() => {
      if (!overlay.classList.contains("show")) overlay.hidden = true;
    }, 400);
    document.body.classList.remove("locked");
  }
  MV.closeAll = closeAll;

  overlay.addEventListener("click", closeAll);
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeAll());

  $("#menu-open").addEventListener("click", () => {
    $("#menu-open").setAttribute("aria-expanded", "true");
    openPanel($("#mobile-menu"));
  });
  $("#cart-open").addEventListener("click", () => openPanel($("#cart-drawer")));
  $("#search-open").addEventListener("click", () =>
    openModal($("#search-modal")),
  );
  $("#search-close").addEventListener("click", closeAll);
  $$("[data-close]").forEach((b) => b.addEventListener("click", closeAll));
  $$(".menu-links a, .menu-meta a").forEach((a) =>
    a.addEventListener("click", closeAll),
  );

  /* --------------------------------- search --------------------------------- */

  const searchInput = $("#search-input");
  const searchResults = $("#search-results");
  let searchTimer = null;

  function renderSearchResults(hits, q) {
    searchResults.innerHTML = hits.length
      ? hits
          .map(
            (p) => `
          <a class="result-item" href="/product.html?id=${p.id}">
            <img src="${p.images[0] || ""}" alt="" loading="lazy">
            <span>
              <span class="ri-name">${p.name}</span>
              <span class="ri-meta">${p.category?.name || ""}${p.badge ? " · " + p.badge : ""}</span>
              <span class="ri-price">${MV.money(MV.effectivePriceCents(p))}</span>
            </span>
          </a>`,
          )
          .join("")
      : `<p class="search-empty">No pieces found for “${q}”.</p>`;
  }

  function runSearch(qRaw) {
    const q = qRaw.trim();
    if (!q) {
      searchResults.innerHTML = `<p class="search-empty">Start typing to explore the collection…</p>`;
      return;
    }
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      try {
        const data = await MV.api.get(
          `/api/products?q=${encodeURIComponent(q)}&limit=6`,
        );
        renderSearchResults(data.products, q);
      } catch {
        searchResults.innerHTML = `<p class="search-empty">Search is unavailable right now.</p>`;
      }
    }, 220);
  }

  searchInput.addEventListener("input", () => runSearch(searchInput.value));
  $$("#search-tags .tag").forEach((t) =>
    t.addEventListener("click", () => {
      searchInput.value = t.textContent;
      runSearch(t.textContent);
      searchInput.focus();
    }),
  );

  /* ------------------------------- newsletter ------------------------------- */

  function bindNewsletter(form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("input", form);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim())) {
        MV.toast("Please enter a valid email address");
        input.focus();
        return;
      }
      MV.toast("Welcome to the list — check your inbox ✦");
      form.reset();
    });
  }
  bindNewsletter($("#footer-nl"));
  const nlForm = $("#nl-form");
  if (nlForm)
    nlForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const msgEl = $("#nl-msg");
      const val = $("#nl-email").value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) {
        msgEl.textContent = "Please enter a valid email address.";
        msgEl.className = "nl-msg err";
        return;
      }
      msgEl.textContent =
        "Thank you — you’re on the list. Welcome to Maison Velvet.";
      msgEl.className = "nl-msg ok";
      nlForm.reset();
    });

  /* ------------------------------ header extras ----------------------------- */

  const header = $("#site-header");
  const toTop = $("#to-top");
  window.addEventListener(
    "scroll",
    () => {
      header.classList.toggle("scrolled", window.scrollY > 8);
      toTop.classList.toggle("show", window.scrollY > 650);
    },
    { passive: true },
  );
  toTop.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" }),
  );

  /* ------------------------------ reveal on scroll --------------------------- */

  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("visible");
          io.unobserve(en.target);
        }
      }),
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
  );

  MV.observeReveals = (root = document) =>
    $$(".reveal:not(.visible)", root).forEach((el) => io.observe(el));
  MV.observeReveals();

  /* ------------------------------ card renderer ------------------------------ */

  MV.starsHTML = (rating) => {
    let out = "";
    for (let i = 1; i <= 5; i++)
      out += `<span class="star${i <= Math.round(rating) ? " on" : ""}">★</span>`;
    return `<span class="stars" aria-hidden="true">${out}</span>`;
  };

  MV.productCardHTML = (p) => {
    const price = MV.effectivePriceCents(p);
    const soldOut = p.stock <= 0;
    const badges = [];
    if (p.salePriceCents)
      badges.push(
        `<span class="badge saleb">-${Math.round((1 - p.salePriceCents / p.priceCents) * 100)}%</span>`,
      );
    if (p.badge) {
      const cls =
        p.badge === "Limited"
          ? "limited"
          : p.badge === "Best Seller"
            ? "best"
            : p.isNew
              ? ""
              : "trend";
      badges.push(`<span class="badge ${cls}">${p.badge}</span>`);
    }
    if (soldOut) badges.push(`<span class="badge limited">Sold Out</span>`);
    const imgA = p.images[0] || "";
    const imgB = p.images[1] || p.images[0] || "";
    return `
    <article class="p-card reveal" data-id="${p.id}" data-name="${p.name}">
      <div class="pc-media">
        <div class="pc-badges">${badges.join("")}</div>
        <button class="pc-wish ${MV.wishHas(p.id) ? "active" : ""}" data-wish="${p.id}" data-name="${p.name}" aria-label="Add ${p.name} to wishlist" aria-pressed="${MV.wishHas(p.id)}">
          <svg viewBox="0 0 24 24" width="17" height="17"><path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.6 5 8.1 5c1.6 0 3 .8 3.9 2.1C12.9 5.8 14.3 5 15.9 5c2.5 0 4.6 2 4.6 4.6 0 3.7-3.5 6.9-8.5 10.9Z"/></svg>
        </button>
        <a class="pc-link" href="/product.html?id=${p.id}" aria-label="${p.name}"></a>
        <img class="pc-img pc-img-a" src="${imgA}" alt="${p.name}" loading="lazy">
        <img class="pc-img pc-img-b" src="${imgB}" alt="" aria-hidden="true" loading="lazy">
        <button class="pc-add" data-add='${JSON.stringify({
          productId: p.id,
          name: p.name,
          image: p.images[0] || "",
          priceCents: price,
          size: p.sizes[0] || "",
          color: p.colors[0]?.name || "",
          maxStock: p.stock,
        }).replace(/'/g, "&#39;")}' ${soldOut ? "disabled" : ""}>${
          soldOut ? "Sold Out" : `Add to Bag — ${MV.money(price)}`
        }</button>
      </div>
      <div class="pc-info">
        <p class="pc-cat">${p.category?.name || ""}</p>
        <h3 class="pc-name"><a href="/product.html?id=${p.id}">${p.name}</a></h3>
        <div class="pc-rating">${MV.starsHTML(p.rating)}<span class="rev-count">(${p.reviewsCount})</span></div>
        <p class="pc-price-row">
          <span class="pc-price">${MV.money(price)}</span>
          ${p.salePriceCents ? `<s class="old">${MV.money(p.priceCents)}</s>` : ""}
        </p>
        ${
          p.colors?.length
            ? `<div class="pc-colors" aria-label="Available colors">${p.colors
                .map(
                  (c, i) =>
                    `<span class="dot${i === 0 ? " on" : ""}" style="background:${c.hex}" title="${c.name}"></span>`,
                )
                .join("")}</div>`
            : ""
        }
      </div>
    </article>`;
  };

  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add && !add.disabled) {
      MV.addToCart(JSON.parse(add.dataset.add));
      return;
    }
    const wish = e.target.closest("[data-wish]");
    if (wish) MV.toggleWish(wish.dataset.wish, wish.dataset.name || "");
    const dot = e.target.closest(".dot");
    if (dot) {
      $$(".dot", dot.parentElement).forEach((d) => d.classList.remove("on"));
      dot.classList.add("on");
    }
  });

  MV.renderGrid = (el, products) => {
    el.innerHTML = products.map(MV.productCardHTML).join("");
    MV.observeReveals(el);
  };

  MV.on("cart", renderCartDrawer);

  /* --------------------------------- boot ----------------------------------- */

  async function boot() {
    renderCartDrawer();
    updateBadges();
    try {
      const [me, cfg] = await Promise.all([
        MV.api.get("/api/auth/me"),
        MV.api.get("/api/config"),
      ]);
      MV.user = me.user;
      MV.config = cfg;
    } catch {}

    if (MV.user) {
      $("#account-btn").href = "/account.html";
      $("#account-btn").ariaLabel = `Account — ${MV.user.name}`;
      try {
        localStorage.setItem(
          "mv-wish",
          localStorage.getItem("mv-wish") || "[]",
        );
        const [serverCart, serverWish] = await Promise.all([
          MV.api.get("/api/cart"),
          MV.api.get("/api/wishlist"),
        ]);
        const map = new Map(MV.cart.map((i) => [cartKey(i), { ...i }]));
        for (const s of serverCart.items) {
          const k = `${s.productId}|${s.size}|${s.color}`;
          const local = map.get(k);
          map.set(
            k,
            local
              ? { ...local, qty: Math.max(local.qty, s.qty) }
              : {
                  productId: s.productId,
                  qty: s.qty,
                  size: s.size,
                  color: s.color,
                  name: s.name || "",
                  image: "",
                  priceCents: 0,
                },
          );
        }
        MV.cart = [...map.values()];
        const missingMeta = MV.cart.filter((i) => !i.priceCents);
        if (missingMeta.length) {
          const ids = [...new Set(missingMeta.map((i) => i.productId))].join(
            ",",
          );
          const res = await MV.api.get(`/api/products?ids=${ids}&limit=60`);
          const byId = Object.fromEntries(res.products.map((p) => [p.id, p]));
          MV.cart = MV.cart
            .filter((i) => byId[i.productId])
            .map((i) => {
              const p = byId[i.productId];
              return {
                productId: p.id,
                name: p.name,
                image: p.images[0] || "",
                priceCents: MV.effectivePriceCents(p),
                qty: Math.min(i.qty, Math.max(p.stock, 1)),
                size: i.size,
                color: i.color,
                maxStock: p.stock,
              };
            });
        }
        MV.wish = new Set(serverWish.productIds);
        persistCart();
        updateBadges();
        MV.emit("cart");
        MV.emit("wish");
      } catch {}
    } else {
      try {
        MV.wish = new Set(JSON.parse(localStorage.getItem("mv-wish") || "[]"));
        updateBadges();
        MV.emit("wish");
      } catch {}
    }
    MV.booted = true;
    MV.emit("boot");
  }

  MV.bootPromise = boot();

  window.MV = MV;
})();
