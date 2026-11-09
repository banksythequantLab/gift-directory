// gift.directory's own shop: Printful print-on-demand products sold directly (no Etsy fees), paid with PayPal,
// made and shipped by Printful. Pure functions; the Printful/PayPal calls and storage are in worker.js.
// While SHOP_PUBLIC is unset the shop is only reachable at /shop (noindex, unlinked), and Printful orders are
// created as drafts (nothing prints until someone confirms them in the Printful dashboard).

const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
export const usd = c => (Math.round(c) / 100).toFixed(2);
const cents = v => Math.round(Number(v) * 100);

// "Outlast the Hurricane Shirt, Hurricane Season Tee, Front and Back Print, ..." -> "Outlast the Hurricane Shirt"
export const shortTitle = name => clip(String(name || "").split(",")[0], 80);
export const kindOf = name => /custom text/i.test(name) ? "text" : /photo/i.test(name) ? "photo" : "fixed";

// ---------- design templates: the buyer fills in a few fields, we render the print file ----------
export const TEMPLATES = {
  text: { name: "Custom text", keepCase: true, fields: [
    { label: "Line 1", max: 22, req: true, ph: "WORLD'S BEST" }, { label: "Line 2 (optional)", max: 22, ph: "AUNT" }] },
  role: { name: "Name & role", fields: [
    { label: "Name", max: 22, req: true, ph: "Dr. Maria Lopez" }, { label: "Role or title", max: 28, req: true, ph: "Emergency Medicine" },
    { label: "Since (optional)", max: 16, ph: "Est. 2026" }] },
  milestone: { name: "Milestone", fields: [
    { label: "The milestone", max: 20, req: true, ph: "Made Partner" }, { label: "Year (optional)", max: 12, ph: "2026" },
    { label: "Name (optional)", max: 24, ph: "Maria Lopez" }] },
  roster: { name: "Family & team", fields: [
    { label: "Family or team name", max: 18, req: true, ph: "The Smiths" }, { label: "Event (optional)", max: 26, ph: "Thanksgiving 2026" },
    { label: "Names (optional)", max: 80, ph: "Ann, Bob, Cal, Dee" }] },
};
export const SAMPLES = { text: ["YOUR TEXT", "HERE"], role: ["Dr. Maria Lopez", "Emergency Medicine", "Est. 2026"],
  milestone: ["Made Partner", "2026", "Maria Lopez"], roster: ["The Smiths", "Thanksgiving 2026", "Ann, Bob, Cal, Dee, Eve"] };
