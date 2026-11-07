// The store owner's AI assistant: model output is bounded and checked; matching and shelf picking.
import { parseAssist, matchHide, pickShelf, describeStep, assistPrompt, storeBrief, MAX_STEPS, applyPicks, pickPrompt, capKinds } from "../assistant.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

const p = parseAssist({ reply: "Sure.", steps: [
  { type: "add_shelf", collection: "Stocking stuffers", query: "stocking stuffers", max_price: 25, count: 99 },
  { type: "remove_shelf", collection: "old shelf" },
  { type: "remove_shelf", collection: "Not there" },
  { type: "hide", words: ["Skull", "al", "alcohol"] },
  { type: "settings", changes: { tagline: "x".repeat(200), occasions: ["a", "b"], tee_banner: false, accent: "#fff" } },
  { type: "delete_store" },
  { type: "connect_etsy", shop: "HeyAiMe" },
] }, ["Old Shelf"]);
eq("reply kept", p.reply, "Sure.");
eq("shelf price to cents", p.steps[0].max_cents, 2500);
eq("shelf count capped", p.steps[0].count, 12);
eq("remove only a real shelf, real name", p.steps[1].collection, "Old Shelf");
eq("made-up shelf dropped", p.steps.filter(s => s.type === "remove_shelf").length, 1);
eq("short hide words dropped, lowercased", p.steps[2].words.join(","), "skull,alcohol");
eq("tagline clipped", p.steps[3].changes.tagline.length, 90);
eq("too few occasions ignored", p.steps[3].changes.occasions, undefined);
eq("tee switch passed", p.steps[3].changes.tee_banner, false);
eq("accent not changeable by the assistant", p.steps[3].changes.accent, undefined);
ok("unknown step dropped", !p.steps.some(s => s.type === "delete_store"));
eq("etsy step", p.steps[4].shop, "HeyAiMe");
eq("garbage in, safe out", parseAssist(null).steps.length, 0);
eq("step cap", parseAssist({ steps: Array.from({ length: 20 }, () => ({ type: "hide", words: ["skull"] })) }).steps.length, MAX_STEPS);
eq("three shelves at most", parseAssist({ steps: Array.from({ length: 5 }, (_, i) => ({ type: "add_shelf", collection: "S" + i, query: "q" })) }).steps.length, 3);

const cards = [{ product_id: "1", title: "Skull Mug", price_cents: 1500 }, { product_id: "2", title: "Wine Glass Set", price_cents: 3000 },
  { product_id: "1", title: "Skull Mug", price_cents: 1500 }, { product_id: "3", title: "Wine Glass Set Deluxe", price_cents: 2000 }, { product_id: "4", title: "Fuzzy Socks", price_cents: 900 }];
eq("hide matches, deduped", matchHide(cards, ["skull"]).length, 1);
eq("hide nothing", matchHide(cards, ["bourbon"]).length, 0);
const sh = pickShelf(cards, { max_cents: 2500, count: 8 }, new Set(["4"]));
eq("shelf: under cap, no repeats, not already on the store", sh.map(c => c.product_id).join(","), "1,3");
eq("shelf: near-duplicate titles collapse", pickShelf(cards, { count: 8 }).map(c => c.product_id).join(","), "1,2,4");

ok("describe shelf", describeStep({ type: "add_shelf", collection: "X", cards: [1, 2], max_cents: 2500 }).includes('"X" with 2 products under $25'));
ok("describe settings", describeStep({ type: "settings", changes: { tee_banner: false } }).includes("tee banner → off"));
ok("prompt has store and message", assistPrompt(storeBrief({ name: "Nurse Gifts" }, { occasions: ["a"] }, [], []), "add socks").includes("Owner: add socks"));

const pool = [{ title: "A", price_cents: 100, merchant: "m" }, { title: "B", price_cents: 200, merchant: "m" }, { title: "C", price_cents: 300, merchant: "m" }];
const shelvesIn = [{ collection: "X", query: "x", count: 2, pool }, { collection: "Y", query: "y", count: 2, pool }];
const picked = applyPicks({ shelves: [{ i: 0, pick: [2, 2, 9, "0"] }] }, shelvesIn);
eq("picks: in order, no repeats, in range, capped", picked[0].map(c => c.title).join(","), "C,A");
eq("picks: skipped shelf falls back to the top candidates", picked[1].map(c => c.title).join(","), "A,B");
eq("picks: no model answer", applyPicks(null, shelvesIn)[0].length, 2);
ok("pick prompt lists candidates", pickPrompt("Nurse Gifts", "", shelvesIn).includes("  2. C — $3.00 — m"));

const kinds = [0, 0, 0, 0, 1, 1, 2, 3, 3].map((k, i) => ({ product_id: String(i), _k: k }));
const capped = capKinds(kinds, 8, 4);
eq("kind cap: best of each kind first, then seconds, at most 2 of a kind", capped.map(c => c.product_id).join(","), "0,4,6,7,1,5,8");
eq("years stripped from searches", parseAssist({ steps: [{ type: "add_shelf", collection: "C", queries: ["legal calendar 2025"] }] }).steps[0].queries[0], "legal calendar");
ok("kind cap: search index removed", capped.every(c => !("_k" in c)));
eq("CJK stripped from reply", parseAssist({ reply: "Practical,暖心, and easy." }).reply, "Practical, and easy.");

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
