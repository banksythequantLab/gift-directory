// The direct shop: product cards from Printful, order checks, the design templates and print files, PayPal and Printful payloads.
import { shopCard, shortTitle, kindOf, validateShopOrder, validateFields, pickRate, designSvg, designItems, parseKind, rowKind, TEMPLATES, SAMPLES, PTYPES,
  shopPayPalOrder, printfulOrder, receiptEmail, storeShopShelf, STORE_SHELVES, printSize, renderWidth, salesTax, taxTable } from "../shop.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };
const eq = (n, a, b) => ok(n, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);
const has = (n, s, sub) => ok(n, String(s).includes(sub), `missing ${JSON.stringify(sub)} in ${String(s).slice(0, 200)}`);

const sv = (id, size, price, extra = {}) => ({ id, variant_id: 4000 + id, size, color: "Black", retail_price: price, is_ignored: false, availability_status: "active",
  files: [{ type: "preview", preview_url: `https://img/${id}.png` }], ...extra });
const textP = { sync_product: { id: 11, name: "Custom Text Shirt, Your Words, Bold Print", thumbnail_url: "https://img/t.png" },
  sync_variants: [sv(1, "S", "24.00"), sv(2, "M", "24.00"), sv(3, "3XL", "27.50"), sv(4, "XS", "24.00", { is_ignored: true })] };
const card = shopCard(textP);

eq("short title", shortTitle("Outlast the Hurricane Shirt, Hurricane Season Tee, Front"), "Outlast the Hurricane Shirt");
eq("kind text", kindOf("Custom Text Shirt"), "text");
eq("kind photo", kindOf("Custom Photo Tee"), "photo");
eq("kind fixed", kindOf("Lawyer Up Tee"), "fixed");
eq("custom text by name is the text template", [card.kind, card.tpl, card.ptype], ["tpl", "text", "tee"]);
eq("card title", card.title, "Custom Text Shirt");
eq("ignored variant left out", card.variants.length, 3);
eq("lowest price", card.price_cents, 2400);
eq("catalog id kept", card.variants[2].catalog_id, 4003);
eq("product thumbnail wins", card.image, "https://img/t.png");
eq("bare thumbnail falls back to the preview", shopCard({ ...textP, sync_product: { ...textP.sync_product, thumbnail_url: "https://files.cdn.printful.com/" } }).image, "https://img/1.png");
eq("card carries the fields", card.fields.length, 2);
eq("photo products skipped", shopCard({ sync_product: { id: 2, name: "Photo Shirt" }, sync_variants: [sv(9, "M", "20")] }), null);
eq("no variants skipped", shopCard({ sync_product: { id: 3, name: "Plain" }, sync_variants: [] }), null);
const mugCard = shopCard({ sync_product: { id: 12, name: "Name & Role Mug, For the desk", external_id: "gd-tpl-role-mug" }, sync_variants: [sv(5, "11 oz", "16.99")] });
eq("template by external id", [mugCard.kind, mugCard.tpl, mugCard.ptype, mugCard.print.w], ["tpl", "role", "mug", 2700]);
eq("unknown template is a fixed product", shopCard({ sync_product: { id: 13, name: "Tee", external_id: "gd-tpl-nope-tee" }, sync_variants: [sv(6, "M", "20")] }).kind, "fixed");
eq("fixed card", shopCard({ sync_product: { id: 14, name: "Lawyer Up Tee" }, sync_variants: [sv(7, "M", "20")] }).kind, "fixed");

eq("row kind for a template", rowKind(mugCard), "tpl:role:mug");
eq("row kind for fixed", rowKind({ kind: "fixed" }), "fixed");
eq("parse template kind", parseKind("tpl:roster:hoodie"), { tpl: "roster", ptype: "hoodie" });
eq("parse legacy text", parseKind("text"), { tpl: "text", ptype: "tee" });
eq("parse fixed", parseKind("fixed"), null);
eq("parse junk", parseKind("tpl:x:tee"), null);

