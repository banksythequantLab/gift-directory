// The sales page: what counts as a markdown, the price re-check, CJ offers, and what the page says.
import { promoTitle, DEAL_MAX_PCT, groupPromos, pctOff, isDeal, saleBadge, checkPrice, refreshDeals, listedDeals, parseCjLinks, cleanPromos, promoReview, promosForReview, renderSales, salesStrip, reviewOffers, dealCard, DEAL_FRESH_HOURS } from "../deals.js";
import { d1 } from "./d1shim.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const makeDb = () => d1(join(dirname(fileURLToPath(import.meta.url)), "..", "migrations"));

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

const card = (o = {}) => ({ product_id: "p1", title: "Brass Desk Clock", brand: "Acme", image: "https://img.example/a.jpg", price_cents: 6000, was_cents: 8000,
  merchant: "store.example", url: "https://buy.example/p1", features: [], reason: "A steady, handsome thing for a desk.", ...o });
eq("percent off", pctOff(card()), 25);
eq("no regular price: 0", pctOff(card({ was_cents: null })), 0);
eq("regular price below the price: 0", pctOff(card({ was_cents: 5000 })), 0);
ok("25% off is a deal", isDeal(card()));
ok("9% off is not", !isDeal(card({ price_cents: 7300 })));
ok("90% off is treated as a bad feed price", !isDeal(card({ price_cents: 800 })));
ok("under $5 is not listed", !isDeal(card({ price_cents: 300, was_cents: 450 })));
ok("no picture: not listed", !isDeal(card({ image: null })));
ok("a bulk pack is not a gift deal", !isDeal(card({ title: "Pens, Pack of 24" })));
ok("badge says the saving", saleBadge(card()).includes("Save 25%"));
eq("no badge without a markdown", saleBadge(card({ was_cents: null })), "");
eq("no badge for an absurd markdown", saleBadge(card({ price_cents: 500 })), "");

// --- the price re-check ---
const product = (o = {}) => ({ id: "p1", title: "Brass Desk Clock", brands: [{ name: "Acme" }], images: [{ url: "https://img.example/a.jpg", is_main_image: true }], key_features: ["Brass"],
  offers: [{ availability: "InStock", url: "https://buy.example/p1", domain: "store.example", condition: "new", price: { price: 60, compare_at_price: 80 } }], ...o });
const answer = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const env = { CHANNEL3_API_KEY: "k" };
let r = await checkPrice(env, "p1", { fetchImpl: answer(200, product()) });
eq("check: today's price", r.card && r.card.price_cents, 6000);
eq("check: today's regular price", r.card && r.card.was_cents, 8000);
r = await checkPrice(env, "p1", { fetchImpl: answer(404, {}) });
ok("check: gone from the catalog", r.gone === true);
r = await checkPrice(env, "p1", { fetchImpl: answer(429, {}) });
ok("check: rate limit stops the round", !!r.error && r.stop === true);
r = await checkPrice(env, "p1", { fetchImpl: answer(200, product({ offers: [] })) });
ok("check: out of stock gives no card", r.card === null);
r = await checkPrice(env, "p1", { fetchImpl: async () => { throw new Error("down"); } });
ok("check: a network failure is an error, not a verdict", !!r.error && !r.gone);

const db = makeDb();
const t0 = Date.parse("2026-11-18T12:00:00Z"), iso = ms => new Date(ms).toISOString();
const guide = (slug, cards) => db.prepare("INSERT INTO seo_pages (slug,guide_json,cards_json,updated_at,created_at) VALUES (?,?,?,?,?)").bind(slug, "{}", JSON.stringify(cards), iso(t0 - 9 * 864e5), iso(t0)).run();
await guide("gifts-for-fishermen", [card({ product_id: "a" }), card({ product_id: "b", price_cents: 4000, title: "Tackle Bag" }), card({ product_id: "c", was_cents: null, title: "Hat" }), card({ product_id: "cj:1:2", title: "CJ thing" })]);
await guide("gifts-for-campers", [card({ product_id: "a" }), card({ product_id: "d", title: "Lantern" })]);
const live = { a: product({ id: "a" }), b: product({ id: "b", title: "Tackle Bag", offers: [{ availability: "InStock", url: "https://buy.example/b", domain: "store.example", condition: "new", price: { price: 80, compare_at_price: null } }] }),
  d: product({ id: "d", title: "Lantern" }) };
