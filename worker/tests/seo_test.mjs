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

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