const rcpt = { name: "Jo Smith", address1: "1 Main St", city: "New York", state_code: "ny", zip: "10001", email: "Jo@Example.com" };
const good = { product_id: 11, variant_id: 3, qty: 2, lines: ["WORLD'S BEST", "AUNT"], recipient: rcpt, gift_message: "Love you" };
const v = validateShopOrder(good, card);
ok("good order passes", !v.error, v.error);
eq("state upper-cased", v.order.recipient.state_code, "NY");
eq("email lower-cased", v.order.recipient.email, "jo@example.com");
eq("lines kept", v.order.lines, ["WORLD'S BEST", "AUNT"]);
has("no product", validateShopOrder(good, null).error, "isn't available");
has("bad size", validateShopOrder({ ...good, variant_id: 4 }, card).error, "size");
has("qty -1", validateShopOrder({ ...good, qty: -1 }, card).error, "Quantity");
eq("qty blank means 1", validateShopOrder({ ...good, qty: "" }, card).order.qty, 1);
has("qty 11", validateShopOrder({ ...good, qty: 11 }, card).error, "Quantity");
has("bad zip", validateShopOrder({ ...good, recipient: { ...rcpt, zip: "1234" } }, card).error, "ZIP");
has("not a US state", validateShopOrder({ ...good, recipient: { ...rcpt, state_code: "ON" } }, card).error, "US state");
has("no email", validateShopOrder({ ...good, recipient: { ...rcpt, email: "x" } }, card).error, "email");
ok("fixed product needs no fields", !validateShopOrder({ ...good, lines: null, variant_id: 7 }, shopCard({ sync_product: { id: 14, name: "Lawyer Up Tee" }, sync_variants: [sv(7, "M", "20")] })).error);

// fields
has("text: first line required", validateFields("text", ["", "B"]).error, "Line 1");
has("too long", validateFields("text", ["x".repeat(23)]).error, "22 characters");
has("optional label trimmed in error", validateFields("text", ["A", "x".repeat(23)]).error, 'Keep "Line 2" to 22');
has("emoji refused", validateFields("text", ["hi 🎉"]).error, "emoji");
eq("accents and curly quotes ok", validateFields("text", ["Café ‘Olé’ — yes"]).lines, ["Café ‘Olé’ — yes", ""]);
eq("positions kept for optional fields", validateFields("role", ["Ann", "Nurse"]).lines, ["Ann", "Nurse", ""]);
has("role needs the role", validateFields("role", ["Ann"]).error, "Role or title");
has("unknown template", validateFields("nope", ["A"]).error, "isn't available");
for (const t of Object.keys(TEMPLATES)) ok(`sample for ${t} is valid`, !validateFields(t, SAMPLES[t]).error, validateFields(t, SAMPLES[t]).error);
for (const t of Object.keys(TEMPLATES)) for (const f of TEMPLATES[t].fields) ok(`placeholder fits ${t}/${f.label}`, f.ph.length <= f.max);

