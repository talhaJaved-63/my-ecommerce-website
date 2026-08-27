(async () => {
  await MV.bootPromise;

  const [trending, arrivals] = await Promise.all([
    MV.api.get("/api/products?trending=1&limit=8").catch(() => ({ products: [] })),
    MV.api.get("/api/products?new=1&limit=6").catch(() => ({ products: [] })),
  ]);

  const tGrid = document.getElementById("trending-grid");
  const aTrack = document.getElementById("arrivals-track");

  if (!trending.products.length)
    tGrid.innerHTML = `<p class="grid-empty">The collection is being curated. Please check back shortly.</p>`;
  else MV.renderGrid(tGrid, trending.products);

  if (!arrivals.products.length) aTrack.innerHTML = `<p class="grid-empty">New pieces are on their way.</p>`;
  else MV.renderGrid(aTrack, arrivals.products);

  const track = aTrack;
  document.getElementById("arr-prev").addEventListener("click", () => track.scrollBy({ left: -track.clientWidth * 0.6 }));
  document.getElementById("arr-next").addEventListener("click", () => track.scrollBy({ left: track.clientWidth * 0.6 }));
})();
