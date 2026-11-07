// Etsy shops as a product source for a store: the shop's active listings come in through Etsy's
// Open API v3 (api.etsy.com/v3, x-api-key "keystring:shared_secret"). Pure functions here; fetching is in worker.js.
// Required on any page that shows Etsy data (Etsy API terms):
export const ETSY_NOTICE = "The term 'Etsy' is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.";
export const ETSY_API = "https://api.etsy.com/v3/application";

const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const decode = s => String(s ?? "").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

// "MyShop", "etsy.com/shop/MyShop", "https://www.etsy.com/shop/MyShop?ref=x", "myshop.etsy.com" -> "MyShop"
export function etsyShopName(input) {
  const raw = String(input ?? "").trim();
  if (/^[A-Za-z0-9]{2,40}$/.test(raw)) return raw;
  let u; try { u = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw); } catch { return null; }
  const h = u.hostname.toLowerCase().replace(/^www\./, "");
  let name = null;
  if (h === "etsy.com") { const m = u.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?shop\/([A-Za-z0-9]+)/i); name = m && m[1]; }
  else if (h.endsWith(".etsy.com")) name = h.slice(0, -".etsy.com".length);
  return name && /^[A-Za-z0-9]{2,40}$/.test(name) ? name : null;
}
export const etsyShopUrl = name => `https://www.etsy.com/shop/${name}`;

// GET /shops?shop_name= -> the shop whose name matches exactly (search is fuzzy).
export function pickShop(json, name) {
  const rs = Array.isArray(json && json.results) ? json.results : [];
  return rs.find(s => String(s.shop_name).toLowerCase() === String(name).toLowerCase()) || null;
}

// GET /shops/{id}/listings?includes=Images -> cards.
export function etsyCards(json, shopName) {
  return (Array.isArray(json && json.results) ? json.results : []).map(l => {
    if (!l || !l.listing_id || !l.price || !l.price.divisor) return null;
    const c = Math.round(l.price.amount / l.price.divisor * 100);
    if (!(c > 0)) return null;
    const imgs = (Array.isArray(l.images) ? l.images : []).slice().sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
    const img = imgs[0] && (imgs[0].url_570xN || imgs[0].url_fullxfull);
    const tags = [...(l.tags || []), ...(l.is_personalizable ? ["personalized"] : [])];
    return {
      product_id: `own:etsy:${l.listing_id}`, title: clip(decode(l.title), 200), brand: shopName,
      image: img && /^https:\/\//.test(img) ? img : null,
      price_cents: c, was_cents: null, merchant: "etsy.com",
      url: `https://www.etsy.com/listing/${l.listing_id}`,
      tags: clip(tags.join(", "), 300),
      available: (l.state || "active") === "active" && (l.quantity == null || l.quantity > 0),
      own: true, features: l.is_personalizable ? ["Personalizable"] : [],
    };
  }).filter(Boolean);
}
