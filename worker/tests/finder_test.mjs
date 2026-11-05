// The gift finder without the network: the court check, the plan, the cards, the picks.
import { courtCheck, validateBrief, parsePlan, fallbackPlan, searchBody, toCard, mergeCards, parsePicks,
         fallbackPicks, findGifts, channel3Search } from "../finder.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  — " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

// ---------- judges and court staff ----------
eq("a judge is flagged", courtCheck({ recipient: "Judge Ramos" }).flagged, true);
eq("so is a law clerk", courtCheck({ recipient: "my old law clerk" }).flagged, true);
eq("and chambers staff", courtCheck({ relationship: "someone in chambers" }).flagged, true);
eq("the 'For a judge or clerk' occasion is flagged", courtCheck({ recipient: "lawyers", occasion: "For a judge or clerk" }).flagged, true);
eq("a litigator is not", courtCheck({ recipient: "my litigator", occasion: "won my case" }).flagged, false);
eq("'judgment' is not a judge", courtCheck({ notes: "got a great judgment for us" }).flagged, false);

// ---------- the brief ----------
ok("a brief needs someone or something", validateBrief({ budget_cents: 10000 }).error);
ok("a budget under $10 is refused", validateBrief({ recipient: "x", budget_cents: 500 }).error);
eq("a good brief passes", validateBrief({ recipient: "my lawyer", budget_cents: 15000 }).brief.budget_cents, 15000);

// ---------- the plan ----------
const plan = parsePlan({ searches: [{ query: "fountain pen", why: "writes briefs" }, { query: "Fountain Pen" }, { query: "x" },
  { query: "leather portfolio" }, { query: "a" }, { query: "desk clock" }, { query: "bookends" }, { query: "whiskey glasses" }, { query: "more" }] });
eq("duplicates and one-letter searches are dropped, at most five", plan.length, 5);
eq("first search kept", plan[0].query, "fountain pen");
eq("junk is an empty plan", parsePlan("nope").length, 0);
ok("weddings get wedding defaults", /wedding/.test(fallbackPlan({ occasion: "wedding" })[0].query));

const body = searchBody("fountain pen", { budget_cents: 20000 });
eq("search is capped at the budget", body.filters.price.max_price, 200);
eq("and starts at a fifth of it", body.filters.price.min_price, 40);
eq("in stock only", body.filters.availability[0], "InStock");

// ---------- cards ----------
const prod = (id, offers, extra = {}) => ({ id, title: "Pen " + id, brands: [{ name: "Lamy" }],
  images: [{ url: "https://img/x.jpg", is_main_image: true }], key_features: ["Steel nib"], offers, ...extra });
const off = (price, o = {}) => ({ availability: "InStock", domain: "store.com", url: "https://store.com/p", price: { price, currency: "USD" }, ...o });
const card = toCard(prod("a", [off(120), off(95.5, { domain: "cheap.com" }), off(80, { availability: "OutOfStock" })]), 20000);
eq("the cheapest in-stock offer wins", card.price_cents, 9550);
eq("from its store", card.merchant, "cheap.com");
eq("out-of-stock offers don't count", card.offers, 2);
eq("over budget only: no card", toCard(prod("b", [off(500)]), 20000), null);
eq("used offers are skipped", toCard(prod("c", [off(50, { condition: "used" })]), 20000), null);
eq("non-https links are skipped", toCard(prod("d", [off(50, { url: "http://store.com/p" })]), 20000), null);
eq("same product from two searches counts once", mergeCards([[card], [card, null]]).length, 1);

// ---------- picks ----------
const cards = ["a", "b", "c"].map((id, i) => ({ ...card, product_id: id, price_cents: 1000 * (i + 1) }));
const picks = parsePicks({ picks: [{ id: "b", reason: "Because." }, { id: "zzz", reason: "invented" }, { id: "b" }, { id: "a" }] }, cards);
eq("an invented product is dropped", picks.some(p => p.product_id === "zzz"), false);
eq("a repeated pick counts once", picks.length, 2);
eq("the reason is kept", picks[0].reason, "Because.");
eq("the price comes from Channel3, not the model", picks[0].price_cents, 2000);
eq("fallback picks lead with the best-priced", fallbackPicks(cards)[0].product_id, "c");

// ---------- the whole run ----------
{
  const brief = validateBrief({ recipient: "my litigator", occasion: "won my case", budget_cents: 20000 }).brief;
  const seen = [];
  const ai = async (sys, user) => sys.startsWith("You are a gift concierge") || sys.startsWith("You are the gift concierge")
    ? { searches: [{ query: "fountain pen" }, { query: "leather portfolio" }] }
    : { picks: [{ id: "a", reason: "For signing the settlement." }] };
  const search = async q => { seen.push(q); return [prod("a", [off(150)]), prod("q-" + q, [off(60)])]; };
  const r = await findGifts(brief, { ai, search });
  eq("both searches ran", seen.length, 2);
  eq("the AI's pick is returned", r.picks[0].product_id, "a");
  eq("and marked as the AI's", r.ai_picked, true);
}
{
  const brief = validateBrief({ recipient: "Judge Ramos", occasion: "retirement", budget_cents: 20000 }).brief;
  let searched = false;
  const r = await findGifts(brief, { ai: async () => ({}), search: async () => { searched = true; return []; } });
  eq("a judge gets the rules, not a shopping list", r.court.flagged, true);
  eq("and nothing is searched", searched, false);
}
{
  const brief = validateBrief({ recipient: "new associate", budget_cents: 10000 }).brief;
  const r = await findGifts(brief, { ai: async () => { throw new Error("model down"); }, search: async () => [prod("z", [off(70)])] });
  eq("with the model down the shopper still gets gifts", r.picks.length, 1);
  eq("not claimed as AI picks", r.ai_picked, false);
}
{
  let sent;
  const fake = async (url, init) => { sent = { url, init }; return new Response(JSON.stringify({ products: [prod("a", [off(10)])] })); };
  const ps = await channel3Search({ CHANNEL3_API_KEY: "k" }, "pen", { budget_cents: 5000 }, { fetchImpl: fake });
  eq("Channel3 search is a POST to /v1/search", sent.url, "https://api.trychannel3.com/v1/search");
  eq("with the key in x-api-key", sent.init.headers["x-api-key"], "k");
  eq("returning its products", ps.length, 1);
}

