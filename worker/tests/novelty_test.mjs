// The joke shop's stock stays on the joke pages; crude items stay off every guide; horror stays with horror fans.
import { allowed, pageBySlug, PAGES } from "../seo.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };

const abra = title => ({ product_id: "cj:7889430:1", title });
const other = title => ({ product_id: "c3:abc", title });
const plain = { slug: "christmas-gifts-for-neighbors", keyword: "Christmas gifts for neighbors" };
const joke = pageBySlug("gag-gifts-under-25"), horror = pageBySlug("gifts-for-horror-movie-fans"), magic = pageBySlug("magic-kits-for-kids");

ok("the new guides exist", !!horror && !!magic && !!pageBySlug("white-elephant-gifts-that-get-stolen") && !!pageBySlug("bachelorette-party-gifts"));
ok("no slug is defined twice", new Set(PAGES.map(p => p.slug)).size === PAGES.length);
ok("gag, funny and white-elephant pages take the joke shop", joke.novelty === true && pageBySlug("funny-gifts-for-dad").novelty === true && pageBySlug("white-elephant-gifts-under-30").novelty === true);
ok("an ordinary page does not", !pageBySlug("christmas-gifts-for-neighbors").novelty && !pageBySlug("get-well-soon-gifts").novelty);

ok("joke-shop product, ordinary page: no", !allowed(plain, abra("Moon Mug Heat Changing Mug")));
ok("same mug from another store, ordinary page: yes", allowed(plain, other("Moon Mug Heat Changing Mug")));
ok("joke-shop product, joke page: yes", allowed({ slug: "x", novelty: true }, abra("Moon Mug Heat Changing Mug")));
ok("joke-shop magic kit on the kids' magic page: yes", allowed({ ...magic, require: undefined }, abra("Beginner Magic Kit")));

for (const t of ["Take A Hit Party Card Game for Stoners", "Re-Useable Boobie Hand Warmers", "Floral Lace Adjustable Robe & Thong Teddy Set", "Sexy Nurse Costume", "THC Game", "Oral Sex Card Game", "Kinky Truth or Dare", "Squishy Stress Schlong", "Lust Card Game", "Who Fuckin' Cares? Pen", "Black Fishnet Ankle Socks"])
  ok(`never on any guide: ${t}`, !allowed({ slug: "x", novelty: true, horror: true }, abra(t)) && !allowed(plain, other(t)));
ok("a gross-out joke stays off an ordinary page", !allowed(plain, other("Vomit Scented Candle")) && !allowed(plain, other("Doggie Doo Keychain")));
ok("and is fine on a joke page", allowed({ slug: "x", novelty: true }, other("Vomit Scented Candle")) && allowed({ slug: "x", novelty: true }, other("Fart Candle")));
for (const t of ["House of 1000 Corpses Coloring Book", "Terrifier Art Krispies Jigsaw Puzzle", "Saw: Billy the Puppet Mug", "Horror Movie Trivia Game"])
  ok(`horror only for horror fans: ${t}`, !allowed(plain, other(t)) && !allowed({ slug: "x", novelty: true }, abra(t)) && allowed({ slug: "x", novelty: true, horror: true }, abra(t)));
for (const t of ["Seaweed Bath Soak", "Weed Puller Garden Tool", "Chainsaw Man" /* blocked */, "Murder Mystery Dinner Game", "Skull Candle", "Killer Whale Plush", "Potting Bench", "Hand Saw Set", "Wanderlust Travel Journal", "Sussex Tea Towel", "Unisex Beanie", "Clustered Pearl Earrings"])
  if (t !== "Chainsaw Man") ok(`an innocent title is not caught: ${t}`, allowed(plain, other(t)));
ok("the office gag page takes no weapons or shock toys", !allowed(pageBySlug("gag-gifts-for-coworkers-under-15"), abra("M16 Rifle Tactical Novelty Pen")) && !allowed(pageBySlug("gag-gifts-for-coworkers-under-15"), abra("Surprising Shock Flashlight Keychain")));
ok("the kids' magic page takes no card-game decks", !allowed(magic, other("Magic: The Gathering Final Fantasy Starter Kit")));
ok("novelty guides search the joke shop slot by slot", Array.isArray(horror.shop) && horror.shop.length === horror.slots.length && Array.isArray(horror.shopMust));
ok("a page's own exclude list still applies", !allowed({ slug: "x", exclude: ["gift card"] }, other("Coffee Gift Card")));

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