let asked = [];
const fetchImpl = async u => { const id = decodeURIComponent(u.split("/").pop()); asked.push(id); return live[id] ? { status: 200, ok: true, json: async () => live[id] } : { status: 404, ok: false, json: async () => ({}) }; };
let out = await refreshDeals(db, env, { max: 30, fetchImpl, nowMs: t0 });
eq("each marked-down pick is asked about once (not the plain one, not the CJ one)", asked.slice().sort().join(","), "a,b,d");
eq("still on sale: listed", out.on_sale, 2);
eq("the sale that ended is not listed", out.listed, 2);
let listed = await listedDeals(db, { nowMs: t0 });
eq("the page gets the two live markdowns", listed.map(c => c.product_id).sort().join(","), "a,d");
ok("with the guide's reason kept", listed.every(c => c.reason));
ok("and the date of the check", listed.every(c => c.checked_at === iso(t0)));
asked = []; out = await refreshDeals(db, env, { max: 30, fetchImpl, nowMs: t0 + 3600e3 });
eq("an hour later nothing is due", asked.length, 0);
asked = []; live.a.offers[0].price = { price: 80, compare_at_price: 80 };
out = await refreshDeals(db, env, { max: 30, fetchImpl, nowMs: t0 + 21 * 3600e3 });
eq("after 20 hours the listed ones are checked again", asked.slice().sort().join(","), "a,d");
eq("one sale has ended", out.ended, 1);
listed = await listedDeals(db, { nowMs: t0 + 21 * 3600e3 });
eq("and it leaves the page", listed.map(c => c.product_id).join(","), "d");
listed = await listedDeals(db, { nowMs: t0 + 21 * 3600e3 + (DEAL_FRESH_HOURS + 1) * 3600e3 });
eq("a markdown not re-checked for two days is not shown", listed.length, 0);
asked = []; out = await refreshDeals(db, env, { max: 30, fetchImpl: async () => ({ status: 429, ok: false, json: async () => ({}) }), nowMs: t0 + 60 * 3600e3 });
eq("a rate limit ends the round and changes nothing", out.checked, 0);

// --- CJ offers ---
const link = (o = {}) => { const f = { "advertiser-id": "55", "advertiser-name": "Muck Boot US", category: "Mens", "link-id": "17", "link-name": "Black Friday: 25% off everything", description: "Save 25% on everything with code TAKE25. Free shipping over $99.",
  "promotion-type": "Coupon", "coupon-code": "TAKE25", "promotion-start-date": "2026-11-18 17:00:00.0", "promotion-end-date": "2026-11-29 08:00:00.0", "relationship-status": "joined", clickUrl: "https://www.jdoqocy.com/click-1-17", ...o };
  return "<link>" + Object.entries(f).map(([k, v]) => `<${k}>${String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</${k}>`).join("") + "<link-code-html>&lt;a href=\"x\"&gt;</link-code-html></link>"; };
const xml = `<?xml version="1.0"?><cj-api><links total-matched="5">${link()}${link({ "link-id": "18", "link-name": "Black Friday banner 300x250" })}` +
  `${link({ "link-id": "19", "advertiser-id": "77", "advertiser-name": "Abracadabra NYC", "link-name": "buy 1 get 1 free", description: "buy 1 get 1 free", "promotion-type": "Sale/Discount", "coupon-code": "", "promotion-end-date": "2036-08-30 04:00:00.0", "promotion-start-date": "2026-04-16 04:00:00.0" })}` +
  `${link({ "link-id": "20", "link-name": "Old sale", "coupon-code": "OLD10", "promotion-end-date": "2026-11-01 08:00:00.0" })}${link({ "link-id": "21", "link-name": "Next month", "coupon-code": "DEC5", "promotion-start-date": "2026-12-05 08:00:00.0", "promotion-end-date": "2026-12-20 08:00:00.0" })}` +
  `${link({ "link-id": "22", "link-name": "Arctic Pro boots", "promotion-type": "N/A", "coupon-code": "" })}${link({ "link-id": "23", "link-name": "Bad link", "coupon-code": "X1", clickUrl: "javascript:alert(1)" })}</links></cj-api>`;
const links = parseCjLinks(xml);
eq("every link is read", links.length, 7);
eq("fields are read and unescaped", links[0].advertiser + "|" + links[0].code + "|" + links[0].kind, "Muck Boot US|TAKE25|Coupon");
const promos = cleanPromos(links, Date.parse("2026-11-19T03:00:00Z"));
eq("live coupons and sales only, one per offer", promos.map(p => p.id).join(","), "17,19");
eq("the coupon's end date is kept", promos[0].ends_at, "2026-11-29T08:00:00.000Z");
eq("an end date ten years out means no end date", promos[1].ends_at, null);
eq("a description that repeats the title is dropped", promos[1].body, "");
eq("before it starts, an offer is not shown", cleanPromos(links, Date.parse("2026-11-18T10:00:00Z")).map(p => p.id).join(","), "19");
eq("review page for a store we have written about", promoReview("Muck Boot US").slug, "muck-boots-gift-guide");
eq("no review page for a store we have not", promoReview("Some Other Store"), null);
eq("offers for one review page", promosForReview("muck-boots-gift-guide", promos).length, 1);

