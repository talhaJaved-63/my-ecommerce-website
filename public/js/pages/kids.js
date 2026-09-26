(async () => {
  await MV.bootPromise;

  const allGrid = document.getElementById("kids-all-grid");
  const filterEl = document.getElementById("kids-filter");
  const filterBtns = filterEl ? [...filterEl.querySelectorAll("[data-kids-filter]")] : [];

  let products = [];
  let activeFilter = "all";

  try {
    const data = await MV.api.get("/api/products?dept=kids&limit=60");
    products = data.products;
  } catch {
    allGrid.innerHTML = `<p class="grid-empty">Could not load the collection. Please refresh.</p>`;
    return;
  }

  const renderAllGrid = () => {
    if (!products.length) {
      allGrid.innerHTML = `<p class="grid-empty">The kids collection is being curated. Please check back shortly.</p>`;
      return;
    }
    const items =
      activeFilter === "all"
        ? products
        : products.filter((p) => p.category?.slug === activeFilter);
    if (items.length) MV.renderGrid(allGrid, items);
    else allGrid.innerHTML = `<p class="grid-empty">No Kids products found in this category.</p>`;
  };

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.dataset.kidsFilter;
      if (value === activeFilter) return;
      activeFilter = value;
      filterBtns.forEach((b) => b.classList.toggle("on", b === btn));
      renderAllGrid();
    });
  });

  renderAllGrid();
})();
