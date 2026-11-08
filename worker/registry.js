// Gift registries: validation, addresses, and the AI "add these to my list" step. Pure functions; the
// storage, searching and PayPal group gifts are in worker.js.

const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
export const REG_MAX_ITEMS = 150, REG_POOL_MIN_CENTS = 5000;
export const OCCASIONS = ["Wedding", "Baby shower", "Birthday", "Housewarming", "Graduation", "Anniversary", "Christmas list", "Retirement", "Other"];

export function validateRegistry(b, { partial = false } = {}) {
  if (!b || typeof b !== "object") return { error: "missing body" };
  const out = {};
  if (!partial || b.title != null) { out.title = clip(b.title, 80); if (!out.title) return { error: "Give your registry a name, like \"Maria & Sam's wedding\"." }; }
  if (!partial || b.owner_name != null) { out.owner_name = clip(b.owner_name, 60); if (!out.owner_name) return { error: "Add your name so guests know whose list it is." }; }
  if (!partial || b.occasion != null) out.occasion = OCCASIONS.includes(b.occasion) ? b.occasion : "Other";
  if (!partial || b.event_date != null) {
    const d = String(b.event_date || "").trim();
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: "The date should look like 2027-06-12." };
    out.event_date = d || null;
  }
  if (!partial || b.paypal_email != null) {
    const e = String(b.paypal_email || "").trim().toLowerCase();
    if (e && !EMAIL.test(e)) return { error: "That PayPal email doesn't look right." };
    out.paypal_email = e || null;
  }
  if (!partial || b.message != null) out.message = clip(b.message, 400) || null;
  if (!partial || b.ship_pct != null) {
    const n = b.ship_pct == null || b.ship_pct === "" ? 10 : Number(b.ship_pct);
    if (!Number.isFinite(n) || n < 0 || n > 50) return { error: "Shipping & tax should be between 0% and 50%." };
    out.ship_pct = Math.round(n);
  }
  return { registry: out };
}

// "Maria & Sam's Wedding!" -> "maria-and-sams-wedding-k3p9"
export function registrySlug(title, suffix) {
  const base = String(title || "").toLowerCase().replace(/&/g, " and ").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  return `${base || "registry"}-${suffix}`;
}

// One registry item from a product card the owner picked (same shape the stores use).
export function validateRegItem(b) {
  const c = b && b.card || {};
  if (!c.title || !/^https:\/\//.test(String(c.url || ""))) return { error: "That product is missing its details." };
  const price = Math.round(Number(c.price_cents));
  const card = { product_id: clip(c.product_id, 120) || null, title: clip(c.title, 200), brand: c.brand ? clip(c.brand, 80) : null,
    image: /^https:\/\//.test(String(c.image || "")) ? String(c.image) : null, price_cents: price > 0 ? price : null,
    merchant: clip(c.merchant || "", 80), url: String(c.url).slice(0, 1000) };
  const qty = Math.max(1, Math.min(20, Math.round(Number(b.qty) || 1)));
  return { item: { card, qty, note: clip(b.note, 140) || null } };
}

// What guests see. Claim names are shown to the owner only (a surprise stays a surprise for other guests).
// A group gift that reached its target counts as the item being bought.
export function publicRegistry(r, items, claims = [], owner = false, pools = {}) {
  return {
    slug: r.slug, title: r.title, occasion: r.occasion, event_date: r.event_date, owner_name: r.owner_name, message: r.message,
    group_gifts: !!r.paypal_email, ship_pct: r.ship_pct ?? 10, owner, ...(owner ? { paypal_email: r.paypal_email || "" } : {}),
    items: items.map(i => {
      const p = i.pool_id && pools[i.pool_id], funded = !!p && (p.status === "funded" || p.raised_cents >= p.target_cents);
      return { item_id: i.item_id, ...JSON.parse(i.card_json), qty: i.qty, claimed: funded ? i.qty : Math.min(i.claimed, i.qty), note: i.note, pool_id: i.pool_id,
        ...(p ? { pool: { raised_cents: p.raised_cents, target_cents: p.target_cents, status: p.status } } : {}),
        ...(owner ? { claimed_by: [...claims.filter(c => c.item_id === i.item_id).map(c => c.name || "A guest"), ...(funded ? ["a group gift"] : [])] } : {}) };
    }),
  };
}

// A registry group gift's goal: the item total plus the registry's shipping & tax estimate, never more than double.
export const poolTarget = (priceCents, pct = 10) => Math.min(priceCents * 2, priceCents + Math.round(priceCents * Math.max(0, Math.min(50, Number(pct) || 0)) / 100));

// "Add a KitchenAid mixer and 6 cozy blankets under $80" -> searches, one per thing they want.
export const REG_AI_SYSTEM = `You help someone fill a gift registry. They describe what they want; you turn it into product searches.
Answer JSON only: {"reply": "one short friendly sentence", "items": [{"query": "2-6 words naming ONE concrete product (brand if they gave one)", "max_price": dollars or null, "qty": 1-20}]}.
At most 8 items, only things they asked for or clearly implied (if they ask for ideas for an occasion, suggest up to 8 classic, useful items for it). No years in queries. Plain English only.`;
export function regAiPrompt(reg, message) {
  return `Registry: ${clip(reg.title, 80)} (${reg.occasion || "Other"})\nThey say: ${clip(message, 600)}`;
}
export function parseRegAi(j) {
  const items = (Array.isArray(j && j.items) ? j.items : []).map(x => {
    const query = clip(String((x && x.query) || "").replace(/\b(19|20)\d\d\b/g, ""), 80);
    const mp = Number(x && x.max_price);
    return query ? { query, max_cents: mp > 0 ? Math.round(mp * 100) : null, qty: Math.max(1, Math.min(20, Math.round(Number(x.qty) || 1))) } : null;
  }).filter(Boolean).slice(0, 8);
  const reply = clip(String((j && j.reply) || "").replace(/[⺀-鿿가-힯豈-﫿＀-￯]+/g, ""), 300) || "Here are some options.";
  return { reply, items };
}