// Print areas from Printful's printfiles (GET /mockup-generator/printfiles/<product>). w x h is the print file;
// `sizes` overrides it per catalog variant. bw: the design's width as a share of the print width. top: where the
// design starts (share of height); without it the design is centered at cy (default 0.5). copies: centers of the
// design across a wrap (shares of width). fill: a background printed under the design. ink: the lettering color.
// bg: what the buyer's preview sits on. example: the design shown on the product until the buyer types.
const DARK = "#1d2433";
export const PTYPES = {
  tee: { placement: "front", dpi: 150, w: 1800, h: 2400, ink: "#ffffff", bg: "#222222", bw: 0.9167, top: 0.0833 },
  hoodie: { placement: "front", dpi: 150, w: 2100, h: 2100, ink: "#ffffff", bg: "#222222", bw: 0.762, top: 0.1238 },
  mug: { placement: "default", w: 2700, h: 1050, ink: DARK, bg: "#ffffff", bw: 0.4074, copies: [0.25, 0.75] },
  ornament: { placement: "front", w: 954, h: 954, sizes: { 22782: [954, 954], 22783: [978, 972] }, ink: DARK, bg: "#ffffff", bw: 0.62, cy: 0.48,
    example: { tpl: "milestone", vals: ["Our First Christmas", "2026", "The Smiths"] } },
  metal: { placement: "front", w: 1275, h: 975, sizes: { 20255: [1275, 975], 20252: [1278, 918] }, ink: DARK, bg: "#ffffff", bw: 0.7,
    example: { tpl: "milestone", vals: ["First Christmas", "2026", "Baby Ava"] } },
  paw: { placement: "front", w: 1239, h: 1200, sizes: { 20253: [1239, 1200] }, ink: DARK, bg: "#ffffff", bw: 0.6, cy: 0.56,
    example: { tpl: "role", vals: ["Bella", "Good Girl", "Est. 2021"] } },
  stocking: { placement: "front", w: 3184, h: 3246, ink: "#2b2118", bg: "#efe6d6", bw: 0.72,
    example: { tpl: "text", vals: ["Ava", ""] } },
  rocks: { placement: "default", w: 3060, h: 600, ink: DARK, bg: "#eef3f6", bw: 0.33, copies: [0.25, 0.75],
    example: { tpl: "milestone", vals: ["Made Partner", "2026", "Jane Doe, Esq."] } },
  wine: { placement: "default", w: 3176, h: 413, ink: DARK, bg: "#eef3f6", bw: 0.3, copies: [0.25, 0.75],
    example: { tpl: "milestone", vals: ["Retired", "2026", ""] } },
  tumbler: { placement: "default", w: 3017, h: 1200, ink: DARK, bg: "#ffffff", bw: 0.38, copies: [0.25, 0.75],
    example: { tpl: "role", vals: ["Jane Doe, RN", "Emergency Nursing", "Est. 2026"] } },
  cooler: { placements: ["front", "back"], w: 1260, h: 1528, sizes: { 19461: [1260, 1528], 19462: [1076, 2085] }, ink: DARK, bg: "#ffffff", bw: 0.85,
    example: { tpl: "roster", vals: ["The Smiths", "Lake Weekend 2026", ""] } },
  bowl: { placement: "default", w: 6496, h: 803, ink: DARK, bg: "#ffffff", bw: 0.2, copies: [0.25, 0.75],
    example: { tpl: "role", vals: ["Bella", "Good Girl", ""] } },
  board: { placement: "front", dpi: 200, w: 3150, h: 2350, sizes: { 23468: [3150, 2350], 23469: [2250, 1650] }, ink: DARK, bg: "#ffffff", fill: "#ffffff", bw: 0.6,
    example: { tpl: "roster", vals: ["The Smiths", "Est. 2015", ""] } },
  deskmat: { placement: "default", w: 5610, h: 3839, sizes: { 22325: [5610, 3839], 22326: [6791, 3839], 22327: [9921, 5197] }, ink: "#ffffff", bg: DARK, fill: DARK, bw: 0.5,
    example: { tpl: "role", vals: ["Jane Doe, Esq.", "Attorney at Law", ""] } },
  puzzle: { placement: "default", w: 4200, h: 3300, sizes: { 13431: [4200, 3300], 13432: [6000, 4800] }, ink: "#ffffff", bg: "#1f3a5f", fill: "#1f3a5f", bw: 0.7,
    example: { tpl: "roster", vals: ["The Smiths", "Family Game Night", "Ann, Ben, Cara, Dev"] } },
  candle: { placement: "front", w: 1194, h: 721, ink: DARK, bg: "#ffffff", bw: 0.8,
    example: { tpl: "text", vals: ["Jane's", "Calm Corner"] } },
};
// The print size for an order: the variant's own printfile if it has one.
export const printSize = (ptype, catalogVariant) => (PTYPES[ptype].sizes && PTYPES[ptype].sizes[catalogVariant]) || [PTYPES[ptype].w, PTYPES[ptype].h];
// Rendering width for a print file: full size up to 3600 px on the long side (Workers memory); Printful scales up.
export const renderWidth = (w, h) => Math.round(w * Math.min(1, 3600 / Math.max(w, h)));
export const exampleFor = ptype => PTYPES[ptype].example || null;
// What an order row's `kind` means: "fixed", "tpl:<template>:<product type>", or the first shop's "text" (custom-text tee).
export function parseKind(kind) {
  if (kind === "text") return { tpl: "text", ptype: "tee" };
  const m = /^tpl:(\w+):(\w+)$/.exec(String(kind || ""));
  return m && TEMPLATES[m[1]] && PTYPES[m[2]] ? { tpl: m[1], ptype: m[2] } : null;
}
export const rowKind = (card, tpl) => card.kind === "tpl" ? `tpl:${tpl || card.tpl}:${card.ptype}` : "fixed";

