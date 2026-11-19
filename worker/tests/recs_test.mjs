// Top picks on a guide: only products on the page, labels from real prices, and nothing claimed that nobody did.
import { recsStyle, recsPrompt, parseRecs, liveRecs, renderRecs, howWeChose, underLabel, RECS_SYSTEM } from "../recs.js";
import { renderGuide, pageBySlug, saveBadge } from "../seo.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

const C = (id, title, cents, o = {}) => ({ product_id: id, title, brand: "Acme", image: `https://img.example/${id}.jpg`, price_cents: cents, was_cents: null, merchant: "store.example", url: `https://buy.example/${id}`, features: ["Waterproof"], reason: "A warm reason.", ...o });
const cards = [C("a", "Tackle Bag", 9499), C("b", "Fishing Pliers", 6795), C("c", "Polarized Sunglasses", 6479, { was_cents: 7199 }), C("d", "Lure Kit", 1849), C("e", "Dry Bag", 4500), C("f", "Rod Holder", 2499)];
const W = "It holds a full day of tackle and keeps it sorted, which suits someone who fishes most weekends. Choose it over the smaller kits when they already own the basics.";
const good = { overall: { id: "a", why: W }, budget: { id: "d", why: W }, splurge: { id: "b", why: W }, for: { id: "e", who: "The angler who kayaks.", why: W }, skip: "Skip novelty signs and mugs; someone who fishes would rather have gear they can use on the water." };

ok("the prompt lists the page's products by id", recsPrompt({ keyword: "Gifts for fishermen", recipient: "an angler", occasion: "Christmas" }, cards).includes("d | Lure Kit by Acme | $18.49 at store.example | Waterproof"));
ok("the model is told not to claim testing or reviews", /Never invent/.test(RECS_SYSTEM) && /tested/.test(RECS_SYSTEM));
eq("budget label rounds the real price up", underLabel(1849), "Best under $20");
eq("budget label at an exact step", underLabel(2500), "Best under $25");
eq("budget label above the steps", underLabel(90000), "Best value");

let r = parseRecs(good, cards);
eq("four picks", r && r.picks.length, 4);
eq("labels", r.picks.map(p => p.label).join(" | "), "Best overall | Best under $20 | Worth the splurge | Best for the angler who kayaks");
ok("the what-to-skip line is kept", r.skip.startsWith("Skip novelty"));
eq("no overall pick: nothing", parseRecs({ ...good, overall: { id: "zzz", why: W } }, cards), null);
r = parseRecs({ ...good, budget: { id: "a2", why: W } }, cards);
eq("an invented product is dropped, the rest stay", r.picks.map(p => p.role).join(","), "overall,splurge,for");
r = parseRecs({ ...good, budget: { id: "b", why: W }, splurge: { id: "d", why: W } }, cards);
eq("a 'budget' pick from the expensive half and a 'splurge' from the cheap half are dropped", r.picks.map(p => p.role).join(","), "overall,for");
r = parseRecs({ ...good, splurge: { id: "a", why: W } }, cards);
eq("the same product is not picked twice", r.picks.filter(p => p.id === "a").length, 1);
for (const [name, bad] of [["we tested", "We tested this bag for a season and it held up, so it suits anyone who fishes often and wants something tough."],
  ["reviewers love", "Reviewers love how much it holds, and it suits someone who fishes most weekends and wants to stay organized."],
  ["star rating", "With a 4.8-star rating it is an easy choice for someone who fishes most weekends and wants to stay organized."],
  ["best-selling", "This best-selling bag suits someone who fishes most weekends and wants to keep a full day of tackle sorted."],
  ["a price", "At $94.99 it suits someone who fishes most weekends and wants to keep a full day of tackle sorted and dry."],
  ["hype", "The perfect bag for someone who fishes most weekends and wants to keep a full day of tackle sorted and dry."],
  ["an exclamation", "It suits someone who fishes most weekends and wants to keep a full day of tackle sorted and dry on the boat!"],
  ["too short", "A nice bag."]]) {
  r = parseRecs({ ...good, splurge: { id: "b", why: bad } }, cards);
  ok(`a reason with ${name} is dropped`, r && !r.picks.some(p => p.role === "splurge"));
}
r = parseRecs({ ...good, for: { id: "e", who: "everyone!!! the ultimate angler of all time and space forever", why: W } }, cards);
ok("a 'best for' that isn't a short plain phrase is dropped", !r.picks.some(p => p.role === "for"));
r = parseRecs({ ...good, skip: "Reviewers hate cheap reels, so skip them and buy something that customers rated well instead." }, cards);
ok("a what-to-skip line that cites reviews is dropped", r && !r.skip);
r = parseRecs({ ...good, skip: "Avoid the sunglasses if they already own a pair, since this model adds nothing beyond standard polarization." }, cards);
ok("a what-to-skip line that criticizes a product on the page is dropped", r && !r.skip);
r = parseRecs({ ...good, skip: "Skip the Polarized Sunglasses unless you know their face shape, because fit matters more than brand." }, cards);
ok("a what-to-skip line that names a product on the page is dropped", r && !r.skip);
r = parseRecs({ ...good, splurge: { id: "b", why: "It suits someone who fishes in the rain, and the grip ensures they never drop it, so choose it when they fish from a boat." } }, cards);
ok("a reason that promises a result is dropped", r && !r.picks.some(p => p.role === "splurge"));
eq("fewer than four products: no top picks", parseRecs(good, cards.slice(0, 3)), null);
eq("junk in: nothing", parseRecs("nope", cards), null);

