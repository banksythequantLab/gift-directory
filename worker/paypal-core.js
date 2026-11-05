// PayPal REST core, carried over from Bottle Tree (D:\bottletree-appraiser\worker\paypal.js, written Oct 2026):
// base URL, cached OAuth token with fresh-token retry, fetch wrapper, webhook signature check, amount parsing.

// PayPal: the money rail for the PayPal AI Hackathon build.
//
// Same split as orders.js: what an event MEANS is decided by pure functions that can be tested
// as rules, and what it DOES to the shop is a separate function over a D1-shaped db. The network
// is passed in (fetchImpl) so the token and signature paths can be tested without PayPal.

export function paypalBase(env) {
  return env && env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

// All three or nothing, for the reason stripeReady gives: a client id without the webhook id
// takes money whose confirmation can never be verified, so the item stays on the shelf.
export function paypalReady(env) {
  return !!(env && env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.PAYPAL_WEBHOOK_ID);
}

// ---------- access token ----------
// PayPal hands back the SAME token on every request until it expires (up to 9 hours), even after
// the app's permissions change. Found the hard way on Oct 14: Invoicing was switched on, every new
// "token" was the old one without the invoicing scope, and every call said NOT_AUTHORIZED. So a
// 401/403 terminates the token server-side and asks again, once.
let cached = null; // { key, token, exp }

function basic(env) { return "Basic " + btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`); }

export function _resetTokenCache() { cached = null; }

export async function paypalToken(env, { fresh = false, fetchImpl = fetch, nowMs = Date.now() } = {}) {
  const key = `${paypalBase(env)}|${env.PAYPAL_CLIENT_ID}`;
  if (!fresh && cached && cached.key === key && cached.exp > nowMs + 60_000) return cached.token;
  if (fresh && cached && cached.key === key) {
    // Without this PayPal just returns the stale token again.
    await fetchImpl(`${paypalBase(env)}/v1/oauth2/token/terminate`, {
      method: "POST", headers: { authorization: basic(env), "content-type": "application/x-www-form-urlencoded" },
      body: `token=${encodeURIComponent(cached.token)}&token_type_hint=ACCESS_TOKEN` }).catch(() => {});
    cached = null;
  }
  const r = await fetchImpl(`${paypalBase(env)}/v1/oauth2/token`, {
    method: "POST", headers: { authorization: basic(env), "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials" });
  if (!r.ok) throw new Error(`paypal token: HTTP ${r.status}`);
  const j = await r.json();
  cached = { key, token: j.access_token, exp: nowMs + (Number(j.expires_in) || 300) * 1000 };
  return cached.token;
}

// One PayPal REST call. Returns { status, body } and never throws on an HTTP error, because the
// caller is usually a webhook or a checkout that has to answer with something sensible.
export async function paypalFetch(env, path, { method = "GET", body, headers = {}, fetchImpl = fetch } = {}) {
  const go = async fresh => {
    const token = await paypalToken(env, { fresh, fetchImpl });
    const r = await fetchImpl(paypalBase(env) + path, { method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
    return { status: r.status, body: parsed };
  };
  const first = await go(false);
  return first.status === 401 || first.status === 403 ? go(true) : first;
}

// ---------- webhook signature ----------
// PayPal's own verification endpoint, rather than checking the certificate chain by hand. It costs
// a round trip per event and is the method PayPal documents for this.
const SIG_HEADERS = ["paypal-auth-algo", "paypal-cert-url", "paypal-transmission-id", "paypal-transmission-sig", "paypal-transmission-time"];

export async function verifyPayPalWebhook(env, headers, event, { fetchImpl = fetch } = {}) {
  const h = Object.fromEntries(SIG_HEADERS.map(k => [k, headers.get(k)]));
  if (SIG_HEADERS.some(k => !h[k]) || !event) return false;
  const r = await paypalFetch(env, "/v1/notifications/verify-webhook-signature", { method: "POST", fetchImpl, body: {
    auth_algo: h["paypal-auth-algo"], cert_url: h["paypal-cert-url"], transmission_id: h["paypal-transmission-id"],
    transmission_sig: h["paypal-transmission-sig"], transmission_time: h["paypal-transmission-time"],
    webhook_id: env.PAYPAL_WEBHOOK_ID, webhook_event: event } });
  return r.status === 200 && r.body && r.body.verification_status === "SUCCESS";
}

// ---------- what an event means ----------
// "12.30" -> 1230 without going through a float.
export function toCents(v) {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(v ?? "").trim());
  return m ? Number(m[1]) * 100 + Number((m[2] || "0").padEnd(2, "0")) : null;
}
export const lastSeg = href => (href ? String(href).split("/").filter(Boolean).pop() : null);
export const link = (r, rel) => ((r && r.links) || []).find(l => l && l.rel === rel);
