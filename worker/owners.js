// Store owners: Log in with PayPal, who owns which store, and the owner's curation.

const clip = (s, n) => String(s ?? "").slice(0, n);

// ---------- Log in with PayPal ----------
export function paypalWebBase(env) {
  return env && env.PAYPAL_ENV === "live" ? "https://www.paypal.com" : "https://www.sandbox.paypal.com";
}
export function authorizeUrl(env, redirectUri, state) {
  const q = new URLSearchParams({ flowEntry: "static", client_id: env.PAYPAL_CLIENT_ID, response_type: "code",
    scope: "openid email profile", redirect_uri: redirectUri, state });
  return `${paypalWebBase(env)}/signin/authorize?${q}`;
}
// PayPal's identity answer comes in two shapes depending on the endpoint/schema; read either.
export function parseUserinfo(b) {
  if (!b || typeof b !== "object") return null;
  const emails = new Set();
  for (const e of Array.isArray(b.emails) ? b.emails : []) if (e && e.value && e.confirmed !== false) emails.add(String(e.value).toLowerCase());
  if (b.email && b.email_verified !== false) emails.add(String(b.email).toLowerCase());
  const payer_id = b.payer_id || null;
  if (!emails.size && !payer_id) return null;
  return { payer_id, emails: [...emails], name: clip(b.name || [b.given_name, b.family_name].filter(Boolean).join(" "), 80) || null };
}
// A store belongs to whoever paid for it (PayPal payer id) or to the email it was set up with,
// provided PayPal itself vouches for that email.
export function ownsStore(user, store) {
  if (!user || !store) return false;
  if (store.owner_payer_id && user.payer_id && store.owner_payer_id === user.payer_id) return true;
  return !!store.owner_email && user.emails.includes(String(store.owner_email).toLowerCase());
}

// ---------- settings ----------
const HEX = /^#[0-9a-fA-F]{6}$/;
export function validateSettings(b, darkEnough) {
  if (!b || typeof b !== "object") return { error: "missing body" };
  const name = clip(String(b.name || "").trim(), 40);
  if (!name) return { error: "Your store needs a name." };
  const occasions = (Array.isArray(b.occasions) ? b.occasions : []).map(o => clip(String(o).trim(), 40)).filter(Boolean).slice(0, 12);
  if (occasions.length < 3) return { error: "Give at least three occasions." };
  if (b.accent && (!HEX.test(b.accent) || !darkEnough(b.accent))) return { error: "Pick a darker color so white text stays readable." };
  return { settings: {
    name, tagline: clip(String(b.tagline || "").trim(), 90),
    occasions, recipient_examples: (Array.isArray(b.recipient_examples) ? b.recipient_examples : []).map(o => clip(String(o).trim(), 60)).filter(Boolean).slice(0, 3),
    search_guidance: clip(String(b.search_guidance || "").trim(), 300) || null,
    avoid: clip(String(b.avoid || "").trim(), 200) || null,
    accent: b.accent || null,
  } };
}

// ---------- curation ----------
export function validateItem(b) {
  if (!b || !["pinned", "hidden"].includes(b.status)) return { error: "status must be pinned or hidden" };
  const c = b.card || {};
  if (!c.product_id || !c.title || !/^https:\/\//.test(String(c.url || ""))) return { error: "That product is missing its details." };
  const card = { product_id: clip(c.product_id, 80), title: clip(c.title, 200), brand: c.brand ? clip(c.brand, 80) : null,
    image: /^https:\/\//.test(String(c.image || "")) ? String(c.image) : null, price_cents: Math.round(Number(c.price_cents)) || null,
    was_cents: null, merchant: clip(c.merchant || "", 80), url: String(c.url), offers: 1, features: [] };
  return { item: { status: b.status, collection: b.status === "pinned" ? (clip(String(b.collection || "").trim(), 40) || null) : null, card } };
}
// The store's shelves from its pinned items: "Our picks" first, then each collection in the order made.
export function shelves(items) {
  const out = new Map();
  for (const it of [...items].filter(i => i.status === "pinned").sort((a, b) => a.sort - b.sort || String(a.created_at).localeCompare(b.created_at))) {
    const t = it.collection || "Our picks";
    if (!out.has(t)) out.set(t, []);
    out.get(t).push(JSON.parse(it.card_json));
  }
  const list = [...out.entries()].map(([title, cards]) => ({ title, cards }));
  list.sort((a, b) => (a.title === "Our picks" ? -1 : b.title === "Our picks" ? 1 : 0));
  return list;
}
// Whatever the owner hid never appears, wherever it came from.
export function withoutHidden(cards, items) {
  const hidden = new Set(items.filter(i => i.status === "hidden").map(i => i.product_id));
  return hidden.size ? cards.filter(c => !hidden.has(c.product_id)) : cards;
}
