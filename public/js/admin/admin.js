(() => {
  "use strict";

  /* ------------------------------- helpers ------------------------------- */

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const money = (c) => usd.format((c || 0) / 100);

  const fmtDate = (s) => {
    try {
      return new Date(String(s).replace(" ", "T")).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return String(s || "").slice(0, 10);
    }
  };

  const pill = (s) => `<span class="pill ${esc(s)}">${esc(s)}</span>`;

  async function api(method, url, body) {
    const opts = { method };
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) {
      opts.headers = { "Content-Type": "application/json" };
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    let data = null;
    try {
      data = await res.json();
    } catch {}
    if (!res.ok) {
      const err = new Error(data?.error || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $("#adm-toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  /* ------------------------------ login page ----------------------------- */

  const loginForm = $("#admin-login-form");
  if (loginForm) {
    const msg = $("#al-msg");

    (async () => {
      try {
        const me = await api("GET", "/api/auth/me");
        if (me.user?.role === "admin") location.replace("/admin/dashboard.html");
      } catch {}
    })();

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.textContent = "";
      const email = $("#al-email").value.trim().toLowerCase();
      const password = $("#al-password").value;
      if (!email || !password) {
        msg.textContent = "Enter your email and password.";
        return;
      }
      const btn = loginForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Signing In…";
      try {
        const res = await api("POST", "/api/auth/login", { email, password });
        if (res.user?.role === "admin") {
          location.replace("/admin/dashboard.html");
          return;
        }
        await api("POST", "/api/auth/logout").catch(() => {});
        msg.textContent = "This account does not have admin access.";
      } catch (err) {
        msg.textContent = err.message;
      }
      btn.disabled = false;
      btn.textContent = "Sign In to Console";
    });
    return;
  }

  /* ---------------------------- dashboard boot --------------------------- */

  const root = $("#adm-root");
  if (!root) return;

  let me = null;
  let categories = [];

  (async () => {
    try {
      const res = await api("GET", "/api/auth/me");
      me = res.user;
      if (!me || me.role !== "admin") return location.replace("/admin/login.html");
    } catch {
      return location.replace("/admin/login.html");
    }
    $("#adm-user").textContent = `${me.name} · ${me.email}`;
    root.hidden = false;
    try {
      categories = (await api("GET", "/api/categories")).categories || [];
    } catch {}
    initNav();
    const initial = location.hash.replace("#", "");
    showView(["overview", "products", "inventory", "orders", "customers"].includes(initial) ? initial : "overview");
  })();

  $("#adm-signout").addEventListener("click", async () => {
    try {
      await api("POST", "/api/auth/logout");
    } catch {}
    location.replace("/admin/login.html");
  });

  /* -------------------------------- router ------------------------------- */

  const TITLES = { overview: "Overview", products: "Products", inventory: "Inventory", orders: "Orders", customers: "Customers" };
  let currentView = null;

  function initNav() {
    $$(".adm-nav button").forEach((b) =>
      b.addEventListener("click", () => {
        showView(b.dataset.view);
        history.replaceState(null, "", `#${b.dataset.view}`);
      })
    );
  }

  function showView(name) {
    if (currentView === name) return;
    currentView = name;
    $$(".adm-nav button").forEach((b) => b.classList.toggle("on", b.dataset.view === name));
    $$(".adm-view").forEach((s) => (s.hidden = s.id !== `view-${name}`));
    $("#adm-title").textContent = TITLES[name];
    ({ overview: loadOverview, products: loadProducts, inventory: loadInventory, orders: loadOrders, customers: loadCustomers })[name]();
  }

  /* ------------------------------- modal -------------------------------- */

  const overlay = $("#modal-overlay");
  const mBody = $("#modal-body");
  const mFoot = $("#modal-foot");

  function openModal(title, bodyHTML, footHTML) {
    $("#modal-title").textContent = title;
    mBody.innerHTML = bodyHTML;
    mBody.scrollTop = 0;
    if (footHTML) {
      mFoot.innerHTML = footHTML;
      mFoot.hidden = false;
    } else {
      mFoot.hidden = true;
      mFoot.innerHTML = "";
    }
    overlay.classList.add("show");
  }

  function closeModal() {
    overlay.classList.remove("show");
  }

  $("#modal-x").addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("show")) closeModal();
  });

  /* ------------------------------- overview ------------------------------ */

  async function loadOverview() {
    const el = $("#view-overview");
    try {
      const s = await api("GET", "/api/admin/stats");
      const pend = s.ordersByStatus?.pending || 0;
      const badge = $("#nav-pending");
      badge.hidden = pend === 0;
      badge.textContent = pend;

      const statusChips = Object.entries(s.ordersByStatus || {})
        .map(([k, v]) => `<span class="pill ${esc(k)}">${esc(k)} ${v}</span>`)
        .join(" ");

      el.innerHTML = `
        <div class="stat-grid">
          <div class="stat-card"><p class="stat-label">Total Sales</p><p class="stat-value">${money(s.revenueCents)}</p><p class="stat-sub">Paid orders, lifetime</p></div>
          <div class="stat-card"><p class="stat-label">Orders</p><p class="stat-value">${s.ordersTotal}</p><p class="stat-sub">${statusChips || "—"}</p></div>
          <div class="stat-card"><p class="stat-label">Customers</p><p class="stat-value">${s.customers}</p><p class="stat-sub">Registered accounts</p></div>
          <div class="stat-card"><p class="stat-label">Active Products</p><p class="stat-value">${s.productsActive}</p><p class="stat-sub">${(s.lowStock || []).length} low-stock alert${(s.lowStock || []).length === 1 ? "" : "s"}</p></div>
        </div>

        <div class="two-col">
          <div class="card card-pad">
            <h3>Low Stock <span class="flag">under 6 units</span></h3>
            ${
              (s.lowStock || []).length
                ? `<table class="adm" style="min-width:0"><tbody>
                    ${s.lowStock
                      .map(
                        (p) => `<tr style="cursor:pointer" data-inv="${p.id}">
                          <td><span class="row-name">${esc(p.name)}</span><span class="row-sub"> · ${esc(p.sku)}</span></td>
                          <td class="t-num"><span class="stock-chip ${p.stock === 0 ? "zero" : "low"}">${p.stock} left</span></td>
                        </tr>`
                      )
                      .join("")}
                  </tbody></table>`
                : `<p class="empty">All stocked up. Nothing running low.</p>`
            }
          </div>

          <div class="card card-pad">
            <h3>Recent Orders</h3>
            ${
              (s.recentOrders || []).length
                ? `<table class="adm" style="min-width:0"><tbody>
                    ${s.recentOrders
                      .map(
                        (o) => `<tr style="cursor:pointer" data-order="${o.id}">
                          <td><span class="row-name">${esc(o.number)}</span><br><span class="row-sub">${esc(o.fullName || "Guest")} · ${fmtDate(o.placedAt)}</span></td>
                          <td>${pill(o.status)}</td>
                          <td class="t-num">${money(o.totalCents)}</td>
                        </tr>`
                      )
                      .join("")}
                  </tbody></table>`
                : `<p class="empty">No orders yet.</p>`
            }
          </div>
        </div>

        ${
          (s.topSellers || []).length
            ? `<div class="card card-pad" style="margin-top:1.1rem">
                <h3>Top Sellers</h3>
                <table class="adm" style="min-width:0"><tbody>
                  ${s.topSellers
                    .map(
                      (t, i) => `<tr>
                        <td style="width:34px;color:var(--accent)">${i + 1}</td>
                        <td>${esc(t.name)}</td>
                        <td class="t-num">${t.units} sold</td>
                        <td class="t-num">${money(t.revenueCents)}</td>
                      </tr>`
                    )
                    .join("")}
                </tbody></table>
              </div>`
            : ""
        }`;

      $$("#view-overview [data-order]").forEach((r) => r.addEventListener("click", () => openOrderDetail(r.dataset.order)));
      $$("#view-overview [data-inv]").forEach((r) =>
        r.addEventListener("click", () => {
          $("#inv-low").checked = true;
          showView("inventory");
        })
      );
    } catch (e) {
      el.innerHTML = `<p class="empty">${esc(e.message)}</p>`;
    }
  }

  /* ------------------------------- products ------------------------------ */

  let prodTimer = null;

  $("#prod-q").addEventListener("input", () => {
    clearTimeout(prodTimer);
    prodTimer = setTimeout(loadProducts, 300);
  });
  $("#prod-status").addEventListener("change", loadProducts);
  $("#prod-add").addEventListener("click", () => openProductModal(null));

  async function loadProducts() {
    const box = $("#prod-table");
    try {
      const q = $("#prod-q").value.trim();
      const status = $("#prod-status").value;
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      const res = await api("GET", `/api/admin/products?${params}`);
      const items = res.products || [];
      $("#prod-count").textContent = `${items.length} product${items.length === 1 ? "" : "s"}`;
      if (!items.length) {
        box.innerHTML = `<div class="card"><p class="empty">No products match.</p></div>`;
        return;
      }
      box.innerHTML = `
        <div class="table-wrap"><table class="adm">
          <thead><tr>
            <th></th><th>Product</th><th>Category</th><th class="t-num">Price</th>
            <th class="t-num">Stock</th><th>Status</th><th>Updated</th><th></th>
          </tr></thead>
          <tbody>
            ${items
              .map(
                (p) => `<tr>
                  <td><img class="row-thumb" src="${esc(p.images[0] || "")}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"></td>
                  <td>
                    <span class="row-name">${esc(p.name)}</span>${
                      p.isTrending ? '<span class="flag">Trend</span>' : ""
                    }${p.isNew ? '<span class="flag">New</span>' : ""}${p.badge ? `<span class="flag">${esc(p.badge)}</span>` : ""}
                    <br><span class="row-sub">${esc(p.sku)} · ${esc(p.dept)}</span>
                  </td>
                  <td>${esc(p.categoryName || "—")}</td>
                  <td class="t-num">${
                    p.salePriceCents
                      ? `<s style="color:var(--muted)">${money(p.priceCents)}</s> ${money(p.salePriceCents)}`
                      : money(p.priceCents)
                  }</td>
                  <td class="t-num"><span class="stock-chip ${p.stock === 0 ? "zero" : p.stock < 6 ? "low" : ""}">${p.stock}</span></td>
                  <td>${pill(p.status)}</td>
                  <td><span class="row-sub">${fmtDate(p.updatedAt)}</span></td>
                  <td class="t-num" style="white-space:nowrap">
                    <button type="button" class="btn btn-sm" data-edit="${p.id}">Edit</button>
                    <button type="button" class="btn btn-sm btn-danger" data-del="${p.id}">Delete</button>
                  </td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table></div>`;

      const byId = Object.fromEntries(items.map((p) => [p.id, p]));
      $$("#prod-table [data-edit]").forEach((b) => b.addEventListener("click", () => openProductModal(byId[b.dataset.edit])));
      $$("#prod-table [data-del]").forEach((b) =>
        b.addEventListener("click", async () => {
          const p = byId[b.dataset.del];
          if (!confirm(`Delete “${p.name}”?`)) return;
          try {
            const res = await api("DELETE", `/api/admin/products/${p.id}`);
            toast(res.archived ? res.message : "Product deleted.");
            loadProducts();
          } catch (e) {
            toast(e.message);
          }
        })
      );
    } catch (e) {
      box.innerHTML = `<p class="empty">${esc(e.message)}</p>`;
    }
  }

  /* --------------------------- product editor ---------------------------- */

  function openProductModal(p) {
    const isEdit = !!p;
    const imgs = [...(p?.images || [])];
    const colors = (p?.colors || []).map((c) => ({ ...c }));

    const catOpts =
      [`<option value="">— None —</option>`]
        .concat(categories.map((c) => `<option value="${c.id}" ${p?.categoryId === c.id ? "selected" : ""}>${esc(c.name)}</option>`))
        .join("");

    const badges = ["New", "Trending", "Best Seller", "Limited"];

    const formHTML = `
      <form id="p-form" class="form-grid" novalidate>
        <div class="field span-2">
          <label for="p-name">Product Name *</label>
          <input class="input" id="p-name" value="${esc(p?.name || "")}" maxlength="120" required>
        </div>
        ${
          isEdit
            ? `<div class="field"><label>SKU</label><input class="input" value="${esc(p.sku)}" disabled><span class="field-hint">SKU cannot be changed.</span></div>`
            : `<div class="field"><label for="p-sku">SKU</label><input class="input" id="p-sku" placeholder="Auto-generated if blank"></div>`
        }
        <div class="field">
          <label for="p-status">Status</label>
          <select class="select" id="p-status">
            ${["draft", "active", "archived"].map((s) => `<option ${p?.status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="p-cat">Category</label>
          <select class="select" id="p-cat">${catOpts}</select>
        </div>
        <div class="field">
          <label for="p-dept">Department</label>
          <select class="select" id="p-dept">
            ${["unisex", "women", "men"].map((d) => `<option ${p?.dept === d ? "selected" : ""}>${d}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="p-badge">Badge</label>
          <select class="select" id="p-badge">
            <option value="">— None —</option>
            ${badges.map((b) => `<option ${p?.badge === b ? "selected" : ""}>${b}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="p-price">Price (USD) *</label>
          <input class="input" id="p-price" type="number" min="0.01" step="0.01" value="${p ? (p.priceCents / 100).toFixed(2) : ""}" required>
        </div>
        <div class="field">
          <label for="p-sale">Sale Price (USD)</label>
          <input class="input" id="p-sale" type="number" min="0.01" step="0.01" value="${p?.salePriceCents ? (p.salePriceCents / 100).toFixed(2) : ""}">
          <span class="field-hint">Leave blank for no sale. Must be below regular price.</span>
        </div>
        <div class="field">
          <label for="p-stock">Stock</label>
          <input class="input" id="p-stock" type="number" min="0" step="1" value="${p?.stock ?? 0}">
        </div>
        <div class="check-row">
          <input type="checkbox" id="p-trend" ${p?.isTrending ? "checked" : ""}>
          <label for="p-trend" style="text-transform:none;letter-spacing:0;font-size:.84rem;color:var(--ink)">Mark as Trending / Featured</label>
        </div>
        <div class="check-row" style="padding-top:0">
          <input type="checkbox" id="p-new" ${p?.isNew ? "checked" : ""}>
          <label for="p-new" style="text-transform:none;letter-spacing:0;font-size:.84rem;color:var(--ink)">Mark as New Arrival</label>
        </div>
        <div class="field">
          <label for="p-rating">Rating (0–5)</label>
          <input class="input" id="p-rating" type="number" min="0" max="5" step="0.1" value="${p?.rating ?? 0}">
        </div>
        <div class="field">
          <label for="p-reviews">Review Count</label>
          <input class="input" id="p-reviews" type="number" min="0" step="1" value="${p?.reviewsCount ?? 0}">
        </div>
        <div class="field span-2">
          <label for="p-desc">Description</label>
          <textarea class="input" id="p-desc" rows="4" maxlength="4000">${esc(p?.description || "")}</textarea>
        </div>
        <div class="field">
          <label for="p-sizes">Sizes</label>
          <input class="input" id="p-sizes" value="${esc((p?.sizes || []).join(", "))}" placeholder="XS, S, M, L, XL">
          <span class="field-hint">Comma-separated, up to 15.</span>
        </div>
        <div class="field">
          <label>Colors</label>
          <div class="color-rows" id="color-rows"></div>
          <button type="button" class="btn btn-sm" id="color-add" style="justify-self:start;margin-top:.3rem">+ Add Color</button>
        </div>
        <div class="field span-2">
          <label>Images (up to 8)</label>
          <div class="img-grid" id="img-grid"></div>
          <label class="upload-zone" style="margin-top:.7rem">
            <strong>+ Upload images</strong>
            <span class="field-hint">JPG, PNG, WebP or AVIF · max 5 MB each · multiple files allowed</span>
            <input type="file" id="p-files" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden>
          </label>
        </div>
        <p class="form-msg err span-2" id="p-msg" role="alert"></p>
      </form>`;

    openModal(isEdit ? `Edit — ${p.name}` : "Add Product", formHTML);

    // Keep the colors[] state array in lockstep with what the admin has typed
    // BEFORE any re-render, otherwise typed values would be wiped by rebuilds.
    const syncColors = () => {
      $$("#color-rows .color-row").forEach((row, i) => {
        if (!colors[i]) return;
        colors[i].name = $('input[name="cname"]', row).value;
        colors[i].hex = $('input[type="color"]', row).value;
      });
    };

    const renderColors = () => {
      const box = $("#color-rows");
      box.innerHTML = colors
        .map(
          (c, i) => `<div class="color-row">
            <input class="input" name="cname" placeholder="Color name" value="${esc(c.name)}" maxlength="24" aria-label="Color name ${i + 1}">
            <input type="color" value="${/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#cccccc"}" aria-label="Color swatch ${i + 1}">
            <button type="button" class="rm" aria-label="Remove color">×</button>
          </div>`
        )
        .join("");
      $$(".color-row", box).forEach((row, i) => {
        $(".rm", row).addEventListener("click", () => {
          syncColors();
          colors.splice(i, 1);
          renderColors();
        });
      });
    };

    $("#color-rows").addEventListener("input", syncColors);

    $("#color-add").addEventListener("click", () => {
      syncColors();
      colors.push({ name: "", hex: "#cccccc" });
      renderColors();
      $$('#color-rows input[name="cname"]').pop()?.focus();
    });
    renderColors();

    const renderImgs = () => {
      $("#img-grid").innerHTML = imgs
        .map(
          (u, i) => `<div class="img-cell">
            <img src="${esc(u)}" alt="Image ${i + 1}">
            <button type="button" class="rm" data-i="${i}" aria-label="Remove image">×</button>
          </div>`
        )
        .join("");
      $$("#img-grid .rm").forEach((b) =>
        b.addEventListener("click", () => {
          const [u] = imgs.splice(Number(b.dataset.i), 1);
          if (u.startsWith("/uploads/") && !(p?.images || []).includes(u)) {
            api("DELETE", `/api/admin/upload?url=${encodeURIComponent(u)}`).catch(() => {});
          }
          renderImgs();
        })
      );
    };
    renderImgs();

    $("#p-files").addEventListener("change", async (e) => {
      const files = [...e.target.files];
      e.target.value = "";
      if (!files.length) return;
      const room = 8 - imgs.length;
      if (room <= 0) return $("#p-msg").textContent = "Maximum of 8 images reached.";
      const batch = files.slice(0, room);
      if (files.length > room) toast(`Only ${room} more image${room === 1 ? "" : "s"} allowed — extra files skipped.`);
      const fd = new FormData();
      batch.forEach((f) => fd.append("files", f));
      $("#p-msg").textContent = "";
      try {
        const res = await api("POST", "/api/admin/upload", fd);
        imgs.push(...res.urls);
        renderImgs();
      } catch (err) {
        $("#p-msg").textContent = err.message;
      }
    });

    mFoot.innerHTML = `
      <button type="button" class="btn" id="p-cancel">Cancel</button>
      <span class="actions"><button type="button" class="btn btn-solid" id="p-save">${isEdit ? "Save Changes" : "Create Product"}</button></span>`;
    mFoot.hidden = false;
    $("#p-cancel").addEventListener("click", closeModal);
    $("#p-save").addEventListener("click", async () => {
      const msg = $("#p-msg");
      msg.textContent = "";

      const cents = (v) => Math.round(parseFloat(v) * 100);
      const priceCents = cents($("#p-price").value);
      if (!$("#p-name").value.trim()) return (msg.textContent = "Product name is required.");
      if (!(priceCents > 0)) return (msg.textContent = "Price must be greater than zero.");
      const saleRaw = $("#p-sale").value;
      const salePriceCents = saleRaw === "" ? null : cents(saleRaw);

      const payload = {
        name: $("#p-name").value.trim(),
        description: $("#p-desc").value.trim(),
        status: $("#p-status").value,
        dept: $("#p-dept").value,
        categoryId: $("#p-cat").value || null,
        badge: $("#p-badge").value || null,
        priceCents,
        salePriceCents,
        stock: parseInt($("#p-stock").value, 10) || 0,
        rating: parseFloat($("#p-rating").value) || 0,
        reviewsCount: parseInt($("#p-reviews").value, 10) || 0,
        isTrending: $("#p-trend").checked,
        isNew: $("#p-new").checked,
        sizes: $("#p-sizes").value.split(",").map((s) => s.trim()).filter(Boolean),
        colors: colors.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), hex: c.hex })),
        images: imgs,
      };

      const saveBtn = $("#p-save");
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
      try {
        if (isEdit) {
          await api("PUT", `/api/admin/products/${p.id}`, payload);
          toast("Product updated.");
        } else {
          const sku = $("#p-sku").value.trim();
          if (sku) payload.sku = sku;
          await api("POST", "/api/admin/products", payload);
          toast("Product created.");
        }
        closeModal();
        loadProducts();
      } catch (err) {
        msg.textContent = err.message;
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? "Save Changes" : "Create Product";
      }
    });
  }

  /* ------------------------------ inventory ------------------------------ */

  $("#inv-low").addEventListener("change", loadInventory);

  async function loadInventory() {
    const box = $("#inv-table");
    try {
      const low = $("#inv-low").checked;
      const res = await api("GET", `/api/admin/products${low ? "?lowstock=1" : ""}`);
      const items = (res.products || []).slice().sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
      $("#inv-count").textContent = `${items.length} item${items.length === 1 ? "" : "s"}${low ? " under 6 units" : ""}`;
      if (!items.length) {
        box.innerHTML = `<div class="card"><p class="empty">${low ? "Nothing is running low." : "No products yet."}</p></div>`;
        return;
      }
      box.innerHTML = `
        <div class="table-wrap"><table class="adm">
          <thead><tr><th></th><th>Product</th><th>Category</th><th class="t-num">Current Stock</th><th class="t-num">Set Stock</th><th></th></tr></thead>
          <tbody>
            ${items
              .map(
                (p) => `<tr class="${p.stock < 6 ? "low" : ""}" data-id="${p.id}">
                  <td><img class="row-thumb" src="${esc(p.images[0] || "")}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"></td>
                  <td><span class="row-name">${esc(p.name)}</span><br><span class="row-sub">${esc(p.sku)}</span></td>
                  <td>${esc(p.categoryName || "—")}</td>
                  <td class="t-num"><span class="stock-chip ${p.stock === 0 ? "zero" : p.stock < 6 ? "low" : ""}">${p.stock}</span></td>
                  <td class="t-num"><input type="number" class="inline-stock" min="0" step="1" value="${p.stock}" aria-label="New stock for ${esc(p.name)}"></td>
                  <td class="t-num"><button type="button" class="btn btn-sm btn-solid" data-save="${p.id}">Save</button></td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table></div>`;

      $$("#inv-table tr[data-id]").forEach((row) => {
        const id = row.dataset.id;
        const input = $(".inline-stock", row);
        const save = async () => {
          const v = parseInt(input.value, 10);
          if (!Number.isFinite(v) || v < 0) return toast("Enter a valid stock number.");
          try {
            const r = await api("PATCH", `/api/admin/products/${id}/stock`, { stock: v });
            toast(`Stock updated to ${r.stock}.`);
            loadInventory();
          } catch (e) {
            toast(e.message);
          }
        };
        $(`[data-save="${id}"]`, row).addEventListener("click", save);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") save();
        });
      });
    } catch (e) {
      box.innerHTML = `<p class="empty">${esc(e.message)}</p>`;
    }
  }

  /* -------------------------------- orders ------------------------------- */

  let ordTimer = null;
  $("#ord-q").addEventListener("input", () => {
    clearTimeout(ordTimer);
    ordTimer = setTimeout(loadOrders, 300);
  });
  $("#ord-status").addEventListener("change", loadOrders);
  $("#ord-payment").addEventListener("change", loadOrders);

  async function loadOrders() {
    const box = $("#ord-table");
    try {
      const params = new URLSearchParams();
      const q = $("#ord-q").value.trim();
      const status = $("#ord-status").value;
      const pay = $("#ord-payment").value;
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (pay) params.set("payment", pay);
      const res = await api("GET", `/api/admin/orders?${params}`);
      const items = res.orders || [];
      $("#ord-count").textContent = `${items.length} order${items.length === 1 ? "" : "s"}`;
      if (!items.length) {
        box.innerHTML = `<div class="card"><p class="empty">No orders match.</p></div>`;
        return;
      }
      box.innerHTML = `
        <div class="table-wrap"><table class="adm">
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th class="t-num">Units</th><th class="t-num">Total</th><th>Payment</th><th>Status</th></tr></thead>
          <tbody>
            ${items
              .map(
                (o) => `<tr class="clickable" data-id="${o.id}">
                  <td><span class="row-name">${esc(o.number)}</span></td>
                  <td><span class="row-sub">${fmtDate(o.placedAt)}</span></td>
                  <td>${esc(o.fullName || "Guest")}<br><span class="row-sub">${esc(o.email || "")}</span></td>
                  <td class="t-num">${o.unit_count ?? o.items?.length ?? "—"}</td>
                  <td class="t-num">${money(o.totalCents)}</td>
                  <td>${pill(o.paymentStatus)}</td>
                  <td>${pill(o.status)}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table></div>`;

      $$("#ord-table tr[data-id]").forEach((r) => r.addEventListener("click", () => openOrderDetail(r.dataset.id)));
    } catch (e) {
      box.innerHTML = `<p class="empty">${esc(e.message)}</p>`;
    }
  }

  async function openOrderDetail(id) {
    let o;
    try {
      o = (await api("GET", `/api/admin/orders/${id}`)).order;
    } catch (e) {
      return toast(e.message);
    }

    const providerLabel = o.paymentProvider === "stripe" ? "Card · Stripe" : o.paymentProvider === "demo" ? "Demo Payment" : esc(o.paymentProvider || "—");

    mBody.innerHTML = `
      <div class="od-grid">
        <div>
          <p class="section-label">Items</p>
          <div class="od-items">
            ${o.items
              .map(
                (i) => `<div class="od-item">
                  <img src="${esc(i.image || "")}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
                  <div><p class="n">${esc(i.name)}</p><p class="m">${[i.size, i.color].filter(Boolean).map(esc).join(" · ") || "—"} · Qty ${i.qty}${i.productId ? "" : " · product removed"}</p></div>
                  <span class="p">${money(i.priceCents * i.qty)}</span>
                </div>`
              )
              .join("")}
          </div>
          <div class="totals-box" style="margin-top:1rem">
            <div><span>Subtotal</span><span>${money(o.subtotalCents)}</span></div>
            <div><span>Shipping</span><span>${o.shippingCents === 0 ? "Free" : money(o.shippingCents)}</span></div>
            <div class="grand"><span>Total</span><span>${money(o.totalCents)}</span></div>
          </div>
          <p class="section-label" style="margin-top:1.4rem">Fulfillment</p>
          <dl class="kv">
            <dt>Ship to</dt><dd>${esc(o.fullName)}<br>${esc(o.address)}${o.address2 ? `, ${esc(o.address2)}` : ""}<br>${esc([o.city, o.region].filter(Boolean).join(", "))} ${esc(o.postal || "")}<br>${esc(o.country)}</dd>
            <dt>Phone</dt><dd>${esc(o.phone || "—")}</dd>
            <dt>Contact</dt><dd>${esc(o.email || "—")}</dd>
            <dt>Account</dt><dd>${o.account ? `${esc(o.account.name)} (${esc(o.account.email)}), joined ${fmtDate(o.account.created_at)}` : "Guest checkout"}</dd>
            <dt>Placed</dt><dd>${fmtDate(o.placedAt)}</dd>
            <dt>Updated</dt><dd>${fmtDate(o.updatedAt)}</dd>
          </dl>
        </div>
        <div>
          <p class="section-label">Management</p>
          <div class="ctrl-grid">
            <div class="field">
              <label for="o-status">Order Status</label>
              <select class="select" id="o-status">
                ${["pending", "processing", "shipped", "delivered", "cancelled"].map((s) => `<option ${o.status === s ? "selected" : ""}>${s}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="o-pay">Payment Status</label>
              <select class="select" id="o-pay">
                ${["unpaid", "paid", "failed", "refunded"].map((s) => `<option ${o.paymentStatus === s ? "selected" : ""}>${s}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="o-carrier">Carrier</label>
              <input class="input" id="o-carrier" value="${esc(o.carrier || "")}" maxlength="60" placeholder="DHL, UPS, La Poste…">
            </div>
            <div class="field">
              <label for="o-tracking">Tracking Number</label>
              <input class="input" id="o-tracking" value="${esc(o.trackingNumber || "")}" maxlength="80">
            </div>
            <div class="field span-2">
              <label for="o-notes">Internal Notes</label>
              <textarea class="input" id="o-notes" rows="3" maxlength="1000">${esc(o.notes || "")}</textarea>
            </div>
            <p class="form-msg err span-2" id="o-msg" role="alert"></p>
            <p class="field-hint span-2">Cancelling a paid order automatically restores product stock and marks the payment refunded, matching the store's Stripe policy.</p>
          </div>
        </div>
      </div>`;

    openModal(`Order ${o.number}`, mBody.innerHTML, "");

    const canCancel = o.status !== "cancelled";
    mFoot.innerHTML = `
      ${canCancel ? `<button type="button" class="btn btn-danger" id="o-cancel">Cancel Order</button>` : "<span></span>"}
      <span class="actions">
        <button type="button" class="btn" id="o-close">Close</button>
        <button type="button" class="btn btn-solid" id="o-save">Save Changes</button>
      </span>`;
    mFoot.hidden = false;

    $("#o-close").addEventListener("click", closeModal);

    $("#o-save").addEventListener("click", async () => {
      const msg = $("#o-msg");
      msg.textContent = "";
      const btn = $("#o-save");
      btn.disabled = true;
      btn.textContent = "Saving…";
      try {
        await api("PATCH", `/api/admin/orders/${o.id}`, {
          status: $("#o-status").value,
          paymentStatus: $("#o-pay").value,
          carrier: $("#o-carrier").value,
          trackingNumber: $("#o-tracking").value,
          notes: $("#o-notes").value,
        });
        toast("Order updated.");
        closeModal();
        if (currentView === "orders") loadOrders();
        if (currentView === "overview") loadOverview();
      } catch (e) {
        msg.textContent = e.message;
        btn.disabled = false;
        btn.textContent = "Save Changes";
      }
    });

    if (canCancel) {
      $("#o-cancel").addEventListener("click", async () => {
        const wasPaid = o.paymentStatus === "paid";
        if (
          !confirm(
            `Cancel order ${o.number}?\n\n` +
              (wasPaid
                ? "Paid order: product stock will be restored and the payment will be marked REFUNDED."
                : "Product stock will be restored for any reserved items.")
          )
        )
          return;
        const btn = $("#o-cancel");
        btn.disabled = true;
        btn.textContent = "Cancelling…";
        try {
          const res = await api("PATCH", `/api/admin/orders/${o.id}`, { status: "cancelled" });
          toast(
            wasPaid && res.order.paymentStatus === "refunded"
              ? "Order cancelled — stock restored, payment marked refunded."
              : "Order cancelled — stock restored."
          );
          closeModal();
          if (currentView === "orders") loadOrders();
          if (currentView === "overview") loadOverview();
        } catch (e) {
          toast(e.message);
          btn.disabled = false;
          btn.textContent = "Cancel Order";
        }
      });
    }
  }

  /* ------------------------------ customers ------------------------------ */

  $("#cus-q").addEventListener("input", renderCustomers);

  let customersCache = [];

  async function loadCustomers() {
    const box = $("#cus-table");
    try {
      customersCache = (await api("GET", "/api/admin/customers")).customers || [];
      renderCustomers();
    } catch (e) {
      box.innerHTML = `<p class="empty">${esc(e.message)}</p>`;
    }
  }

  function renderCustomers() {
    const box = $("#cus-table");
    const q = $("#cus-q").value.trim().toLowerCase();
    const items = customersCache.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
    $("#cus-count").textContent = `${items.length} customer${items.length === 1 ? "" : "s"}`;
    if (!items.length) {
      box.innerHTML = `<div class="card"><p class="empty">${q ? "No customers match." : "No customers yet."}</p></div>`;
      return;
    }
    box.innerHTML = `
      <div class="table-wrap"><table class="adm">
        <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Joined</th><th class="t-num">Orders</th><th class="t-num">Lifetime Spend</th><th></th></tr></thead>
        <tbody>
          ${items
            .map(
              (c) => `<tr>
                <td><span class="row-sub">${c.id}</span></td>
                <td><span class="row-name">${esc(c.name)}</span></td>
                <td>${esc(c.email)}</td>
                <td><span class="row-sub">${fmtDate(c.joinedAt)}</span></td>
                <td class="t-num">${c.orders}</td>
                <td class="t-num">${money(c.spentCents)}</td>
                <td class="t-num"><button type="button" class="btn btn-sm" data-cust="${esc(c.email)}" data-nm="${esc(c.name)}">View Orders</button></td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table></div>`;

    $$("#cus-table [data-cust]").forEach((b) =>
      b.addEventListener("click", () => openCustomerOrders(b.dataset.cust, b.dataset.nm))
    );
  }

  async function openCustomerOrders(email, name) {
    openModal(`Orders — ${name}`, `<p class="skeleton-note">Loading…</p>`, "");
    try {
      const res = await api("GET", `/api/admin/orders?q=${encodeURIComponent(email)}`);
      const mine = (res.orders || []).filter((o) => (o.email || "").toLowerCase() === email.toLowerCase());
      mBody.innerHTML = mine.length
        ? `<div class="table-wrap" style="border:none"><table class="adm">
            <thead><tr><th>Order</th><th>Date</th><th class="t-num">Total</th><th>Payment</th><th>Status</th></tr></thead>
            <tbody>
              ${mine
                .map(
                  (o) => `<tr style="cursor:pointer" data-jump="${o.id}">
                    <td><span class="row-name">${esc(o.number)}</span></td>
                    <td><span class="row-sub">${fmtDate(o.placedAt)}</span></td>
                    <td class="t-num">${money(o.totalCents)}</td>
                    <td>${pill(o.paymentStatus)}</td>
                    <td>${pill(o.status)}</td>
                  </tr>`
                )
                .join("")}
            </tbody>
          </table></div>`
        : `<p class="empty">No orders for this customer yet.</p>`;
      $$("#modal-body [data-jump]").forEach((r) =>
        r.addEventListener("click", () => {
          closeModal();
          showView("orders");
          openOrderDetail(r.dataset.jump);
        })
      );
    } catch (e) {
      mBody.innerHTML = `<p class="empty">${esc(e.message)}</p>`;
    }
  }
})();
