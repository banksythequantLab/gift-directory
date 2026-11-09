// The direct shop: product cards from Printful, order checks, the print file, PayPal and Printful payloads.
import { shopCard, shortTitle, kindOf, validateShopOrder, validateLines, pickRate, textPrintSvg, shopPayPalOrder, printfulOrder, receiptEmail, MAX_LINE } from "../shop.js";

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
eq("card kind", card.kind, "text");
eq("card title", card.title, "Custom Text Shirt");
eq("ignored variant left out", card.variants.length, 3);
eq("lowest price", card.price_cents, 2400);
eq("catalog id kept", card.variants[2].catalog_id, 4003);
eq("preview image", card.image, "https://img/1.png");
eq("photo products skipped", shopCard({ sync_product: { id: 2, name: "Photo Shirt" }, sync_variants: [sv(9, "M", "20")] }), null);
eq("no variants skipped", shopCard({ sync_product: { id: 3, name: "Plain" }, sync_variants: [] }), null);

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
has("no first line", validateLines(["", "B"]).error, "first line");
has("too long", validateLines(["x".repeat(MAX_LINE + 1)]).error, String(MAX_LINE));
has("emoji refused", validateLines(["hi 🎉"]).error, "emoji");
eq("accents and curly quotes ok", validateLines(["Café ‘Olé’ — yes"]).lines, ["Café ‘Olé’ — yes"]);
eq("blank second line dropped", validateLines(["ONE", "  "]).lines, ["ONE"]);

eq("standard rate picked", pickRate([{ id: "EXP", name: "Express", rate: "9.00" }, { id: "STANDARD", name: "Flat", rate: "4.75" }]).cents, 475);
eq("else cheapest", pickRate([{ id: "A", name: "a", rate: "9.00" }, { id: "B", name: "b", rate: "6.10" }]).id, "B");
eq("no rates", pickRate([]), null);

const svg = textPrintSvg(["A & <B>", "TWO"]);
has("svg escapes", svg, "A &amp; &lt;B&gt;");
has("svg size", svg, 'width="1800" height="2400"');
ok("two text lines", (svg.match(/<text /g) || []).length === 2);
has("short text capped at 300", textPrintSvg(["HI"]), 'font-size="300"');
has("long text floored at 120", textPrintSvg(["x".repeat(22)]), 'font-size="120"');

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
eq("text uses catalog variant", pfo.items[0].variant_id, 4003);
eq("text sends print file", pfo.items[0].files[0].url, "https://gift.directory/api/shop/print/ord1.png");
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

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
