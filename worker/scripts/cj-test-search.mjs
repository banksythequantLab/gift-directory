// Live check of cj.js against CJ with the keys in ~/.gd_cj. Prints product titles, prices and merchants (no secrets).
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { cjSearch, cjQuery, CJ_URL } from "../cj.js";
const env = Object.fromEntries(readFileSync(`${homedir()}/.gd_cj`, "utf8").split(/\r?\n/).map(l => l.match(/^\s*(CJ_\w+)\s*=\s*(.+?)\s*$/)).filter(Boolean).map(m => [m[1], m[2]]));
for (const q of process.argv.slice(2)) {
  try {
    const cards = await cjSearch(env, q, { budget_cents: 20000 }, { limit: 10 });
    console.log(`== "${q}": ${cards.length} cards`);
    for (const c of cards.slice(0, 6)) console.log(`  $${(c.price_cents / 100).toFixed(2)}  ${c.merchant}  |  ${c.title.slice(0, 70)}  |  link ok: ${/^https:\/\/www\.[a-z]+\.(com|net)\/click-101922999-/.test(c.url)}`);
  } catch (e) { console.log(`== "${q}": ERROR ${String(e.message).split(env.CJ_TOKEN).join("***")}`); }
}
// Raw count without our filters, to tell "no joined products" apart from "filtered out".
const r = await fetch(CJ_URL, { method: "POST", headers: { authorization: `Bearer ${env.CJ_TOKEN}`, "content-type": "application/json" },
  body: JSON.stringify({ query: `{ shoppingProducts(companyId: "${env.CJ_CID}", partnerStatus: JOINED, limit: 5) { count resultList { title advertiserName availability price { amount currency } } } }` }) });
console.log("raw joined sample:", (await r.text()).split(env.CJ_TOKEN).join("***").slice(0, 700));