// --- the page ---
const deals = [card({ product_id: "a", slug: "gifts-for-fishermen", checked_at: "2026-11-18T12:00:00.000Z" }), card({ product_id: "d", title: "Lantern <b>", slug: "gifts-for-campers", checked_at: "2026-11-18T12:00:00.000Z", price_cents: 7000 })];
const pg = renderSales({ deals, promos, nowMs: Date.parse("2026-11-19T03:00:00Z") });
ok("page: not empty", pg.empty === false && pg.markdowns === 2);
ok("page: both prices and the saving", pg.html.includes("$60") && pg.html.includes("$80") && pg.html.includes("Save 25%"));
ok("page: the date each price was checked", pg.html.includes("Price checked Nov 18"));
ok("page: the guide each gift came from", pg.html.includes('href="/gifts/gifts-for-fishermen"'));
ok("page: the coupon code and its last day", pg.html.includes("TAKE25") && pg.html.includes("Through Nov 28"));
ok("page: an offer with no end date says so", pg.html.includes("No end date given"));
ok("page: store links are marked sponsored", pg.html.includes('href="https://www.jdoqocy.com/click-1-17" target="_blank" rel="noopener sponsored nofollow"'));
ok("page: titles are escaped", pg.html.includes("Lantern &lt;b&gt;") && !pg.html.includes("Lantern <b>"));
ok("page: says nothing was tested", pg.html.includes("We have not handled or tested these products"));
ok("page: says how fresh prices are", pg.html.includes(`re-checked within the last ${DEAL_FRESH_HOURS} hours`));
ok("page: no ratings are claimed", !/aggregateRating|"review"/.test(pg.html));
ok("page: canonical address", pg.html.includes('<link rel="canonical" href="https://gift.directory/sales">'));
const many = Array.from({ length: 7 }, (_, i) => ({ ...promos[0], id: "m" + i, title: "Tier " + i, code: "T" + i }));
eq("offers are grouped by store", groupPromos([...many, promos[1]]).map(g => g.offers.length).join(","), "7,1");
const crowded = renderSales({ deals, promos: [...many, promos[1]], nowMs: Date.parse("2026-11-19T03:00:00Z") }).html;
ok("a store with many codes shows four and counts the rest", crowded.includes("Tier 3") && !crowded.includes("Tier 4") && crowded.includes("and 3 more offers at this store"));
ok("and the other store is still on the page", crowded.includes("Abracadabra NYC"));
ok("a card with no higher regular price shows no struck-through price", !dealCard({ title: "Tee", url: "https://x.test/t", price_cents: 2499, was_cents: 0, image: "https://x.test/i.png" }, { from: false }).includes('class="was"'));
const none = renderSales({ deals: [], promos: [] });
ok("nothing on sale: says so, and is flagged empty", none.empty === true && none.html.includes("No sales have been confirmed"));
eq("home strip: nothing to show, nothing added", salesStrip([], []), "");
const strip = salesStrip(deals, promos);
ok("home strip: links to the sales page", strip.includes('href="/sales"') && strip.includes("TAKE25"));
ok("review page: its store's current offers", reviewOffers("muck-boots-gift-guide", promos).includes("TAKE25"));
eq("review page: none for a store with no offers", reviewOffers("drivers-ed-as-a-gift", promos), "");
ok("a store's product card has no guide line", !dealCard(card(), { from: false }).includes("From our guide"));

eq("a title does not repeat the code shown beside it", promoTitle({ title: "OEDRO 2026 Thanksgiving Specials 10% OFF Code: TSG10", code: "TSG10" }), "OEDRO 2026 Thanksgiving Specials 10% OFF");
eq("'use code X' goes too", promoTitle({ title: "Get 15% off sitewide, use code MUCK15", code: "MUCK15" }), "Get 15% off sitewide");
eq("a title without the code is left alone", promoTitle({ title: "Black Friday Sale: 25% on everything", code: "TAKE25" }), "Black Friday Sale: 25% on everything");
eq("a bare lower-case title gets a capital", promoTitle({ title: "buy 1 get 1 free", code: "" }), "Buy 1 get 1 free");
eq("no code, no change", promoTitle({ title: "Free shipping over $50", code: "" }), "Free shipping over $50");
{
  const db2 = makeDb(), now = Date.parse("2026-11-19T12:00:00Z"), at = new Date(now - 3600e3).toISOString();
  const mk = (id, pct) => db2.prepare("INSERT INTO deals (product_id, slug, card_json, price_cents, was_cents, pct, on_sale, checked_at) VALUES (?,?,?,?,?,?,1,?)")
    .bind(id, "gifts-for-gardeners", JSON.stringify({ title: "Item " + id, url: "https://x.test/" + id, image: "https://x.test/" + id + ".jpg", merchant: "x.test", price_cents: 10000 - pct * 100, was_cents: 10000 }), 10000 - pct * 100, 10000, pct, at).run();
  for (const [id, pct] of [["a", 75], ["b", 74], ["c", 72], ["d", 70], ["e", 50], ["f", 40], ["g", 30], ["h", 20]]) await mk(id, pct);
  const top = await listedDeals(db2, { limit: 4, nowMs: now });
  eq("the first four are the biggest markdowns under the cap, not four over it", top.map(c => c.product_id).join(","), "e,f,g,h");
  ok("none is over the cap", DEAL_MAX_PCT === 60 && top.every(c => (1 - c.price_cents / c.was_cents) * 100 <= 60));
}
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
