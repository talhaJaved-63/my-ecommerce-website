const Stripe = require("stripe");

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

const CURRENCY = process.env.CURRENCY || "usd";
const FREE_SHIPPING_THRESHOLD_CENTS = parseInt(process.env.FREE_SHIPPING_THRESHOLD_CENTS || "15000", 10);
const FLAT_SHIPPING_CENTS = parseInt(process.env.FLAT_SHIPPING_CENTS || "800", 10);

const isConfigured = () => !!stripe;

function quote(subtotalCents) {
  const shipping =
    subtotalCents === 0 || subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS;
  return { shippingCents: shipping, totalCents: subtotalCents + shipping };
}

async function createPaymentIntent({ amountCents, metadata }) {
  if (!isConfigured()) {
    return { id: `demo_${Date.now().toString(36)}`, clientSecret: null, demo: true };
  }
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: CURRENCY,
    automatic_payment_methods: { enabled: true },
    metadata,
  });
  return { id: intent.id, clientSecret: intent.client_secret, demo: false };
}

async function retrieveIntent(id) {
  if (!id || id.startsWith("demo_")) return { id, status: "succeeded", demo: true };
  if (!isConfigured()) return null;
  try {
    const intent = await stripe.paymentIntents.retrieve(id);
    return { id: intent.id, status: intent.status, amountReceived: intent.amount_received, demo: false };
  } catch {
    return null;
  }
}

module.exports = {
  stripe,
  isConfigured,
  quote,
  createPaymentIntent,
  retrieveIntent,
  CURRENCY,
  FREE_SHIPPING_THRESHOLD_CENTS,
  FLAT_SHIPPING_CENTS,
};
