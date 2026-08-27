(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const form = $("#track-form");
  if (!form) return;

  const msg = $("#track-msg");
  const resultEl = $("#track-result");
  const params = new URLSearchParams(location.search);

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const money = (c) => MV.money(c);

  const fmtDate = (s) => {
    try {
      return new Date(String(s).replace(" ", "T")).toLocaleDateString(undefined, {
        year: "numeric", month: "long", day: "numeric",
      });
    } catch {
      return String(s || "").slice(0, 10);
    }
  };

  const FLOW = ["pending", "processing", "shipped", "delivered"];
  const LABELS = { pending: "Confirmed", processing: "Processing", shipped: "Shipped", delivered: "Delivered" };

  function timelineHTML(status) {
    const idx = FLOW.indexOf(status);
    const cancelled = status === "cancelled";
    const steps = FLOW.map(
      (s, i) => `
      <div class="tl-step${!cancelled && i <= idx ? " done" : ""}">
        <span class="tl-dot"></span>${LABELS[s]}
      </div>`
    ).join("");
    const cancelStep = cancelled
      ? `<div class="tl-step cancelled"><span class="tl-dot"></span>Cancelled</div>`
      : "";
    return `<div class="timeline">${steps}${cancelStep}</div>`;
  }

  function setError(text) {
    msg.textContent = text;
    msg.className = text ? "form-msg err span-2" : "form-msg span-2";
  }

  async function lookup(number, email) {
    setError("");
    resultEl.hidden = true;
    try {
      const res = await MV.api.get(
        `/api/track?number=${encodeURIComponent(number)}&email=${encodeURIComponent(email)}`
      );
      renderOrder(res.order);
    } catch (e) {
      setError(e.message || "Could not find that order.");
    }
  }

  function renderOrder(o) {
    resultEl.innerHTML = `
      <article class="order-card open">
        <div class="oc-head" style="cursor:default">
          <div>
            <p class="oc-num">${esc(o.number)}</p>
            <p class="oc-date">Placed ${fmtDate(o.placedAt)}</p>
          </div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end">
            <span class="pill ${o.paymentStatus}">${esc(o.paymentStatus)}</span>
            <span class="pill ${o.status}">${esc(o.status)}</span>
          </div>
        </div>
        <div class="oc-body" style="display:block">
          ${timelineHTML(o.status)}
          ${
            o.carrier || o.trackingNumber
              ? `<div class="tracking-box">
                   <span>Carrier: <strong>${esc(o.carrier || "—")}</strong>${
                   o.trackingNumber ? ` · Tracking: <strong>${esc(o.trackingNumber)}</strong>` : ""
                 }</span>
                 </div>`
              : ""
          }
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
          <div class="addr-block">
            Ship to — ${esc(o.fullName)}, ${esc(o.address)}${o.city ? `, ${esc(o.city)}` : ""}${
             o.region ? `, ${esc(o.region)}` : ""
           } ${esc(o.postal || "")}, ${esc(o.country)}
          </div>
        </div>
      </article>`;
    resultEl.hidden = false;
    resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ------------------------------ wire up ------------------------------ */

  $("#track-number").value = params.get("number") || "";
  $("#track-email").value = params.get("email") || "";

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const number = $("#track-number").value.trim().toUpperCase();
    const email = $("#track-email").value.trim().toLowerCase();
    if (!number) return setError("Please enter your order number.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setError("Please enter a valid email address.");
    history.replaceState(null, "", `/track.html?number=${encodeURIComponent(number)}&email=${encodeURIComponent(email)}`);
    lookup(number, email);
  });

  if (params.get("number") && params.get("email")) lookup(params.get("number").toUpperCase(), params.get("email"));
})();
