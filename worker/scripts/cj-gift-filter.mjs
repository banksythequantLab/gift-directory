// Re-applies the gift filter to docs/cj-advertisers-notjoined.csv without calling CJ again; prints the top programs.
import { readFileSync, writeFileSync } from "node:fs";
const GIFT_PARENTS = /^(Gifts & Flowers|Accessories|Clothing\/Apparel|Home & Garden|Toys & Hobbies|Sports & Fitness|Computer & Electronics|Family|Beauty|Department Stores\/Malls|Entertainment|Books\/Media|Art\/Photo\/Music|Recreation & Leisure|Food & Drinks|Health and Wellness)\b/;
const NOT_GIFTS = /(Utilities|Construction|Internet Service|Computer SW|Groceries|Telephone|Online\/Wireless|Loans|Insurance|Banking|Real Estate|Energy Saving|Office|Moving|Tools & Supplies|Medical|Pharmaceutical|Dental|Vacation|Hotel|\bCars?\b|\bAuto(motive)?\b)/i;
const ABROAD = /\b(UK|U\.K\.|EU|Europe|Canada|CA|AU|Australia|DE|FR|IT|ES|NL|Germany|France|Ireland|NZ|India|Global Programme|International)\b/;
const parse = line => { const out = []; let cur = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i];
  if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
  else if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; };
const lines = readFileSync(new URL("../../docs/cj-advertisers-notjoined.csv", import.meta.url), "utf8").split("\n");
const head = parse(lines[0]), rows = lines.slice(1).filter(Boolean).map(l => Object.fromEntries(parse(l).map((v, i) => [head[i], v])));
const fit = rows.filter(r => GIFT_PARENTS.test(r.category) && !NOT_GIFTS.test(r.category) && !ABROAD.test(r.name));
writeFileSync(new URL("../../docs/cj-advertisers-notjoined-gifts.csv", import.meta.url), [lines[0], ...lines.slice(1).filter(Boolean).filter((_, i) => fit.includes(rows[i]))].join("\n"));
console.log(`${rows.length} not joined; ${fit.length} fit a gift site`);
for (const r of fit.slice(0, Number(process.argv[2] || 60))) console.log(`${Number(r.three_month_epc).toFixed(2).padStart(7)} | ${(r.sale_commission || "-").slice(0, 16).padEnd(16)} | ${r.name.slice(0, 38).padEnd(38)} | ${r.category.slice(0, 45)}`);
