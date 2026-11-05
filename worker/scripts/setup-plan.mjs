// One-time: create the PayPal catalog product and the $19/month plan that publishes a store.
// Usage: node scripts/setup-plan.mjs <path to a .dev.vars with PAYPAL_CLIENT_ID/SECRET>  (sandbox)
// Prints the plan id to put in wrangler.jsonc as PAYPAL_PLAN_ID. Safe to re-run: it reuses an
// existing product/plan with the same name instead of making duplicates.
import { readFileSync } from "node:fs";
import { paypalFetch } from "../paypal-core.js";

const vars = Object.fromEntries(readFileSync(process.argv[2], "utf8").split(/\r?\n/)
  .map(l => /^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/.exec(l)).filter(Boolean).map(m => [m[1], m[2]]));
const env = { PAYPAL_CLIENT_ID: vars.PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET: vars.PAYPAL_CLIENT_SECRET, PAYPAL_ENV: process.env.PAYPAL_ENV || "sandbox" };
const PRODUCT = "gift.directory store", PLAN = "gift.directory store — monthly";

let products = await paypalFetch(env, "/v1/catalogs/products?page_size=20");
let product = (products.body.products || []).find(p => p.name === PRODUCT);
if (!product) {
  const r = await paypalFetch(env, "/v1/catalogs/products", { method: "POST", headers: { "PayPal-Request-Id": "gd-product-1" },
    body: { name: PRODUCT, description: "A hosted AI gift store on gift.directory", type: "SERVICE", category: "SOFTWARE" } });
  if (r.status >= 300) { console.log("product failed", r.status, JSON.stringify(r.body)); process.exit(1); }
  product = r.body;
}
console.log("product", product.id);

const plans = await paypalFetch(env, `/v1/billing/plans?product_id=${product.id}&page_size=20`);
let plan = (plans.body.plans || []).find(p => p.name === PLAN && p.status === "ACTIVE");
if (!plan) {
  const r = await paypalFetch(env, "/v1/billing/plans", { method: "POST", headers: { "PayPal-Request-Id": "gd-plan-1", Prefer: "return=representation" },
    body: { product_id: product.id, name: PLAN, status: "ACTIVE", description: "Your gift store, live on gift.directory",
      billing_cycles: [{ frequency: { interval_unit: "MONTH", interval_count: 1 }, tenure_type: "REGULAR", sequence: 1, total_cycles: 0,
        pricing_scheme: { fixed_price: { value: "19.00", currency_code: "USD" } } }],
      payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 1 } } });
  if (r.status >= 300) { console.log("plan failed", r.status, JSON.stringify(r.body)); process.exit(1); }
  plan = r.body;
}
console.log("plan", plan.id, plan.status);
