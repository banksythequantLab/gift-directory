// Gift Finder — API worker. Static pages (finder, pool page) are served from ./public.
import { paypalFetch, link, paypalMode } from "./paypal-core.js";
import { validateBrief, findGifts, browseGifts, channel3Search, toCard, mergeCards } from "./finder.js";
import { validatePool, contributionError, buildContributionOrder, readCapture, applyCapture, publicPool } from "./pools.js";
import { ROOT, DRAFT_SYSTEM, parseDraft, validateStore, storePlanSystem, subscriptionBody, storeStatusFor, hostKey, publicStore, darkEnough } from "./stores.js";
import { PAGES, pageBySlug, GUIDE_SYSTEM, guidePrompt, parseGuide, pageBrief, renderGuide, renderHub, renderTopic, topicSlug, topicBySlug, related, teamNav, TEAM_PAGES, THEME_PAGES, sitemap, adSlot, configureAds, diversify, allowed } from "./seo.js";
import { LEGAL_SLUGS, renderLegal } from "./legal.js";
import { authorizeUrl, paypalWebBase, parseUserinfo, ownsStore, validateSettings, validateItem, shelves, withoutHidden } from "./owners.js";
import { OWN_MAX, safeHttpsUrl, shopOrigin, shopifyCards, productFromHtml, parseCsv, ownMatches } from "./own.js";
import { ETSY_API, ETSY_NOTICE, etsyShopName, etsyShopUrl, pickShop, etsyCards } from "./etsy.js";
import { cjSearch } from "./cj.js";
import { TEE, teePromo } from "./promo.js";
import { REG_MAX_ITEMS, REG_POOL_MIN_CENTS, validateRegistry, registrySlug, validateRegItem, publicRegistry, REG_AI_SYSTEM, regAiPrompt, parseRegAi, poolTarget, reminderSendOn, validateReminder, reminderEmail } from "./registry.js";
import { ASSIST_SYSTEM, MAX_STEPS, SHELF_MAX, storeBrief, assistPrompt, parseAssist, matchHide, pickShelf, describeStep, PICK_SYSTEM, pickPrompt, applyPicks, capKinds } from "./assistant.js";
import { ogTags, poolMeta, registryMeta, storeMeta, PLATFORM_META, REGISTRY_HOME_META } from "./meta.js";
import { shopCard, validateShopOrder, validateFields, pickRate, designSvg, PTYPES, TEMPLATES, SAMPLES, parseKind, rowKind, storeShopShelf, printSize, renderWidth, exampleFor, DESIGN_VERSION, salesTax, taxTable, shopPayPalOrder, printfulOrder, receiptEmail, imageInfo, PHOTO_ID, PHOTO_MIN, PHOTO_GOOD, PHOTO_MAX_BYTES } from "./shop.js";
import { svgToPng } from "./print.js";
import { renderSVG } from "uqr";
import STORE_MOCKUPS from "./shop-mockups.json";

const now = () => new Date().toISOString();
// Guide price/stock refresh budget (see the /gifts/<slug> route): ~570 pages every 14 days is ~40 a day, ~280 searches.
const REFRESH_DAYS = 14, REFRESH_PER_DAY = 40;
// Unbuilt team pages, a few per run, one after another (each build is several searches and two model calls).
async function retryTeamPages(db, env, max = 6) {
  const built = new Set((await db.prepare("SELECT slug FROM seo_pages").all()).results.map(r => r.slug));
  // Rotate by week so the same few hopeless teams don't take every turn.
  const left = [...TEAM_PAGES, ...THEME_PAGES].filter(p => !built.has(p.slug)), at = left.length ? (Math.floor(Date.now() / 6048e5) * max) % left.length : 0;
  const todo = [...left.slice(at), ...left.slice(0, at)].slice(0, max), out = [];
  for (const p of todo) out.push({ slug: p.slug, ...(await buildGuide(db, env, p).catch(e => ({ ok: false, error: String(e) }))) });
  console.log("team retry", JSON.stringify(out.map(o => [o.slug, o.ok])));
  return out;
}
const uid = () => crypto.randomUUID();
const J = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
async function readJson(req) { try { return await req.json(); } catch { return null; } }
const shortId = () => { const a = "abcdefghjkmnpqrstuvwxyz23456789", b = crypto.getRandomValues(new Uint8Array(8)); return [...b].map(x => a[x % a.length]).join(""); };
async function sha256(s) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join(""); }
const paypalOn = env => !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);

