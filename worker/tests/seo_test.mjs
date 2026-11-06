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
  const ten = pageBySlug("10-best-high-tech-christmas-gifts");
  eq("10-best page asks for exactly 10 products", ten && ten.count, 10);
  ok("10-best page sits in the Tech topic", ten && ten.topic === "Tech");
  ok("best gifts for golfers exists", !!pageBySlug("best-gifts-for-golfers"));
  const tech = diversify(["Sony WH1000XM4 Noise Cancelling Wireless Headphones + Guide", "Studio Pro Wireless Headphones with Case", "Google Nest Hub Max", "Nest Hub (2nd Gen)", "Compact Portable Projector PH31"].map(x => ({ title: x })), 1);
  eq("one of each: headphones, hub, projector", tech.length, 3);
  eq("Kindle eReader and Kobo E-Reader are one kind", diversify([{ title: "Kobo Clara 6\" E-Reader" }, { title: "Amazon Kindle eReader" }], 1).length, 1);
  eq("Galaxy Watch5 and a Slate Watch are one kind", diversify([{ title: "Galaxy Watch5 Pro" }, { title: "Suunto 9 Peak Pro Slate Watch" }], 1).length, 1);
  eq("the last kind word wins: Mini Glass Candle is a candle", diversify(["Mini Soy Candle", "Amber Mini Soy Candle", "Woody Mini Glass Candle"].map(x => ({ title: x })), 2).length, 2);
  eq("sleeping pads with different endings are one kind", diversify(["NeoAir Sleeping Pad with Mini Pump", "Inflatable Sleeping Pad with Built-In Foot Pump", "Self Inflating Sleeping Pad"].map(x => ({ title: x })), 2).length, 2);
  eq("a cashmere throw and a throw blanket are one kind", diversify(["Cashmere Throw", "Waffle Knit Throw Blanket", "Faux Cashmere Throw"].map(x => ({ title: x })), 2).length, 2);
  eq("multi-tools with different endings are one kind", diversify(["Foldable Multi-Tool Kit", "Premium 10-in-1 Multi-Tool", "Paint Multi-Tool 14090060"].map(x => ({ title: x })), 2).length, 2);
  eq("crossbody bags and handbags are one kind", diversify(["Darcy Small Woven Leather Crossbody Handbag", "Laila Extra-small Leather Crossbody Bag", "207 Leather Crossbody"].map(x => ({ title: x })), 2).length, 2);
  eq("cocktail smokers are one kind", diversify(["Cocktail Smoking Kit", "Glass Topper Cocktail Smoker Kit", "Cold Smoke Electric Cocktail Smoker"].map(x => ({ title: x })), 2).length, 2);
  eq("barware sets are one kind", diversify(["Lalique Lotus Barware Collection", "Talismano Barware Set", "Ethno Barware Set"].map(x => ({ title: x })), 2).length, 2);
  eq("gifts for her drops lawyer novelty", allowed(pageBySlug("christmas-gifts-for-her-under-50"), { title: "Trust Me, I'm A Lawyer - 22-oz Candle Jar" }), false);
  {
    const first = pageBySlug("1st-anniversary-gifts");
    ok("1st anniversary page names paper and clocks", first && /paper \(traditional\) and clocks \(modern\)/.test(first.keyword));
    eq("anniversary pages for 20 years", PAGES.filter(p => p.anniversary).length, 20);
    eq("ordinals read right", ["2nd", "3rd", "11th", "12th", "13th", "20th", "25th"].every(o => !!pageBySlug(`${o}-anniversary-gifts`)), true);
    eq("first four slots are traditional", first.slotGroups.slice(0, 4).every(g => g === "Traditional: paper"), true);
    eq("same-theme years have no split", pageBySlug("25th-anniversary-gifts").slotGroups, null);
    eq("real ivory never shows", allowed(pageBySlug("14th-anniversary-gifts"), { title: "Genuine Ivory Carving" }), false);
    const { groupCards } = await import("../seo.js");
    eq("cards group under their theme headings", groupCards([{ group: "Traditional: paper" }, { group: "Modern: clocks" }, { group: "Traditional: paper" }]).map(([k, v]) => k + v.length).join("|"), "Traditional: paper2|Modern: clocks1");
  }
  eq("controller charging docks are one kind", diversify(["Controller Charging Dock", "4 in 1 Controller Charger LED Indicator Handle Grip Charging Dock", "Dual Controller Charging Station"].map(x => ({ title: x })), 1).length, 1);
  eq("RGB light strips, kits and bars are one kind", diversify(["RGB LED Light Strip", "TUF Gaming ARGB Lighting Kit", "Gaming Light Bars"].map(x => ({ title: x })), 1).length, 1);
  eq("gamers page drops PC case fans", allowed(pageBySlug("gifts-for-gamers"), { title: "NZXT F280 RGB CORE RF-U28HF-W1 RGB LED Single-Frame RGB Fan Unit" }), false);
  eq("gaming pages drop gift cards", allowed(pageBySlug("gifts-for-ps5-players"), { title: "PlayStation Store Gift Card $50" }), false);
  eq("football page drops baseball", allowed(pageBySlug("gifts-for-football-fans"), { title: "St. Louis Cardinals Park Stadium Throw Blanket" }), false);
  {
    const { TEAM_PAGES } = await import("../seo.js");
    eq("one fan page per team in the four leagues", TEAM_PAGES.filter(p => ["NFL", "MLB", "NBA", "NHL"].includes(p.team.league)).length, 124);
    eq("WNBA, MLS, college, club and national pages", TEAM_PAGES.length, 199 + 31 + 21);
    eq("England page drops New England gear", allowed(pageBySlug("gifts-for-england-soccer-fans"), { title: "New England Patriots Soccer Scarf" }), false);
    { const { teamNav, related } = await import("../seo.js"); const built = new Set(["gifts-for-football-fans", "gifts-for-new-york-giants-fans", "gifts-for-dallas-cowboys-fans", "gifts-for-alabama-crimson-tide-fans"]);
      const hub = teamNav(pageBySlug("gifts-for-football-fans"), built), team = teamNav(pageBySlug("gifts-for-dallas-cowboys-fans"), built);
      eq("football guide lists built NFL and college teams", hub.includes("/gifts/gifts-for-new-york-giants-fans") && hub.includes("Shop by team: College") && !hub.includes("philadelphia-eagles"), true);
      eq("team page links league mates and its sport guide, not itself", team.includes("new-york-giants") && team.includes("/gifts/gifts-for-football-fans") && !team.includes("dallas-cowboys-fans"), true);
      eq("related skips unbuilt pages", related(pageBySlug("gifts-for-dallas-cowboys-fans"), built).map(r => r.slug).every(s => built.has(s)), true);
      eq("non-sport pages get no team list", teamNav(pageBySlug("gifts-for-gamers"), built), ""); }
    eq("Ajax page drops Ajax cleaner", allowed(pageBySlug("gifts-for-afc-ajax-fans"), { title: "Ajax Dish Soap" }), false);
    eq("USMNT page keeps U.S. Soccer gear", allowed(pageBySlug("gifts-for-usmnt-fans"), { title: "U.S. Soccer 2026 Home Jersey" }), true);
    eq("MLS alias spellings count", allowed(pageBySlug("gifts-for-lafc-fans"), { title: "Los Angeles FC Club Scarf" }), true);
    eq("accents leave the slug", !!pageBySlug("gifts-for-cf-montreal-fans"), true);
    eq("pages use the full team name", !!pageBySlug("gifts-for-new-york-giants-fans") && !!pageBySlug("gifts-for-san-francisco-giants-fans") && !!pageBySlug("gifts-for-st-louis-cardinals-fans"), true);
    eq("Yankees page keeps Yankees gear", allowed(pageBySlug("gifts-for-new-york-yankees-fans"), { title: "New York Yankees Fleece Throw Blanket" }), true);
    eq("Yankees page drops Mets gear", allowed(pageBySlug("gifts-for-new-york-yankees-fans"), { title: "New York Mets Fleece Throw Blanket" }), false);
    eq("NY Giants page drops SF Giants", allowed(pageBySlug("gifts-for-new-york-giants-fans"), { title: "San Francisco Giants Logo Mug" }), false);
    eq("Heat page drops heated blankets", allowed(pageBySlug("gifts-for-miami-heat-fans"), { title: "Sunbeam Heated Throw Blanket" }), false);
    eq("St Louis spelled without the dot still counts", allowed(pageBySlug("gifts-for-st-louis-blues-fans"), { title: "St Louis Blues Knit Beanie" }), true);
    eq("Chargers page drops phone chargers", allowed(pageBySlug("gifts-for-los-angeles-chargers-fans"), { title: "Anker USB-C Charger 65W" }), false);
  }
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
