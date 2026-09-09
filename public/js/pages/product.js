(async () => {
  const params = new URLSearchParams(location.search);
  const idOrSlug = params.get("id") || params.get("slug");
  const layout = document.getElementById("product-layout");

  let product;
  try {
    product = (await MV.api.get(`/api/products/${encodeURIComponent(idOrSlug)}`)).product;
  } catch {
    layout.innerHTML = `<div class="panel"><h2>Piece not found</h2><p style="color:var(--muted)">This piece may have sold out or been retired.</p><p style="margin-top:1.4rem"><a class="btn btn-outline" href="/shop.html">Back to the Collection</a></p></div>`;
    return;
  }

  document.title = `${product.name} — Maison Velvet`;

  const colorList = product.colors || [];
  const sizeList = product.sizes || [];
  const variations = Array.isArray(product.variations) ? product.variations : [];
  const hasVariations = variations.length > 0;

  const comboKey = (color, size) => `${color}\u0000${size}`;
  const varByCombo = new Map(variations.map((v) => [comboKey(v.color?.name, v.size), v]));
  const sizesByColor = new Map();
  for (const v of variations) {
    const c = v.color?.name;
    if (!sizesByColor.has(c)) sizesByColor.set(c, []);
    sizesByColor.get(c).push(v.size);
  }
  const colorAvailable = (name) => (sizesByColor.get(name) || []).length > 0;
  const sizeAvailableFor = (color, size) => varByCombo.has(comboKey(color, size));

  let selSize;
  let selColor;
  if (hasVariations) {
    selColor = variations[0]?.color?.name ?? colorList[0]?.name ?? null;
    selSize = variations[0]?.size ?? null;
  } else {
    selSize = sizeList.length === 1 ? sizeList[0] : null;
    selColor = colorList[0]?.name ?? null;
  }
  let qty = 1;
  let activeVariation = hasVariations ? varByCombo.get(comboKey(selColor, selSize)) || null : null;

  const galleryHTML = `
    <div>
      <div class="gallery-main"><img id="gal-img" alt="${product.name}"></div>
      <div class="gallery-thumbs" id="gal-thumbs" hidden></div>
    </div>`;

  const infoHTML = `
    <div class="pd-info">
      <p class="pc-cat">${product.category?.name || ""}${product.dept !== "unisex" ? ` — ${product.dept}` : ""}</p>
      <h1 class="pd-title">${product.name}</h1>
      <div class="pd-rating">${MV.starsHTML(product.rating)}<span class="rev-count">${product.rating.toFixed(1)} · ${product.reviewsCount} reviews</span></div>
      <p class="pd-price-row" id="pd-price-row"></p>
      <p class="pd-desc">${product.description || ""}</p>

      ${sizeList.length ? `<p class="opt-label"><span>Select Size</span><a href="#" id="size-guide" style="text-decoration:underline;text-transform:none;letter-spacing:0">Size guide</a></p>
      <div class="size-opts" id="size-opts">${sizeList.map((s) => `<button class="size-btn${selSize === s ? " on" : ""}${hasVariations && !sizeAvailableFor(selColor, s) ? " off" : ""}" data-size="${s}">${s}</button>`).join("")}</div>` : ""}

      ${colorList.length ? `<p class="opt-label"><span>Colour — <em id="color-name" style="font-style:normal;color:var(--ink);letter-spacing:.05em">${selColor || ""}</em></span></p>
      <div class="color-opts" id="color-opts">${colorList
        .map((c) => `<button class="swatch${selColor === c.name ? " on" : ""}${hasVariations && !colorAvailable(c.name) ? " off" : ""}" data-color="${c.name}" aria-label="${c.name}"><i style="background:${c.hex}"></i>${c.name}</button>`)
        .join("")}</div>` : ""}

      <p class="combo-note" id="combo-note" hidden>This combination isn’t available — please choose another colour or size.</p>

      <div class="buy-row">
        <div class="qty-picker">
          <button id="qty-dec" aria-label="Decrease quantity">−</button>
          <span id="qty-val">1</span>
          <button id="qty-inc" aria-label="Increase quantity">+</button>
        </div>
        <button class="btn btn-solid" id="pd-add">Add to Bag</button>
        <button class="wish-toggle ${MV.wishHas(product.id) ? "active" : ""}" id="pd-wish" aria-label="Toggle wishlist">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.6 5 8.1 5c1.6 0 3 .8 3.9 2.1C12.9 5.8 14.3 5 15.9 5c2.5 0 4.6 2 4.6 4.6 0 3.7-3.5 6.9-8.5 10.9Z"/></svg>
        </button>
      </div>

      <p class="stock-note ${product.stock <= 0 ? "out" : product.stock <= 5 ? "low" : "ok"}" id="stock-note">
        ${product.stock <= 0 ? "Out of stock" : product.stock <= 5 ? `Only ${product.stock} left — limited availability` : "In stock & ready to ship"}
      </p>

      <div class="pd-meta">
        <span>SKU · ${product.sku}</span>
        <span>Complimentary shipping on orders over $150</span>
        <span>Free returns within 30 days</span>
      </div>
    </div>`;

  layout.innerHTML = galleryHTML + infoHTML;

  const galImg = document.getElementById("gal-img");
  const galThumbs = document.getElementById("gal-thumbs");

  function renderGallery(images) {
    const list = images && images.length ? images : [""];
    galImg.src = list[0];
    if (list.length > 1) {
      galThumbs.hidden = false;
      galThumbs.innerHTML = list
        .map((src, i) => `<button class="${i === 0 ? "on" : ""}" data-src="${src}" aria-label="View image ${i + 1}"><img src="${src}" alt=""></button>`)
        .join("");
    } else {
      galThumbs.hidden = true;
      galThumbs.innerHTML = "";
    }
  }

  galThumbs.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-src]");
    if (!btn) return;
    galImg.src = btn.dataset.src;
    MV.$$("#gal-thumbs button").forEach((b) => b.classList.remove("on"));
    btn.classList.add("on");
  });

  const addBtn = document.getElementById("pd-add");
  const note = document.getElementById("combo-note");
  const priceRow = document.getElementById("pd-price-row");

  const varPriceCents = (v) =>
    v?.price != null ? v.price : MV.effectivePriceCents(product);

  function renderPrice(v) {
    if (hasVariations && v && v.price != null) {
      priceRow.innerHTML = `<span class="pd-price">${MV.money(v.price)}</span>`;
      return;
    }
    const price = MV.effectivePriceCents(product);
    let html = `<span class="pd-price">${MV.money(price)}</span>`;
    if (product.salePriceCents) {
      html += `<s class="old">${MV.money(product.priceCents)}</s><span class="pill cancelled">Sale</span>`;
    }
    priceRow.innerHTML = html;
  }

  const availableSizes = (color) => (sizesByColor.get(color) || []).filter((s) => sizeList.includes(s));

  function refreshAvailability() {
    MV.$$("#color-opts .swatch").forEach((b) => {
      const off = hasVariations && !colorAvailable(b.dataset.color);
      b.classList.toggle("off", off);
      if (off && b.dataset.color === selColor) b.classList.remove("on");
    });
    MV.$$("#size-opts .size-btn").forEach((b) => {
      const off = hasVariations && !sizeAvailableFor(selColor, b.dataset.size);
      b.classList.toggle("off", off);
      if (off && b.dataset.size === selSize) {
        selSize = null;
        b.classList.remove("on");
      }
    });
  }

  function refresh() {
    if (hasVariations) {
      if (!selSize) {
        const avail = availableSizes(selColor);
        selSize = avail.length ? avail[0] : null;
      }
      activeVariation = varByCombo.get(comboKey(selColor, selSize)) || null;
    } else {
      activeVariation = null;
    }
    const comboOk = !hasVariations || !!activeVariation;
    renderGallery(comboOk && hasVariations && activeVariation ? activeVariation.images : product.images);
    renderPrice(activeVariation);
    note.hidden = !hasVariations || comboOk;
    const soldOut = product.stock <= 0;
    addBtn.disabled = soldOut || !comboOk;
    addBtn.textContent = soldOut ? "Sold Out" : comboOk ? "Add to Bag" : "Unavailable";
    refreshAvailability();
    MV.$$("#size-opts .size-btn").forEach((b) => b.classList.toggle("on", b.dataset.size === selSize));
    MV.$$("#color-opts .swatch").forEach((b) => b.classList.toggle("on", b.dataset.color === selColor));
  }

  if (sizeList.length) {
    document.getElementById("size-opts").addEventListener("click", (e) => {
      const b = e.target.closest(".size-btn");
      if (!b || b.classList.contains("off")) return;
      selSize = b.dataset.size;
      refresh();
    });
  }

  document.getElementById("color-opts")?.addEventListener("click", (e) => {
    const b = e.target.closest(".swatch");
    if (!b || b.classList.contains("off")) return;
    selColor = b.dataset.color;
    document.getElementById("color-name").textContent = selColor;
    refresh();
  });

  refresh();

  const qtyVal = document.getElementById("qty-val");
  const maxQty = Math.min(Math.max(product.stock, 1), 20);
  document.getElementById("qty-dec").addEventListener("click", () => {
    qty = Math.max(qty - 1, 1);
    qtyVal.textContent = qty;
  });
  document.getElementById("qty-inc").addEventListener("click", () => {
    qty = Math.min(qty + 1, maxQty);
    qtyVal.textContent = qty;
  });

  document.getElementById("pd-add").addEventListener("click", () => {
    if (sizeList.length && !selSize) {
      MV.toast("Please select a size");
      return;
    }
    if (hasVariations && !activeVariation) {
      MV.toast("This combination isn’t available");
      return;
    }
    MV.addToCart({
      productId: product.id,
      name: product.name,
      image: activeVariation?.images?.[0] || product.images[0] || "",
      priceCents: varPriceCents(activeVariation),
      size: selSize || "",
      color: selColor || "",
      variationId: activeVariation?.id || "",
      maxStock: product.stock,
      qty,
    });
    document.querySelector("#cart-drawer") && openCartDrawer();
  });

  function openCartDrawer() {
    MV.$("#cart-open").click();
  }

  document.getElementById("pd-wish").addEventListener("click", async () => {
    await MV.toggleWish(product.id, product.name);
    document.getElementById("pd-wish").classList.toggle("active", MV.wishHas(product.id));
  });

  const related = await MV.api
    .get(`/api/products?${product.category ? `cat=${product.category.slug}&` : ""}limit=8`)
    .catch(() => ({ products: [] }));
  const relGrid = document.getElementById("related-grid");
  const items = related.products.filter((p) => p.id !== product.id).slice(0, 4);
  if (items.length) {
    document.getElementById("related-sec").hidden = false;
    MV.renderGrid(relGrid, items);
  }
})();
