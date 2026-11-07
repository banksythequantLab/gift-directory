// CJ Affiliate products: query shape, card filtering, and the off switch when keys are missing.
import { cjOn, cjQuery, cjToCard, cjSearch } from "../cj.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

const env = { CJ_TOKEN: "t", CJ_CID: "1234", CJ_PID: "5678" };
const prod = (o = {}) => ({ id: "SKU1", title: "Leather Journal", advertiserId: "99", advertiserName: "Good Store", brand: "Acme",
  imageLink: "https://img.example/a.jpg", availability: "in stock", condition: "new", price: { amount: "40.00", currency: "USD" },
  linkCode: { clickUrl: "https://www.kqzyfj.com/click-5678-1?url=x" }, ...o });

eq("off without keys", cjOn({ CJ_TOKEN: "t", CJ_CID: "1" }), false);
eq("on with keys", cjOn(env), true);
const q = cjQuery(env, 'golf "gift"', { highCents: 5000, limit: 500 });
ok("query only joined advertisers", q.includes("partnerStatus: JOINED"));
ok("query in stock, USD", q.includes("availability: IN_STOCK") && q.includes('currency: "USD"'));
ok("tracking link uses our PID", q.includes('linkCode(pid: "5678")'));
ok("keywords are escaped", q.includes('keywords: ["golf \\"gift\\""]'), q);
ok("budget becomes highPrice", q.includes("highPrice: 50.00"));
ok("limit is capped at 100", q.includes("limit: 100"));

const c = cjToCard(prod(), 10000);
eq("card id is namespaced", c.product_id, "cj:99:SKU1");
eq("card links through CJ", c.url, "https://www.kqzyfj.com/click-5678-1?url=x");
eq("card price in cents", c.price_cents, 4000);
eq("card marks its source", c.source, "cj");
eq("sale price wins and list shows as was", JSON.stringify((({ price_cents, was_cents }) => ({ price_cents, was_cents }))(cjToCard(prod({ salePrice: { amount: "30", currency: "USD" } }), 10000))), '{"price_cents":3000,"was_cents":4000}');
eq("over budget is dropped", cjToCard(prod(), 3000), null);
eq("adult is dropped", cjToCard(prod({ adult: "yes" }), 10000), null);
eq("used is dropped", cjToCard(prod({ condition: "used" }), 10000), null);
eq("multipack is dropped", cjToCard(prod({ multipack: 6 }), 10000), null);
eq("out of stock is dropped", cjToCard(prod({ availability: "OUT_OF_STOCK" }), 10000), null);
eq("no tracking link is dropped", cjToCard(prod({ linkCode: null }), 10000), null);
eq("non-USD is dropped", cjToCard(prod({ price: { amount: "40", currency: "GBP" } }), 10000), null);
eq("http image is not used", cjToCard(prod({ imageLink: "http://img.example/a.jpg" }), 10000).image, null);

{
  let called = 0;
  const none = await cjSearch({}, "x", {}, { fetchImpl: async () => { called++; return null; } });
  ok("no keys: no request, no products", called === 0 && none.length === 0);
  let sent = null;
  const got = await cjSearch(env, "journal", { budget_cents: 10000 }, { fetchImpl: async (u, o) => { sent = { u, o };
    return { ok: true, json: async () => ({ data: { shoppingProducts: { resultList: [prod(), prod({ id: "SKU2", adult: "yes" })] } } }) }; } });
  eq("search returns only the good card", got.length, 1);
  eq("bearer token sent", sent.o.headers.authorization, "Bearer t");
  let threw = false;
  try { await cjSearch(env, "x", {}, { fetchImpl: async () => ({ ok: true, json: async () => ({ errors: [{ message: "bad token" }] }) }) }); } catch { threw = true; }
  ok("API errors throw (callers fall back to Channel3)", threw);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
