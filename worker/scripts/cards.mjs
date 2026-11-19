// Print the products on one or more guides, straight from the database. "A" marks AbracadabraNYC, "alt" a runner-up.
// Usage (from worker): node scripts/cards.mjs <slug> [<slug> ...]
import { execSync } from "child_process";
const slugs = process.argv.slice(2).filter(s => /^[a-z0-9-]+$/.test(s));
if (!slugs.length) { console.log("usage: node scripts/cards.mjs <slug> ..."); process.exit(1); }
const sql = `SELECT slug, cards_json FROM seo_pages WHERE slug IN (${slugs.map(s => `'${s}'`).join(",")})`;
const out = execSync(`npx wrangler d1 execute gift-finder --remote --json --command "${sql}"`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64e6 });
for (const r of JSON.parse(out)[0].results) {
  const cs = JSON.parse(r.cards_json), abra = c => /^cj:7889430:/.test(c.product_id);
  console.log(`== ${r.slug} (${cs.filter(abra).length} of ${cs.length} from Abracadabra)`);
  for (const c of cs) console.log(`${abra(c) ? "A " : "  "}${c.alt ? "alt " : "    "}$${c.price_cents / 100} ${String(c.title).slice(0, 64)}`);
}