// One card per Printful sync product (from GET /store/products/{id}). External ids: "gd-tpl-<template>-<type>"
// is one fixed design; "gd-item-<type>" lets the buyer pick any design, starting from the type's example.
// Photo shirts wait for uploads, so they're skipped.
export function shopCard(d) {
  const p = d.sync_product, vs = (d.sync_variants || []).filter(v => !v.is_ignored && v.availability_status !== "discontinued");
  const ext = String(p.external_id || ""), m = /^gd-tpl-(\w+)-(\w+)$/.exec(ext), mi = /^gd-item-(\w+)$/.exec(ext);
  let tpl = m && TEMPLATES[m[1]] && PTYPES[m[2]] ? m[1] : null, ptype = tpl ? m[2] : null, tpls = tpl ? [tpl] : null;
  if (!tpl && mi && PTYPES[mi[1]]) { ptype = mi[1]; tpls = Object.keys(TEMPLATES); tpl = (exampleFor(ptype) || {}).tpl || "role"; }
  if (!tpl && kindOf(p.name) === "text") { tpl = "text"; ptype = "tee"; tpls = ["text"]; }
  if ((!tpl && kindOf(p.name) === "photo") || !vs.length) return null;
  const prev = vs.map(v => (v.files || []).find(f => f.type === "preview")).find(Boolean);
  const name = String(p.name || ""), rest = clip(name.slice(name.indexOf(",") + 1), 140), P = ptype && PTYPES[ptype];
  return {
    id: p.id, kind: tpl ? "tpl" : "fixed", title: shortTitle(name), subtitle: name.includes(",") ? rest : "",
    ...(tpl ? { tpl, tpls, ptype, fields: TEMPLATES[tpl].fields, design: TEMPLATES[tpl].name, example: exampleFor(ptype), print: { w: P.w, h: P.h, bg: P.bg },
      designs: tpls.map(t => ({ tpl: t, name: TEMPLATES[t].name, fields: TEMPLATES[t].fields })) } : {}),
    // A product thumbnail (our mockup) beats the variant preview, which for API-made products is the bare print file.
    image: (/\.(png|jpe?g|webp)$/i.test(p.thumbnail_url || "") && p.thumbnail_url) || (prev && (prev.preview_url || prev.thumbnail_url)) || null,
    price_cents: Math.min(...vs.map(v => cents(v.retail_price))),
    variants: vs.map(v => ({ id: v.id, catalog_id: v.variant_id, color: v.color || "", size: v.size || "", price_cents: cents(v.retail_price) })),
  };
}

