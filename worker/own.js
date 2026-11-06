// A store owner's own products: imported from their Shopify shop (products.json), from single product
// links on any site (the page's schema.org / Open Graph product tags), or from a CSV. Pure functions here;
// the fetching and storing is in worker.js.

export const OWN_MAX = 1000;            // products per store
const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const cents = v => { const n = Number(String(v ?? "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null; };

// Only public https sites: no IP addresses, no localhost or internal names (the worker fetches these URLs).
export function safeHttpsUrl(input) {
  let u;
  try { u = new URL(/^https?:\/\//i.test(String(input).trim()) ? String(input).trim() : "https://" + String(input).trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  u.protocol = "https:";
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || /^[\d.]+$/.test(h) || h.includes(":") || /(^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(h)) return null;
  if (u.username || u.password || (u.port && u.port !== "443")) return null;
  return u;
}

// "mystore.com", "mystore.myshopify.com/collections/x", "https://shop.brand.com/" -> "https://mystore.com"
export function shopOrigin(input) {
  const u = safeHttpsUrl(input);
  return u ? u.origin : null;
}

// Shopify's public /products.json -> cards. Price is the cheapest variant in stock; sold-out products come back unavailable.
export function shopifyCards(json, origin) {
  const host = new URL(origin).hostname.replace(/^www\./, "");
  return (Array.isArray(json && json.products) ? json.products : []).map(p => {
    const vs = Array.isArray(p.variants) ? p.variants : [];
    const live = vs.filter(v => v && v.available !== false);
    const pool = live.length ? live : vs;
    const best = pool.map(v => ({ c: cents(v.price), was: cents(v.compare_at_price) })).filter(v => v.c).sort((a, b) => a.c - b.c)[0];
    const img = (Array.isArray(p.images) && p.images[0] && p.images[0].src) || (p.image && p.image.src) || null;
    if (!p.id || !p.handle || !best) return null;
    return {
      product_id: `own:${host}:${p.id}`, title: clip(p.title, 200), brand: clip(p.vendor, 80) || null,
      image: img && /^https:\/\//.test(img) ? img : (img && img.startsWith("//") ? "https:" + img : null),
      price_cents: best.c, was_cents: best.was && best.was > best.c ? best.was : null,
      merchant: host, url: `${origin}/products/${encodeURIComponent(p.handle)}`,
      tags: clip([p.product_type, ...(Array.isArray(p.tags) ? p.tags : String(p.tags || "").split(","))].filter(Boolean).join(", "), 300),
      available: live.length > 0, own: true, features: [],
    };
  }).filter(Boolean);
}

// One product page on any site -> card, from JSON-LD Product (preferred) or Open Graph product tags.
export function productFromHtml(html, pageUrl) {
  const u = safeHttpsUrl(pageUrl); if (!u) return null;
  const host = u.hostname.replace(/^www\./, "");
  const decode = s => String(s ?? "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  let name = null, image = null, price = null, brand = null, avail = true;
  for (const m of String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data; try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const nodes = []; const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") { nodes.push(x); if (x["@graph"]) walk(x["@graph"]); } }; walk(data);
    const prod = nodes.find(n => [].concat(n["@type"] || []).some(t => /^Product$/i.test(t)));
    if (!prod) continue;
    name = prod.name; brand = prod.brand && (prod.brand.name || prod.brand);
    image = [].concat(prod.image || [])[0]; if (image && typeof image === "object") image = image.url || image.contentUrl;
    const offers = [].concat(prod.offers || []).flatMap(o => o && o["@type"] === "AggregateOffer" ? [{ price: o.lowPrice, availability: o.availability }] : [o]).filter(Boolean);
    const priced = offers.map(o => ({ c: cents(o.price ?? (o.priceSpecification && o.priceSpecification.price)), a: String(o.availability || "") })).filter(o => o.c).sort((a, b) => a.c - b.c);
    if (priced.length) { price = priced[0].c; avail = !/OutOfStock|SoldOut|Discontinued/i.test(priced[0].a); }
    break;
  }
  const meta = p => { const m = String(html).match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']*)["']`, "i")) || String(html).match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${p}["']`, "i")); return m ? decode(m[1]) : null; };
  name = name || meta("og:title"); image = image || meta("og:image");
  price = price || cents(meta("product:price:amount") || meta("og:price:amount"));
  if (!name || !price) return null;
  image = image ? new URL(decode(image), u).href.replace(/^http:\/\//, "https://") : null;
  return { product_id: `own:${host}:${hashKey(u.origin + u.pathname)}`, title: clip(decode(name), 200), brand: brand ? clip(brand, 80) : null,
    image: image && image.startsWith("https://") ? image : null, price_cents: price, was_cents: null, merchant: host,
    url: u.origin + u.pathname + u.search, tags: "", available: avail, own: true, features: [] };
}

// Short stable id for a URL (FNV-1a, hex) so re-adding the same link updates it instead of duplicating.
export function hashKey(s) { let h = 0x811c9dc5; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); }

// CSV with a header row. Needs title, price and link columns (common names accepted); image and tags optional.
export function parseCsv(text) {
  const rows = [], errors = [];
  const lines = csvRows(String(text || "").replace(/^﻿/, ""));
  if (lines.length < 2) return { rows, errors: ["The CSV needs a header row and at least one product."] };
  const head = lines[0].map(h => h.trim().toLowerCase());
  const col = names => head.findIndex(h => names.includes(h));
  const ti = col(["title", "name", "product", "product name"]), pi = col(["price", "variant price", "amount"]),
        li = col(["url", "link", "product url", "product link"]), ii = col(["image", "image url", "image src", "photo"]), gi = col(["tags", "category", "type"]);
  if (ti < 0 || pi < 0 || li < 0) return { rows, errors: ["Columns needed: title, price and url (an image column is optional)."] };
  lines.slice(1).forEach((r, n) => {
    if (r.every(x => !String(x).trim())) return;
    const u = safeHttpsUrl(r[li]); const c = cents(r[pi]); const t = clip(r[ti], 200);
    if (!t || !c || !u) { errors.push(`Row ${n + 2}: needs a title, a price and a valid https link.`); return; }
    const img = ii >= 0 ? safeHttpsUrl(r[ii]) : null, host = u.hostname.replace(/^www\./, "");
    rows.push({ product_id: `own:${host}:${hashKey(u.origin + u.pathname)}`, title: t, brand: null, image: img ? img.href : null, price_cents: c, was_cents: null,
      merchant: host, url: u.href, tags: gi >= 0 ? clip(r[gi], 300) : "", available: true, own: true, features: [] });
  });
  return { rows: rows.slice(0, OWN_MAX), errors: errors.slice(0, 20) };
}
function csvRows(s) {
  const out = []; let row = [], f = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(f); f = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && s[i + 1] === "\n") i++; row.push(f); out.push(row); row = []; f = ""; }
    else f += ch;
  }
  if (f || row.length) { row.push(f); out.push(row); }
  return out;
}

// The owner's products that fit what the shopper asked for: words from the AI's searches and the brief
// against title, brand and tags; within budget; best matches first. These go to the picker first (a boost).
export function ownMatches(products, words, budgetCents, limit = 6) {
  const ws = [...new Set(words.flatMap(w => String(w || "").toLowerCase().split(/[^a-z0-9]+/)).filter(w => w.length >= 4))];
  return products.filter(p => p.available !== false && p.price_cents <= budgetCents)
    .map(p => { const t = `${p.title} ${p.brand || ""} ${p.tags || ""}`.toLowerCase(); return { p, s: ws.filter(w => t.includes(w)).length }; })
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limit).map(x => x.p);
}
