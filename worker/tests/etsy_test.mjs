// Etsy shops as a product source: shop-name parsing, exact shop match, listing -> card.
import { etsyShopName, etsyShopUrl, pickShop, etsyCards, ETSY_NOTICE } from "../etsy.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

eq("bare name", etsyShopName("BanksyTees"), "BanksyTees");
eq("shop url", etsyShopName("https://www.etsy.com/shop/BanksyTees?ref=simple-shop-header-name"), "BanksyTees");
eq("no scheme", etsyShopName("etsy.com/shop/BanksyTees"), "BanksyTees");
eq("locale path", etsyShopName("https://www.etsy.com/uk/shop/BanksyTees"), "BanksyTees");
eq("subdomain", etsyShopName("banksytees.etsy.com"), "banksytees");
eq("listing url is not a shop", etsyShopName("https://www.etsy.com/listing/123/shirt"), null);
eq("other site", etsyShopName("https://example.com/shop/BanksyTees"), null);
eq("junk", etsyShopName("my shop!"), null);
eq("shop url form", etsyShopUrl("BanksyTees"), "https://www.etsy.com/shop/BanksyTees");

const shops = { results: [{ shop_id: 1, shop_name: "BanksyTeesToo" }, { shop_id: 2, shop_name: "banksytees" }] };
eq("exact match, any case", pickShop(shops, "BanksyTees").shop_id, 2);
eq("no match", pickShop(shops, "Nope"), null);
eq("bad json", pickShop(null, "x"), null);

const L = (o = {}) => ({ listing_id: 555, title: "Custom Dad Joke Shirt &amp; Tee &#39;Best Dad&#39;", state: "active", quantity: 10,
  price: { amount: 2499, divisor: 100, currency_code: "USD" }, tags: ["dad", "funny"], is_personalizable: true,
  images: [{ rank: 2, url_570xN: "https://i.etsystatic.com/b.jpg" }, { rank: 1, url_570xN: "https://i.etsystatic.com/a.jpg" }], ...o });
const [c] = etsyCards({ results: [L()] }, "BanksyTees");
eq("id namespaced", c.product_id, "own:etsy:555");
eq("title decoded", c.title, "Custom Dad Joke Shirt & Tee 'Best Dad'");
eq("price in cents", c.price_cents, 2499);
eq("first-ranked image", c.image, "https://i.etsystatic.com/a.jpg");
eq("clean listing url", c.url, "https://www.etsy.com/listing/555");
eq("merchant", c.merchant, "etsy.com");
eq("brand is the shop", c.brand, "BanksyTees");
ok("personalized tag", c.tags.includes("personalized"));
eq("available", c.available, true);
eq("own product", c.own, true);
eq("sold out", etsyCards({ results: [L({ quantity: 0 })] }, "x")[0].available, false);
eq("no price dropped", etsyCards({ results: [L({ price: null })] }, "x").length, 0);
eq("http image dropped", etsyCards({ results: [L({ images: [{ url_570xN: "http://x/a.jpg" }] })] }, "x")[0].image, null);
eq("empty json", etsyCards({}, "x").length, 0);
ok("trademark notice", ETSY_NOTICE.startsWith("The term 'Etsy' is a trademark of Etsy, Inc."));

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