// The finder's model: OpenAI-compatible chat on Nebius Token Factory, JSON out.
function aiFor(env) {
  return async (system, user) => {
    if (!env.NEBIUS_API_KEY) throw new Error("no model key");
    const base = (env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1").replace(/\/+$/, "");
    const r = await fetch(`${base}/chat/completions`, { method: "POST",
      headers: { authorization: `Bearer ${env.NEBIUS_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: env.TEXT_MODEL || "Qwen/Qwen3-235B-A22B-Instruct-2507", temperature: 0.4, max_tokens: 1200,
        response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      signal: AbortSignal.timeout(25000) });
    if (!r.ok) throw new Error(`model ${r.status}`);
    const j = await r.json();
    return JSON.parse(j.choices[0].message.content);
  };
}

// Gift box on a rounded square, 64-unit grid (scripts/make-favicon.py draws the same for the .ico).
const faviconSvg = accent => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
  `<rect width="64" height="64" rx="14" fill="${accent}"/>` +
  `<rect x="13" y="30" width="38" height="22" rx="3" fill="#fff"/><rect x="10" y="22" width="44" height="9" rx="3" fill="#fff"/>` +
  `<rect x="29" y="22" width="6" height="30" fill="#b08d57"/>` +
  `<ellipse cx="25" cy="17" rx="5" ry="4" fill="none" stroke="#b08d57" stroke-width="4"/>` +
  `<ellipse cx="39" cy="17" rx="5" ry="4" fill="none" stroke="#b08d57" stroke-width="4"/></svg>`;

// ---------- gift guides ----------
// The guide text is written once; the products are found the same way a store's finder finds them.
async function buildGuide(db, env, p, { cardsOnly = false } = {}) {
  const ai = aiFor(env);
  let guide = null;
  const old = await db.prepare("SELECT guide_json FROM seo_pages WHERE slug=?").bind(p.slug).first();
  if (cardsOnly && old) guide = JSON.parse(old.guide_json);
  else { guide = parseGuide(await ai(GUIDE_SYSTEM, guidePrompt(p)).catch(() => null), p); if (!guide) return { ok: false, error: "the model gave no usable guide" }; }
  const brief = pageBrief(p);
  // A "10 best" page with fixed slots: one search per category, the top in-stock product of each, then one AI call for the reasons.
  if (p.slots) {
    // CJ products from joined advertisers come first (they pay us directly); Channel3 fills the rest. No CJ keys, no CJ.
    const found = await Promise.all(p.slots.map(q => Promise.all([
      cjSearch(env, q, brief, { limit: 40 }).then(cs => cs.slice(0, 6)).catch(() => []),
      channel3Search(env, q, brief).then(ps => ps.map(x => toCard(x, brief.budget_cents))).catch(() => []),
    ]).then(([cj, c3]) => [...cj, ...c3])));
    // Up to six candidates per slot; the AI picks the best-known, best-reviewed-sounding one by index and says why.
    // `slotMust[i]`: the product title must name that slot's kind (a scarf slot can't fill with a fourth jersey).
    const fits = (c, i) => !p.slotMust || !p.slotMust[i] || p.slotMust[i].some(w => String(c.title || "").toLowerCase().includes(w));
    const cands = found.map((list, i) => mergeCards([list.filter(Boolean)]).filter(c => allowed(p, c, i) && fits(c, i)).slice(0, 6));
    let choice = [];
    try {
      const out = (await ai("You pick the single best gift in each category for a page titled \"" + p.keyword + "\". Prefer well-known brands and real, " +
        "current products over generic or knock-off listings. Only use what the titles say; never invent specs. " +
        "The reason is for the shopper: why this makes a meaningful gift for the occasion" + (p.anniversary ? " and its theme (" + p.anniversary.traditional.replace(/\s*\(.*\)$/, "") + " / " + p.anniversary.modern + ")" : "") +
        ". Never mention the price, never compare it to the other options, never say 'highest-priced' or 'premium option'. " +
        "Answer only JSON: {\"picks\":[{\"slot\":0,\"pick\":2,\"reason\":\"one warm sentence under 25 words\"}]} with one entry per slot.",
        JSON.stringify(cands.map((l, i) => ({ slot: i, category: p.slots[i], options: l.map((c, k) => `${k}: ${c.title} ($${(c.price_cents || 0) / 100})`) })))));
      choice = Array.isArray(out && out.picks) ? out.picks : [];
    } catch { choice = []; }
    const chosen = [], seen = new Set();
    cands.forEach((l, i) => {
      const ch = choice.find(x => x && x.slot === i), k = ch && Number.isInteger(ch.pick) && l[ch.pick] ? ch.pick : 0;
      const c = l[k] && !seen.has(l[k].product_id) ? l[k] : l.find(x => !seen.has(x.product_id));
      if (!c) return;
      seen.add(c.product_id);
      const group = p.slotGroups ? p.slotGroups[i] : undefined;
      chosen.push({ ...(ch && typeof ch.reason === "string" && ch.reason.length > 10 && c === l[k] ? { ...c, reason: ch.reason.slice(0, 220) } : c), ...(group ? { group } : {}) });
    });
    if (chosen.length < (p.minCount || p.count || chosen.length)) return { ok: false, error: `only ${chosen.length} of ${p.slots.length} slots found a product` };
    const cards = chosen.slice(0, p.count || 16), t = now();
    await db.prepare("INSERT INTO seo_pages (slug,guide_json,cards_json,updated_at,created_at) VALUES (?,?,?,?,?) " +
      "ON CONFLICT(slug) DO UPDATE SET guide_json=excluded.guide_json, cards_json=excluded.cards_json, updated_at=excluded.updated_at")
      .bind(p.slug, JSON.stringify(guide), JSON.stringify(cards), t, t).run();
    return { ok: true, slug: p.slug, products: cards.length, with_reasons: cards.filter(c => c.reason).length, faq: guide.faq.length };
  }
  // Otherwise a count page runs up to three search rounds and pools them to reach its number of distinct kinds.
  let pool = [], cards = [];
  for (let round = 0; round < (p.count ? 3 : 1); round++) {
    const r = await findGifts(brief, { ai, search: q => channel3Search(env, q, brief), alsoSearch: q => cjSearch(env, q, brief, { limit: 30 }) });
    pool = mergeCards([pool, r.picks || [], r.more || []]);
    cards = diversify(pool.filter(c => allowed(p, c)), p.cap || 3).slice(0, p.count || 16);
    if (!p.count || cards.length >= p.count) break;
  }
  const need = p.count || 4;
  if (cards.length < need) return { ok: false, error: `only ${cards.length} products found (need ${need})` };
  const t = now();
  await db.prepare("INSERT INTO seo_pages (slug,guide_json,cards_json,updated_at,created_at) VALUES (?,?,?,?,?) " +
    "ON CONFLICT(slug) DO UPDATE SET guide_json=excluded.guide_json, cards_json=excluded.cards_json, updated_at=excluded.updated_at")
    .bind(p.slug, JSON.stringify(guide), JSON.stringify(cards), t, t).run();
  return { ok: true, slug: p.slug, products: cards.length, with_reasons: cards.filter(c => c.reason).length, faq: guide.faq.length };
}

// ---------- owners: sessions, Log in with PayPal ----------
function cookieVal(request, name) {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(request.headers.get("cookie") || ""); return m ? m[1] : null;
}
// One login across gift.directory and every <slug>.gift.directory; host-only anywhere else.
function sessionCookie(url, value, maxAge) {
  const dom = url.hostname === ROOT || url.hostname.endsWith("." + ROOT) ? `; Domain=${ROOT}` : "";
  return `gd_s=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}${dom}`;
}
async function currentUser(db, request) {
  const sid = cookieVal(request, "gd_s"); if (!sid) return null;
  const s = await db.prepare("SELECT * FROM sessions WHERE id=? AND expires_at > ?").bind(await sha256(sid), now()).first();
  return s ? { payer_id: s.payer_id, emails: JSON.parse(s.emails_json), name: s.name } : null;
}
async function ownedStores(db, user) {
  const all = (await db.prepare("SELECT * FROM stores ORDER BY created_at").all()).results;
  return all.filter(s => ownsStore(user, s));
}
// The code PayPal handed back → who this person is. The PayPal token is used once and never stored.
async function paypalLogin(env, code) {
  const base = env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const t = await fetch(`${base}/v1/oauth2/token`, { method: "POST",
    headers: { authorization: "Basic " + btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`), "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=authorization_code&code=${encodeURIComponent(code)}` });
  if (!t.ok) return null;
  const tok = (await t.json()).access_token; if (!tok) return null;
  for (const path of ["/v1/identity/oauth2/userinfo?schema=paypalv1.1", "/v1/identity/openidconnect/userinfo?schema=openid"]) {
    const r = await fetch(base + path, { headers: { authorization: `Bearer ${tok}` } });
    if (r.ok) { const u = parseUserinfo(await r.json()); if (u) return u; }
  }
  return null;
}
async function storeItems(db, storeId) {
  return (await db.prepare("SELECT * FROM store_items WHERE store_id=?").bind(storeId).all()).results;
}
// ---------- the owner's own products (Shopify, links, CSV) ----------
async function ownProducts(db, storeId, { all = false } = {}) {
  const rows = (await db.prepare(`SELECT card_json, available, kind, source_id FROM own_products WHERE store_id=?${all ? "" : " AND available=1"} ORDER BY updated_at DESC LIMIT ${OWN_MAX}`).bind(storeId).all()).results;
  return rows.map(r => ({ ...JSON.parse(r.card_json), available: !!r.available, kind: r.kind, source_id: r.source_id }));
}
// Fetch a public page or JSON with a size cap and a timeout. Redirects are followed only to other safe https URLs.
async function fetchPublic(u, { json = false, maxBytes = 3_000_000 } = {}) {
  let url = safeHttpsUrl(u); if (!url) throw new Error("That address isn't a public https site.");
  for (let hop = 0; hop < 4; hop++) {
    const r = await fetch(url.href, { redirect: "manual", signal: AbortSignal.timeout(15000),
      headers: { "user-agent": "gift.directory product import (+https://gift.directory/about)", accept: json ? "application/json" : "text/html,application/xhtml+xml" } });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { url = safeHttpsUrl(new URL(r.headers.get("location"), url).href); if (!url) throw new Error("The site redirected somewhere we can't follow."); continue; }
    if (r.status === 429) throw new Error("That site is limiting requests right now. Try again in a few minutes.");
    if (r.status === 401 || r.status === 403) throw new Error("That site blocked the request. Try the CSV import instead.");
    if (!r.ok) throw new Error(`The site answered ${r.status}.`);
    const text = await r.text(); if (text.length > maxBytes) throw new Error("That page is too large to read.");
    if (!json) return { text, url: url.href };
    try { return JSON.parse(text); } catch { throw new Error("This doesn't look like a Shopify store with a public product feed. Add products by link or CSV instead."); }
  }
  throw new Error("Too many redirects.");
}
async function upsertOwn(db, storeId, cards, kind, sourceId = null) {
  const t = now(), have = await db.prepare("SELECT COUNT(*) n FROM own_products WHERE store_id=?").bind(storeId).first();
  const room = Math.max(0, OWN_MAX - have.n);
  const stmts = cards.map(c => db.prepare("INSERT INTO own_products (store_id,product_id,source_id,kind,card_json,available,updated_at,created_at) VALUES (?,?,?,?,?,?,?,?) " +
    "ON CONFLICT(store_id,product_id) DO UPDATE SET card_json=excluded.card_json, available=excluded.available, source_id=excluded.source_id, updated_at=excluded.updated_at")
    .bind(storeId, c.product_id, sourceId, kind, JSON.stringify({ ...c, available: undefined }), c.available === false ? 0 : 1, t, t));
  // New products beyond the cap are dropped; updates to existing ones always go through (ON CONFLICT).
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  if (have.n + cards.length > OWN_MAX) await db.prepare(`DELETE FROM own_products WHERE store_id=? AND rowid NOT IN (SELECT rowid FROM own_products WHERE store_id=? ORDER BY created_at LIMIT ${OWN_MAX})`).bind(storeId, storeId).run();
  return Math.min(cards.length, room + 0);
}
// Pull a Shopify shop's whole public catalog (up to 1000 products), store it, and mark what vanished as unavailable.
async function syncShopify(db, src) {
  const cards = [];
  try {
    for (let page = 1; page <= 4; page++) {
      const j = await fetchPublic(`${src.url}/products.json?limit=250&page=${page}`, { json: true, maxBytes: 8_000_000 });
      const got = shopifyCards(j, src.url); cards.push(...got);
      if (!j || !Array.isArray(j.products) || j.products.length < 250) break;
    }
    if (!cards.length) throw new Error("No products found. Is this a Shopify store with products published to its online store?");
    await upsertOwn(db, src.store_id, cards, "shopify", src.id);
    const ids = cards.map(c => c.product_id);
    const gone = (await db.prepare("SELECT product_id FROM own_products WHERE store_id=? AND source_id=?").bind(src.store_id, src.id).all()).results.filter(r => !ids.includes(r.product_id));
    for (let i = 0; i < gone.length; i += 50) await db.batch(gone.slice(i, i + 50).map(r => db.prepare("UPDATE own_products SET available=0, updated_at=? WHERE store_id=? AND product_id=?").bind(now(), src.store_id, r.product_id)));
    await db.prepare("UPDATE own_sources SET last_synced=?, last_error=NULL, product_count=? WHERE id=?").bind(now(), cards.length, src.id).run();
    return { ok: true, count: cards.length, available: cards.filter(c => c.available !== false).length };
  } catch (e) {
    await db.prepare("UPDATE own_sources SET last_synced=?, last_error=? WHERE id=?").bind(now(), String(e.message || e).slice(0, 300), src.id).run();
    return { ok: false, error: String(e.message || e) };
  }
}
// Pull an Etsy shop's active listings (up to 1000) through the Etsy Open API; same bookkeeping as Shopify.
async function etsyGet(env, path) {
  const r = await fetch(ETSY_API + path, { signal: AbortSignal.timeout(15000), headers: { "x-api-key": env.ETSY_API_KEY, accept: "application/json" } });
  if (r.status === 429) throw new Error("Etsy is limiting requests right now. Try again in a few minutes.");
  if (r.status === 401 || r.status === 403) throw new Error("Etsy refused the request (the site's Etsy app key may not be approved yet).");
  if (!r.ok) throw new Error(`Etsy answered ${r.status}.`);
  return r.json();
}
async function syncEtsy(env, db, src) {
  try {
    if (!env.ETSY_API_KEY) throw new Error("Etsy connections aren't switched on yet.");
    const name = etsyShopName(src.url); if (!name) throw new Error("That isn't an Etsy shop address.");
    const shop = pickShop(await etsyGet(env, `/shops?shop_name=${encodeURIComponent(name)}`), name);
    if (!shop) throw new Error(`No Etsy shop named ${name}.`);
    const cards = [];
    // Public endpoints only (an API key, no seller sign-in): the shop's active listings, then the same
    // listings again through the batch endpoint, which is the one that can attach their photos.
    for (let off = 0; off < OWN_MAX; off += 100) {
      const j = await etsyGet(env, `/shops/${shop.shop_id}/listings/active?limit=100&offset=${off}`);
      const ids = (Array.isArray(j.results) ? j.results : []).map(l => l.listing_id).filter(Boolean);
      if (ids.length) {
        const b = await etsyGet(env, `/listings/batch?listing_ids=${ids.join(",")}&includes=Images`).catch(() => j);
        cards.push(...etsyCards(b, shop.shop_name));
      }
      if (ids.length < 100) break;
    }
    if (!cards.length) throw new Error("That Etsy shop has no active listings.");
    await upsertOwn(db, src.store_id, cards, "etsy", src.id);
    const ids = new Set(cards.map(c => c.product_id));
    const gone = (await db.prepare("SELECT product_id FROM own_products WHERE store_id=? AND source_id=?").bind(src.store_id, src.id).all()).results.filter(r => !ids.has(r.product_id));
    for (let i = 0; i < gone.length; i += 50) await db.batch(gone.slice(i, i + 50).map(r => db.prepare("UPDATE own_products SET available=0, updated_at=? WHERE store_id=? AND product_id=?").bind(now(), src.store_id, r.product_id)));
    await db.prepare("UPDATE own_sources SET last_synced=?, last_error=NULL, product_count=? WHERE id=?").bind(now(), cards.length, src.id).run();
    return { ok: true, count: cards.length, available: cards.filter(c => c.available !== false).length };
  } catch (e) {
    await db.prepare("UPDATE own_sources SET last_synced=?, last_error=? WHERE id=?").bind(now(), String(e.message || e).slice(0, 300), src.id).run();
    return { ok: false, error: String(e.message || e) };
  }
}
// The tee banner's live price, cached for 6 hours; the listed fallback if Etsy can't be reached.
async function teePrice(env) {
  if (!env.ETSY_API_KEY) return 0;
  const key = new Request(`https://cache.gift.directory/etsy-tee/${TEE.listing_id}`), cache = caches.default;
  const hit = await cache.match(key); if (hit) return Number(await hit.text()) || 0;   // keeps -1
  try {
    const l = await etsyGet(env, `/listings/${TEE.listing_id}`);
    const c = l && l.price && l.price.divisor ? Math.round(l.price.amount / l.price.divisor * 100) : 0;
    const live = l && l.state === "active" ? c : -1;   // -1: the listing is gone or paused, so no banner
    await cache.put(key, new Response(String(live), { headers: { "cache-control": "max-age=21600" } }));
    return live;
  } catch { return 0; }
}
// Connect a shop to a store (the "Your products" forms and the AI assistant both use these).
async function connectSource(env, db, storeId, kind, input) {
  const target = kind === "etsy" ? (etsyShopName(input) && etsyShopUrl(etsyShopName(input))) : shopOrigin(input);
  if (!target) return { ok: false, status: 400, error: kind === "etsy" ? "Enter your Etsy shop name or address, like etsy.com/shop/YourShop." : "Enter your shop's web address, like myshop.com or myshop.myshopify.com." };
  const list = (await db.prepare("SELECT id,kind,url FROM own_sources WHERE store_id=?").bind(storeId).all()).results;
  let src = list.find(x => x.url.toLowerCase() === target.toLowerCase());
  const isNew = !src;
  if (isNew) {
    if (list.length >= 3) return { ok: false, status: 409, error: "A store can connect up to 3 shops." };
    src = { id: uid(), kind, url: target };
    await db.prepare("INSERT INTO own_sources (id,store_id,kind,url,created_at) VALUES (?,?,?,?,?)").bind(src.id, storeId, kind, target, now()).run();
  }
  const r = await syncSource(env, db, { ...src, kind, store_id: storeId });
  if (!r.ok && isNew) await db.prepare("DELETE FROM own_sources WHERE id=?").bind(src.id).run();   // a failed first connect leaves nothing behind
  return r.ok ? r : { ok: false, status: 422, error: r.error };
}
// Pin one card on a store (validated like the Curate tab's Pin button). Returns an error string or null.
async function putItem(db, storeId, body) {
  const v = validateItem(body); if (v.error) return v.error;
  const n = await db.prepare("SELECT COUNT(*) n FROM store_items WHERE store_id=?").bind(storeId).first();
  if (n.n >= 300) return "That's the most a store can curate.";
  await db.prepare("INSERT INTO store_items (store_id,product_id,status,collection,card_json,sort,created_at) VALUES (?,?,?,?,?,?,?) " +
    "ON CONFLICT(store_id,product_id) DO UPDATE SET status=excluded.status, collection=excluded.collection, card_json=excluded.card_json")
    .bind(storeId, v.item.card.product_id, v.item.status, v.item.collection, JSON.stringify(v.item.card), n.n, now()).run();
  return null;
}
// ---------- the store owner's AI assistant ----------
async function assistContext(db, s) {
  const items = await storeItems(db, s.id);
  const counts = {}; for (const i of items) if (i.status === "pinned") counts[i.collection || "Our picks"] = (counts[i.collection || "Our picks"] || 0) + 1;
  const sources = (await db.prepare("SELECT kind,url FROM own_sources WHERE store_id=?").bind(s.id).all()).results;
  const fc = await db.prepare("SELECT cards_json FROM browse_cache WHERE store_id=?").bind(s.id).first();
  return { items, shelves: Object.entries(counts).map(([title, count]) => ({ title, count })), sources, front: fc ? JSON.parse(fc.cards_json) : [] };
}
// Plan: ask the model, then do the lookups each step needs (searches for shelves, matches for hides) so the
// owner sees the actual products before anything changes.
async function assistPlan(env, db, s, cfg, body) {
  const message = String(body.message || "").trim();
  if (!message) return { error: "Tell the assistant what you'd like to do." };
  const ctx = await assistContext(db, s);
  let j; try { j = await aiFor(env)(ASSIST_SYSTEM, assistPrompt(storeBrief(s, cfg, ctx.shelves, ctx.sources), message, Array.isArray(body.history) ? body.history : [])); }
  catch { return { reply: "I couldn't reach the AI just now. Try again in a moment.", steps: [] }; }
  const plan = parseAssist(j, ctx.shelves.map(x => x.title));
  const taken = new Set(ctx.items.map(i => i.product_id));
  const shelves = plan.steps.filter(st => st.type === "add_shelf");
  // Search every new shelf at once, then let the model choose the best of the candidates in one call.
  await Promise.all(shelves.map(async st => {
    const brief = { budget_cents: st.max_cents || 50000 };
    // one search per product kind, results interleaved so every kind is in the candidate pool
    const lists = await Promise.all(st.queries.map(q => Promise.all([searchCards(env, q).catch(() => []), cjSearch(env, q, brief, { limit: 10 }).catch(() => [])])
      .then(([a, b]) => pickShelf([...b.slice(0, 2), ...a], { max_cents: st.max_cents, count: 8 }, taken))))
      .then(ls => ls.map((l, k) => l.map(c => ({ ...c, _k: k }))));
    const mixed = []; for (let k = 0; k < 8; k++) for (const l of lists) if (l[k]) mixed.push(l[k]);
    st.pool = pickShelf(mixed, { count: 24 });
  }));
  if (shelves.some(st => st.pool.length)) {
    let picks = null;
    // ask for up to twice the shelf size, ranked; the per-kind cap then trims it to a varied shelf
    try { picks = await aiFor(env)(PICK_SYSTEM, pickPrompt(s.name, s.niche, shelves.map(st => ({ ...st, count: Math.min(st.pool.length, st.count * 2) })))); } catch {}
    applyPicks(picks, shelves.map(st => ({ ...st, count: st.pool.length }))).forEach((cards, i) => { shelves[i].cards = capKinds(cards.filter(c => !taken.has(c.product_id)), shelves[i].count, shelves[i].queries.length); shelves[i].cards.forEach(c => taken.add(c.product_id)); });
  }
  for (const st of plan.steps) {
    if (st.type === "add_shelf") { st.cards = st.cards || []; delete st.pool; }
    else if (st.type === "hide") st.cards = matchHide([...ctx.front, ...ctx.items.filter(i => i.status === "pinned").map(i => JSON.parse(i.card_json))], st.words);
    st.summary = describeStep(st);
  }
  plan.steps = plan.steps.filter(st => st.type !== "add_shelf" || st.cards.length);
  return plan;
}
// Apply the steps the owner approved. Every step is re-checked here; the browser's copy is not trusted.
async function assistApply(env, db, s, cfg, body) {
  const steps = (Array.isArray(body.steps) ? body.steps : []).slice(0, MAX_STEPS), results = [];
  let next = { ...cfg }, name = s.name, tagline = s.tagline, settingsChanged = false;
  for (const st of steps) {
    try {
      if (st.type === "add_shelf") {
        const collection = String(st.collection || "").slice(0, 40); let n = 0, err = null;
        for (const card of (Array.isArray(st.cards) ? st.cards : []).slice(0, SHELF_MAX)) { err = await putItem(db, s.id, { status: "pinned", collection, card }); if (!err) n++; else if (err.startsWith("That's the most")) break; }
        results.push(n ? { ok: true, text: `Added ${n} products to "${collection}".` } : { ok: false, text: err || "No products to add." });
      } else if (st.type === "remove_shelf") {
        const r = await db.prepare("DELETE FROM store_items WHERE store_id=? AND status='pinned' AND collection=?").bind(s.id, String(st.collection || "")).run();
        results.push({ ok: true, text: `Removed "${st.collection}" (${r.meta.changes} products).` });
      } else if (st.type === "hide") {
        const words = (Array.isArray(st.words) ? st.words : []).map(w => String(w).toLowerCase().slice(0, 40)).filter(w => w.length >= 3).slice(0, 10);
        let n = 0; for (const card of (Array.isArray(st.cards) ? st.cards : []).slice(0, 60)) if (words.some(w => String(card.title || "").toLowerCase().includes(w)) && !(await putItem(db, s.id, { status: "hidden", card }))) n++;
        // and keep them out of future picks
        const avoid = [next.avoid, ...words.filter(w => !String(next.avoid || "").toLowerCase().includes(w))].filter(Boolean).join(", ").slice(0, 200);
        if (avoid !== (next.avoid || "")) { next.avoid = avoid; settingsChanged = true; }
        results.push({ ok: true, text: `Hid ${n} product${n === 1 ? "" : "s"}; the AI will also avoid ${words.join(", ")}.` });
      } else if (st.type === "settings") {
        const ch = st.changes || {};
        const v = validateSettings({ name, tagline, occasions: next.occasions, recipient_examples: next.recipient_examples, search_guidance: next.search_guidance,
          avoid: next.avoid, accent: next.accent, tee_banner: next.tee_banner !== false, ...ch }, darkEnough);
        if (v.error) { results.push({ ok: false, text: v.error }); continue; }
        name = v.settings.name; tagline = v.settings.tagline;
        next = { ...next, ...v.settings, accent: v.settings.accent || next.accent }; delete next.name; delete next.tagline;
        settingsChanged = true; results.push({ ok: true, text: "Settings updated." });
      } else if (st.type === "connect_etsy" || st.type === "connect_shopify") {
        const r = await connectSource(env, db, s.id, st.type === "connect_etsy" ? "etsy" : "shopify", st.type === "connect_etsy" ? st.shop : st.url);
        results.push(r.ok ? { ok: true, text: `Connected: ${r.count} products imported.` } : { ok: false, text: r.error });
      }
    } catch (e) { results.push({ ok: false, text: String(e.message || e).slice(0, 200) }); }
  }
  if (settingsChanged) await db.batch([
    db.prepare("UPDATE stores SET name=?, tagline=?, config_json=?, updated_at=? WHERE id=?").bind(name, tagline, JSON.stringify(next), now(), s.id),
    db.prepare("DELETE FROM browse_cache WHERE store_id=?").bind(s.id),
  ]);
  return { results };
}
// Store owners can switch the tee banner off in Settings (stored as config tee_banner:false).
const teeOn = store => { try { return JSON.parse(store.config_json || "{}").tee_banner !== false; } catch { return true; } };
const syncSource = (env, db, src) => src.kind === "etsy" ? syncEtsy(env, db, src) : syncShopify(db, src);
// The owner's products as a shelf for the store page (newest first).
async function ownShelf(db, storeId) {
  const cards = (await ownProducts(db, storeId)).slice(0, 24);
  if (!cards.length) return [];
  return [{ title: "From our shop", cards, ...(cards.some(c => c.merchant === "etsy.com") ? { note: ETSY_NOTICE } : {}) }];
}

// A typed search: any price from $5 to $500, junk and duplicates out. No model: it should feel instant.
async function searchCards(env, q) {
  if (!env.CHANNEL3_API_KEY) return [];
  const brief = { budget_cents: 50000, min_cents: 500 };
  const ps = await channel3Search(env, q, brief).catch(() => []);
  return mergeCards([ps.map(p => toCard(p, brief.budget_cents)).filter(Boolean)]).slice(0, 24);
}

// ---------- stores ----------
const isWorkersDev = h => h.endsWith(".workers.dev");
// A store's address. On workers.dev (testing, before DNS) stores are picked with ?store=<slug>.
function storeUrl(env, url, slug) {
  return isWorkersDev(url.hostname) ? `${url.origin}/?store=${slug}` : `https://${slug}.${ROOT}/`;
}
// ---------- the shop: Printful products sold directly, paid with PayPal ----------
// Cloudflare's edge cache for computed results (kept per data center), under a synthetic URL. Search and AI answers
// are reused for the same question in the same store; the store's settings stamp is part of every key, so an owner's
// edit starts fresh answers. A miss or a cache error just means doing the work.
const EDGE = "https://cache.gift.directory/";
async function edgeGet(key) { try { const r = await caches.default.match(new Request(EDGE + key)); return r ? await r.json() : null; } catch { return null; } }
function edgePut(ctx, key, data, ttl) {
  ctx.waitUntil(caches.default.put(new Request(EDGE + key), new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "cache-control": `max-age=${ttl}` } })).catch(() => {}));
}
const storeStamp = store => encodeURIComponent(`${store.id}@${store.updated_at || ""}`);
// The front-page grid: a fresh round of searches for the store, saved to browse_cache.
async function refreshBrowse(env, db, store) {
  const cfg = JSON.parse(store.config_json);
  const planSystem = cfg.house ? undefined : storePlanSystem({ ...cfg, name: store.name, niche: store.niche });
  const r = await browseGifts(store.niche, { ai: aiFor(env), search: (q, b) => channel3Search(env, q, b), alsoSearch: q => cjSearch(env, q, { budget_cents: 15000 }, { limit: 30 }), planSystem, queries: cfg.browse_searches });
  if (r.cards.length) await db.prepare("INSERT INTO browse_cache (store_id,cards_json,created_at) VALUES (?,?,?) ON CONFLICT(store_id) DO UPDATE SET cards_json=excluded.cards_json, created_at=excluded.created_at")
    .bind(store.id, JSON.stringify(r.cards), now()).run();
  return r.cards;
}

