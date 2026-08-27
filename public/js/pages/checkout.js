(async () => {
  await MV.bootPromise;

  const root = document.getElementById("checkout-root");
  const linesEl = document.getElementById("summary-lines");
  const totalsEl = document.getElementById("summary-totals");
  const payArea = document.getElementById("payment-area");
  const payMsg = document.getElementById("pay-msg");

  if (!MV.cart.length) {
    root.innerHTML = `
      <div class="panel" style="max-width:560px;margin:2rem auto;text-align:center;padding:3.5rem 2rem">
        <h2 style="margin-bottom:.4rem">Your bag is empty</h2>
        <p style="color:var(--muted)">Add a piece to your bag to continue to checkout.</p>
        <p style="margin-top:1.8rem"><a class="btn btn-solid" href="/shop.html">Explore the Collection</a></p>
      </div>`;
    return;
  }

  let intent = null;
  try {
    intent = await MV.api.post("/api/checkout/intent", { items: MV.cart.map(({ productId, qty, size, color }) => ({ productId, qty, size, color })) });
  } catch (err) {
    linesEl.innerHTML = `<p class="grid-empty">${err.message}</p>`;
    document.getElementById("co-form").style.display = "none";
    payArea.innerHTML = `<a class="btn btn-outline" href="/shop.html">Return to the Collection</a>`;
    return;
  }

  renderSummary(intent);

  function renderSummary(data) {
    linesEl.innerHTML = data.items
      .map(
        (i) => `
      <div class="summary-line">
        <img src="${i.image}" alt="${i.name}">
        <span>
          <span class="sum-name">${i.name}</span><br>
          <span class="sum-meta">${[i.size, i.color].filter(Boolean).join(" · ")} — Qty ${i.qty}</span>
        </span>
        <strong>${MV.money(i.unitPriceCents * i.qty)}</strong>
      </div>`
      )
      .join("");
    totalsEl.innerHTML = `
      <div class="totals">
        <div><span>Subtotal</span><span>${MV.money(data.summary.subtotalCents)}</span></div>
        <div><span>Shipping</span><span>${
          data.summary.shippingCents === 0 ? "Free" : MV.money(data.summary.shippingCents)
        }</span></div>
        <div class="grand"><span>Total</span><span>${MV.money(data.summary.totalCents)}</span></div>
      </div>`;
  }

  const stripe = await setupPayment();

  let stripeElements = null;

  async function setupPayment() {
    const cfg = MV.config || (await MV.api.get("/api/config"));
    if (cfg.demoPayments || !cfg.stripePublishableKey || !intent.clientSecret) {
      payArea.innerHTML = `
        <div class="demo-box">
          <strong>Demo payment mode.</strong> Stripe keys are not configured on this server,
          so orders are authorized by the built-in demo gateway and marked as paid.
          Add <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_PUBLISHABLE_KEY</code> to go live.
        </div>
        <button class="btn btn-solid btn-block" id="place-order">Place Order — ${MV.money(
          intent.summary.totalCents
        )}</button>`;
      document.getElementById("place-order").addEventListener("click", () => submit(null));
      return null;
    }
    await loadStripeJs();
    const stripeInstance = window.Stripe(cfg.stripePublishableKey);
    stripeElements = stripeInstance.elements({
      clientSecret: intent.clientSecret,
      appearance: {
        theme: "stripe",
        variables: { colorPrimary: "#161513", colorText: "#161513", fontFamily: "Jost, sans-serif", borderRadius: "2px" },
      },
    });
    stripeElements.create("payment").mount("#payment-element");
    payArea.insertAdjacentHTML(
      "beforeend",
      `<button class="btn btn-solid btn-block" id="place-order" style="margin-top:.4rem">Pay ${MV.money(
        intent.summary.totalCents
      )}</button>`
    );
    document.getElementById("place-order").addEventListener("click", () => submit(stripeInstance));
    return stripeInstance;
  }

  function loadStripeJs() {
    return new Promise((resolve, reject) => {
      if (window.Stripe) return resolve();
      const s = document.createElement("script");
      s.src = "https://js.stripe.com/v3/";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Stripe.js could not be loaded. Check your connection."));
      document.head.appendChild(s);
    });
  }

  function readCustomer() {
    const v = (id) => document.getElementById(id).value.trim();
    const customer = {
      fullName: v("co-name"),
      email: v("co-email").toLowerCase(),
      phone: v("co-phone"),
      address1: v("co-address1"),
      address2: v("co-address2"),
      city: v("co-city"),
      region: v("co-region"),
      postal: v("co-postal"),
      country: v("co-country"),
    };
    const missing = [
      [customer.fullName.length >= 2, "your full name"],
      [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customer.email), "a valid email address"],
      [customer.address1.length >= 4, "your street address"],
      [customer.city.length >= 2, "your city"],
      [customer.postal.length >= 3, "your postal code"],
      [customer.country.length >= 2, "your country"],
    ].find(([ok]) => !ok);
    return missing ? { error: `Please enter ${missing[1]}.` } : { customer };
  }

  function setBusy(busy, label) {
    const btn = document.getElementById("place-order");
    if (!btn) return;
    btn.disabled = busy;
    if (label) btn.textContent = label;
  }

  function setPayError(text) {
    payMsg.textContent = text;
    payMsg.className = text ? "form-msg err" : "form-msg";
  }

  async function submit(stripeInstance) {
    setPayError("");
    const { error: validationError, customer } = readCustomer();
    if (validationError) {
      setPayError(validationError);
      document.getElementById("co-name").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setBusy(true, "Processing…");

    let paymentRef = null;
    if (stripeInstance && stripeElements) {
      const { error, paymentIntent } = await stripeInstance.confirmPayment({
        elements: stripeElements,
        redirect: "if_required",
      });
      if (error) {
        setBusy(false);
        setPayError(error.message || "Payment failed. Please try again.");
        return;
      }
      if (paymentIntent && paymentIntent.status !== "succeeded") {
        setBusy(false);
        setPayError(`Payment not completed (${paymentIntent.status}).`);
        return;
      }
      paymentRef = intent.intentId;
    } else {
      paymentRef = intent.intentId;
      await new Promise((r) => setTimeout(r, 700));
    }

    try {
      const res = await MV.api.post("/api/orders", {
        items: intent.items.map((i) => ({
          productId: i.productId,
          qty: i.qty,
          size: i.size,
          color: i.color,
        })),
        customer,
        paymentRef,
      });
      MV.clearCart();
      showConfirmation(res.order, customer.email);
    } catch (err) {
      setBusy(false);
      setPayError(err.message);
    }
  }

  function showConfirmation(order, email) {
    root.innerHTML = `
      <div class="order-confirm">
        <div class="ok-ring">✓</div>
        <h1>Thank you${MV.user ? ", " + MV.user.name.split(" ")[0] : ""}.</h1>
        <p style="color:var(--muted);margin-top:.6rem">Your order has been placed and is being prepared with care.</p>
        <span class="order-number">${order.number}</span>
        <p style="color:var(--muted);font-size:.85rem;margin-top:1rem">
          Total charged: <strong style="color:var(--ink)">${MV.money(order.totalCents)}</strong> · Keep this number to follow your delivery.
        </p>
        <div class="confirm-actions">
          ${MV.user ? `<a class="btn btn-solid" href="/account.html">View My Orders</a>` : `<a class="btn btn-solid" href="/shop.html">Continue Shopping</a>`}
          <a class="btn btn-outline" href="/track.html?number=${order.number}&email=${encodeURIComponent(
      email || ""
    )}">Track Order</a>
          ${MV.user ? `<a class="btn btn-outline" href="/shop.html">Continue Shopping</a>` : ""}
        </div>
      </div>`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
})();