// ---------- the front page and the grid ----------
{
  const { interleave, browseGifts } = await import("../finder.js");
  const c = id => ({ product_id: id });
  eq("interleave mixes searches", interleave([[c("a1"), c("a2")], [c("b1")], [c("c1"), c("c2")]]).map(x => x.product_id).join(","), "a1,b1,c1,a2,c2");
  eq("and drops repeats", interleave([[c("x")], [c("x"), c("y")]]).length, 2);
  const seen = [];
  const r = await browseGifts("nurses", { ai: async () => ({ searches: [{ query: "self care kit" }, { query: "insulated tumbler" }] }),
    search: async (q, b) => { seen.push(b.budget_cents); return [prod("p-" + q, [off(40)])]; } });
  eq("the front page runs the AI's searches", r.cards.length, 2);
  eq("with a modest default budget (a high floor let bulk packs in)", seen[0], 15000);
  const r2 = await browseGifts("nurses", { ai: async () => { throw new Error("down"); }, search: async q => [prod("f-" + q, [off(40)])] });
  ok("and still fills with the model down", r2.cards.length > 0);
  const brief = validateBrief({ recipient: "my nurse", budget_cents: 10000 }).brief;
  const f = await findGifts(brief, { ai: async (s) => s.includes("concierge") ? { searches: [{ query: "aa" }, { query: "bb" }] } : { picks: [{ id: "p-aa" }] },
    search: async q => [prod("p-" + q, [off(40)]), prod("q-" + q, [off(30)])] });
  eq("find returns the picks", f.picks[0].product_id, "p-aa");
  eq("and the rest for the grid, without repeating the picks", f.more.some(x => x.product_id === "p-aa"), false);
  eq("all of the rest", f.more.length, 3);
}

// ---------- junk, duplicates, and the model's gift check (from the live Nurse Gifts page, Nov 5) ----------
{
  const { isJunk, mergeCards, parseIds, browseGifts, findGifts: fg } = await import("../finder.js");
  const t = title => ({ product_id: title, title });
  for (const bad of ["Round Badge Reel with Slide Clip", "STANLEY Healthcare badge reel (pack of 20)", "16 Sets Bulk Employee Appreciation Notebook And Pen Set",
    "Cricut 15oz. White Ceramic Mug Blanks", "Custom Printed Full-color Jumbo Size Postcards", "Teacher Appreciation Gift Handout Kit"])
    eq(`junk: ${bad}`, isJunk(t(bad)), true);
  for (const good of ["Sending a BIG Hug Luxury Gift Spa Set", "Recognition Nurse Snow Globe", "Self-Care Essentials Skincare Gift Set",
    "Lamy 2000 Fountain Pen", "Personalized Initial Mug", "AOIZGMY Self Care Gifts for Women 11 Piece Set"])
    eq(`a gift: ${good}`, isJunk(t(good)), false);
  eq("the same product under two ids appears once", mergeCards([[{ ...t("Self Care Spa Gift Set"), product_id: "x1" }, { ...t("Self Care Spa Gift Set"), product_id: "x2" }]]).length, 1);
  eq("ids the model didn't return are dropped", parseIds({ keep: ["a"] }, "keep", [t("a"), t("b")]).length, 1);
  const prods = ["Spa Set", "Snow Globe", "Badge Reel", "Tote", "Mug", "Candle", "Blanket", "Book"].map(n => prod(n.toLowerCase(), [off(40)], { title: n }));
  const gated = await browseGifts("nurses", { search: async () => prods,
    ai: async s => s.startsWith("You curate") ? { keep: ["spa set", "snow globe", "tote", "mug", "candle", "blanket"] } : { searches: [{ query: "gifts" }] } });
  eq("the front page keeps only what the model calls a gift", gated.cards.length, 6);
  eq("and says it was checked", gated.gated, true);
  eq("the badge reel never reaches the model's list", gated.cards.some(c => c.product_id === "badge reel"), false);
  const brief = validateBrief({ recipient: "my nurse", budget_cents: 10000 }).brief;
  const f = await fg(brief, { search: async () => prods,
    ai: async s => s.includes("concierge") ? { searches: [{ query: "gifts" }] } : { picks: [{ id: "spa set", reason: "r" }], also: ["mug", "candle"] } });
  eq("below the picks, only what the model vouched for", f.more.map(c => c.product_id).join(","), "mug,candle");
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