// designs: nothing may run past the print box at the longest allowed text
const longest = t => TEMPLATES[t].fields.map(f => "W".repeat(f.max));
for (const t of Object.keys(TEMPLATES)) for (const p of Object.keys(PTYPES)) {
  const P = PTYPES[p], bw = Math.round(P.w * P.bw), its = designItems(t, longest(t), bw).filter(i => !i.rule);
  ok(`${t}/${p}: every line fits the box`, its.every(i => i.t.length * i.fs * (0.7 + i.ls) <= bw + 1), JSON.stringify(its.map(i => [i.t.length, i.fs])));
  for (const vals of [SAMPLES[t], longest(t)]) {
    const svg = designSvg(t, p, vals);
    has(`${t}/${p}: print size`, svg, `width="${P.w}" height="${P.h}"`);
    const ys = [...svg.matchAll(/<text [^>]* y="(\d+)"/g)].map(m => Number(m[1])), fss = [...svg.matchAll(/font-size="(\d+)"/g)].map(m => Number(m[1]));
    ok(`${t}/${p}: inside the print area`, ys.every((y, i) => y - fss[i] * 0.74 >= 0 && y < P.h), `${ys} / h ${P.h}`);
  }
}
// per-variant print sizes, render cap, backgrounds, two-sided items
eq("variant print size", printSize("deskmat", 22327), [9921, 5197]);
eq("default print size", printSize("deskmat", 1), [5610, 3839]);
has("variant size in the svg", designSvg("role", "deskmat", SAMPLES.role, [9921, 5197]), 'width="9921" height="5197"');
ok("render capped at 3600 on the long side", renderWidth(9921, 5197) === 3600 && renderWidth(1800, 2400) === 1800 && renderWidth(1076, 2085) === 1076);
has("puzzle prints on a background", designSvg("roster", "puzzle", SAMPLES.roster), '<rect width="4200" height="3300" fill="#1f3a5f"/>');
ok("tee has no background", !designSvg("role", "tee", SAMPLES.role).includes('<rect width='));
eq("can cooler prints front and back", printfulOrder({ id: "x", kind: "tpl:roster:cooler", pf_catalog_variant_id: 19461, title: "t", qty: 1, unit_cents: 1, subtotal_cents: 1, shipping_cents: 1, recipient_json: JSON.stringify(rcpt) }, "u").items[0].files.map(f => f.type), ["front", "back"]);
for (const p of Object.keys(PTYPES)) if (PTYPES[p].example) ok(`${p} example is valid`, !validateFields(PTYPES[p].example.tpl, PTYPES[p].example.vals).error, validateFields(PTYPES[p].example.tpl, PTYPES[p].example.vals).error);
const wine = designSvg("roster", "wine", ["The Smiths", "Lake Weekend 2026", "Ann, Ben, Cara, Dev, Eve, Fay, Gus"]);
has("short print area keeps the main line", wine, ">THE SMITHS<");
ok("short print area drops lines too small to print", [...wine.matchAll(/font-size="(\d+)"/g)].every(m => Number(m[1]) >= 39), wine.slice(0, 300));
eq("tee keeps every line", (designSvg("roster", "tee", ["The Smiths", "Lake Weekend 2026", "Ann, Ben, Cara"]).match(/<text /g) || []).length, 3);
// a pick-your-design item
const item = shopCard({ sync_product: { id: 20, name: "Personalized Rocks Glass, 10.5 oz", external_id: "gd-item-rocks", thumbnail_url: "https://img/r.jpg" }, sync_variants: [sv(8, "10.5 oz", "22.99")] });
eq("item card", [item.kind, item.ptype, item.tpl, item.tpls.length, item.designs.length], ["tpl", "rocks", "milestone", 4, 4]);
eq("item carries its example", item.example.vals[0], "Made Partner");
eq("unknown item type is fixed", shopCard({ sync_product: { id: 21, name: "X", external_id: "gd-item-nope" }, sync_variants: [sv(8, "M", "9")] }).kind, "fixed");
const pick = validateShopOrder({ ...good, product_id: 20, variant_id: 8, tpl: "role", lines: ["Ann Lee", "Nurse", ""] }, item);
eq("buyer's design choice kept", [pick.order.tpl, rowKind(item, pick.order.tpl)], ["role", "tpl:role:rocks"]);
eq("design not offered falls back to the default", validateShopOrder({ ...good, product_id: 20, variant_id: 8, tpl: "nope", lines: ["Retired"] }, item).order.tpl, "milestone");
has("chosen design's fields are checked", validateShopOrder({ ...good, product_id: 20, variant_id: 8, tpl: "role", lines: ["Ann Lee"] }, item).error, "Role or title");
has("svg escapes", designSvg("text", "tee", ["A & <B>", "TWO"]), "A &amp; &lt;B&gt;");
ok("text keeps case", designSvg("text", "tee", ["Hello", ""]).includes(">Hello<"));
ok("role upper-cases", designSvg("role", "tee", ["Ann Lee", "Nurse", ""]).includes(">ANN LEE<"));
eq("text: two lines", (designSvg("text", "tee", ["A", "B"]).match(/<text /g) || []).length, 2);
eq("mug prints the design twice", (designSvg("role", "mug", ["Ann", "Nurse", ""]).match(/<text /g) || []).length, 4);
eq("milestone without a name has no rule", (designSvg("milestone", "tee", ["Retired", "2026", ""]).match(/<rect /g) || []).length, 0);
const roster = designItems("roster", ["The Smiths", "", "Ann, Bob; Cal / Dee"], 1650).map(i => i.t || "rule");
eq("roster names joined", roster, ["THE SMITHS", "rule", "ANN · BOB · CAL · DEE"]);
ok("roster wraps long name lists", designItems("roster", ["X", "", "Alexandra, Benjamin, Christopher, Dominique, Evangeline"], 1650).filter(i => !i.rule).length >= 3);
ok("short text capped", designItems("text", ["HI"], 1650)[0].fs === Math.round(1650 * 0.18));

