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

  let selSize = null;
  let selColor = product.colors[0]?.name || null;
  let qty = 1;

  const galleryHTML = `
    <div>
      <div class="gallery-main"><img id="gal-img" src="${product.images[0] || ""}" alt="${product.name}"></div>
      ${
        product.images.length > 1
          ? `<div class="gallery-thumbs" id="gal-thumbs">${product.images
              .map((src, i) => `<button class="${i === 0 ? "on" : ""}" data-src="${src}" aria-label="View image ${i + 1}"><img src="${src}" alt=""></button>`)
              .join("")}</div>`
          : ""
      }
    </div>`;

  const infoHTML = `
    <div class="pd-info">
      <p class="pc-cat">${product.category?.name || ""}${product.dept !== "unisex" ? ` — ${product.dept}` : ""}</p>
      <h1 class="pd-title">${product.name}</h1>
      <div class="pd-rating">${MV.starsHTML(product.rating)}<span class="rev-count">${product.rating.toFixed(1)} · ${product.reviewsCount} reviews</span></div>
      <p class="pd-price-row">
        <span class="pd-price">${MV.money(MV.effectivePriceCents(product))}</span>
        ${product.salePriceCents ? `<s class="old">${MV.money(product.priceCents)}</s><span class="pill cancelled">Sale</span>` : ""}
      </p>
      <p class="pd-desc">${product.description || ""}</p>

      ${product.sizes.length ? `<p class="opt-label"><span>Select Size</span><a href="#" id="size-guide" style="text-decoration:underline;text-transform:none;letter-spacing:0">Size guide</a></p>
      <div class="size-opts" id="size-opts">${product.sizes.map((s) => `<button class="size-btn${product.sizes.length === 1 ? " on" : ""}" data-size="${s}">${s}</button>`).join("")}</div>` : ""}

      ${product.colors.length ? `<p class="opt-label"><span>Colour — <em id="color-name" style="font-style:normal;color:var(--ink);letter-spacing:.05em">${selColor || ""}</em></span></p>
      <div class="color-opts" id="color-opts">${product.colors
        .map((c, i) => `<button class="swatch${i === 0 ? " on" : ""}" data-color="${c.name}" aria-label="${c.name}"><i style="background:${c.hex}"></i>${c.name}</button>`)
        .join("")}</div>` : ""}

      <div class="buy-row">
        <div class="qty-picker">
          <button id="qty-dec" aria-label="Decrease quantity">−</button>
          <span id="qty-val">1</span>
          <button id="qty-inc" aria-label="Increase quantity">+</button>
        </div>
        <button class="btn btn-solid" id="pd-add" ${product.stock <= 0 ? "disabled" : ""}>${
    product.stock > 0 ? "Add to Bag" : "Sold Out"
  }</button>
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
  document.getElementById("gal-thumbs")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-src]");
    if (!btn) return;
    galImg.src = btn.dataset.src;
    MV.$$("#gal-thumbs button").forEach((b) => b.classList.remove("on"));
    btn.classList.add("on");
  });

  if (product.sizes.length) {
    document.getElementById("size-opts").addEventListener("click", (e) => {
      const b = e.target.closest(".size-btn");
      if (!b) return;
      selSize = b.dataset.size;
      MV.$$("#size-opts .size-btn").forEach((x) => x.classList.toggle("on", x === b));
    });
    if (product.sizes.length === 1) selSize = product.sizes[0];
  }

  document.getElementById("color-opts")?.addEventListener("click", (e) => {
    const b = e.target.closest(".swatch");
    if (!b) return;
    selColor = b.dataset.color;
    document.getElementById("color-name").textContent = selColor;
    MV.$$("#color-opts .swatch").forEach((x) => x.classList.toggle("on", x === b));
  });

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
    if (product.sizes.length && !selSize) {
      MV.toast("Please select a size");
      return;
    }
    MV.addToCart({
      productId: product.id,
      name: product.name,
      image: product.images[0] || "",
      priceCents: MV.effectivePriceCents(product),
      size: selSize || "",
      color: selColor || "",
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
