(async () => {
  await MV.bootPromise;

  const grids = {
    dresses: document.querySelector('.kids-grid[data-cat="dresses"]'),
    outerwear: document.querySelector('.kids-grid[data-cat="outerwear"]'),
    "shoes-accessories": document.querySelector('.kids-grid[data-cat="shoes-accessories"]'),
  };
  const sections = {
    dresses: document.getElementById("kids-dresses"),
    outerwear: document.getElementById("kids-outerwear"),
    "shoes-accessories": document.getElementById("kids-shoes-accessories"),
  };
  const allGrid = document.getElementById("kids-all-grid");

  let products = [];
  try {
    const data = await MV.api.get("/api/products?dept=kids&limit=60");
    products = data.products;
  } catch {
    allGrid.innerHTML = `<p class="grid-empty">Could not load the collection. Please refresh.</p>`;
    return;
  }

  for (const [key, grid] of Object.entries(grids)) {
    const section = sections[key];
    const items = products.filter((p) => p.category?.slug === key);
    if (!grid || !section) continue;
    if (!items.length) {
      section.hidden = true;
      continue;
    }
    MV.renderGrid(grid, items);
  }

  if (!products.length)
    allGrid.innerHTML = `<p class="grid-empty">The kids collection is being curated. Please check back shortly.</p>`;
  else MV.renderGrid(allGrid, products);
})();