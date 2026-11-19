// Runner-up products on a guide: one more per kind, nothing repeated, and numbered pages keep their number.
import { pickAlternates, fixedCount } from "../more.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

const card = (id, title, extra = {}) => ({ product_id: id, title, url: "https://x.test/" + id, price_cents: 2500, image: "https://x.test/" + id + ".jpg", ...extra });
const p = { slug: "gifts-for-fishermen", keyword: "Gifts for fishermen", slots: ["tackle bag", "pliers", "hat"] };
const cands = [
  [card("a1", "Tackle Bag One", { reason: "written elsewhere" }), card("a2", "Tackle Bag Two", { reason: "written elsewhere" }), card("a3", "Tackle Bag Three")],
  [card("b1", "Fishing Pliers"), card("b2", "Fishing Pliers"), card("b3", "Split Ring Pliers", { image: "" }), card("b4", "Aluminum Pliers", { price_cents: 0 }), card("b5", "Titanium Pliers")],
  [card("c1", "Fishing Hat")],
];
const main = [cands[0][0], cands[1][0], cands[2][0]];

const alts = pickAlternates(p, cands, main);
eq("one runner-up per kind that has one", alts.map(c => c.product_id).join(","), "a2,b5");
ok("never a product already on the page", !alts.some(c => main.some(m => m.product_id === c.product_id)));
ok("a second listing of the same title is not a second gift", !alts.some(c => c.product_id === "b2"));
ok("no picture or no price, no place", !alts.some(c => c.product_id === "b3" || c.product_id === "b4"));
ok("marked as a runner-up", alts.every(c => c.alt === true));
ok("a reason from another search is dropped", alts.every(c => !("reason" in c)));
eq("two per kind when asked", pickAlternates(p, cands, main, 2).map(c => c.product_id).join(","), "a2,a3,b5");
eq("a runner-up joins its slot's group", pickAlternates({ ...p, slotGroups: ["Gear", "Tools", "Wear"] }, cands, main)[1].group, "Tools");
ok("the original cards are left alone", cands[0][1].reason === "written elsewhere" && !("alt" in cands[0][1]));

ok("a '10 best' title is a fixed count", fixedCount({ keyword: "10 Best Gifts for Gamers", slug: "10-best-gifts-for-gamers" }));
ok("an anniversary number is not a fixed count", !fixedCount({ keyword: "10th anniversary gifts", slug: "10th-anniversary-gifts" }));
ok("an ordinary guide is not a fixed count", !fixedCount(p));
eq("a numbered page gets no runners-up", pickAlternates({ ...p, keyword: "10 Best Gifts for Anglers" }, cands, main).length, 0);
eq("nothing to choose from, nothing added", pickAlternates(p, [[], [], []], main).length, 0);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