eq("standard rate picked", pickRate([{ id: "EXP", name: "Express", rate: "9.00" }, { id: "STANDARD", name: "Flat", rate: "4.75" }]).cents, 475);
eq("else cheapest", pickRate([{ id: "A", name: "a", rate: "9.00" }, { id: "B", name: "b", rate: "6.10" }]).id, "B");
eq("no rates", pickRate([]), null);

const o = { ...v.order, id: "ord1", shipping_cents: 475 };
const pp = shopPayPalOrder(o, "https://gift.directory");
const pu = pp.purchase_units[0];
eq("paypal total", pu.amount.value, "59.75");
eq("paypal items", pu.amount.breakdown.item_total.value, "55.00");
eq("paypal shipping", pu.amount.breakdown.shipping.value, "4.75");
eq("paypal qty", pu.items[0].quantity, "2");
eq("paypal address", pu.shipping.address.admin_area_1, "NY");
eq("paypal return", pp.payment_source.paypal.experience_context.return_url, "https://gift.directory/api/shop/return");
eq("buyer can't change address", pp.payment_source.paypal.experience_context.shipping_preference, "SET_PROVIDED_ADDRESS");

const row = { id: "ord1", kind: "text", pf_sync_variant_id: 3, pf_catalog_variant_id: 4003, title: "Custom Text Shirt", variant_label: "Black / 3XL", qty: 2,
  lines_json: JSON.stringify(["WORLD'S BEST", "AUNT"]), gift_message: "Love you", recipient_json: JSON.stringify(v.order.recipient), email: "jo@example.com",
  unit_cents: 2750, subtotal_cents: 5500, shipping_cents: 475, total_cents: 5975 };
const pfo = printfulOrder(row, "https://gift.directory/api/shop/print/ord1.png");
eq("legacy text uses catalog variant", pfo.items[0].variant_id, 4003);
eq("tee prints on the front", pfo.items[0].files[0], { type: "front", url: "https://gift.directory/api/shop/print/ord1.png" });
eq("mug prints on default", printfulOrder({ ...row, kind: "tpl:role:mug" }, "u").items[0].files[0].type, "default");
eq("external id", pfo.external_id, "ord1");
eq("gift message", pfo.gift.message, "Love you");
const fixed = printfulOrder({ ...row, kind: "fixed", lines_json: null, gift_message: null }, "x");
eq("fixed uses sync variant", fixed.items[0].sync_variant_id, 3);
ok("fixed has no files", !fixed.items[0].files);
ok("no gift block without message", !fixed.gift);
const m = receiptEmail(row);
has("receipt subject", m.subject, "Custom Text Shirt");
has("receipt total", m.text, "$59.75");
has("receipt text lines", m.html, "WORLD&#39;S BEST / AUNT");
has("receipt skips empty fields", receiptEmail({ ...row, lines_json: JSON.stringify(["Ann", "Nurse", ""]) }).text, "Your text: Ann / Nurse\n");

// sales tax
const njTo = st => ({ ...rcpt, state_code: st });
const mugOrder = { card: mugCard, variant: { price_cents: 1699 }, qty: 2, recipient: njTo("NJ") };
eq("NJ: non-clothing taxed with shipping at 6.625%", salesTax(mugOrder, 795), { cents: Math.round((3398 + 795) * 0.06625), rate: 0.06625, state: "NJ" });
eq("NJ: tee is clothing, exempt", salesTax({ ...mugOrder, card: card }, 495).cents, 0);
eq("NJ: hoodie exempt", salesTax({ ...mugOrder, card: { kind: "tpl", ptype: "hoodie" } }, 495).exempt, "clothing");
eq("NJ: a fixed shirt is clothing", salesTax({ ...mugOrder, card: { kind: "fixed", title: "Outlast the Hurricane Shirt" } }, 495).cents, 0);
ok("NJ: stocking is not clothing", salesTax({ ...mugOrder, card: { kind: "tpl", ptype: "stocking" } }, 0).cents > 0);
eq("NY: not collected", salesTax({ ...mugOrder, recipient: njTo("NY") }, 795).cents, 0);
eq("table from SHOP_TAX", salesTax({ ...mugOrder, recipient: njTo("NY") }, 0, taxTable('{"NY":{"rate":0.04}}')).cents, 136);
eq("bad SHOP_TAX falls back to NJ only", Object.keys(taxTable("{nope")), ["NJ"]);
eq("no shipping tax when the state says so", salesTax(mugOrder, 795, { NJ: { rate: 0.1 } }).cents, 340);
const ppTax = shopPayPalOrder({ ...o, shipping_cents: 475, tax_cents: 300 }, "https://gift.directory").purchase_units[0].amount;
eq("paypal total includes tax", [ppTax.value, ppTax.breakdown.tax_total.value], ["62.75", "3.00"]);
ok("no tax line when none", !shopPayPalOrder(o, "https://gift.directory").purchase_units[0].amount.breakdown.tax_total);
eq("printful retail tax", printfulOrder({ ...row, tax_cents: 300 }, "u").retail_costs.tax, "3.00");
has("receipt shows tax", receiptEmail({ ...row, tax_cents: 300 }).text, "Sales tax: $3.00");
ok("receipt has no tax line without tax", !receiptEmail(row).text.includes("Sales tax"));

