// Store owners' own products: Shopify products.json, product pages, CSV, matching.
import { safeHttpsUrl, shopOrigin, shopifyCards, productFromHtml, parseCsv, ownMatches, hashKey } from "../own.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

// addresses
eq("bare domain becomes an https origin", shopOrigin("myshop.com"), "https://myshop.com");
eq("a deep link becomes the origin", shopOrigin("https://mine.myshopify.com/collections/all?x=1"), "https://mine.myshopify.com");
eq("http is upgraded", shopOrigin("http://shop.brand.com"), "https://shop.brand.com");
eq("localhost refused", shopOrigin("localhost:8787"), null);
eq("IP address refused", shopOrigin("http://169.254.169.254/latest"), null);
eq("internal name refused", shopOrigin("printer.local"), null);
eq("credentials in URL refused", safeHttpsUrl("https://a:b@shop.com"), null);
eq("odd port refused", safeHttpsUrl("https://shop.com:8443/x"), null);

// Shopify
const shop = { products: [
  { id: 101, handle: "brass-scale", title: "Brass Scale", vendor: "Maker Co", product_type: "Decor", tags: ["law", "office"],
    images: [{ src: "https://cdn.shopify.com/s/files/scale.jpg" }],
    variants: [{ price: "120.00", compare_at_price: "150.00", available: true }, { price: "95.00", available: false }] },
  { id: 102, handle: "sold-out-mug", title: "Mug", variants: [{ price: "20.00", available: false }], images: [] },
  { id: 103, handle: "no-price", title: "Broken", variants: [] },
] };
const cards = shopifyCards(shop, "https://www.mineshop.com");
eq("products without a price are skipped", cards.length, 2);
eq("price is the cheapest variant in stock", cards[0].price_cents, 12000);
eq("compare-at price kept when higher", cards[0].was_cents, 15000);
eq("link goes to the product on the shop", cards[0].url, "https://www.mineshop.com/products/brass-scale");
eq("id is stable and namespaced", cards[0].product_id, "own:mineshop.com:101");
eq("merchant is the shop host", cards[0].merchant, "mineshop.com");
eq("sold-out product is marked unavailable", cards[1].available, false);
ok("tags searchable", cards[0].tags.includes("law"));
eq("own cards are flagged", cards[0].own, true);

// product pages
const ld = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Product","name":"Hand-thrown Mug","brand":{"name":"Clay Co"},"image":["/img/mug.jpg"],"offers":{"@type":"Offer","price":"38.50","availability":"https://schema.org/InStock"}}]}</script></head></html>`;
const p1 = productFromHtml(ld, "https://www.etsy.com/listing/123/mug?ref=x");
eq("JSON-LD product name", p1 && p1.title, "Hand-thrown Mug");
eq("JSON-LD price", p1 && p1.price_cents, 3850);
eq("relative image made absolute", p1 && p1.image, "https://www.etsy.com/img/mug.jpg");
eq("brand read", p1 && p1.brand, "Clay Co");
const og = `<meta property="og:title" content="Leather Wallet &amp; Card Case"><meta property="og:image" content="https://cdn.x.com/w.jpg"><meta property="product:price:amount" content="64.00">`;
const p2 = productFromHtml(og, "https://shop.example.com/products/wallet");
eq("Open Graph fallback", p2 && p2.title + "|" + p2.price_cents, "Leather Wallet & Card Case|6400");
eq("an http og:image is upgraded to https", productFromHtml(`<meta property='og:title' content='Tree Runner'><meta property='og:image' content='http://www.shop.com/a.png'><meta property='og:price:amount' content='100'>`, "https://www.shop.com/products/t").image, "https://www.shop.com/a.png");
eq("page with no price is refused", productFromHtml(`<meta property="og:title" content="About us">`, "https://x.com/about"), null);
const oos = productFromHtml(`<script type="application/ld+json">{"@type":"Product","name":"Gone","offers":{"price":"10","availability":"https://schema.org/OutOfStock"}}</script>`, "https://x.com/p");
eq("out of stock read from offers", oos && oos.available, false);
eq("same page twice gets the same id", productFromHtml(og, "https://shop.example.com/products/wallet?a=1").product_id, p2.product_id);

// CSV
const csv = `Title,Price,URL,Image\n"Mug, large",$24.00,https://myshop.com/mug,https://myshop.com/mug.jpg\nNo link,10,,\n`;
const r = parseCsv(csv);
eq("CSV row with a quoted comma", r.rows[0] && r.rows[0].title, "Mug, large");
eq("CSV price with $", r.rows[0] && r.rows[0].price_cents, 2400);
eq("bad CSV row reported, not imported", r.rows.length + "|" + r.errors.length, "1|1");
ok("missing columns explained", parseCsv("name,cost\nx,1").errors[0].includes("Columns needed"));

// matching
const pool = [{ ...cards[0] }, { product_id: "own:a:2", title: "Silk Scarf", price_cents: 9000, available: true, tags: "" }, { product_id: "own:a:3", title: "Gold Scale Pin", price_cents: 90000, available: true }];
const m = ownMatches(pool, ["scales of justice decor", "for a lawyer"], 20000);
eq("matches by words in the searches", m.map(x => x.product_id).join(","), "own:mineshop.com:101");
eq("over-budget products are left out", ownMatches(pool, ["scale"], 20000).some(x => x.product_id === "own:a:3"), false);
eq("unavailable products never match", ownMatches([{ ...cards[1] }], ["mug"], 100000).length, 0);
ok("hash is stable", hashKey("abc") === hashKey("abc") && hashKey("abc") !== hashKey("abd"));

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
