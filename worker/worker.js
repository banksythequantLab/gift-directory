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
    const cands = found.map((list, i) => mergeCards([list.filter(Boolean)]).filter(c => allowed(p, c) && fits(c, i)).slice(0, 6));
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
        return new Response(renderLegal(parts[0]), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
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
          return new Response(sitemap([{ loc: `https://${ROOT}/` }, { loc: `https://${ROOT}/gifts` }, ...LEGAL_SLUGS.map(s => ({ loc: `https://${ROOT}/${s}` })),
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
      if (parts[0] !== "api") {
        // Ask for bare names ("/pool", not "/pool.html"): the asset server answers .html with a 307
        // to the bare name, and that redirect reached the browser and threw away /g/<id>.
        if (parts[0] === "g" && parts[1]) return page("/pool");
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
        if (platform && (parts.length === 0 || parts[0] === "new")) return page("/platform");
        if (parts.length === 0) return page("/");
        return env.ASSETS.fetch(request);
      }

      // ---------- which store is this ----------
      if (parts[1] === "store" && m === "GET") {
        if (platform) return J({ platform: true });
        if (!store) return J({ error: "No store here." }, 404);
        const user = await currentUser(db, request);
        return withCookie(Promise.resolve(J({ ...publicStore(store), shelves: [...await ownShelf(db, store.id), ...shelves(await storeItems(db, store.id))],
          can_edit: ownsStore(user, store) })), setCookie);
      }

      // ---------- the front-page grid ----------
      if (parts[1] === "browse" && m === "GET") {
        if (!store || store.status !== "active") return J({ error: "This store isn't open." }, 404);
        const hit = await db.prepare("SELECT cards_json, created_at FROM browse_cache WHERE store_id=?").bind(store.id).first();
        const items = await storeItems(db, store.id);
        if (hit && Date.now() - Date.parse(hit.created_at) < 6 * 3600 * 1000) return J({ cards: withoutHidden(JSON.parse(hit.cards_json), items), cached: true });
        if (!env.CHANNEL3_API_KEY) return J({ cards: [] });
        const cfg = JSON.parse(store.config_json);
        const planSystem = cfg.house ? undefined : storePlanSystem({ ...cfg, name: store.name, niche: store.niche });
        const r = await browseGifts(store.niche, { ai: aiFor(env), search: (q, b) => channel3Search(env, q, b), alsoSearch: q => cjSearch(env, q, { budget_cents: 15000 }, { limit: 30 }), planSystem, queries: cfg.browse_searches });
        if (r.cards.length) await db.prepare("INSERT INTO browse_cache (store_id,cards_json,created_at) VALUES (?,?,?) ON CONFLICT(store_id) DO UPDATE SET cards_json=excluded.cards_json, created_at=excluded.created_at")
          .bind(store.id, JSON.stringify(r.cards), now()).run();
        return J({ cards: withoutHidden(r.cards, items), cached: false });
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
        const b = v.brief;
        const r = await findGifts(v.brief, { ai: aiFor(env), search: q => channel3Search(env, q, v.brief), alsoSearch: q => cjSearch(env, q, v.brief, { limit: 30 }), planSystem,
          extra: plan => ownMatches(ownList, [...plan.map(s => s.query), b.recipient, b.occasion, b.notes, ...(b.interests || [])], b.budget_cents) });
        const items = await storeItems(db, store.id);
        r.picks = withoutHidden(r.picks || [], items); r.more = withoutHidden(r.more || [], items);
        const id = uid();
        await db.prepare("INSERT INTO searches (id,brief_json,plan_json,picks_json,created_at,store_id) VALUES (?,?,?,?,?,?)")
          .bind(id, JSON.stringify(v.brief), JSON.stringify(r.plan), JSON.stringify(r.picks), now(), store.id).run();
        return J({ search_id: id, ...r });
      }

      // ---------- shopper search (the store's search bar) ----------
      if (parts[1] === "search" && m === "GET") {
        if (!store || store.status !== "active") return J({ error: "This store isn't open." }, 404);
        const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
        if (q.length < 2) return J({ cards: [] });
        const items = await storeItems(db, store.id);
        const mineFirst = ownMatches(await ownProducts(db, store.id), [q], 50000, 12);
        return J({ q, cards: withoutHidden(mergeCards([mineFirst, await searchCards(env, q)]), items) });
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
                       occasions: cfg.occasions, recipient_examples: cfg.recipient_examples || [], search_guidance: cfg.search_guidance || "", avoid: cfg.avoid || "", accent: cfg.accent },
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
            const v = validateItem(await readJson(request));
            if (v.error) return J({ error: v.error }, 400);
            const n = await db.prepare("SELECT COUNT(*) n FROM store_items WHERE store_id=?").bind(s.id).first();
            if (n.n >= 300) return J({ error: "That's the most a store can curate." }, 409);
            await db.prepare("INSERT INTO store_items (store_id,product_id,status,collection,card_json,sort,created_at) VALUES (?,?,?,?,?,?,?) " +
              "ON CONFLICT(store_id,product_id) DO UPDATE SET status=excluded.status, collection=excluded.collection, card_json=excluded.card_json")
              .bind(s.id, v.item.card.product_id, v.item.status, v.item.collection, JSON.stringify(v.item.card), n.n, now()).run();
            return J({ ok: true });
          }
          if (parts[4] === "items" && parts[5] && m === "DELETE") {
            await db.prepare("DELETE FROM store_items WHERE store_id=? AND product_id=?").bind(s.id, decodeURIComponent(parts[5])).run();
            return J({ ok: true });
          }
          // ---- the owner's own products ----
          if (parts[4] === "own") {
            const sources = async () => (await db.prepare("SELECT id,kind,url,last_synced,last_error,product_count FROM own_sources WHERE store_id=? ORDER BY created_at").bind(s.id).all()).results;
            if (parts.length === 5 && m === "GET") return J({ sources: await sources(), products: await ownProducts(db, s.id, { all: true }), max: OWN_MAX });
            if (parts[5] === "shopify" && m === "POST") {
              const origin = shopOrigin(((await readJson(request)) || {}).url || "");
              if (!origin) return J({ error: "Enter your shop's web address, like myshop.com or myshop.myshopify.com." }, 400);
              const list = await sources();
              let src = list.find(x => x.url === origin);
              if (!src) {
                if (list.length >= 3) return J({ error: "A store can connect up to 3 shops." }, 409);
                src = { id: uid(), store_id: s.id, kind: "shopify", url: origin };
                await db.prepare("INSERT INTO own_sources (id,store_id,kind,url,created_at) VALUES (?,?,?,?,?)").bind(src.id, s.id, "shopify", origin, now()).run();
              }
              const r = await syncShopify(db, { ...src, store_id: s.id });
              if (!r.ok && !list.find(x => x.url === origin)) await db.prepare("DELETE FROM own_sources WHERE id=?").bind(src.id).run(); // a failed first connect leaves nothing behind
              return r.ok ? J(r) : J({ error: r.error }, 422);
            }
            if (parts[5] === "etsy" && m === "POST") {
              const name = etsyShopName(((await readJson(request)) || {}).url || "");
              if (!name) return J({ error: "Enter your Etsy shop name or address, like etsy.com/shop/YourShop." }, 400);
              const url = etsyShopUrl(name), list = await sources();
              let src = list.find(x => x.url.toLowerCase() === url.toLowerCase());
              if (!src) {
                if (list.length >= 3) return J({ error: "A store can connect up to 3 shops." }, 409);
                src = { id: uid(), store_id: s.id, kind: "etsy", url };
                await db.prepare("INSERT INTO own_sources (id,store_id,kind,url,created_at) VALUES (?,?,?,?,?)").bind(src.id, s.id, "etsy", url, now()).run();
              }
              const r = await syncEtsy(env, db, { ...src, store_id: s.id });
              if (!r.ok && !list.find(x => x.id === src.id)) await db.prepare("DELETE FROM own_sources WHERE id=?").bind(src.id).run();
              return r.ok ? J(r) : J({ error: r.error }, 422);
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
  },
};
