// For checking a guide's top picks against what the listing actually says: prints each pick's reason next to the
// product's title, brand, price and listed features (the only things the writer was shown).
// Usage (from worker): node scripts/audit.mjs <slug> [<slug> ...]
import { execSync } from "child_process";
const slugs = process.argv.slice(2).filter(s => /^[a-z0-9-]+$/.test(s));
if (!slugs.length) { console.log("usage: node scripts/audit.mjs <slug> ..."); process.exit(1); }
const sql = `SELECT slug, cards_json, json_extract(guide_json,'$.recs') r FROM seo_pages WHERE slug IN (${slugs.map(s => `'${s}'`).join(",")})`;
const out = execSync(`npx wrangler d1 execute gift-finder --remote --json --command "${sql}"`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64e6 });
for (const r of JSON.parse(out)[0].results) {
  console.log(`== ${r.slug}`);
  const cards = JSON.parse(r.cards_json || "[]"), j = r.r ? JSON.parse(r.r) : null;
  for (const p of (j && j.picks) || []) {
    const c = cards.find(x => x.product_id === (p.id || p.product_id));
    console.log(`  [${p.label}] ${p.why}`);
    console.log(c ? `     LISTING: ${c.title} | ${c.brand || "-"} | $${c.price_cents / 100} | ${(c.features || []).join("; ").slice(0, 500) || "(no features listed)"}${c.description ? " | DESC: " + String(c.description).slice(0, 300) : ""}` : "     LISTING: (product no longer on the page)");
  }
}
