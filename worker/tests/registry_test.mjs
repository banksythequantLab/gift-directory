// Gift registries: validation, addresses, what guests vs the owner see, and the AI step's output.
import { validateRegistry, registrySlug, validateRegItem, publicRegistry, parseRegAi, OCCASIONS, poolTarget } from "../registry.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

const good = { title: "Maria & Sam's wedding", owner_name: "Maria", occasion: "Wedding", event_date: "2027-06-12", paypal_email: "Maria@Example.com", message: "Thanks!" };
const v = validateRegistry(good).registry;
eq("title kept", v.title, "Maria & Sam's wedding");
eq("email lowercased", v.paypal_email, "maria@example.com");
ok("name required", validateRegistry({ ...good, owner_name: " " }).error);
ok("title required", validateRegistry({ ...good, title: "" }).error);
ok("bad date refused", validateRegistry({ ...good, event_date: "June 12" }).error);
ok("bad email refused", validateRegistry({ ...good, paypal_email: "nope" }).error);
eq("email optional", validateRegistry({ ...good, paypal_email: "" }).registry.paypal_email, null);
eq("unknown occasion -> Other", validateRegistry({ ...good, occasion: "Bar mitzvah party" }).registry.occasion, "Other");
ok("occasion list", OCCASIONS.includes("Baby shower"));
eq("partial update touches only given fields", Object.keys(validateRegistry({ paypal_email: "a@b.co" }, { partial: true }).registry).join(), "paypal_email");

eq("slug", registrySlug("Maria & Sam's Wedding!", "k3p9"), "maria-and-sams-wedding-k3p9");
eq("empty slug", registrySlug("!!!", "ab12"), "registry-ab12");

const card = { product_id: "c3:1", title: "Dutch Oven", url: "https://shop.example/d", image: "http://x/img.jpg", price_cents: 12999, merchant: "shop.example" };
const it = validateRegItem({ card, qty: 50, note: "blue please" }).item;
eq("qty capped", it.qty, 20);
eq("http image dropped", it.card.image, null);
ok("non-https link refused", validateRegItem({ card: { ...card, url: "javascript:x" } }).error);

const reg = { slug: "s", title: "T", occasion: "Wedding", event_date: null, owner_name: "M", message: null, paypal_email: "m@x.co" };
const rows = [{ item_id: "a", card_json: JSON.stringify(card), qty: 2, claimed: 1, note: null, pool_id: null },
              { item_id: "b", card_json: JSON.stringify(card), qty: 1, claimed: 0, note: null, pool_id: "P1" }];
const claims = [{ item_id: "a", name: "Aunt Jo" }];
const guest = publicRegistry(reg, rows, claims, false);
ok("guests don't see who bought what", !("claimed_by" in guest.items[0]));
ok("guests don't see the PayPal email", !("paypal_email" in guest));
eq("group gifts on", guest.group_gifts, true);
const own = publicRegistry(reg, rows, claims, true, { P1: { raised_cents: 12999, target_cents: 12999, status: "open" } });
eq("owner sees who bought it", own.items[0].claimed_by[0], "Aunt Jo");
eq("funded group gift counts as bought", own.items[1].claimed, 1);
eq("pool progress shown", own.items[1].pool.raised_cents, 12999);

const ai = parseRegAi({ reply: "Sure,暖心 here.", items: [{ query: "KitchenAid stand mixer 2025", max_price: 400, qty: 1 }, { query: "", qty: 2 }, { query: "throw blanket", max_price: 80, qty: 99 }] });
eq("ai: empty query dropped", ai.items.length, 2);
eq("ai: year stripped", ai.items[0].query, "KitchenAid stand mixer");
eq("ai: price to cents", ai.items[1].max_cents, 8000);
eq("ai: qty capped", ai.items[1].qty, 20);
eq("ai: CJK stripped", ai.reply, "Sure, here.");
eq("ai: garbage", parseRegAi(null).items.length, 0);

eq("shipping & tax defaults to 10%", validateRegistry(good).registry.ship_pct, 10);
eq("shipping & tax set", validateRegistry({ ...good, ship_pct: "15" }).registry.ship_pct, 15);
ok("shipping & tax over 50% refused", validateRegistry({ ...good, ship_pct: 80 }).error);
ok("negative refused", validateRegistry({ ...good, ship_pct: -1 }).error);
eq("partial update without ship_pct leaves it alone", "ship_pct" in validateRegistry({ title: "x" }, { partial: true }).registry, false);
eq("pool goal adds the estimate", poolTarget(13900, 10), 15290);
eq("pool goal with 0%", poolTarget(13900, 0), 13900);
eq("pool goal never over double", poolTarget(10000, 500), 15000);
eq("guests see the estimate %", publicRegistry({ ...reg, ship_pct: 12 }, [], [], false).ship_pct, 12);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