// ---------- the "Personalize it" shelf in a store (shown only when SHOP_PUBLIC is on) ----------
// Each store gets the shop's template products, opened with an example written for its people.
export const STORE_SHELVES = {
  lawyers: { role: ["Jane Doe, Esq.", "Attorney at Law", "Admitted 2026"], milestone: ["Made Partner", "2026", "Jane Doe, Esq."],
    text: ["OBJECTION!", "SUSTAINED"], roster: ["Doe & Partners", "Firm Retreat 2026", "Ann, Ben, Cara, Dev"] },
  nurses: { role: ["Jane Doe, RN", "Emergency Nursing", "Est. 2026"], milestone: ["Finally an RN", "2026", "Jane Doe"],
    text: ["NURSE BY DAY", "CAFFEINATED BY NIGHT"], roster: ["4 West Night Crew", "Nurses Week 2026", "Ann, Ben, Cara, Dev"] },
  "firefighter-gifts": { role: ["Capt. Jane Doe", "Engine Company 12", "Est. 2026"], milestone: ["Retired", "2026", "Capt. Jane Doe"],
    text: ["FIRST IN", "LAST OUT"], roster: ["Engine 12", "Station 12 Family", "Ann, Ben, Cara, Dev"] },
};
// Pick-your-design items each store adds, opened on the design that suits its example: [product type, design].
const SHELF_ITEMS = {
  lawyers: [["rocks", "milestone"], ["deskmat", "role"]],
  nurses: [["tumbler", "role"], ["ornament", "milestone"]],
  "firefighter-gifts": [["rocks", "milestone"], ["cooler", "roster"]],
};
const SHELF_PICKS = [["role", "tee"], ["role", "mug"], ["role", "hoodie"], ["milestone", "tee"], ["milestone", "mug"], ["text", "tee"], ["text", "mug"], ["roster", "tee"]];
// `mockups` (shop-mockups.json): per store, a Printful mockup of that store's example on each product.
export function storeShopShelf(cards, slug, origin = "https://gift.directory", mockups = {}) {
  const ex = STORE_SHELVES[slug]; if (!ex) return null;
  const out = [];
  const picks = [...SHELF_PICKS.map(([t, p]) => [t, p, false]), ...(SHELF_ITEMS[slug] || []).map(([p, t]) => [t, p, true])];
  for (const [t, p, isItem] of picks) {
    const c = cards.find(x => x.kind === "tpl" && x.ptype === p && (isItem ? (x.tpls || []).length > 1 && x.tpls.includes(t) : x.tpl === t && (x.tpls || [t]).length === 1));
    if (!c || !ex[t] || validateFields(t, ex[t]).error) continue;
    const q = new URLSearchParams([["p", String(c.id)], ...(isItem ? [["t", t]] : []), ...ex[t].map(v => ["f", v])]);
    out.push({ product_id: `shop:${c.id}`, title: c.title, brand: "Personalized for you", image: (mockups[slug] && mockups[slug][c.id]) || c.image, price_cents: c.price_cents, was_cents: null,
      merchant: "gift.directory", url: `${origin}/shop?${q}`, own: true, available: true, features: ["Personalizable"] });
  }
  return out.length ? { title: "Personalize it", cards: out, note: "Made to order with their name or your words, printed and shipped by Printful." } : null;
}

export const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
// Characters the bundled print font has (Latin-1 + curly quotes, dashes, ellipsis).
const PRINTABLE = /^[\x20-\x7E -ÿ‘-”…–—]*$/;
export const MAX_LINE = 22;

export function validateRecipient(r) {
  if (!r || typeof r !== "object") return { error: "Add a shipping address." };
  const o = { name: clip(r.name, 60), address1: clip(r.address1, 100), address2: clip(r.address2, 100) || null, city: clip(r.city, 60),
    state_code: clip(r.state_code, 2).toUpperCase(), zip: clip(r.zip, 10), country_code: "US", email: clip(r.email, 200).toLowerCase() };
  if (!o.name) return { error: "Add the name to ship to." };
  if (!o.address1 || !o.city) return { error: "Add the street address and city." };
  if (!STATES.includes(o.state_code)) return { error: "Pick a US state (we ship within the US for now)." };
  if (!/^\d{5}(-\d{4})?$/.test(o.zip)) return { error: "The ZIP code should look like 10001." };
  if (!EMAIL.test(o.email)) return { error: "Add an email for the receipt." };
  return { recipient: o };
}

// The buyer's fields for a template, kept in field order (an empty optional field stays "").
export function validateFields(tpl, vals) {
  const T = TEMPLATES[tpl]; if (!T) return { error: "That design isn't available." };
  const vs = T.fields.map((f, i) => String((Array.isArray(vals) ? vals[i] : "") ?? "").replace(/\s+/g, " ").trim());
  for (const [i, f] of T.fields.entries()) {
    if (f.req && !vs[i]) return { error: `Fill in "${f.label}".` };
    if (vs[i].length > f.max) return { error: `Keep "${f.label.replace(/ \(optional\)$/, "")}" to ${f.max} characters.` };
    if (!PRINTABLE.test(vs[i])) return { error: "Use letters, numbers and common punctuation (no emoji)." };
  }
  return { lines: vs };
}