// the shop's terms show only when the shop is public
const { renderLegal } = await import("../legal.js");
ok("terms hide the shop section while the shop is hidden", !renderLegal("terms").includes("The gift.directory shop") && !renderLegal("terms").includes("<!--shop-->"));
has("terms show the shop section when public", renderLegal("terms", { shop: true }), "we'll reprint it or refund you");

// a store's "Personalize it" shelf
const tcard = (id, tpl, ptype) => ({ id, kind: "tpl", tpl, ptype, title: `${tpl} ${ptype}`, image: `https://img/${id}.jpg`, price_cents: 1699 });
const shopCards = [tcard(1, "role", "tee"), tcard(2, "role", "mug"), tcard(3, "role", "hoodie"), tcard(4, "milestone", "tee"), tcard(5, "milestone", "mug"),
  tcard(6, "text", "tee"), tcard(7, "text", "mug"), tcard(8, "roster", "tee"), tcard(9, "roster", "hoodie"), { id: 10, kind: "fixed", title: "Hurricane" }];
eq("no shelf for other stores", storeShopShelf(shopCards, "friend-gifts"), null);
for (const slug of Object.keys(STORE_SHELVES)) {
  const sh = storeShopShelf(shopCards, slug);
  eq(`${slug}: eight personalized products`, sh.cards.length, 8);
  for (const t of Object.keys(STORE_SHELVES[slug])) ok(`${slug}/${t} example is valid`, !validateFields(t, STORE_SHELVES[slug][t]).error, validateFields(t, STORE_SHELVES[slug][t]).error);
}
const nurse = storeShopShelf(shopCards, "nurses");
eq("shelf title", nurse.title, "Personalize it");
eq("link opens the product with the store's example", nurse.cards[0].url, "https://gift.directory/shop?p=1&f=Jane+Doe%2C+RN&f=Emergency+Nursing&f=Est.+2026");
eq("card marked as ours", [nurse.cards[0].own, nurse.cards[0].merchant, nurse.cards[0].product_id], [true, "gift.directory", "shop:1"]);
ok("fixed products not on the shelf", !nurse.cards.some(c => c.product_id === "shop:10"));
eq("missing products are skipped", storeShopShelf([tcard(1, "role", "tee")], "lawyers").cards.length, 1);
eq("empty shop, no shelf", storeShopShelf([], "lawyers"), null);
const withItems = [...shopCards, { ...tcard(30, "milestone", "rocks"), tpls: Object.keys(TEMPLATES) }, { ...tcard(31, "role", "deskmat"), tpls: Object.keys(TEMPLATES) }];
const law = storeShopShelf(withItems, "lawyers");
eq("store's items join its shelf", law.cards.length, 10);
eq("item link opens the right design", law.cards[8].url, "https://gift.directory/shop?p=30&t=milestone&f=Made+Partner&f=2026&f=Jane+Doe%2C+Esq.");
eq("nurse shelf skips items the shop doesn't have", storeShopShelf(withItems, "nurses").cards.length, 8);
eq("store mockup used when there is one", storeShopShelf(shopCards, "nurses", "https://gift.directory", { nurses: { 2: "https://m/n2.jpg" } }).cards.map(c => c.image).slice(0, 2), ["https://img/1.jpg", "https://m/n2.jpg"]);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
