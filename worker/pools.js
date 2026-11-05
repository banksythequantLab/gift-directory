// Group gifts: one person picks the gift and shares a link; everyone chips in through PayPal.
//
// Each contribution is its own PayPal order whose payee is the organizer, so the money goes
// straight to them and never sits with this site. The capture happens when the contributor comes
// back from PayPal; that answer is what moves the tally, so it does not depend on a webhook that
// PayPal may or may not send us for a payment made to someone else's account.

import { toCents } from "./paypal-core.js";

const usd = c => (Number(c) / 100).toFixed(2);
const clip = (s, n) => String(s ?? "").slice(0, n);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const MIN_CENTS = 100;
export const UNCLAIMED_NOTE = "Paid. PayPal is holding it until the organizer claims it with a PayPal account at their email.";

// What a new pool must look like. Returns { error } or { pool } with clean values.
export function validatePool(b) {
  if (!b || typeof b !== "object") return { error: "missing body" };
  const title = clip(String(b.title || "").trim(), 120);
  const organizer_name = clip(String(b.organizer_name || "").trim(), 80);
  const organizer_email = String(b.organizer_email || "").trim().toLowerCase();
  const p = b.product || {};
  const price = Math.round(Number(p.price_cents));
  if (!title) return { error: "Give the gift a title." };
  if (!organizer_name) return { error: "Who is organizing it?" };
  if (!EMAIL.test(organizer_email)) return { error: "The organizer's PayPal email doesn't look right." };
  if (!p.title || !/^https:\/\//.test(String(p.url || ""))) return { error: "Pick a gift first." };
  if (!(price >= MIN_CENTS && price <= 1000000)) return { error: "That gift's price is out of range." };
  // The target is the gift's price unless the organizer asks for more (shipping, a card, tax).
  const target = b.target_cents == null ? price : Math.round(Number(b.target_cents));
  if (!(target >= price && target <= price * 2)) return { error: "The target must be at least the gift's price and at most double it." };
  return { pool: {
    title, organizer_name, organizer_email, occasion: clip(b.occasion || "", 60) || null,
    product: { title: clip(p.title, 200), url: String(p.url), image: /^https:\/\//.test(String(p.image || "")) ? String(p.image) : null,
               merchant: clip(p.merchant || "", 80) || null, price_cents: price, product_id: clip(p.product_id || "", 80) || null },
    target_cents: target,
  } };
}

// How much someone may put in right now: at least $1, never more than what's left.
export function contributionError(pool, cents) {
  if (!pool) return "This gift doesn't exist.";
  if (pool.status !== "open") return pool.status === "funded" ? "This gift is fully funded — thank you!" : "This gift is closed.";
  if (pool.closes_at && pool.closes_at < new Date().toISOString()) return "This gift is closed.";
  const left = pool.target_cents - pool.raised_cents;
  if (!Number.isInteger(cents) || cents < MIN_CENTS) return "The smallest contribution is $1.";
  if (cents > left) return `Only $${usd(left)} is left to raise.`;
  return null;
}

// The PayPal order for one contribution. The payee is the organizer.
export function buildContributionOrder(pool, contrib, origin) {
  const product = JSON.parse(pool.product_json);
  return {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: contrib.id, custom_id: contrib.id,
      description: clip(`Group gift: ${pool.title} (${product.title})`, 127),
      amount: { currency_code: "USD", value: usd(contrib.amount_cents) },
      payee: { email_address: pool.organizer_email },
    }],
    payment_source: { paypal: { experience_context: {
      brand_name: clip(`${pool.organizer_name}'s group gift`, 127), shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW", landing_page: "LOGIN",
      return_url: `${origin}/api/pools/return`, cancel_url: `${origin}/api/pools/cancel`,
    } } },
  };
}

// PayPal's answer to a capture call, reduced to what the tally needs.
export function readCapture(body) {
  const pu = ((body && body.purchase_units) || [])[0] || {};
  const cap = (((pu.payments || {}).captures) || [])[0];
  if (!cap) return { status: "NONE" };
  return { status: cap.status, reason: (cap.status_details && cap.status_details.reason) || null,
           capture_id: cap.id || null, amount_cents: toCents(cap.amount && cap.amount.value),
           payer_name: body.payer && body.payer.name ? [body.payer.name.given_name, body.payer.name.surname].filter(Boolean).join(" ") : null };
}

// Record a captured contribution. Status-guarded so a replay, a double click or a second tab can
// never count the same money twice; the pool total moves in the same transaction.
export async function applyCapture(db, contrib, cap, { now = () => new Date().toISOString() } = {}) {
  const t = now();
  // UNILATERAL: the organizer's email has no PayPal account yet. The contributor has paid; PayPal
  // holds it for the organizer to claim (and returns it after 30 days if they never do). It counts,
  // with a note so the organizer knows to claim it.
  const unclaimed = cap.status === "PENDING" && cap.reason === "UNILATERAL";
  if (cap.status === "COMPLETED" || unclaimed) {
    if (cap.amount_cents != null && cap.amount_cents < contrib.amount_cents) {
      await db.prepare("UPDATE contributions SET note=?, updated_at=? WHERE id=? AND status='pending'")
        .bind(`PayPal captured $${usd(cap.amount_cents)} of $${usd(contrib.amount_cents)}.`, t, contrib.id).run();
      return { outcome: "short capture" };
    }
    const res = await db.batch([
      db.prepare("UPDATE contributions SET status='paid', paypal_capture_id=?, note=?, paid_at=?, updated_at=? WHERE id=? AND status='pending'")
        .bind(cap.capture_id, unclaimed ? UNCLAIMED_NOTE : null, t, t, contrib.id),
      // Only adds if the row above actually changed: changes() is that statement's count.
      db.prepare("UPDATE pools SET raised_cents=raised_cents+?, updated_at=?, " +
        "status=CASE WHEN raised_cents+?>=target_cents THEN 'funded' ELSE status END WHERE id=? AND changes()=1")
        .bind(contrib.amount_cents, t, contrib.amount_cents, contrib.pool_id),
    ]);
    return { outcome: res[0].meta.changes ? "paid" : "already" };
  }
  if (cap.status === "DECLINED" || cap.status === "FAILED") {
    await db.prepare("UPDATE contributions SET status='cancelled', note=?, updated_at=? WHERE id=? AND status='pending'")
      .bind(`Payment ${cap.status.toLowerCase()}.`, t, contrib.id).run();
    return { outcome: "cancelled" };
  }
  await db.prepare("UPDATE contributions SET note=?, updated_at=? WHERE id=? AND status='pending'")
    .bind(`PayPal says the payment is ${String(cap.status).toLowerCase()}.`, t, contrib.id).run();
  return { outcome: "waiting" };
}

// The public view of a pool: never the organizer's email or the manage hash.
export function publicPool(pool, contribs) {
  return {
    id: pool.id, title: pool.title, occasion: pool.occasion, organizer_name: pool.organizer_name,
    product: JSON.parse(pool.product_json), target_cents: pool.target_cents, raised_cents: pool.raised_cents,
    status: pool.status, closes_at: pool.closes_at,
    unclaimed_cents: contribs.filter(c => c.status === "paid" && c.note === UNCLAIMED_NOTE).reduce((s, c) => s + c.amount_cents, 0),
    contributors: contribs.filter(c => c.status === "paid").map(c => ({
      name: c.hide_name ? "Anonymous" : (c.name || "Someone"), message: c.message || null, at: c.paid_at })),
  };
}
