(async () => {
  const params = new URLSearchParams(location.search);
  const grid = document.getElementById("shop-grid");
  const chipsEl = document.getElementById("shop-chips");
  const title = document.getElementById("shop-title");
  const countEl = document.getElementById("shop-count");
  const sortSel = document.getElementById("shop-sort");

  let products = [];

  const chipDefs = [
    { label: "All", href: "/shop.html", match: () => ![...params.keys()].some((k) => ["cat", "dept", "sale", "new", "trending"].includes(k)) },
    { label: "Women", href: "/shop.html?dept=women", match: () => params.get("dept") === "women" },
    { label: "Men", href: "/shop.html?dept=men", match: () => params.get("dept") === "men" },
    { label: "Dresses", href: "/shop.html?cat=dresses", match: () => params.get("cat") === "dresses" },
    { label: "Tops", href: "/shop.html?cat=tops", match: () => params.get("cat") === "tops" },
    { label: "Bottoms", href: "/shop.html?cat=bottoms", match: () => params.get("cat") === "bottoms" },
    { label: "Outerwear", href: "/shop.html?cat=outerwear", match: () => params.get("cat") === "outerwear" },
    { label: "Knitwear", href: "/shop.html?cat=knitwear", match: () => params.get("cat") === "knitwear" },
    { label: "Accessories", href: "/shop.html?cat=accessories", match: () => params.get("cat") === "accessories" },
    { label: "New In", href: "/shop.html?new=1", match: () => params.get("new") === "1" },
    { label: "Sale", href: "/shop.html?sale=1", match: () => params.get("sale") === "1" },
  ];

  chipsEl.innerHTML = chipDefs
    .map((c) => `<a class="chip${c.match() ? " on" : ""}" href="${c.href}">${c.label}</a>`)
    .join("");

  if (params.get("dept")) title.textContent = params.get("dept") === "women" ? "Women" : "Men";
  else if (params.get("sale")) title.textContent = "Sale";
  else if (params.get("new")) title.textContent = "New Arrivals";
  else if (params.get("trending")) title.textContent = "Trending Now";

  const qs = new URLSearchParams();
  for (const k of ["cat", "dept", "sale", "new", "trending", "q"]) if (params.get(k)) qs.set(k, params.get(k));
  qs.set("limit", "60");

  try {
    const data = await MV.api.get(`/api/products?${qs}`);
    products = data.products;
  } catch {
    grid.innerHTML = `<p class="grid-empty">Could not load the collection. Please refresh.</p>`;
    return;
  }

  function applySort() {
    const v = sortSel.value;
    if (v === "price-asc") products.sort((a, b) => MV.effectivePriceCents(a) - MV.effectivePriceCents(b));
    else if (v === "price-desc") products.sort((a, b) => MV.effectivePriceCents(b) - MV.effectivePriceCents(a));
    else if (v === "rating") products.sort((a, b) => b.rating - a.rating);
    MV.renderGrid(grid, products);
  }

  sortSel.addEventListener("change", applySort);
  countEl.textContent = `${products.length} ${products.length === 1 ? "piece" : "pieces"}`;
  if (!products.length)
    grid.innerHTML = `<p class="grid-empty">Nothing here yet — explore the full collection.</p>`;
  else applySort();
})();
