// CJ Affiliate products for gift.directory. Only advertisers we have JOINED (they are the ones who pay us),
// in stock, in USD, with a CJ tracking link built from our gift.directory property id (PID).
// Docs: https://developers.cj.com/graphql/reference/Product%20Feed (shoppingProducts, linkCode(pid))
export const CJ_URL = "https://ads.api.cj.com/query";
export const cjOn = env => !!(env && env.CJ_TOKEN && env.CJ_CID && env.CJ_PID);

const str = s => JSON.stringify(String(s));
const clip = (s, n) => { s = String(s ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

export function cjQuery(env, query, { highCents = null, limit = 24 } = {}) {
  const args = [`companyId: ${str(env.CJ_CID)}`, "partnerStatus: JOINED", "availability: IN_STOCK", 'currency: "USD"',
    `keywords: [${str(clip(query, 120))}]`, `limit: ${Math.max(1, Math.min(100, limit | 0))}`];
  if (highCents) args.push(`highPrice: ${(highCents / 100).toFixed(2)}`);
  return `{ shoppingProducts(${args.join(", ")}) { resultList { id title description advertiserId advertiserName brand imageLink ` +
    `availability condition adult multipack price { amount currency } salePrice { amount currency } linkCode(pid: ${str(env.CJ_PID)}) { clickUrl } } } }`;
}

const cents = a => { const n = Number(a && a.amount); return a && (a.currency || "USD") === "USD" && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null; };
const https = u => (typeof u === "string" && /^https:\/\//i.test(u)) ? u : null;

// One CJ product as a card in the same shape Channel3 cards use (see finder.js toCard).
export function cjToCard(p, budgetCents) {
  if (!p || !p.id || !p.title) return null;
  if (/^(yes|true|1)$/i.test(String(p.adult || ""))) return null;
  if (p.condition && !/^new$/i.test(p.condition)) return null;
  if (Number(p.multipack) > 1) return null;
  if (p.availability && !/^in[_ ]?stock$/i.test(p.availability)) return null;
  const url = https(p.linkCode && p.linkCode.clickUrl); if (!url) return null;
  const list = cents(p.price), sale = cents(p.salePrice), price = sale && list && sale < list ? sale : (list || sale);
  if (!price || (budgetCents && price > budgetCents)) return null;
  return {
    product_id: `cj:${p.advertiserId}:${p.id}`, title: clip(p.title, 200), brand: p.brand ? clip(p.brand, 60) : null,
    image: https(p.imageLink), price_cents: price, was_cents: sale && list && sale < list ? list : null,
    merchant: clip(p.advertiserName || "", 80), url, offers: 1, features: [], source: "cj",
  };
}

// CJ keyword search matches ANY word ("hunting gifts" returns earrings), and CJ results are listed first, so a CJ product
// only counts if its title has every meaningful word of the search (plurals match singulars).
const STOP = new Set(["for", "the", "and", "a", "an", "of", "with", "to", "in", "on", "gift", "gifts", "him", "her", "his", "hers", "year", "old",
  "years", "kids", "kid", "boy", "boys", "girl", "girls", "man", "men", "woman", "women", "adult", "adults", "fan", "fans", "lover", "lovers", "set"]);
const stem = w => w.replace(/(ies)$/, "y").replace(/(es|s)$/, "");
const words = s => String(s).toLowerCase().replace(/[^a-z0-9&]+/g, " ").split(" ").filter(w => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w)).map(stem);
export function cjRelevant(title, query) {
  const need = words(query); if (!need.length) return false;
  const have = new Set(words(title)), flat = " " + String(title).toLowerCase().replace(/[^a-z0-9&]+/g, " ") + " ";
  return need.every(w => have.has(w) || flat.includes(" " + w));
}

export async function cjSearch(env, query, brief = {}, { fetchImpl = fetch, limit = 24 } = {}) {
  if (!cjOn(env)) return [];
  const r = await fetchImpl(CJ_URL, { method: "POST", headers: { authorization: `Bearer ${env.CJ_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ query: cjQuery(env, query, { highCents: brief.budget_cents || null, limit }) }) });
  if (!r.ok) throw new Error(`cj ${r.status}`);
  const j = await r.json();
  if (j && j.errors && j.errors.length && !(j.data && j.data.shoppingProducts)) throw new Error(`cj ${clip(j.errors[0].message, 120)}`);
  const list = (j && j.data && j.data.shoppingProducts && j.data.shoppingProducts.resultList) || [];
  return list.filter(p => cjRelevant(p.title, query)).map(p => cjToCard(p, brief.budget_cents || null)).filter(Boolean);
}
