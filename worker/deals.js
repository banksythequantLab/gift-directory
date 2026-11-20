// Sales on gift.directory (gift.directory/sales), from two sources:
//   1. Markdowns: products already picked for a gift guide whose price is below the retailer's own regular
//      ("compare at") price. A guide's prices can be two weeks old, so nothing is listed as on sale until the
//      catalog has been asked for that product's price again; the date of that check is shown on the card.
//   2. Store offers: coupon codes and sale events from the CJ advertisers we have joined (CJ Link Search).
// Nothing here is written by a model, and no discount is computed from anything but the retailer's two prices.
import { shell, pageBySlug, productLd } from "./seo.js";
import { alertForm } from "./alerts.js";
import { toCard, isJunk } from "./finder.js";

const C3 = "https://api.trychannel3.com";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = c => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
const clip = (s, n) => { s = String(s ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + "\u2026" : s; };
const day = iso => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

// ---------- markdowns ----------
// A markdown counts from 10% off. Over 60% is nearly always an inflated "regular" price (department-store list prices), not a sale.
export const DEAL_MIN_PCT = 10, DEAL_MAX_PCT = 60, DEAL_MIN_CENTS = 500;
export const DEAL_FRESH_HOURS = 48;      // listed only if the price was checked this recently
export const DEAL_RECHECK_HOURS = 20;    // a listed markdown is checked again after this long
export const DEAL_RETRY_DAYS = 7;        // a product that was not on sale is looked at again after this long
export const DEALS_KEEP = 300;           // stop adding new markdowns past this many listed
export const pctOff = c => c && c.was_cents > c.price_cents && c.price_cents > 0 ? Math.round((1 - c.price_cents / c.was_cents) * 100) : 0;
export function isDeal(c) {
  const p = pctOff(c);
  return !!c && p >= DEAL_MIN_PCT && p <= DEAL_MAX_PCT && c.price_cents >= DEAL_MIN_CENTS && /^https:\/\//.test(c.url || "") && !!c.image && !isJunk(c);
}
// The badge on any product card that shows two prices (guides too).
export const saleBadge = c => { const p = pctOff(c); return p >= 5 && p <= DEAL_MAX_PCT ? `<span class="save">Save ${p}%</span>` : ""; };

// Guide picks that were marked down when their guide was last refreshed (catalog products only: CJ products have no price lookup by id).
const CANDIDATES = "SELECT s.slug AS slug, j.value AS card FROM seo_pages s, json_each(s.cards_json) j " +
  "WHERE json_extract(j.value,'$.was_cents') > json_extract(j.value,'$.price_cents') AND json_extract(j.value,'$.product_id') NOT LIKE 'cj:%' " +
  "AND json_extract(j.value,'$.product_id') NOT IN (SELECT product_id FROM deals)";

// Ask the catalog for one product's price now. { card } on sale or not; { gone } if the catalog no longer has it; { error } to try later.
export async function checkPrice(env, id, { fetchImpl = fetch } = {}) {
  let r;
  try { r = await fetchImpl(`${C3}/v1/products/${encodeURIComponent(id)}`, { headers: { "x-api-key": env.CHANNEL3_API_KEY }, signal: AbortSignal.timeout(8000) }); }
  catch (e) { return { error: String((e && e.message) || e) }; }
  if (r.status === 404) return { gone: true };
  if (!r.ok) return { error: `catalog ${r.status}`, stop: r.status === 429 || r.status === 401 || r.status === 403 };
  const p = await r.json().catch(() => null);
  if (!p || !p.id) return { error: "catalog answer unreadable" };
  return { card: toCard(p, 1e12) };       // null when nothing is in stock
}

// One round: re-check the listed markdowns that are due, then new candidates, then old misses. At most `max` catalog lookups.
export async function refreshDeals(db, env, { max = 30, fetchImpl = fetch, nowMs = Date.now() } = {}) {
  const iso = ms => new Date(ms).toISOString(), t = iso(nowMs), out = { checked: 0, on_sale: 0, ended: 0, gone: 0, errors: 0, new: 0 };
  const due = (await db.prepare("SELECT product_id, slug, card_json, on_sale FROM deals WHERE on_sale=1 AND checked_at < ? ORDER BY checked_at LIMIT ?")
    .bind(iso(nowMs - DEAL_RECHECK_HOURS * 3600e3), max).all()).results.map(d => ({ id: d.product_id, slug: d.slug, old: JSON.parse(d.card_json), listed: true }));
  const queue = [...due];
  if (queue.length < max) {
    const listed = (await db.prepare("SELECT COUNT(*) AS n FROM deals WHERE on_sale=1").first()).n;
    if (listed < DEALS_KEEP) {
      const seen = new Set(), cand = [];
      for (const r of (await db.prepare(CANDIDATES).all()).results) {
        let c; try { c = JSON.parse(r.card); } catch { continue; }
        if (!c || !c.product_id || seen.has(c.product_id) || !isDeal(c)) continue;
        seen.add(c.product_id); cand.push({ id: c.product_id, slug: r.slug, old: c, pct: pctOff(c) });
      }
      cand.sort((a, b) => b.pct - a.pct);
      queue.push(...cand.slice(0, max - queue.length));
    }
  }
  if (queue.length < max) {
    const misses = (await db.prepare("SELECT product_id, slug, card_json FROM deals WHERE on_sale=0 AND checked_at < ? ORDER BY checked_at LIMIT ?")
      .bind(iso(nowMs - DEAL_RETRY_DAYS * 864e5), max - queue.length).all()).results;
    queue.push(...misses.map(d => ({ id: d.product_id, slug: d.slug, old: JSON.parse(d.card_json) })));
  }
  const writes = [];
  const put = (q, card, on) => writes.push(db.prepare("INSERT INTO deals (product_id,slug,card_json,price_cents,was_cents,pct,on_sale,checked_at) VALUES (?,?,?,?,?,?,?,?) " +
    "ON CONFLICT(product_id) DO UPDATE SET slug=excluded.slug, card_json=excluded.card_json, price_cents=excluded.price_cents, was_cents=excluded.was_cents, pct=excluded.pct, on_sale=excluded.on_sale, checked_at=excluded.checked_at")
    .bind(q.id, q.slug, JSON.stringify(card), card.price_cents || 0, card.was_cents || 0, on ? pctOff(card) : 0, on ? 1 : 0, t));
  for (const q of queue) {
    const r = await checkPrice(env, q.id, { fetchImpl });
    if (r.error) { out.errors++; if (r.stop) break; continue; }
    out.checked++;
    if (r.gone || !r.card) { out.gone++; put(q, q.old, false); if (q.listed) out.ended++; continue; }
    // The guide's one-line reason stays with the product; everything about price, stock and where to buy is today's.
    const card = { ...r.card, ...(q.old.reason ? { reason: q.old.reason } : {}) };
    if (isDeal(card)) { out.on_sale++; if (!q.listed) out.new++; put(q, card, true); }
    else { put(q, card, false); if (q.listed) out.ended++; }
  }
  for (let i = 0; i < writes.length; i += 40) await db.batch(writes.slice(i, i + 40));
  out.listed = (await db.prepare("SELECT COUNT(*) AS n FROM deals WHERE on_sale=1 AND checked_at > ?").bind(iso(nowMs - DEAL_FRESH_HOURS * 3600e3)).first()).n;
  return out;
}
// What the page shows: markdowns whose price was checked in the last two days, biggest first.
// `maxCents`: only markdowns selling at or under that price (the /sales/under-NN pages).
export const SALE_BUDGETS = [25, 50, 100];
export async function listedDeals(db, { limit = 160, nowMs = Date.now(), maxCents = null } = {}) {
  const rows = (await db.prepare("SELECT product_id, slug, card_json, checked_at FROM deals WHERE on_sale=1 AND checked_at > ? AND pct BETWEEN ? AND ? AND price_cents <= ? ORDER BY pct DESC, checked_at DESC LIMIT ?")
    .bind(new Date(nowMs - DEAL_FRESH_HOURS * 3600e3).toISOString(), DEAL_MIN_PCT, DEAL_MAX_PCT, maxCents || 1e12, limit).all()).results;
  return rows.map(r => { try { return { ...JSON.parse(r.card_json), product_id: r.product_id, slug: r.slug, checked_at: r.checked_at }; } catch { return null; } }).filter(c => c && isDeal(c));
}

// ---------- store offers (CJ) ----------
const unxml = s => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");
const field = (b, name) => { const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(b); return m ? unxml(m[1]).replace(/\s+/g, " ").trim() : ""; };
export function parseCjLinks(xml) {
  return [...String(xml || "").matchAll(/<link>([\s\S]*?)<\/link>/g)].map(m => ({
    id: field(m[1], "link-id"), advertiser_id: field(m[1], "advertiser-id"), advertiser: field(m[1], "advertiser-name"), title: field(m[1], "link-name"),
    body: field(m[1], "description"), kind: field(m[1], "promotion-type"), code: field(m[1], "coupon-code"), starts: field(m[1], "promotion-start-date"),
    ends: field(m[1], "promotion-end-date"), url: field(m[1], "clickUrl"), category: field(m[1], "category"), status: field(m[1], "relationship-status") }));
}
// CJ dates look like "2026-11-29 08:00:00.0" (UTC). Returned as ISO, or null.
const cjDate = s => { const m = /^(\d{4}-\d\d-\d\d)[ T](\d\d:\d\d:\d\d)/.exec(s || ""); const d = m ? new Date(`${m[1]}T${m[2]}Z`) : null; return d && !isNaN(d) ? d.toISOString() : null; };
// Live coupons and sales only, one per offer (CJ lists the same offer once per banner size).
export function cleanPromos(links, nowMs = Date.now()) {
  const seen = new Set(), out = [];
  for (const l of links || []) {
    if (!l || !/^(coupon|sale\/discount)$/i.test(l.kind) || !/^https:\/\//.test(l.url) || !l.advertiser || !l.id) continue;
    if (l.status && !/^joined$/i.test(l.status)) continue;
    const starts = cjDate(l.starts), ends = cjDate(l.ends);
    if (starts && Date.parse(starts) > nowMs) continue;
    if (ends && Date.parse(ends) <= nowMs) continue;
    const code = /^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/.test(l.code) ? l.code : "";
    const title = clip(l.title, 150), body = clip(l.body, 260);
    if (!title) continue;
    const key = l.advertiser_id + "|" + (code ? code.toLowerCase() : (body || title).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 60));
    if (seen.has(key)) continue; seen.add(key);
    // An end date years away is CJ's way of saying "no end date".
    out.push({ id: l.id, advertiser_id: l.advertiser_id, advertiser: clip(l.advertiser, 80), title, body: body.toLowerCase() === title.toLowerCase() ? "" : body,
      code, kind: /coupon/i.test(l.kind) ? "coupon" : "sale", starts_at: starts, ends_at: ends && Date.parse(ends) - nowMs < 366 * 864e5 ? ends : null, url: l.url, category: clip(l.category, 60) });
  }
  // Offers that end soonest first, then coupon codes, then the rest.
  return out.sort((a, b) => (a.ends_at ? Date.parse(a.ends_at) : 9e15) - (b.ends_at ? Date.parse(b.ends_at) : 9e15) || (b.code ? 1 : 0) - (a.code ? 1 : 0)).slice(0, 60);
}
export async function fetchPromos(env, { fetchImpl = fetch } = {}) {
  if (!(env && env.CJ_TOKEN && env.CJ_PID)) return null;
  const links = [];
  for (const kind of ["coupon", "sale/discount"]) {
    const r = await fetchImpl(`https://link-search.api.cj.com/v2/link-search?website-id=${encodeURIComponent(env.CJ_PID)}&advertiser-ids=joined&promotion-type=${encodeURIComponent(kind)}&records-per-page=100`,
      { headers: { authorization: `Bearer ${env.CJ_TOKEN}` }, signal: AbortSignal.timeout(9000) });
    if (!r.ok) throw new Error(`cj links ${r.status}`);
    links.push(...parseCjLinks(await r.text()));
  }
  return links;
}
// Replace the saved offers with today's. A failed fetch leaves yesterday's in place (they still carry their end dates).
export async function refreshPromos(db, env, { fetchImpl = fetch, nowMs = Date.now() } = {}) {
  const links = await fetchPromos(env, { fetchImpl });
  if (!links) return { ok: false, error: "CJ is not set up" };
  const promos = cleanPromos(links, nowMs), t = new Date(nowMs).toISOString();
  await db.batch([db.prepare("DELETE FROM promos"), ...promos.map(p => db.prepare("INSERT INTO promos (id,advertiser_id,advertiser,title,body,code,kind,starts_at,ends_at,url,category,fetched_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(p.id, p.advertiser_id, p.advertiser, p.title, p.body, p.code, p.kind, p.starts_at, p.ends_at, p.url, p.category, t))]);
  return { ok: true, found: links.length, kept: promos.length };
}
export async function listedPromos(db, nowMs = Date.now()) {
  const rows = (await db.prepare("SELECT * FROM promos ORDER BY CASE WHEN ends_at IS NULL THEN 1 ELSE 0 END, ends_at, advertiser").all()).results;
  return rows.filter(p => !p.ends_at || Date.parse(p.ends_at) > nowMs);
}
// Our own review page for a store, when we have one.
const REVIEW_OF = [[/muck/i, "muck-boots-gift-guide", "Muck boots as a gift"], [/abracadabra/i, "magic-kits-and-costume-gifts", "magic kits and costume gifts"],
  [/graphic\s*audio/i, "graphicaudio-gift-guide", "GraphicAudio audiobooks"], [/king'?s camo/i, "kings-camo-gift-guide", "Kings Camo gifts for hunters"],
  [/aceable/i, "drivers-ed-as-a-gift", "driver's ed as a gift"], [/oedro/i, "truck-accessories-gifts", "truck accessories as a gift"],
  [/angi\b|angie/i, "gift-a-home-service", "giving a home service"], [/amazing clubs/i, "gift-of-the-month-clubs", "gift of the month clubs"]];
export const promoTitle = p => { const c = String((p && p.code) || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), s = String((p && p.title) || "");
  return (c ? s.replace(new RegExp("[\\s,:;-]*(?:use\\s+|with\\s+)?(?:promo\\s+|coupon\\s+)?code:?\\s*" + c + "\\b\\.?", "ig"), "").trim() : s).replace(/^[a-z]/, ch => ch.toUpperCase()) || s; };
export const promoReview = advertiser => { const m = REVIEW_OF.find(([re]) => re.test(advertiser || "")); return m ? { slug: m[1], label: m[2] } : null; };
export const promosForReview = (slug, promos) => (promos || []).filter(p => { const r = promoReview(p.advertiser); return r && r.slug === slug; });
// "through Nov 28": CJ's end time is midnight Pacific at the START of the next day.
const through = iso => new Date(Date.parse(iso) - 60e3).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" });

// ---------- HTML ----------
const SALE_CSS = `<style>.promo{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));margin-top:14px}.promo .card h3{margin:2px 0 6px;font-size:1.02rem}
.code{display:inline-block;border:2px dashed var(--accent);border-radius:8px;padding:3px 10px;font:700 .95rem ui-monospace,Consolas,monospace;background:#fff;letter-spacing:.5px}
.ends{font-size:.82rem;color:#92400e;font-weight:600}.chk{font-size:.76rem;color:var(--muted);margin:4px 0 0}.from{font-size:.82rem;margin:6px 0 0}</style>`;
// One card per store: a store with a dozen tiered codes would otherwise bury everyone else. Stores keep the order of
// their soonest-ending offer; each shows up to four offers and says how many more it has.
export function groupPromos(promos) {
  const m = new Map();
  for (const p of promos || []) { const k = p.advertiser_id || p.advertiser; if (!m.has(k)) m.set(k, { advertiser: p.advertiser, offers: [] }); m.get(k).offers.push(p); }
  return [...m.values()];
}
const PER_STORE = 4;
function storeCard(g) {
  const rev = promoReview(g.advertiser), shown = g.offers.slice(0, PER_STORE), more = g.offers.length - shown.length;
  return `<article class="card"><h3 style="margin:0 0 8px;font-family:Georgia,serif;font-size:1.15rem">${esc(g.advertiser)}</h3>
<ul style="margin:0 0 10px;padding-left:18px">${shown.map(p => `<li style="margin:0 0 8px"><a href="${esc(p.url)}" target="_blank" rel="noopener sponsored nofollow">${esc(clip(promoTitle(p), 110))}</a><br>${p.code ? `Code <span class="code">${esc(p.code)}</span> ` : ""}<span class="ends">${p.ends_at ? `Through ${esc(through(p.ends_at))}` : "No end date given"}</span></li>`).join("")}</ul>
${more > 0 ? `<p class="muted" style="font-size:.85rem;margin:0 0 10px">and ${more} more offer${more === 1 ? "" : "s"} at this store</p>` : ""}
<a class="btn sec" href="${esc(g.offers[0].url)}" target="_blank" rel="noopener sponsored nofollow">Shop at ${esc(g.advertiser)}</a>
${rev ? `<p class="from">Our notes: <a href="/reviews/${rev.slug}">${esc(rev.label)}</a></p>` : ""}</article>`;
}
export function dealCard(c, { from = true } = {}) {
  const g = from && c.slug ? pageBySlug(c.slug) : null;
  return `<article class="card gift">${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.title)}" loading="lazy" width="300" height="300">` : ""}
<h3>${esc(c.title)}</h3><div class="muted" style="font-size:.82rem">${esc(c.brand || "")}${c.brand ? " · " : ""}${esc(c.merchant)}</div>
<div class="price">${money(c.price_cents)}${c.was_cents > c.price_cents ? `<span class="was">${money(c.was_cents)}</span>` : ""}${saleBadge(c)}</div>
${c.reason && !g ? `<p class="why">${esc(c.reason)}</p>` : ""}
<div class="acts"><a class="btn sec" href="${esc(c.url)}" target="_blank" rel="noopener sponsored nofollow">View at ${esc(c.merchant)}</a></div>
${c.checked_at ? `<p class="chk">Price checked ${esc(day(c.checked_at))}</p>` : ""}${g ? `<p class="from">From our guide: <a href="/gifts/${g.slug}">${esc(g.keyword)}</a></p>` : ""}${g ? alertForm(c, c.slug) : ""}</article>`;
}
const TOP_N = 12, PER_TOPIC = 8;
// `under` (dollars): the same page limited to gifts at or under that price, at /sales/under-NN, without the coupon section.
// The US shopping days around Thanksgiving (the fourth Thursday of November) for a given year.
export function blackFridayDates(year) {
  const nov1 = new Date(Date.UTC(year, 10, 1)).getUTCDay(), thanks = 1 + ((4 - nov1 + 7) % 7) + 21;
  const d = n => new Date(Date.UTC(year, 10, n)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const md = n => new Date(Date.UTC(year, 10, n)).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  // The weekday is in the names of the last two days already, so they get the plain date.
  return { year, thanksgiving: d(thanks), blackFriday: d(thanks + 1), smallBusiness: md(thanks + 2), cyberMonday: md(thanks + 4) };
}
// bf: the same checked markdowns, presented as the Black Friday page (/black-friday) with that season's dates and questions.
export function renderSales({ deals = [], promos = [], ad = "", nowMs = Date.now(), under = null, signup = "", bf = false } = {}) {
  if (bf) under = null;
  if (under) promos = [];
  const et = new Date(new Date(nowMs).toLocaleString("en-US", { timeZone: "America/New_York" })), week = (et.getMonth() === 10 && et.getDate() >= 20) || (et.getMonth() === 11 && et.getDate() <= 1);
  const h1 = bf ? "Black Friday gift deals" : under ? `Gift deals under ${under}` : "Gifts on sale now";
  const bfd = blackFridayDates(et.getMonth() === 11 && et.getDate() > 2 ? et.getFullYear() + 1 : et.getFullYear());
  const bfFaq = [
    { q: `When is Black Friday ${bfd.year}?`, a: `Black Friday ${bfd.year} is ${bfd.blackFriday}, the day after Thanksgiving (${bfd.thanksgiving}). Small Business Saturday is ${bfd.smallBusiness} and Cyber Monday is ${bfd.cyberMonday}.` },
    { q: "Are Black Friday prices really lower?", a: "Sometimes. A markdown only means something against the price the store normally charges, so every gift on this page shows the store's own regular price next to today's price, and the date we last checked it." },
    { q: "Should I wait for Cyber Monday?", a: "For most gifts the two days carry similar prices. If a gift on your list is already marked down here and in stock, waiting risks it selling out; stores restock less often in December." },
  ];
  const budgets = `<nav class="rel" aria-label="Sales by budget" style="margin:0 0 12px">${under ? `<a href="/sales">All sales</a>` : ""}${SALE_BUDGETS.filter(b => b !== under).map(b => `<a href="/sales/under-${b}">Under $${b}</a>`).join("")}</nav>`;
  const url = bf ? "https://gift.directory/black-friday" : "https://gift.directory/sales" + (under ? `/under-${under}` : ""), today = new Date(nowMs).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
  const top = deals.slice(0, TOP_N), rest = deals.slice(TOP_N), byTopic = new Map();
  for (const c of rest) { const g = pageBySlug(c.slug), t = (g && g.topic) || "More gifts"; if (!byTopic.has(t)) byTopic.set(t, []); if (byTopic.get(t).length < PER_TOPIC) byTopic.get(t).push(c); }
  const topics = [...byTopic.entries()].filter(([, cs]) => cs.length >= 3).sort((a, b) => b[1].length - a[1].length);
  const shown = [...top, ...topics.flatMap(([, cs]) => cs)];
  const body = `${SALE_CSS}<div class="crumbs"><a href="/">gift.directory</a> › ${bf ? `<a href="/sales">Sales</a> › Black Friday` : "Sales"}</div>
<h1 style="font-family:Georgia,serif;margin:4px 0 6px">${h1}</h1>
<p class="muted" style="margin:0 0 12px">Updated ${esc(today)} · ${week ? "Black Friday and Cyber Monday week · " : ""}${shown.length} marked-down gifts${under ? "" : ` · ${promos.length} offers from ${groupPromos(promos).length} stores`}</p>
${budgets}${bf ? `<section class="guide"><p><b>Black Friday ${bfd.year}</b> is ${esc(bfd.blackFriday)}. Thanksgiving is ${esc(bfd.thanksgiving)}, Small Business Saturday is ${esc(bfd.smallBusiness)} and Cyber Monday is ${esc(bfd.cyberMonday)}. Many stores start their Black Friday prices a week or more early, so the markdowns below are live now and re-checked through the season.</p></section>` : (week ? `<p><a href="/black-friday"><b>Black Friday ${bfd.year}: dates and gift deals →</b></a></p>` : "")}<section class="guide"><p>Every gift below comes from one of our <a href="/gifts">gift guides</a>${under ? `, costs $${under} or less today,` : ""} and is selling for less than the retailer's own regular price right now. We ask the retailer catalog for each price again before listing it, and the date of that check is on the card.${under ? "" : " Coupon codes and sale events come straight from the stores we work with, with the end date each store gave."}</p></section>
${top.length ? `<h2 style="font-family:Georgia,serif">Biggest markdowns</h2><div class="grid">${top.map(c => dealCard(c)).join("")}</div>` : ""}
${topics.map(([t, cs]) => `<h2 style="font-family:Georgia,serif">${esc(t)} on sale</h2><div class="grid">${cs.map(c => dealCard(c)).join("")}</div>`).join("")}
${promos.length ? `<h2 style="font-family:Georgia,serif">Coupon codes and store sales</h2><div class="promo">${groupPromos(promos).map(storeCard).join("")}</div>` : ""}
${!shown.length && !promos.length ? `<p>No sales have been confirmed in the last two days. <a href="/gifts">Browse the gift guides</a> in the meantime.</p>` : ""}
${signup}${bf ? `<h2 style="font-family:Georgia,serif">Black Friday questions</h2>${bfFaq.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("")}` : ""}<h2 style="font-family:Georgia,serif">How this page works</h2>
<section class="guide"><p><b>What counts as a sale.</b> The "was" price is the regular price the retailer itself lists next to its current price. We show a markdown only when the difference is at least ${DEAL_MIN_PCT}%, and we leave out anything showing more than ${DEAL_MAX_PCT}% off, because discounts that large are usually a mistake in a store's listing.</p>
<p><b>How fresh the prices are.</b> A markdown stays on this page only while its price has been re-checked within the last ${DEAL_FRESH_HOURS} hours. Sales end without notice, so the retailer's page always has the final price.</p>
<p><b>What we have not done.</b> We have not handled or tested these products. Each card links to the gift guide the product was chosen for, where the reason for choosing it is given. We may earn a commission when you buy through a link, at no extra cost to you; that does not change which prices are shown.</p></section>
<h2 style="font-family:Georgia,serif">More ways to save on a gift</h2><nav class="rel" aria-label="Gift guides by budget"><a href="/gifts/christmas-gifts-under-10">Christmas gifts under $10</a><a href="/gifts/christmas-gifts-under-20">Christmas gifts under $20</a><a href="/gifts/secret-santa-gifts-under-25">Secret Santa gifts under $25</a><a href="/gifts/unique-gifts-under-25">Unique gifts under $25</a><a href="/gifts/tech-gifts-under-50">Tech gifts under $50</a><a href="/gifts/black-friday-gift-ideas">Black Friday gift ideas</a><a href="/gifts">All gift guides →</a></nav>`;
  const ld = [...(shown.length ? [{ "@context": "https://schema.org", "@type": "ItemList", name: "Gifts on sale now", url, numberOfItems: shown.length,
    itemListElement: shown.map((c, i) => ({ "@type": "ListItem", position: i + 1, item: productLd(c) })) }] : []),
    ...(bf ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: bfFaq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Sales", item: "https://gift.directory/sales" }, ...(bf ? [{ "@type": "ListItem", position: 2, name: "Black Friday", item: url }] : [])] }];
  const html = bf ? shell(`Black Friday Gift Deals ${bfd.year}: Price-Checked Markdowns | gift.directory`, `Black Friday ${bfd.year} is ${bfd.blackFriday}. Gifts from our guides marked down now, each with the store's regular price and the date we checked it, plus coupon codes.`.slice(0, 160), url, body, ld, ad, (shown.find(c => c.image) || {}).image) : shell(under ? `Gift deals under $${under}: price-checked markdowns | gift.directory` : "Gifts on sale now: checked markdowns and coupon codes | gift.directory",
    under ? `Gifts from our guides that cost $${under} or less and are marked down right now, each with the date its price was checked.` : "Gifts from our guides that are marked down right now, with the date each price was checked, plus current coupon codes and sales from the stores we work with.", url, body, ld, ad, (shown.find(c => c.image) || {}).image);
  return { html, empty: !shown.length && !promos.length, markdowns: shown.length };
}
// A short strip for the home page and the guides hub.
export function salesStrip(deals, promos = [], n = 4) {
  if (!deals.length && !promos.length) return "";
  const p = promos.find(x => x.code) || promos[0];
  return `<h2 class="hh" style="font-family:Georgia,serif">On sale now</h2>
${p ? `<p style="margin:0 0 4px"><b>${esc(p.advertiser)}:</b> ${esc(clip(promoTitle(p), 110))}${p.code ? ` Code <b>${esc(p.code)}</b>.` : ""} <a href="/sales">All store offers →</a></p>` : ""}
${deals.length ? `<div class="grid">${deals.slice(0, n).map(c => dealCard(c, { from: false })).join("")}</div>` : ""}
<p style="margin:10px 0 0"><a href="/sales"><b>See every gift on sale →</b></a></p>`;
}
// Current offers on one of our review pages.
export function reviewOffers(slug, promos) {
  const mine = promosForReview(slug, promos);
  if (!mine.length) return "";
  return `<aside style="border:2px solid #92400e;background:#fffbeb;border-radius:14px;padding:16px;margin:18px 0"><b style="font-family:Georgia,serif;font-size:1.1rem">Current offers from ${esc(mine[0].advertiser)}</b>
<ul style="margin:8px 0 0;padding-left:20px">${mine.slice(0, 4).map(p => `<li style="margin:4px 0"><a href="${esc(p.url)}" target="_blank" rel="noopener sponsored nofollow">${esc(promoTitle(p))}</a>${p.code ? ` — code <b>${esc(p.code)}</b>` : ""}${p.ends_at ? ` <span class="muted">(through ${esc(through(p.ends_at))})</span>` : ""}</li>`).join("")}</ul>
<p class="muted" style="font-size:.82rem;margin:8px 0 0">From the store's own offer feed. <a href="/sales">All sales →</a></p></aside>`;
}