// Everything a checkout needs, checked against the live product.
export function validateShopOrder(b, card) {
  if (!card) return { error: "That product isn't available." };
  const v = card.variants.find(x => x.id === Number(b && b.variant_id));
  if (!v) return { error: "Pick a size." };
  const qty = Math.round(Number((b && b.qty) || 1));
  if (!(qty >= 1 && qty <= 10)) return { error: "Quantity should be 1 to 10." };
  const r = validateRecipient(b && b.recipient); if (r.error) return r;
  let lines = null, tpl = null;
  if (card.kind === "tpl") {
    tpl = (card.tpls || [card.tpl]).includes(b.tpl) ? b.tpl : card.tpl;
    const l = validateFields(tpl, b.lines); if (l.error) return l; lines = l.lines;
  }
  return { order: { card, variant: v, qty, lines, tpl, gift_message: clip(b && b.gift_message, 200) || null, recipient: r.recipient } };
}

// Printful's shipping answer: the STANDARD rate if there is one, else the cheapest.
export function pickRate(rates) {
  const rs = (Array.isArray(rates) ? rates : []).filter(r => r && Number(r.rate) >= 0);
  if (!rs.length) return null;
  const r = rs.find(x => x.id === "STANDARD") || rs.reduce((a, b) => (Number(b.rate) < Number(a.rate) ? b : a));
  return { id: r.id, name: clip(r.name, 120), cents: cents(r.rate), min_days: r.minDeliveryDays ?? null, max_days: r.maxDeliveryDays ?? null };
}