// the products refresh under saved picks
const saved = parseRecs(good, cards);
let live = liveRecs(saved, cards);
eq("all four are still on the page", live.picks.length, 4);
live = liveRecs(saved, cards.filter(c => c.product_id !== "b"));
eq("a pick whose product left the page goes with it", live.picks.map(p => p.role).join(","), "overall,budget,for");
live = liveRecs(saved, cards.map(c => c.product_id === "d" ? { ...c, price_cents: 2700 } : c));
eq("the budget label follows today's price", live.picks[1].label, "Best under $30");
eq("the overall pick gone: no top picks at all", liveRecs(saved, cards.filter(c => c.product_id !== "a")), null);
eq("no saved picks: nothing", liveRecs(undefined, cards), null);

const html = renderRecs(liveRecs(saved, cards), saveBadge);
ok("each pick shows its label, product and reason", html.includes("Best overall") && html.includes("Tackle Bag") && html.includes("Choose it over the smaller kits"));
ok("links are marked sponsored", html.includes('rel="noopener sponsored nofollow"'));
eq("nothing to show: nothing rendered", renderRecs(null), "");
const how = howWeChose({ recipient: "an angler", budget_cents: 10000 }, 8, "2026-11-18");
ok("how we chose: says an AI sorted them and nobody tested them", how.includes("An AI model sorted") && how.includes("We have not handled or tested"));
ok("how we chose: says we may earn a commission", how.includes("We may earn a commission"));

// on a real guide page
const p = pageBySlug("gifts-for-fishermen");
const row = { guide_json: JSON.stringify({ meta: "m".repeat(100), intro: ["An intro paragraph that is long enough to be kept on the page."], faq: [], recs: saved }), cards_json: JSON.stringify(cards), updated_at: "2026-11-18T12:00:00.000Z" };
const page = renderGuide(p, row, [], null);
ok("guide: top picks come before the full list", page.indexOf("Top picks") > 0 && page.indexOf("Top picks") < page.indexOf("All 6 picks"));
ok("guide: how we chose is on the page", page.includes("How we chose"));
ok("guide: a marked-down pick carries its saving", page.includes("Save 10%"));
ok("guide: points to the sales page when something is marked down", page.includes('href="/sales"') && page.includes("1 of these is marked down"));
const plain = renderGuide(p, { ...row, guide_json: JSON.stringify({ meta: "m".repeat(100), intro: ["An intro paragraph that is long enough to be kept on the page."], faq: [] }) }, [], null);
ok("guide without saved picks: the old heading, no empty section", plain.includes("Our picks") && !plain.includes("Top picks"));

ok("a page always gets the same shape", recsStyle("gifts-for-fishermen") === recsStyle("gifts-for-fishermen") && recsStyle("gifts-for-fishermen").includes("Shape for this page"));
ok("team pages do not all get one shape", new Set(["dallas-cowboys", "new-york-giants", "green-bay-packers", "chicago-bears", "miami-dolphins", "buffalo-bills", "denver-broncos", "detroit-lions"].map(t => recsStyle("gifts-for-" + t + "-fans"))).size >= 3);
ok("the editor is told not to open every reason the same way", /no two may open with the same words/.test(RECS_SYSTEM));
const cow = pageBySlug("gifts-for-dallas-cowboys-fans"), nhl = pageBySlug("gifts-for-boston-bruins-fans");
ok("football and hockey pages ask for different extras", cow.slots.some(x => /garden flag/.test(x)) && nhl.slots.some(x => /hockey puck/.test(x)) && !cow.slots.some(x => /puck/.test(x)));
ok("every team slot has its kind words", cow.slotMust.length === cow.slots.length && cow.slotMust.every(Boolean) && nhl.slotMust.every(Boolean));
const lab = pageBySlug("gifts-for-labrador-lovers"), gold = pageBySlug("gifts-for-golden-retriever-lovers");
ok("two breeds do not ask for the same list", lab.slots.length === 9 && gold.slots.length === 9 && lab.slots.slice(7).map(x => x.replace("Labrador", "")).join() !== gold.slots.slice(7).map(x => x.replace("Golden Retriever", "")).join());
ok("every breed slot has its kind words", lab.slotMust.every(Boolean) && gold.slotMust.every(Boolean));
ok("a product with no listed features is marked so", recsPrompt({ keyword: "k", recipient: "r", occasion: "o" }, [{ product_id: "a1", title: "Ultra Hydration Vest", price_cents: 9747, merchant: "x.test" }]).includes("(no details listed)"));
ok("and one with features is not", !recsPrompt({ keyword: "k", recipient: "r", occasion: "o" }, [{ product_id: "a1", title: "Belt", price_cents: 2100, merchant: "x.test", features: ["Two side pockets"] }]).includes("(no details listed)"));
ok("the editor is told not to invent details for those", /no details listed/.test(RECS_SYSTEM) && /Do not rank the products/.test(RECS_SYSTEM));
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
