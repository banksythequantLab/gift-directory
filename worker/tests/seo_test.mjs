// Gift guides: page list, the ad slot (bottom only), rendering.
import { PAGES, adSlot, renderGuide, parseGuide } from "../seo.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  — " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

eq("every guide has its own address", new Set(PAGES.map(p => p.slug)).size, PAGES.length);
ok("addresses are clean", PAGES.every(p => /^[a-z0-9-]+$/.test(p.slug)));

eq("no AdSense ids: no ad, no empty box", adSlot({}), "");
eq("malformed ids: no ad", adSlot({ ADSENSE_CLIENT: "pub-1", ADSENSE_SLOT: "x" }), "");
const ad = adSlot({ ADSENSE_CLIENT: "ca-pub-1234567890123456", ADSENSE_SLOT: "1234567890" });
ok("with ids: the slot is there", ad.includes('data-ad-slot="1234567890"') && ad.includes("ca-pub-1234567890123456"));

const p = PAGES[0];
const guide = parseGuide({ meta: "x".repeat(150), intro: ["A real paragraph about gifts for lawyers that is long enough."], faq: [{ q: "Q?", a: "A." }] }, p);
const row = { guide_json: JSON.stringify(guide), cards_json: JSON.stringify([{ product_id: "a", title: "Pen", merchant: "s.com", url: "https://s.com/p", price_cents: 5000 }]), updated_at: "2026-11-05T00:00:00Z" };
const html = renderGuide(p, row, [], null, ad);
const head = html.slice(0, html.indexOf("</head>")), adAt = html.indexOf("adsbygoogle"), footAt = html.indexOf("<footer"), faqAt = html.indexOf("Questions people ask"), picksAt = html.indexOf("Our picks");
eq("nothing ad-related in the header", head.includes("adsbygoogle") || head.includes("googlesyndication"), false);
ok("the ad comes after the products", adAt > picksAt);
ok("and after the FAQ", adAt > faqAt);
ok("just above the footer", adAt < footAt);
eq("without ids the page has no ad code at all", renderGuide(p, row, [], null, "").includes("adsbygoogle"), false);

{
  const { diversify } = await import("../seo.js");
  const t = s => ({ title: s });
  const out = diversify(["Myla Candle", "Peony Candle", "Oudh Candle", "Triple Scented Candles", "Cheese Board", "Serving Bowl", "Lagos Bowl"].map(t));
  eq("at most three candles on a page", out.filter(c => /candle/i.test(c.title)).length, 3);
  eq("other kinds kept", out.length, 6);
  eq("items of no known kind are never dropped", diversify(["A", "B", "C", "D"].map(t)).length, 4);
}
{
  const { diversify, allowed, pageBySlug } = await import("../seo.js");
  const police = pageBySlug("gifts-for-police-officers");
  eq("police page drops a Marine Corps coin", allowed(police, { title: "Personalized USMC Valor 250 Challenge Coin" }), false);
  eq("police page keeps navy-colored items", allowed(police, { title: "Navy Blue Insulated Tumbler" }), true);
  eq("soldier page drops knives", allowed(pageBySlug("gifts-for-soldiers"), { title: "Tactical Folding Knife" }), false);
  eq("soldier page keeps gunmetal", allowed(pageBySlug("gifts-for-soldiers"), { title: "Gunmetal Watch" }), true);
  eq("pages without exclude allow all", allowed(pageBySlug("gifts-for-emts"), { title: "Anything" }), true);
  const flasks = diversify(["Engraved Flask", "Gunmetal Flask", "Steel Flask & Funnel", "Leather Wallet"].map(x => ({ title: x })), 2);
  eq("cap 2 keeps two flasks", flasks.filter(c => /flask/i.test(c.title)).length, 2);
  for (const s of ["gifts-for-soldiers", "gifts-for-emts", "gifts-for-lifeguards", "gifts-for-computer-geeks"])
    eq(`${s} exists with notes`, !!(pageBySlug(s) && pageBySlug(s).notes), true);
  eq("slugs are unique", new Set(PAGES.map(p => p.slug)).size, PAGES.length);
  const banks = diversify(["Power Bank", "Rugged Power Bank", "DEWALT Type C USB-A Power Bank 2-Ports", "Portable Power Bank", "Rugged Watch"].map(x => ({ title: x })), 2);
  eq("at most two power banks at cap 2", banks.filter(c => /power bank/i.test(c.title)).length, 2);
  const dryers = diversify(["Simple Dry Boot Dryer", "Micro Dry Boot Dryer", "Electric Portable Boot Dryer with Timer"].map(x => ({ title: x })), 2);
  eq("boot dryers capped even with a trailing word", dryers.length, 2);
  const misc = diversify(["Treasure Box", "Keepsake Box", "Beaded Box", "Wool Scarf"].map(x => ({ title: x })), 2);
  eq("unknown kinds capped by last word", misc.length, 3);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