// ---------- the print file ----------
const xml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const W_EM = 0.7;   // average advance of Inter Display Black capitals, a little generous so text never runs off the print area
const fitFs = (t, maxFs, bw, ls = 0) => Math.max(1, Math.min(Math.round(maxFs), Math.floor(bw / (Math.max(String(t).length, 1) * (W_EM + ls)))));
function wrap(words, n) {
  const out = []; let cur = "";
  for (const w of words) { const next = cur ? cur + " · " + w : w; if (next.length > n && cur) { out.push(cur); cur = w; } else cur = next; }
  if (cur) out.push(cur); return out;
}
// The design as a stack of lines and rules; sizes come from the width of the print box.
export function designItems(tpl, vals, bw) {
  const v = (vals || []).map(x => String(x ?? "").trim()), up = s => s.toUpperCase(), it = [];
  const line = (t, maxFs, ls = 0) => { if (t) it.push({ t, fs: fitFs(t, maxFs, bw, ls), ls }); };
  const rule = () => it.push({ rule: true });
  if (tpl === "text") {
    const ls = v.filter(Boolean).slice(0, 2), fs = fitFs("x".repeat(Math.max(...ls.map(l => l.length), 4)), bw * 0.18, bw);
    ls.forEach(t => it.push({ t, fs, ls: 0 }));
  } else if (tpl === "role") {
    line(up(v[0]), bw * 0.16); rule(); line(up(v[1]), bw * 0.072, 0.12); line(up(v[2] || ""), bw * 0.05, 0.2);
  } else if (tpl === "milestone") {
    line(up(v[0]), bw * 0.15); line(v[1] || "", bw * 0.2); if (v[2]) { rule(); line(up(v[2]), bw * 0.05, 0.15); }
  } else if (tpl === "roster") {
    line(up(v[0]), bw * 0.15); line(up(v[1] || ""), bw * 0.058, 0.12);
    const names = up(v[2] || "").split(/\s*[,;/]\s*|\s{2,}/).filter(Boolean);
    if (names.length) { rule(); const ls = wrap(names, 28).slice(0, 4), fs = fitFs("x".repeat(Math.max(...ls.map(l => l.length))), bw * 0.05, bw, 0.04); ls.forEach(t => it.push({ t, fs, ls: 0.04 })); }
  }
  return it;
}
function stack(tpl, vals, bw, minFs = 0) {
  const els = []; let y = 0;
  // Lines too small to print legibly are left out (the preview shows exactly what will print), with any rule before them.
  const all = designItems(tpl, vals, bw), first = all.find(i => !i.rule);
  const its = all.filter(i => i.rule || i === first || i.fs >= minFs)
    .filter((i, k, a) => !i.rule || (a[k + 1] && !a[k + 1].rule && k > 0));
  for (const i of its) {
    if (i.rule) { const rh = Math.max(3, Math.round(bw * 0.006)); y += Math.round(bw * 0.03); els.push({ rule: true, y, rh }); y += rh + Math.round(bw * 0.045); }
    else { const base = y + (els.length && !els[els.length - 1].rule && els[els.length - 1].fs !== i.fs ? Math.round(i.fs * 0.3) : 0) + Math.round(i.fs * 0.74); els.push({ ...i, y: base }); y = base + Math.round(i.fs * 0.34); }
  }
  return { els, y };
}
// The print file as SVG at the product's print size (or a variant's own size). A design too tall for a short
// print area (a glass, a bowl) is narrowed until it fits.
export function designSvg(tpl, ptype, vals, size) {
  const P = PTYPES[ptype], [W, H] = size || [P.w, P.h];
  const bw0 = Math.round(W * P.bw), room = P.top != null ? H * (1 - P.top) * 0.9 : H * 0.84;
  const minFs = Math.round((P.dpi || 300) * 0.13 * W / P.w);   // ~0.09 in capitals
  // Too tall: shrink to fit, leaving out any line the shrinking would make illegible, then shrink again.
  let thr = 0, s = stack(tpl, vals, bw0);
  for (let k = 0; k < 4 && s.y > room; k++) { const t = minFs * s.y / room; if (t <= thr) break; thr = t; s = stack(tpl, vals, bw0, thr); }
  const scale = Math.min(1, room / s.y), bw = Math.floor(bw0 * scale), { els, y } = stack(tpl, vals, bw, thr * scale);
  const top = P.top != null ? Math.round(H * P.top) : Math.round(H * (P.cy ?? 0.5) - y / 2), xs = (P.copies || [0.5]).map(f => W * f);
  return designMarkup(P, W, H, bw, els, top, xs);
}
function designMarkup(P, W, H, bw, els, top, xs) {
  const body = xs.map(cx => els.map(e => e.rule
    ? `<rect x="${Math.round(cx - bw * 0.18)}" y="${top + e.y}" width="${Math.round(bw * 0.36)}" height="${e.rh}" fill="${P.ink}"/>`
    : `<text x="${Math.round(cx + e.ls * e.fs / 2)}" y="${top + e.y}" text-anchor="middle" font-family="Inter Display" font-weight="900" font-size="${e.fs}"${e.ls ? ` letter-spacing="${Math.round(e.ls * e.fs)}"` : ""} fill="${P.ink}">${xml(e.t)}</text>`).join("")).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${P.fill ? `<rect width="${W}" height="${H}" fill="${P.fill}"/>` : ""}${body}</svg>`;
}

export function shopPayPalOrder(o, origin) {
  const unit = o.variant.price_cents, sub = unit * o.qty, total = sub + o.shipping_cents, r = o.recipient;
  const label = [o.variant.color, o.variant.size].filter(Boolean).join(" / ");
  return {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: o.id, custom_id: o.id, description: clip(`gift.directory: ${o.card.title}`, 127),
      amount: { currency_code: "USD", value: usd(total), breakdown: { item_total: { currency_code: "USD", value: usd(sub) }, shipping: { currency_code: "USD", value: usd(o.shipping_cents) } } },
      items: [{ name: clip(`${o.card.title}${label ? " (" + label + ")" : ""}`, 127), quantity: String(o.qty), unit_amount: { currency_code: "USD", value: usd(unit) }, category: "PHYSICAL_GOODS", sku: `pf-${o.variant.id}` }],
      shipping: { name: { full_name: r.name }, address: { address_line_1: r.address1, ...(r.address2 ? { address_line_2: r.address2 } : {}), admin_area_2: r.city, admin_area_1: r.state_code, postal_code: r.zip, country_code: "US" } },
    }],
    payment_source: { paypal: { experience_context: {
      brand_name: "gift.directory", shipping_preference: "SET_PROVIDED_ADDRESS", user_action: "PAY_NOW", landing_page: "LOGIN",
      return_url: `${origin}/api/shop/return`, cancel_url: `${origin}/api/shop/cancel`,
    } } },
  };
}

// The Printful order once PayPal has captured. Template products are ordered from the catalog with our print
// file in the product's placement; fixed designs by their synced variant. Created as a draft unless confirmed.
export function printfulOrder(row, printUrl) {
  const r = JSON.parse(row.recipient_json), k = parseKind(row.kind);
  const item = k
    ? { variant_id: row.pf_catalog_variant_id, quantity: row.qty, retail_price: usd(row.unit_cents), name: row.title,
        files: (PTYPES[k.ptype].placements || [PTYPES[k.ptype].placement]).map(type => ({ type, url: printUrl })) }
    : { sync_variant_id: row.pf_sync_variant_id, quantity: row.qty, retail_price: usd(row.unit_cents) };
  return {
    external_id: row.id, shipping: "STANDARD",
    recipient: { name: r.name, address1: r.address1, ...(r.address2 ? { address2: r.address2 } : {}), city: r.city, state_code: r.state_code, country_code: "US", zip: r.zip, email: r.email },
    items: [item],
    retail_costs: { currency: "USD", subtotal: usd(row.subtotal_cents), shipping: usd(row.shipping_cents), tax: "0.00" },
    ...(row.gift_message ? { gift: { subject: "A gift for you", message: row.gift_message } } : {}),
    packing_slip: { store_name: "gift.directory", email: "hello@gift.directory", message: "Thank you for shopping gift.directory." },
  };
}

const escH = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function receiptEmail(row) {
  const r = JSON.parse(row.recipient_json), lines = row.lines_json ? JSON.parse(row.lines_json).filter(Boolean) : null;
  const what = `${row.title}${row.variant_label ? " (" + row.variant_label + ")" : ""} × ${row.qty}`;
  const subject = `Your gift.directory order: ${row.title}`;
  const text = `Thanks for your order!\n\n${what}${lines ? `\nYour text: ${lines.join(" / ")}` : ""}\n\nItems: $${usd(row.subtotal_cents)}\nShipping: $${usd(row.shipping_cents)}\nTotal paid: $${usd(row.total_cents)}\n\n` +
    `Shipping to: ${r.name}, ${r.address1}${r.address2 ? ", " + r.address2 : ""}, ${r.city}, ${r.state_code} ${r.zip}\n\nIt's printed to order by our partner Printful and shipped to that address. Order number: ${row.id}\nQuestions? Reply to hello@gift.directory.\n\n— gift.directory`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;color:#1d2433;line-height:1.5">
<p style="font-size:1.05rem"><b>Thanks for your order!</b></p><p>${escH(what)}${lines ? `<br>Your text: <b>${escH(lines.join(" / "))}</b>` : ""}</p>
<p>Items: $${usd(row.subtotal_cents)}<br>Shipping: $${usd(row.shipping_cents)}<br><b>Total paid: $${usd(row.total_cents)}</b></p>
<p>Shipping to: ${escH(r.name)}, ${escH(r.address1)}${r.address2 ? ", " + escH(r.address2) : ""}, ${escH(r.city)}, ${escH(r.state_code)} ${escH(r.zip)}</p>
<p style="color:#6b7280">It's printed to order by our partner Printful and shipped to that address. Order number: ${escH(row.id)}. Questions? Write to hello@gift.directory.</p>
<p style="color:#6b7280;font-size:.85rem">— gift.directory</p></div>`;
  return { subject, text, html };
}