const PF_API = "https://api.printful.com";
async function pf(env, path, { method = "GET", body } = {}) {
  const r = await fetch(PF_API + path, { method, body: body ? JSON.stringify(body) : undefined,
    headers: { Authorization: `Bearer ${env.PRINTFUL_TOKEN}`, "X-PF-Store-Id": String(env.PRINTFUL_STORE_ID), "content-type": "application/json" } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Printful ${r.status}: ${String((j.error && j.error.message) || j.result || "").slice(0, 200)}`);
  return j.result;
}
// The shelf: every product in the gift.directory Printful store, cached for 30 minutes.
async function shopCards(env) {
  const key = new Request(`https://cache.gift.directory/shop-cards/${env.PRINTFUL_STORE_ID}/v8`), cache = caches.default;
  const hit = await cache.match(key); if (hit) return hit.json();
  const list = await pf(env, "/store/products?limit=100");
  const cards = (await Promise.all(list.map(p => pf(env, `/store/products/${p.id}`).then(shopCard).catch(() => null)))).filter(Boolean);
  const T = ["role", "milestone", "roster", "text"], P = ["tee", "hoodie", "mug"], I = Object.keys(PTYPES);
  const rank = c => c.kind !== "tpl" ? 999 : c.tpls && c.tpls.length > 1 ? 100 + I.indexOf(c.ptype) : T.indexOf(c.tpl) * 10 + P.indexOf(c.ptype);
  cards.sort((a, b) => rank(a) - rank(b));   // the shelf by design, each as tee, hoodie, mug; fixed designs last
  await cache.put(key, new Response(JSON.stringify(cards), { headers: { "content-type": "application/json", "cache-control": "max-age=1800" } }));
  return cards;
}
async function shopRate(env, o) {
  const r = o.recipient;
  return pickRate(await pf(env, "/shipping/rates", { method: "POST", body: {
    recipient: { address1: r.address1, city: r.city, country_code: "US", state_code: r.state_code, zip: r.zip },
    items: [{ variant_id: String(o.variant.catalog_id), quantity: o.qty }], currency: "USD" } }));
}
// After PayPal captures: create the Printful order (a draft unless the shop is live and fulfilment is switched on),
// then email the receipt. Failures are noted on the order for a person to fix; the money is already safe in PayPal.
async function shopFulfill(env, db, row) {
  const confirm = env.SHOP_FULFILL === "1" && env.PAYPAL_ENV === "live";
  const k = parseKind(row.kind);
  try {
    // A paid order's photo is kept a year (uploads otherwise expire after 30 days).
    if (k && k.photo && env.SHOP_UPLOADS) {
      const { value, metadata } = await env.SHOP_UPLOADS.getWithMetadata(`up/${k.photo}`, { type: "arrayBuffer" });
      if (value) await env.SHOP_UPLOADS.put(`up/${k.photo}`, value, { expirationTtl: 365 * 86400, metadata: { ...(metadata || {}), order: row.id } });
    }
    const r = await pf(env, `/orders${confirm ? "?confirm=1" : ""}`, { method: "POST", body: printfulOrder(row, `https://${ROOT}/api/shop/print/${row.id}.png`, k && k.photo ? `https://${ROOT}/api/shop/photo/${k.photo}` : null) });
    await db.prepare("UPDATE shop_orders SET pf_order_id=?, pf_status=?, updated_at=? WHERE id=?").bind(r.id, r.status, now(), row.id).run();
  } catch (e) { await db.prepare("UPDATE shop_orders SET note=?, updated_at=? WHERE id=?").bind(String(e.message || e).slice(0, 300), now(), row.id).run(); }
  if (env.EMAIL && !/@[^@]*example\.com$/i.test(row.email)) {
    const msg = receiptEmail(row); if (env.PAYPAL_ENV !== "live") msg.subject = "[Test order, not shipped] " + msg.subject;
    try { await env.EMAIL.send({ to: row.email, from: "orders@gift.directory", ...msg }); } catch {}
  }
}
// Registry reminders that are due: send each once, then delete the row (and with it the guest's email).
// A send that fails stays for tomorrow's run; one for an event that has already happened is dropped.
const REMIND_FROM = "reminders@gift.directory";
async function sendReminders(env, db, today) {
  if (!env.EMAIL) return { sent: 0, skipped: "no EMAIL binding" };
  const due = (await db.prepare("SELECT m.token, m.email, r.id, r.slug, r.title, r.occasion, r.event_date, r.owner_name, r.paypal_email FROM registry_reminders m JOIN registries r ON r.id = m.registry_id WHERE m.send_on <= ? ORDER BY m.send_on LIMIT 100").bind(today).all()).results;
  let sent = 0, failed = 0, dropped = 0;
  for (const d of due) {
    if (!d.event_date || d.event_date < today) { await db.prepare("DELETE FROM registry_reminders WHERE token=?").bind(d.token).run(); dropped++; continue; }
    const left = (await db.prepare("SELECT COUNT(*) n FROM registry_items WHERE registry_id=? AND claimed < qty").bind(d.id).first()).n;
    const msg = reminderEmail(d, `https://${ROOT}/r/${d.slug}`, `https://${ROOT}/api/registry/unsubscribe?t=${d.token}`, left);
    try { await env.EMAIL.send({ to: d.email, from: REMIND_FROM, ...msg }); await db.prepare("DELETE FROM registry_reminders WHERE token=?").bind(d.token).run(); sent++; }
    catch { failed++; }
  }
  return { sent, failed, dropped };
}
// Link previews: put Open Graph tags into a static page's <head>. A lookup that fails just leaves the page as it was.
async function withPreview(resP, metaP) {
  const [res, meta] = await Promise.all([resP, Promise.resolve(metaP).catch(() => null)]);
  if (!meta || !res.ok || !/text\/html/.test(res.headers.get("content-type") || "")) return res;
  const tags = ogTags(meta);
  return new HTMLRewriter().on("head", { element(el) { el.append(tags, { html: true }); } }).transform(res);
}
const card = j => { try { return JSON.parse(j || "{}"); } catch { return {}; } };
async function poolPreview(db, id, url) {
  const p = await db.prepare("SELECT title, organizer_name, product_json, target_cents, raised_cents, status FROM pools WHERE id=?").bind(id).first();
  return p ? poolMeta(p, card(p.product_json), `${url.origin}/g/${id}`) : null;
}
async function registryPreview(db, slug, url) {
  const r = await db.prepare("SELECT id, title, occasion, owner_name, paypal_email FROM registries WHERE slug=?").bind(slug).first();
  if (!r) return null;
  const items = (await db.prepare("SELECT card_json FROM registry_items WHERE registry_id=? ORDER BY sort, created_at LIMIT 150").bind(r.id).all()).results.map(i => card(i.card_json));
  return registryMeta(r, items, `${url.origin}/r/${slug}`);
}
async function storePreview(db, store, url) {
  const it = await db.prepare("SELECT card_json FROM store_items WHERE store_id=? AND status='pinned' ORDER BY sort LIMIT 1").bind(store.id).first();
  return storeMeta(store, `${url.origin}/`, it && card(it.card_json).image);
}
function withCookie(resP, cookie) {
  if (!cookie) return resP;
  return Promise.resolve(resP).then(r => { const h = new Headers(r.headers); h.append("set-cookie", cookie); return new Response(r.body, { status: r.status, headers: h }); });
}
// Ask PayPal about a store's subscription and move the store to match. Never more often than every
// 6 hours per store from page views; always when the owner comes back from approving.
async function refreshSubscription(db, env, s) {
  const r = await paypalFetch(env, `/v1/billing/subscriptions/${encodeURIComponent(s.paypal_subscription_id)}`);
  if (r.status >= 300 || !r.body) return s;
  // The subscription must be ours, for this store, on our plan: an id pasted from elsewhere changes nothing.
  if (r.body.custom_id !== s.id || r.body.plan_id !== env.PAYPAL_PLAN_ID) return s;
  const status = storeStatusFor(r.body.status, s.status), t = now();
  // Whoever paid owns the store: their PayPal payer id is what "Log in with PayPal" matches later.
  const payer = (r.body.subscriber && r.body.subscriber.payer_id) || null;
  await db.prepare("UPDATE stores SET status=?, subscription_status=?, owner_payer_id=COALESCE(owner_payer_id,?), checked_at=?, updated_at=? WHERE id=?")
    .bind(status, r.body.status, payer, t, t, s.id).run();
  return { ...s, status, subscription_status: r.body.status, owner_payer_id: s.owner_payer_id || payer, checked_at: t };
}
async function resolveStore(db, env, url, request) {
  let key = hostKey(url.hostname);
  let setCookie = null;
  if (isWorkersDev(url.hostname)) {
    // Testing on workers.dev: ?store=<slug> picks a store and is remembered; ?store= alone returns
    // to the platform; with neither, the house store (Lawyer Gifts) answers, as it always has.
    const q = url.searchParams.get("store");
    const cookie = /(?:^|;\s*)store=([a-z0-9-]*)/.exec(request.headers.get("cookie") || "");
    const pick = q !== null ? q : cookie ? cookie[1] : "lawyers";
    if (q !== null) setCookie = `store=${q}; Path=/; Secure; SameSite=Lax; Max-Age=86400`;
    key = pick ? { slug: pick } : { platform: true };
  }
  if (key.platform) return { platform: true, setCookie };
  let store = key.slug ? await db.prepare("SELECT * FROM stores WHERE slug=?").bind(key.slug).first()
                       : await db.prepare("SELECT * FROM stores WHERE custom_host=?").bind(key.host).first();
  if (store && store.paypal_subscription_id && store.status !== "draft" &&
      (!store.checked_at || Date.now() - Date.parse(store.checked_at) > 6 * 3600 * 1000)) {
    try { store = await refreshSubscription(db, env, store); } catch {}
  }
  return { store, setCookie };
}

export default {
  async fetch(request, env, ctx) {
    env = paypalMode(env); // sandbox or live PayPal credentials, by PAYPAL_ENV
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const m = request.method;
    const db = env.DB;
    try {
      const { store, platform, setCookie } = await resolveStore(db, env, url, request);
      const page = path => withCookie(env.ASSETS.fetch(new Request(new URL(path, url), request)), setCookie);
      // The tab icon, in the store's own color (the platform's navy elsewhere). Same drawing as favicon.ico.
      if (url.pathname === "/favicon.svg") {
        let accent = "#1f3a5f";
        try { const a = store && JSON.parse(store.config_json).accent; if (/^#[0-9a-fA-F]{6}$/.test(a || "")) accent = a; } catch {}
        return new Response(faviconSvg(accent), { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
      }
      // ads.txt: who may sell ads on gift.directory (required by AdSense). Only once a real publisher id is set.
      if (url.pathname === "/ads.txt") {
        const pub = /^ca-(pub-\d{10,20})$/.exec(env.ADSENSE_CLIENT || "");
        return pub ? new Response(`google.com, ${pub[1]}, DIRECT, f08c47fec0942fa0\n`, { headers: { "content-type": "text/plain" } }) : new Response("", { status: 404 });
      }
      // IndexNow ownership file (Bing, Yandex and others): the key is public by design.
      if (env.INDEXNOW_KEY && url.pathname === `/${env.INDEXNOW_KEY}.txt`) return new Response(env.INDEXNOW_KEY, { headers: { "content-type": "text/plain" } });
      // ---------- About, Contact, Privacy, Terms ----------
      if (parts.length === 1 && LEGAL_SLUGS.includes(parts[0])) {
        if (url.hostname !== ROOT && !isWorkersDev(url.hostname)) return Response.redirect(`https://${ROOT}/${parts[0]}`, 301);
        configureAds(env);
        return new Response(renderLegal(parts[0], { shop: env.SHOP_PUBLIC === "1" }), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
      }
      // ---------- gift guides, sitemap, robots (the platform's own address) ----------
      if (parts[0] === "gifts" || url.pathname === "/sitemap.xml" || url.pathname === "/robots.txt") {
        if (url.hostname !== ROOT && !isWorkersDev(url.hostname)) return Response.redirect(`https://${ROOT}${url.pathname}`, 301);
        configureAds(env);
        const html = (b, st = 200) => new Response(b, { status: st, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
        if (url.pathname === "/robots.txt")
          return new Response(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /login\n\nSitemap: https://${ROOT}/sitemap.xml\n`, { headers: { "content-type": "text/plain" } });
        const rows = (await db.prepare("SELECT slug, updated_at FROM seo_pages").all()).results;
        if (url.pathname === "/sitemap.xml") {
          const stores = (await db.prepare("SELECT slug, updated_at FROM stores WHERE status='active'").all()).results;
          return new Response(sitemap([{ loc: `https://${ROOT}/` }, { loc: `https://${ROOT}/gifts` }, { loc: `https://${ROOT}/registry` }, ...LEGAL_SLUGS.map(s => ({ loc: `https://${ROOT}/${s}` })),
            ...[...new Set(PAGES.filter(p => rows.some(r => r.slug === p.slug)).map(p => p.topic))].map(t => ({ loc: `https://${ROOT}/gifts/topic/${topicSlug(t)}` })),
            ...rows.map(r => ({ loc: `https://${ROOT}/gifts/${r.slug}`, lastmod: r.updated_at })),
            ...stores.map(s => ({ loc: `https://${s.slug}.${ROOT}/`, lastmod: s.updated_at }))]), { headers: { "content-type": "application/xml" } });
        }
        if (!parts[1]) return html(renderHub(new Set(rows.map(r => r.slug)), adSlot(env)));
        if (parts[1] === "topic") { const t = topicBySlug(parts[2] || ""); return t ? html(renderTopic(t, new Set(rows.map(r => r.slug)), adSlot(env))) : html(`<!doctype html><title>Not found</title><p>No such topic. <a href="/gifts">All gift guides</a></p>`, 404); }
        const p = pageBySlug(parts[1]);
        const row = p && await db.prepare("SELECT * FROM seo_pages WHERE slug=?").bind(p.slug).first();
        if (!row) return html(`<!doctype html><title>Not found</title><p>No such guide. <a href="/gifts">All gift guides</a></p>`, 404);
        // Keep prices and stock fresh without making a visitor (or a crawler) wait for it.
        // Every refresh costs Channel3 searches (about 7 for a slot page) and crawlers visit every page, so: a page
        // refreshes at most every REFRESH_DAYS, and at most REFRESH_PER_DAY pages refresh in any 24 hours.
        if (ctx && Date.now() - Date.parse(row.updated_at) > REFRESH_DAYS * 864e5) {
          const since = new Date(Date.now() - 864e5).toISOString();
          const done = (await db.prepare("SELECT COUNT(*) AS n FROM seo_pages WHERE updated_at > ?").bind(since).first()).n;
          // A refresh that comes up short keeps the old products but still counts as a refresh, so it isn't retried on every visit.
          if (done < REFRESH_PER_DAY) ctx.waitUntil(buildGuide(db, env, p, { cardsOnly: true }).catch(e => ({ ok: false, error: String(e) }))
            .then(r => r && r.ok ? null : db.prepare("UPDATE seo_pages SET updated_at=? WHERE slug=?").bind(now(), p.slug).run()).catch(() => {}));
        }
        const st = p.store && await db.prepare("SELECT slug FROM stores WHERE slug=? AND status='active'").bind(p.store).first();
        const built = new Set(rows.map(r => r.slug));
        return html(renderGuide(p, row, related(p, built), st ? `https://${st.slug}.${ROOT}/` : null, adSlot(env), teamNav(p, built)));
      }
      // Builds a guide page. Not public: needs the build token.
      if (url.pathname.startsWith("/api/seo/build/") && m === "POST") {
        if (!env.BUILD_TOKEN || request.headers.get("x-build-token") !== env.BUILD_TOKEN) return J({ error: "not allowed" }, 403);
        const p = pageBySlug(parts[3]); if (!p) return J({ error: "unknown page" }, 404);
        return J(await buildGuide(db, env, p, { cardsOnly: url.searchParams.get("cards") === "1" }));
      }
      // The store assistant's plan for a store, without logging in as its owner: a check for the operator.
      // Plan only (nothing is applied). Needs the build token.
      if (url.pathname.startsWith("/api/seo/assist-check/") && m === "POST") {
        if (!env.BUILD_TOKEN || request.headers.get("x-build-token") !== env.BUILD_TOKEN) return J({ error: "not allowed" }, 403);
        const st = await db.prepare("SELECT * FROM stores WHERE slug=?").bind(parts[3]).first(); if (!st) return J({ error: "unknown store" }, 404);
        return J(await assistPlan(env, db, st, JSON.parse(st.config_json), (await readJson(request)) || {}));
      }
      // Operator check of registry reminders: {"to": "..."} sends one sample reminder; {"run": true} sends today's due ones now. Needs the build token.
      if (url.pathname === "/api/seo/remind-test" && m === "POST") {
        if (!env.BUILD_TOKEN || request.headers.get("x-build-token") !== env.BUILD_TOKEN) return J({ error: "not allowed" }, 403);
        if (!env.EMAIL) return J({ error: "no EMAIL binding" }, 503);
        const b = (await readJson(request)) || {};
        if (b.run) return J(await sendReminders(env, db, now().slice(0, 10)));
        const v = validateReminder({ email: b.to }); if (v.error) return J({ error: v.error }, 400);
        const ev = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
        const msg = reminderEmail({ title: "Maria & Sam's wedding (sample)", occasion: "Wedding", event_date: ev, owner_name: "Maria", paypal_email: "x" }, `https://${ROOT}/registry`, `https://${ROOT}/api/registry/unsubscribe?t=sample`, 12);
        try { const r = await env.EMAIL.send({ to: v.email, from: REMIND_FROM, ...msg }); return J({ ok: true, id: r && r.messageId }); }
        catch (e) { return J({ ok: false, error: String((e && e.message) || e) }, 502); }
      }
      // Operator check of the Etsy import for a shop (reads only, stores nothing). Needs the build token.
      if (url.pathname.startsWith("/api/seo/etsy-check/") && m === "GET") {
        if (!env.BUILD_TOKEN || request.headers.get("x-build-token") !== env.BUILD_TOKEN) return J({ error: "not allowed" }, 403);
        const out = { key: !!env.ETSY_API_KEY };
        try {
          const name = etsyShopName(parts[3]); out.name = name;
          const shop = pickShop(await etsyGet(env, `/shops?shop_name=${encodeURIComponent(name)}`), name); out.shop_id = shop && shop.shop_id;
          const j = await etsyGet(env, `/shops/${shop.shop_id}/listings/active?limit=100`); out.active = (j.results || []).length;
          const b = await etsyGet(env, `/listings/batch?listing_ids=${(j.results || []).map(l => l.listing_id).join(",")}&includes=Images`);
          out.cards = etsyCards(b, shop.shop_name).map(c => ({ title: c.title, price_cents: c.price_cents, image: !!c.image }));
        } catch (e) { out.error = String(e.message || e); }
        return J(out);
      }
      if (parts[0] !== "api") {
        // Ask for bare names ("/pool", not "/pool.html"): the asset server answers .html with a 307
        // to the bare name, and that redirect reached the browser and threw away /g/<id>.
        if (parts[0] === "g" && parts[1]) return withPreview(page("/pool"), poolPreview(db, parts[1], url));
        if (parts[0] === "r" && parts[1]) return withPreview(page("/registry"), registryPreview(db, parts[1], url));
        if (parts[0] === "registry" && parts.length === 1) return withPreview(page("/registry"), REGISTRY_HOME_META);
        // Logins all go through gift.directory, the one callback address registered with PayPal.
        if (parts[0] === "login") {
          if (url.hostname !== ROOT && !isWorkersDev(url.hostname)) return Response.redirect(`https://${ROOT}/login`, 302);
          const state = uid();
          await db.prepare("INSERT INTO oauth_states (state,created_at) VALUES (?,?)").bind(state, now()).run();
          return Response.redirect(authorizeUrl(env, `${url.origin}/api/auth/paypal/callback`, state), 302);
        }
        if (parts[0] === "admin") {
          if (url.hostname !== ROOT && !isWorkersDev(url.hostname) && url.hostname.endsWith("." + ROOT)) return Response.redirect(`https://${ROOT}/admin`, 302);
          return page("/admin");
        }
        if (platform && (parts.length === 0 || parts[0] === "new")) return withPreview(page("/platform"), PLATFORM_META);
        if (parts.length === 0) return withPreview(page("/"), store && store.status === "active" ? storePreview(db, store, url) : null);
        return env.ASSETS.fetch(request);
      }

      // ---------- the shop (Printful print-on-demand, paid with PayPal; hidden unless SHOP_PUBLIC) ----------
      if (parts[1] === "shop") {
        if (!env.PRINTFUL_TOKEN || !env.PRINTFUL_STORE_ID) return J({ error: "The shop isn't set up yet." }, 503);
        // Photo products and uploads are off while the shop is hidden (unless SHOP_PHOTOS is set for testing).
        const photosOn = env.SHOP_PUBLIC === "1" || env.SHOP_PHOTOS === "1";
        if (parts[2] === "products" && m === "GET") return J({ products: (await shopCards(env)).filter(c => photosOn || c.kind !== "photo"), live: env.PAYPAL_ENV === "live", public: env.SHOP_PUBLIC === "1" });
        // A buyer's photo for a photo shirt: JPEG or PNG, up to 15 MB, at least 600 px on the short side. Kept 30 days.
        if (parts[2] === "upload" && m === "POST") {
          if (!env.SHOP_UPLOADS || !photosOn) return J({ error: "Photo uploads aren't switched on yet." }, 503);
          const ipHash = await sha256("up:" + (request.headers.get("cf-connecting-ip") || ""));
          const rk = `rl/${ipHash}/${new Date().toISOString().slice(0, 13)}`, n = Number(await env.SHOP_UPLOADS.get(rk)) || 0;
          if (n >= 30) return J({ error: "That's a lot of uploads in an hour. Try again later." }, 429);
          const len = Number(request.headers.get("content-length") || 0);
          if (len > PHOTO_MAX_BYTES) return J({ error: "That photo is over 15 MB." }, 413);
          const buf = await request.arrayBuffer();
          if (buf.byteLength > PHOTO_MAX_BYTES) return J({ error: "That photo is over 15 MB." }, 413);
          const info = imageInfo(buf);
          if (!info) return J({ error: "Use a JPEG or PNG photo." }, 415);
          if (Math.min(info.w, info.h) < PHOTO_MIN) return J({ error: `That photo is too small to print well (${info.w} × ${info.h}). Use one at least ${PHOTO_MIN} pixels on the short side.` }, 400);
          const id = uid().replace(/-/g, "");
          await env.SHOP_UPLOADS.put(`up/${id}`, buf, { expirationTtl: 30 * 86400, metadata: { type: info.type, w: info.w, h: info.h } });
          await env.SHOP_UPLOADS.put(rk, String(n + 1), { expirationTtl: 7200 });
          return J({ id, w: info.w, h: info.h, url: `/api/shop/photo/${id}`, low_res: Math.min(info.w, info.h) < PHOTO_GOOD });
        }
        // The uploaded photo (the buyer's preview, and the file Printful downloads for the front).
        if (parts[2] === "photo" && PHOTO_ID.test(parts[3] || "") && m === "GET") {
          const { value, metadata } = env.SHOP_UPLOADS ? await env.SHOP_UPLOADS.getWithMetadata(`up/${parts[3]}`, { type: "arrayBuffer" }) : {};
          if (!value) return new Response("not found", { status: 404 });
          return new Response(value, { headers: { "content-type": (metadata && metadata.type) || "image/jpeg", "cache-control": "private, max-age=86400", "x-robots-tag": "noindex" } });
        }
        // The print file Printful downloads for a paid order of a template product.
        if (parts[2] === "print" && parts[3] && m === "GET") {
          const o = await db.prepare("SELECT kind, lines_json, status, pf_catalog_variant_id FROM shop_orders WHERE id=?").bind(parts[3].replace(/\.png$/, "")).first();
          const k = o && o.status === "paid" && parseKind(o.kind);
          if (!k) return new Response("not found", { status: 404 });
          const [w, h] = printSize(k.ptype, o.pf_catalog_variant_id);
          return new Response(await svgToPng(designSvg(k.tpl, k.ptype, JSON.parse(o.lines_json), [w, h]), renderWidth(w, h)), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
        }
        // A template's sample design at full print size (what the Printful product was set up with).
        if (parts[2] === "sample" && TEMPLATES[parts[3]] && PTYPES[(parts[4] || "").replace(/\.png$/, "")] && m === "GET") {
          const pt = parts[4].replace(/\.png$/, "");
          return new Response(await svgToPng(designSvg(parts[3], pt, SAMPLES[parts[3]]), renderWidth(PTYPES[pt].w, PTYPES[pt].h)), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
        }
        // A pick-your-design item's example at print size.
        if (parts[2] === "sample" && parts[3] === "item" && PTYPES[(parts[4] || "").replace(/\.png$/, "")] && m === "GET") {
          const pt = parts[4].replace(/\.png$/, ""), ex = exampleFor(pt) || { tpl: "role", vals: SAMPLES.role };
          return new Response(await svgToPng(designSvg(ex.tpl, pt, ex.vals), renderWidth(PTYPES[pt].w, PTYPES[pt].h)), { headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" } });
        }
        // The live preview while the buyer types: the real print file, small. ?f=<field>&f=<field>...
        if (parts[2] === "preview" && parts[3] && m === "GET") {
          const c = (await shopCards(env)).find(x => x.id === Number(parts[3].replace(/\.png$/, "")));
          if (!c || (c.kind !== "tpl" && c.kind !== "photo")) return new Response("not found", { status: 404 });
          const t = (c.tpls || [c.tpl]).includes(url.searchParams.get("t")) ? url.searchParams.get("t") : c.tpl;
          const v = validateFields(t, url.searchParams.getAll("f"));
          if (v.error) return J({ error: v.error }, 400);
          const cache = caches.default, key = new Request(`${url.toString()}&dv=${DESIGN_VERSION}`), hit = await cache.match(key); if (hit) return hit;
          // ?full=1 renders at print size (used to make product mockups); otherwise a small preview.
          const res = new Response(await svgToPng(designSvg(t, c.ptype, v.lines), url.searchParams.get("full") === "1" ? renderWidth(PTYPES[c.ptype].w, PTYPES[c.ptype].h) : 600), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
          await cache.put(key, res.clone()); return res;
        }
        if ((parts[2] === "quote" || parts[2] === "checkout") && m === "POST") {
          const b = (await readJson(request)) || {};
          const card = (await shopCards(env)).find(c => c.id === Number(b.product_id));
          const quote = parts[2] === "quote";   // shipping needs only the address; the rest is checked at checkout
          const v = validateShopOrder(quote ? { ...b, lines: card && card.kind === "photo" ? [] : card && card.tpl ? SAMPLES[card.tpl] : null, photo: "q".repeat(16), recipient: { ...(b.recipient || {}), name: "quote", email: "quote@gift.directory" } } : b, card);
          if (v.error) return J({ error: v.error }, 400);
          // A photo shirt's photo must still be in storage; its size goes on the order for placing it on the print.
          let photo = null;
          if (!quote && v.order.photo) {
            const found = env.SHOP_UPLOADS && (await env.SHOP_UPLOADS.list({ prefix: `up/${v.order.photo}`, limit: 1 })).keys[0];
            const meta = found && found.name === `up/${v.order.photo}` && found.metadata;
            if (!meta) return J({ error: "Your photo has expired. Upload it again." }, 400);
            photo = { id: v.order.photo, w: meta.w, h: meta.h };
          }
          const o = v.order, rate = await shopRate(env, o).catch(() => null);
          if (!rate) return J({ error: "We couldn't get a shipping rate for that address. Check the ZIP code." }, 502);
          const sub = o.variant.price_cents * o.qty, tax = salesTax(o, rate.cents, taxTable(env.SHOP_TAX));
          if (quote) return J({ subtotal_cents: sub, shipping_cents: rate.cents, tax_cents: tax.cents, tax, total_cents: sub + rate.cents + tax.cents, rate });
          if (!paypalOn(env)) return J({ error: "PayPal is not configured." }, 503);
          const ipHash = await sha256("shop:" + (request.headers.get("cf-connecting-ip") || ""));
          const recent = await db.prepare("SELECT COUNT(*) n FROM shop_orders WHERE ip_hash=? AND created_at > ?").bind(ipHash, new Date(Date.now() - 3600e3).toISOString()).first();
          if (recent.n >= 15) return J({ error: "That's a lot of checkouts in an hour. Try again later." }, 429);
          const id = uid(), t = now(), label = [o.variant.color, o.variant.size].filter(Boolean).join(" / ");
          const pp = await paypalFetch(env, "/v2/checkout/orders", { method: "POST", body: shopPayPalOrder({ ...o, id, shipping_cents: rate.cents, tax_cents: tax.cents }, url.origin), headers: { "PayPal-Request-Id": id } });
          const href = pp.status < 300 && pp.body ? (link(pp.body, "payer-action") || link(pp.body, "approve") || {}).href : null;
          if (!href) return J({ error: "PayPal could not start the payment.", paypal_status: pp.status, detail: pp.body && pp.body.details }, 502);
          await db.prepare("INSERT INTO shop_orders (id,pf_product_id,pf_sync_variant_id,pf_catalog_variant_id,kind,title,variant_label,qty,lines_json,gift_message,recipient_json,email,unit_cents,subtotal_cents,shipping_cents,tax_cents,total_cents,status,paypal_order_id,ip_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?)")
            .bind(id, o.card.id, o.variant.id, o.variant.catalog_id, rowKind(o.card, o.tpl, photo), o.card.title, label || null, o.qty, o.lines ? JSON.stringify(o.lines) : null, o.gift_message,
              JSON.stringify(o.recipient), o.recipient.email, o.variant.price_cents, sub, rate.cents, tax.cents, sub + rate.cents + tax.cents, pp.body.id, ipHash, t, t).run();
          return J({ url: href });
        }
        // PayPal sends the buyer back here: capture, then hand the order to Printful.
        if (parts[2] === "return" && m === "GET") {
          const orderId = url.searchParams.get("token");
          const row = orderId && await db.prepare("SELECT * FROM shop_orders WHERE paypal_order_id=?").bind(orderId).first();
          if (!row) return Response.redirect(`${url.origin}/shop`, 303);
          if (row.status === "pending") {
            const r = await paypalFetch(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", body: {}, headers: { "PayPal-Request-Id": `cap-${row.id}`, Prefer: "return=representation" } });
            let cap = r.status < 300 ? readCapture(r.body) : null;
            if (!cap) { const g = await paypalFetch(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}`); cap = g.status < 300 ? readCapture(g.body) : null; }
            if (cap && cap.status === "COMPLETED") {
              const u = await db.prepare("UPDATE shop_orders SET status='paid', updated_at=? WHERE id=? AND status='pending'").bind(now(), row.id).run();
              if (u.meta.changes) await shopFulfill(env, db, { ...row, status: "paid" });
            } else await db.prepare("UPDATE shop_orders SET note=?, updated_at=? WHERE id=?").bind(`capture: ${cap ? cap.status : "HTTP " + r.status}`, now(), row.id).run();
          }
          return Response.redirect(`${url.origin}/shop?order=${row.id}`, 303);
        }
        if (parts[2] === "cancel" && m === "GET") {
          const orderId = url.searchParams.get("token");
          if (orderId) await db.prepare("UPDATE shop_orders SET status='cancelled', updated_at=? WHERE paypal_order_id=? AND status='pending'").bind(now(), orderId).run();
          return Response.redirect(`${url.origin}/shop?cancelled=1`, 303);
        }
        // The thank-you page's view of one order (no address: the id is the only key).
        if (parts[2] === "orders" && parts[3] && m === "GET") {
          const o = await db.prepare("SELECT id,title,variant_label,qty,lines_json,subtotal_cents,shipping_cents,tax_cents,total_cents,status,pf_order_id FROM shop_orders WHERE id=?").bind(parts[3]).first();
          if (!o) return J({ error: "not found" }, 404);
          return J({ ...o, lines: o.lines_json ? JSON.parse(o.lines_json) : null, lines_json: undefined, sent_to_printer: !!o.pf_order_id, live: env.PAYPAL_ENV === "live" });
        }
        return J({ error: "not found" }, 404);
      }

      // ---------- gift registries (any store; guests mark what they bought; big items can be group gifts) ----------
      if (parts[1] === "registry") {
        if (parts.length === 2 && m === "POST") {
          const v = validateRegistry(await readJson(request)); if (v.error) return J({ error: v.error }, 400);
          const ipHash = await sha256("reg:" + (request.headers.get("cf-connecting-ip") || ""));
          const recent = await db.prepare("SELECT COUNT(*) n FROM registries WHERE ip_hash=? AND created_at > ?").bind(ipHash, new Date(Date.now() - 3600e3).toISOString()).first();
          if (recent.n >= 5) return J({ error: "That's a lot of registries in an hour. Try again later." }, 429);
          const id = uid(), token = uid(), t = now(), r = v.registry, slug = registrySlug(r.title, shortId().slice(0, 4));
          await db.prepare("INSERT INTO registries (id,slug,manage_hash,title,occasion,event_date,owner_name,paypal_email,message,ship_pct,ip_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(id, slug, await sha256(token), r.title, r.occasion, r.event_date, r.owner_name, r.paypal_email, r.message, r.ship_pct, ipHash, t, t).run();
          return J({ slug, manage_token: token, url: `${url.origin}/r/${slug}` }, 201);
        }
        // The registry's link as a QR code (SVG), for printed cards at showers and parties.
        if (parts[3] === "qr.svg" && parts[2] && m === "GET") {
          const r = await db.prepare("SELECT slug FROM registries WHERE slug=?").bind(parts[2]).first();
          if (!r) return new Response("not found", { status: 404 });
          return new Response(renderSVG(`${url.origin}/r/${r.slug}`, { ecc: "M", border: 2, pixelSize: 8 }), { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
        }
        // One-click unsubscribe from a registry reminder (the link in the email). Deleting the row deletes the address.
        if (parts[2] === "unsubscribe" && m === "GET") {
          const t = url.searchParams.get("t") || "";
          if (t) await db.prepare("DELETE FROM registry_reminders WHERE token=?").bind(t).run();
          return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title><link rel="stylesheet" href="/style.css"><div class="wrap"><h1 style="font-family:Georgia,serif">You're unsubscribed</h1><p>You won't get any registry reminders from us, and we've deleted your email.</p><p><a href="/">gift.directory</a></p></div>`, { headers: { "content-type": "text/html; charset=utf-8" } });
        }
        const reg = parts[2] && await db.prepare("SELECT * FROM registries WHERE slug=?").bind(parts[2]).first();
        if (!reg) return J({ error: "This registry doesn't exist." }, 404);
        // A guest asks for one email a week before the event (only once sending is set up, and only for an upcoming date).
        if (parts[3] === "remind" && m === "POST") {
          if (!env.EMAIL) return J({ error: "Reminders aren't switched on yet." }, 503);
          const v = validateReminder(await readJson(request)); if (v.error) return J({ error: v.error }, 400);
          const sendOn = reminderSendOn(reg.event_date, now().slice(0, 10));
          if (!sendOn) return J({ error: "This registry has no upcoming date to remind you about." }, 400);
          const ipHash = await sha256("rem:" + (request.headers.get("cf-connecting-ip") || ""));
          const recent = await db.prepare("SELECT COUNT(*) n FROM registry_reminders WHERE ip_hash=? AND created_at > ?").bind(ipHash, new Date(Date.now() - 3600e3).toISOString()).first();
          if (recent.n >= 10) return J({ error: "That's a lot of reminders in an hour. Try again later." }, 429);
          await db.prepare("INSERT INTO registry_reminders (token,registry_id,email,send_on,ip_hash,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(registry_id,email) DO UPDATE SET send_on=excluded.send_on")
            .bind(uid() + uid(), reg.id, v.email, sendOn, ipHash, now()).run();
          return J({ ok: true, send_on: sendOn });
        }
        const tok = request.headers.get("x-manage-token") || "", owner = !!tok && (await sha256(tok)) === reg.manage_hash;
        const items = async () => (await db.prepare("SELECT * FROM registry_items WHERE registry_id=? ORDER BY sort, created_at").bind(reg.id).all()).results;
        if (parts.length === 3 && m === "GET") {
          const claims = owner ? (await db.prepare("SELECT item_id,name FROM registry_claims WHERE registry_id=? ORDER BY created_at").bind(reg.id).all()).results : [];
          const its = await items(), ids = its.map(i => i.pool_id).filter(Boolean), pools = {};
          if (ids.length) for (const p of (await db.prepare(`SELECT id,raised_cents,target_cents,status FROM pools WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all()).results) pools[p.id] = p;
          // For the owner's thank-you list: who chipped in to each group gift (names as they gave them, even if hidden from other guests).
          if (owner && ids.length) for (const c of (await db.prepare(`SELECT pool_id,name,amount_cents FROM contributions WHERE status='paid' AND pool_id IN (${ids.map(() => "?").join(",")}) ORDER BY paid_at`).bind(...ids).all()).results)
            if (pools[c.pool_id]) (pools[c.pool_id].contributors ||= []).push({ name: c.name || "A guest", amount_cents: c.amount_cents });
          return J({ ...publicRegistry(reg, its, claims, owner, pools), reminders: !!env.EMAIL && !!reminderSendOn(reg.event_date, now().slice(0, 10)) });
        }
        // Guests: "I bought this" (no login), and "chip in" on a big item, which opens a PayPal group gift.
        if (parts[3] === "items" && parts[4] && parts[5] === "claim" && m === "POST") {
          const name = String(((await readJson(request)) || {}).name || "").replace(/\s+/g, " ").trim().slice(0, 60) || null;
          const r = await db.prepare("UPDATE registry_items SET claimed=claimed+1 WHERE registry_id=? AND item_id=? AND claimed < qty").bind(reg.id, parts[4]).run();
          if (!r.meta.changes) return J({ error: "Someone already got this one. Thank you anyway!" }, 409);
          await db.prepare("INSERT INTO registry_claims (id,registry_id,item_id,name,created_at) VALUES (?,?,?,?,?)").bind(uid(), reg.id, parts[4], name, now()).run();
          return J({ ok: true });
        }
        if (parts[3] === "items" && parts[4] && parts[5] === "pool" && m === "POST") {
          if (!reg.paypal_email) return J({ error: "This registry isn't set up for group gifts." }, 400);
          const it = await db.prepare("SELECT * FROM registry_items WHERE registry_id=? AND item_id=?").bind(reg.id, parts[4]).first();
          if (!it) return J({ error: "That item isn't on the registry." }, 404);
          if (it.pool_id) return J({ id: it.pool_id });
          if (it.claimed >= it.qty) return J({ error: "Guests already bought this one." }, 409);
          const c = JSON.parse(it.card_json), price = (c.price_cents || 0) * it.qty;
          if (price < REG_POOL_MIN_CENTS) return J({ error: "Group gifts are for items over $50." }, 400);
          const pid = shortId(), t = now();
          // The pool's manage token is the registry's, so the owner manages both with one private link.
          await db.prepare("INSERT INTO pools (id,manage_hash,title,occasion,organizer_name,organizer_email,product_json,target_cents,created_at,updated_at,store_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
            .bind(pid, reg.manage_hash, `${c.title.slice(0, 70)} for ${reg.title}`.slice(0, 120), reg.occasion, reg.owner_name, reg.paypal_email,
              JSON.stringify({ title: c.title, url: c.url, image: c.image, merchant: c.merchant, price_cents: price, product_id: c.product_id }), poolTarget(price, reg.ship_pct), t, t, null).run();
          const set = await db.prepare("UPDATE registry_items SET pool_id=? WHERE registry_id=? AND item_id=? AND pool_id IS NULL").bind(pid, reg.id, parts[4]).run();
          if (!set.meta.changes) { await db.prepare("DELETE FROM pools WHERE id=?").bind(pid).run(); return J({ id: (await db.prepare("SELECT pool_id FROM registry_items WHERE registry_id=? AND item_id=?").bind(reg.id, parts[4]).first()).pool_id }); }
          return J({ id: pid }, 201);
        }
        // Everything below is the owner's.
        if (!owner) return J({ error: "Only the registry's owner can do that." }, 403);
        if (parts.length === 3 && m === "PUT") {
          const v = validateRegistry(await readJson(request), { partial: true }); if (v.error) return J({ error: v.error }, 400);
          const f = Object.keys(v.registry); if (!f.length) return J({ ok: true });
          await db.prepare(`UPDATE registries SET ${f.map(k => `${k}=?`).join(", ")}, updated_at=? WHERE id=?`).bind(...f.map(k => v.registry[k]), now(), reg.id).run();
          return J({ ok: true });
        }
        if (parts[3] === "items" && parts.length === 4 && m === "POST") {
          const v = validateRegItem(await readJson(request)); if (v.error) return J({ error: v.error }, 400);
          const have = await items();
          if (have.length >= REG_MAX_ITEMS) return J({ error: `A registry can hold ${REG_MAX_ITEMS} items.` }, 409);
          const dup = v.item.card.product_id && have.find(i => i.product_id === v.item.card.product_id);
          if (dup) { await db.prepare("UPDATE registry_items SET qty=MIN(20, qty+?) WHERE registry_id=? AND item_id=?").bind(v.item.qty, reg.id, dup.item_id).run(); return J({ ok: true, item_id: dup.item_id, merged: true }); }
          const iid = shortId();
          await db.prepare("INSERT INTO registry_items (registry_id,item_id,product_id,card_json,qty,note,sort,created_at) VALUES (?,?,?,?,?,?,?,?)")
            .bind(reg.id, iid, v.item.card.product_id, JSON.stringify(v.item.card), v.item.qty, v.item.note, have.length, now()).run();
          return J({ ok: true, item_id: iid }, 201);
        }
        if (parts[3] === "items" && parts[4] && parts.length === 5 && m === "PUT") {
          const b = (await readJson(request)) || {}, qty = Math.max(1, Math.min(20, Math.round(Number(b.qty) || 1)));
          await db.prepare("UPDATE registry_items SET qty=?, note=? WHERE registry_id=? AND item_id=?").bind(qty, String(b.note || "").trim().slice(0, 140) || null, reg.id, parts[4]).run();
          return J({ ok: true });
        }
        if (parts[3] === "items" && parts[4] && parts.length === 5 && m === "DELETE") {
          await db.batch([db.prepare("DELETE FROM registry_items WHERE registry_id=? AND item_id=?").bind(reg.id, parts[4]),
                          db.prepare("DELETE FROM registry_claims WHERE registry_id=? AND item_id=?").bind(reg.id, parts[4])]);
          return J({ ok: true });
        }
        if (parts[3] === "search" && m === "GET") {
          const q = String(url.searchParams.get("q") || "").trim().slice(0, 80); if (!q) return J({ cards: [] });
          const [a, b] = await Promise.all([searchCards(env, q).catch(() => []), cjSearch(env, q, { budget_cents: 100000 }, { limit: 10 }).catch(() => [])]);
          return J({ cards: pickShelf([...b.slice(0, 3), ...a], { count: 18 }) });
        }
        if (parts[3] === "link" && m === "POST") {
          const raw = ((await readJson(request)) || {}).url || "";
          if (!safeHttpsUrl(raw)) return J({ error: "Paste a full product link (https://…)." }, 400);
          let pg; try { pg = await fetchPublic(raw); } catch (e) { return J({ error: e.message }, 422); }
          const card = productFromHtml(pg.text, pg.url);
          return card ? J({ card }) : J({ error: "We couldn't read a product name and price on that page. Try searching for it instead." }, 422);
        }
        if (parts[3] === "ai" && m === "POST") {
          const message = String(((await readJson(request)) || {}).message || "").trim(); if (!message) return J({ error: "Tell the assistant what you'd like." }, 400);
          let plan; try { plan = parseRegAi(await aiFor(env)(REG_AI_SYSTEM, regAiPrompt(reg, message))); } catch { return J({ reply: "I couldn't reach the AI just now. Try again in a moment.", groups: [] }); }
          const groups = await Promise.all(plan.items.map(async it => {
            const [a, b] = await Promise.all([searchCards(env, it.query).catch(() => []), cjSearch(env, it.query, { budget_cents: it.max_cents || 100000 }, { limit: 8 }).catch(() => [])]);
            return { query: it.query, qty: it.qty, max_cents: it.max_cents, cards: pickShelf([...b.slice(0, 2), ...a], { max_cents: it.max_cents, count: 4 }) };
          }));
          return J({ reply: plan.reply, groups: groups.filter(g => g.cards.length) });
        }
        return J({ error: "not found" }, 404);
      }

      // ---------- which store is this ----------
      if (parts[1] === "store" && m === "GET") {
        if (platform) return J({ platform: true });
        if (!store) return J({ error: "No store here." }, 404);
        const user = await currentUser(db, request);
        // Our own shop's personalized products, once the shop is public (SHOP_PUBLIC=1); a Printful hiccup just leaves the shelf out.
        const shopShelf = env.SHOP_PUBLIC === "1" && env.PRINTFUL_TOKEN ? await shopCards(env).then(c => storeShopShelf(c, store.slug, `https://${ROOT}`, STORE_MOCKUPS)).catch(() => null) : null;
        return withCookie(Promise.resolve(J({ ...publicStore(store), shelves: [...(shopShelf ? [shopShelf] : []), ...await ownShelf(db, store.id), ...shelves(await storeItems(db, store.id))],
          promo: teeOn(store) ? await teePrice(env).then(c => c < 0 ? null : teePromo(store, c)) : null, can_edit: ownsStore(user, store) })), setCookie);
      }

      // ---------- the front-page grid ----------
      if (parts[1] === "browse" && m === "GET") {
        if (!store || store.status !== "active") return J({ error: "This store isn't open." }, 404);
        const hit = await db.prepare("SELECT cards_json, created_at FROM browse_cache WHERE store_id=?").bind(store.id).first();
        const items = await storeItems(db, store.id);
        // The saved grid stays until the store's settings change (that clears browse_cache); no timed refresh.
        if (hit) return J({ cards: withoutHidden(JSON.parse(hit.cards_json), items), cached: true });
        if (!env.CHANNEL3_API_KEY) return J({ cards: [] });
        return J({ cards: withoutHidden(await refreshBrowse(env, db, store), items), cached: false });
      }

      // ---------- the finder ----------
      if (parts[1] === "find" && m === "POST") {
        if (!store || store.status !== "active") return J({ error: "This store isn't open." }, 404);
        const v = validateBrief(await readJson(request));
        if (v.error) return J({ error: v.error }, 400);
       if (!env.CHANNEL3_API_KEY) return J({ error: "Product search is not configured yet." }, 503);
        const cfg = JSON.parse(store.config_json);
        const planSystem = cfg.house ? undefined : storePlanSystem({ ...cfg, name: store.name, niche: store.niche });
        const ownList = await ownProducts(db, store.id);
        const b = v.brief, fkey = `find/${storeStamp(store)}/${await sha256(JSON.stringify(v.brief))}`;
        let r = await edgeGet(fkey), fromCache = !!r;
        if (!r) r = await findGifts(v.brief, { ai: aiFor(env), search: q => channel3Search(env, q, v.brief), alsoSearch: q => cjSearch(env, q, v.brief, { limit: 30 }), planSystem,
          extra: plan => ownMatches(ownList, [...plan.map(s => s.query), b.recipient, b.occasion, b.notes, ...(b.interests || [])], b.budget_cents) });
        if (!fromCache && (r.picks || []).length) edgePut(ctx, fkey, r, 6 * 3600);
        const items = await storeItems(db, store.id);
        r.picks = withoutHidden(r.picks || [], items); r.more = withoutHidden(r.more || [], items);
        const id = uid();
        await db.prepare("INSERT INTO searches (id,brief_json,plan_json,picks_json,created_at,store_id) VALUES (?,?,?,?,?,?)")
          .bind(id, JSON.stringify(v.brief), JSON.stringify(r.plan), JSON.stringify(r.picks), now(), store.id).run();
        return J({ search_id: id, ...r, cached: fromCache });
      }

      // ---------- shopper search (the store's search bar) ----------
      if (parts[1] === "search" && m === "GET") {
        if (!store || store.status !== "active") return J({ error: "This store isn't open." }, 404);
        const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
        if (q.length < 2) return J({ cards: [] });
        const items = await storeItems(db, store.id);
        const mineFirst = ownMatches(await ownProducts(db, store.id), [q], 50000, 12);
        const skey = `search/${encodeURIComponent(q.toLowerCase())}`;
        let found = await edgeGet(skey), fromCache = !!found;
        if (!found) { found = await searchCards(env, q); if (found.length) edgePut(ctx, skey, found, 3600); }
        return J({ q, cards: withoutHidden(mergeCards([mineFirst, found]), items), cached: fromCache });
      }

      // ---------- Log in with PayPal ----------
      if (parts[1] === "auth") {
        if (parts[2] === "paypal" && parts[3] === "callback" && m === "GET") {
          const state = url.searchParams.get("state") || "", code = url.searchParams.get("code") || "";
          const st = state && await db.prepare("DELETE FROM oauth_states WHERE state=? RETURNING created_at").bind(state).first();
          if (!st || Date.now() - Date.parse(st.created_at) > 15 * 60 * 1000 || !code) return Response.redirect(`${url.origin}/admin?login=failed`, 303);
          const user = await paypalLogin(env, code);
          if (!user) return Response.redirect(`${url.origin}/admin?login=failed`, 303);
          const sid = uid() + uid().replace(/-/g, ""), t = new Date();
          await db.prepare("INSERT INTO sessions (id,payer_id,emails_json,name,created_at,expires_at) VALUES (?,?,?,?,?,?)")
            .bind(await sha256(sid), user.payer_id, JSON.stringify(user.emails), user.name, t.toISOString(), new Date(+t + 14 * 864e5).toISOString()).run();
          return new Response(null, { status: 303, headers: { location: `${url.origin}/admin`, "set-cookie": sessionCookie(url, sid, 14 * 86400) } });
        }
        if (parts[2] === "logout" && m === "POST") {
          const sid = cookieVal(request, "gd_s");
          if (sid) await db.prepare("DELETE FROM sessions WHERE id=?").bind(await sha256(sid)).run();
          return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json", "set-cookie": sessionCookie(url, "", 0) } });
        }
      }

      // ---------- the owner's back end ----------
      if (parts[1] === "admin") {
        const user = await currentUser(db, request);
        if (!user) return J({ error: "Log in with PayPal first.", login: `${url.origin}/login` }, 401);
        const mine = await ownedStores(db, user);
        if (parts[2] === "me" && m === "GET")
          return J({ user: { name: user.name, emails: user.emails }, stores: mine.map(s => ({ id: s.id, slug: s.slug, name: s.name, status: s.status, url: storeUrl(env, url, s.slug) })) });
        if (parts[2] === "stores" && parts[3]) {
          const s = mine.find(x => x.id === parts[3]);
          if (!s) return J({ error: "Not your store." }, 403);
          const cfg = JSON.parse(s.config_json);
          if (parts.length === 4 && m === "GET") {
            const items = await storeItems(db, s.id);
            const pools = (await db.prepare("SELECT id,title,raised_cents,target_cents,status,created_at FROM pools WHERE store_id=? ORDER BY created_at DESC LIMIT 50").bind(s.id).all()).results;
            const searches = await db.prepare("SELECT COUNT(*) n FROM searches WHERE store_id=?").bind(s.id).first();
            const fc = await db.prepare("SELECT cards_json FROM browse_cache WHERE store_id=?").bind(s.id).first();
            const front = fc ? JSON.parse(fc.cards_json) : [];
            return J({ store: { id: s.id, slug: s.slug, name: s.name, tagline: s.tagline, niche: s.niche, status: s.status, url: storeUrl(env, url, s.slug), house: !!cfg.house,
                       occasions: cfg.occasions, recipient_examples: cfg.recipient_examples || [], search_guidance: cfg.search_guidance || "", avoid: cfg.avoid || "", accent: cfg.accent, tee_banner: cfg.tee_banner !== false },
                       subscription: { id: s.paypal_subscription_id, status: s.subscription_status, checked_at: s.checked_at, manage_url: `${paypalWebBase(env)}/myaccount/autopay/` },
                       items: items.map(i => ({ product_id: i.product_id, status: i.status, collection: i.collection, card: JSON.parse(i.card_json) })),
                       front, pools, searches: searches.n });
          }
          if (parts[4] === "settings" && m === "PUT") {
            const v = validateSettings(await readJson(request), darkEnough);
            if (v.error) return J({ error: v.error }, 400);
            const next = { ...cfg, ...v.settings, accent: v.settings.accent || cfg.accent }; delete next.name; delete next.tagline;
            await db.batch([
              db.prepare("UPDATE stores SET name=?, tagline=?, config_json=?, updated_at=? WHERE id=?").bind(v.settings.name, v.settings.tagline, JSON.stringify(next), now(), s.id),
              db.prepare("DELETE FROM browse_cache WHERE store_id=?").bind(s.id),   // the grid follows the new guidance
            ]);
            return J({ ok: true });
          }
          if (parts[4] === "search" && m === "GET") {
            const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
            return J({ cards: q.length >= 2 ? await searchCards(env, q) : [] });
          }
          if (parts[4] === "items" && parts.length === 5 && m === "PUT") {
            const err = await putItem(db, s.id, await readJson(request));
            return err ? J({ error: err }, err.startsWith("That's the most") ? 409 : 400) : J({ ok: true });
          }
          // ---- the AI assistant: plan (nothing changes), then apply what the owner approved ----
          if (parts[4] === "assist" && m === "POST") {
            const body = (await readJson(request)) || {};
            if (parts.length === 5) return J(await assistPlan(env, db, s, cfg, body));
            if (parts[5] === "apply") return J(await assistApply(env, db, s, cfg, body));
          }
          if (parts[4] === "items" && parts[5] && m === "DELETE") {
            await db.prepare("DELETE FROM store_items WHERE store_id=? AND product_id=?").bind(s.id, decodeURIComponent(parts[5])).run();
            return J({ ok: true });
          }
          // ---- the owner's own products ----
          if (parts[4] === "own") {
            const sources = async () => (await db.prepare("SELECT id,kind,url,last_synced,last_error,product_count FROM own_sources WHERE store_id=? ORDER BY created_at").bind(s.id).all()).results;
            if (parts.length === 5 && m === "GET") return J({ sources: await sources(), products: await ownProducts(db, s.id, { all: true }), max: OWN_MAX });
            if ((parts[5] === "shopify" || parts[5] === "etsy") && m === "POST") {
              const r = await connectSource(env, db, s.id, parts[5], ((await readJson(request)) || {}).url || "");
              return r.ok ? J(r) : J({ error: r.error }, r.status || 422);
            }
            if (parts[5] === "link" && m === "POST") {
              const raw = ((await readJson(request)) || {}).url || "";
              if (!safeHttpsUrl(raw)) return J({ error: "Paste a full product link (https://…)." }, 400);
              let page; try { page = await fetchPublic(raw); } catch (e) { return J({ error: e.message }, 422); }
              const card = productFromHtml(page.text, page.url);
              if (!card) return J({ error: "We couldn't find a product name and price on that page. Try the CSV import instead." }, 422);
              await upsertOwn(db, s.id, [card], "link");
              return J({ ok: true, product: card });
            }
            if (parts[5] === "csv" && m === "POST") {
              const body = (await readJson(request)) || {};
              if (String(body.csv || "").length > 2_000_000) return J({ error: "That file is too large (2 MB max)." }, 413);
              const r = parseCsv(body.csv);
              if (!r.rows.length) return J({ error: r.errors[0] || "No products found in that file.", errors: r.errors }, 400);
              await upsertOwn(db, s.id, r.rows, "csv");
              return J({ ok: true, added: r.rows.length, errors: r.errors });
            }
            if (parts[5] === "sync" && m === "POST") {
              const out = [];
              for (const src of await sources()) out.push({ url: src.url, ...(await syncSource(env, db, { ...src, store_id: s.id })) });
              return J({ results: out });
            }
            if (parts[5] === "products" && parts[6] && m === "DELETE") {
              await db.prepare("DELETE FROM own_products WHERE store_id=? AND product_id=?").bind(s.id, decodeURIComponent(parts[6])).run();
              return J({ ok: true });
            }
            if (parts[5] === "sources" && parts[6] && m === "DELETE") {
              await db.batch([db.prepare("DELETE FROM own_products WHERE store_id=? AND source_id=?").bind(s.id, parts[6]),
                              db.prepare("DELETE FROM own_sources WHERE store_id=? AND id=?").bind(s.id, parts[6])]);
              return J({ ok: true });
            }
          }
        }
        return J({ error: "not found" }, 404);
      }

      // ---------- gift.directory: draft and publish a store ----------
      if (parts[1] === "stores") {
        if (parts[2] === "draft" && m === "POST") {
          const b = (await readJson(request)) || {};
          const niche = String(b.niche || "").trim().slice(0, 120);
          if (niche.length < 3) return J({ error: "Tell us who the store is for." }, 400);
          let j = null; try { j = await aiFor(env)(DRAFT_SYSTEM, `The store is for: ${niche}`); } catch { j = null; }
          const draft = parseDraft(j, niche);
          // Offer a free address: add -2, -3 … if the AI's slug is taken.
          for (let n = 2, base = draft.slug; await db.prepare("SELECT 1 FROM stores WHERE slug=?").bind(draft.slug).first(); n++) draft.slug = `${base}-${n}`.slice(0, 30);
          return J({ niche, draft, ai_drafted: !!j });
        }
        if (parts.length === 2 && m === "POST") {
          if (!paypalOn(env) || !env.PAYPAL_PLAN_ID) return J({ error: "Store billing is not configured." }, 503);
          const v = validateStore(await readJson(request));
          if (v.error) return J({ error: v.error }, 400);
          const s = v.store;
          if (await db.prepare("SELECT 1 FROM stores WHERE slug=?").bind(s.slug).first()) return J({ error: `${s.slug}.${ROOT} is taken.` }, 409);
          const id = uid(), token = uid(), t = now();
          const cfg = { occasions: s.occasions, recipient_examples: s.recipient_examples, search_guidance: s.search_guidance, avoid: s.avoid, accent: s.accent };
          await db.prepare("INSERT INTO stores (id,slug,name,tagline,niche,config_json,owner_email,manage_hash,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'draft',?,?)")
            .bind(id, s.slug, s.name, s.tagline, s.niche, JSON.stringify(cfg), s.owner_email, await sha256(token), t, t).run();
          const r = await paypalFetch(env, "/v1/billing/subscriptions", { method: "POST", body: subscriptionBody({ id }, env.PAYPAL_PLAN_ID, url.origin),
            headers: { "PayPal-Request-Id": `sub-${id}` } });
          const href = r.status < 300 && r.body ? (link(r.body, "approve") || {}).href : null;
          if (!href) return J({ error: "PayPal could not start the subscription.", paypal_status: r.status, paypal_error: r.body && (r.body.name || r.body.message) }, 502);
          await db.prepare("UPDATE stores SET paypal_subscription_id=?, subscription_status=?, updated_at=? WHERE id=?").bind(r.body.id, r.body.status || null, now(), id).run();
          return J({ id, slug: s.slug, manage_token: token, approve_url: href, store_url: storeUrl(env, url, s.slug) }, 201);
        }
        // PayPal sends the owner back here after approving. PayPal's own record decides.
        if (parts[3] === "subscribed" && m === "GET") {
          const s = await db.prepare("SELECT * FROM stores WHERE id=?").bind(parts[2]).first();
          if (!s || !s.paypal_subscription_id) return Response.redirect(`${url.origin}/new`, 303);
          const fresh = await refreshSubscription(db, env, s);
          return Response.redirect(fresh.status === "active" ? `${storeUrl(env, url, s.slug)}?welcome=1` : `${url.origin}/new?pending=${s.id}`, 303);
        }
      }

      // ---------- group gift pools ----------
      if (parts[1] === "pools") {
        if (parts.length === 2 && m === "POST") {
          if (!store || store.status !== "active") return J({ error: "This store isn't open." }, 404);
          const v = validatePool(await readJson(request));
          if (v.error) return J({ error: v.error }, 400);
          const id = shortId(), token = uid(), t = now(), p = v.pool;
          await db.prepare("INSERT INTO pools (id,manage_hash,title,occasion,organizer_name,organizer_email,product_json,target_cents,created_at,updated_at,store_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
            .bind(id, await sha256(token), p.title, p.occasion, p.organizer_name, p.organizer_email, JSON.stringify(p.product), p.target_cents, t, t, store.id).run();
          return J({ id, manage_token: token, share_url: `${url.origin}/g/${id}` }, 201);
        }
        // PayPal sends the contributor back here; the capture is what counts the money.
        if (parts[2] === "return" && m === "GET") {
          const orderId = url.searchParams.get("token");
          const c = orderId && await db.prepare("SELECT * FROM contributions WHERE paypal_order_id=?").bind(orderId).first();
          if (!c) return Response.redirect(`${url.origin}/`, 303);
          if (c.status === "pending") {
            const r = await paypalFetch(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
              { method: "POST", body: {}, headers: { "PayPal-Request-Id": `cap-${c.id}`, Prefer: "return=representation" } });
            let cap = r.status < 300 ? readCapture(r.body) : null;
            // Already captured (a refresh, a second tab, a retry): read the order instead of guessing.
            const already = r.body && (r.body.name === "ORDER_ALREADY_CAPTURED" ||
              (r.body.details || []).some(d => d && d.issue === "ORDER_ALREADY_CAPTURED"));
            if (!cap && already) { const g = await paypalFetch(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}`); cap = g.status < 300 ? readCapture(g.body) : null; }
            if (!cap) cap = { status: "PENDING", reason: `capture HTTP ${r.status}` };
            const res = await applyCapture(db, c, cap);
            return Response.redirect(`${url.origin}/g/${c.pool_id}?paid=${res.outcome === "paid" || res.outcome === "already" ? 1 : 0}`, 303);
          }
          return Response.redirect(`${url.origin}/g/${c.pool_id}?paid=${c.status === "paid" ? 1 : 0}`, 303);
        }
        if (parts[2] === "cancel" && m === "GET") {
          const orderId = url.searchParams.get("token");
          const c = orderId && await db.prepare("SELECT * FROM contributions WHERE paypal_order_id=?").bind(orderId).first();
          if (c) await db.prepare("UPDATE contributions SET status='cancelled', note='Cancelled at PayPal.', updated_at=? WHERE id=? AND status='pending'").bind(now(), c.id).run();
          return Response.redirect(c ? `${url.origin}/g/${c.pool_id}?cancelled=1` : `${url.origin}/`, 303);
        }
        const pool = parts[2] && await db.prepare("SELECT * FROM pools WHERE id=?").bind(parts[2]).first();
        if (!pool) return J({ error: "not found" }, 404);
        if (parts.length === 3 && m === "GET") {
          const cs = (await db.prepare("SELECT * FROM contributions WHERE pool_id=? ORDER BY paid_at").bind(pool.id).all()).results;
          return J(publicPool(pool, cs));
        }
        if (parts[3] === "contribute" && m === "POST") {
          if (!paypalOn(env)) return J({ error: "PayPal is not configured." }, 503);
          const b = (await readJson(request)) || {};
          const cents = Math.round(Number(b.amount_cents));
          const err = contributionError(pool, cents);
          if (err) return J({ error: err }, 409);
          const c = { id: uid(), pool_id: pool.id, amount_cents: cents };
          const r = await paypalFetch(env, "/v2/checkout/orders", { method: "POST", body: buildContributionOrder(pool, c, url.origin),
            headers: { "PayPal-Request-Id": c.id } });
          const href = r.status < 300 && r.body ? (link(r.body, "payer-action") || link(r.body, "approve") || {}).href : null;
          if (!href) return J({ error: "PayPal could not start the payment.", paypal_status: r.status, paypal_error: r.body && (r.body.name || r.body.message), detail: r.body && r.body.details }, 502);
          const t = now();
          await db.prepare("INSERT INTO contributions (id,pool_id,paypal_order_id,amount_cents,name,message,hide_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'pending',?,?)")
            .bind(c.id, pool.id, r.body.id, cents, String(b.name || "").slice(0, 60) || null, String(b.message || "").slice(0, 280) || null, b.hide_name ? 1 : 0, t, t).run();
          return J({ url: href });
        }
        // The organizer's controls: private token, never in the share link.
        if (parts[3] === "close" && m === "POST") {
          const tok = request.headers.get("x-manage-token") || "";
          if (!tok || (await sha256(tok)) !== pool.manage_hash) return J({ error: "not allowed" }, 403);
          await db.prepare("UPDATE pools SET status='closed', updated_at=? WHERE id=? AND status IN ('open','funded')").bind(now(), pool.id).run();
          return J({ id: pool.id, status: "closed" });
        }
      }
      return J({ error: "not found" }, 404);
    } catch (e) {
      return J({ error: String((e && e.message) || e) }, 500);
    }
  },

  // Daily: re-pull every connected Shopify and Etsy shop (prices, stock, new products), oldest sync first.
  async scheduled(controller, env, ctx) {
    const db = env.DB;
    const due = (await db.prepare("SELECT * FROM own_sources WHERE kind IN ('shopify','etsy') AND (last_synced IS NULL OR last_synced < ?) ORDER BY last_synced LIMIT 25")
      .bind(new Date(Date.now() - 20 * 3600 * 1000).toISOString()).all()).results;
    for (const src of due) ctx.waitUntil(syncSource(env, db, src));
    // Mondays: retry team, fandom, breed and other themed pages that had too little stock to build (they go live once stock shows up).
    if (new Date(controller.scheduledTime || Date.now()).getUTCDay() === 1) ctx.waitUntil(retryTeamPages(db, env));
    // Registry reminders that are due today.
    ctx.waitUntil(sendReminders(env, db, new Date(controller.scheduledTime || Date.now()).toISOString().slice(0, 10)).catch(() => {}));
  },
};
