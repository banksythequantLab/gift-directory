// Print the top picks (label and reason) on one or more guides, straight from the database.
// Usage (from worker): node scripts/picks.mjs <slug> [<slug> ...]
import { execSync } from "child_process";
const slugs = process.argv.slice(2).filter(s => /^[a-z0-9-]+$/.test(s));
if (!slugs.length) { console.log("usage: node scripts/picks.mjs <slug> ..."); process.exit(1); }
const sql = `SELECT slug, json_array_length(cards_json) n, json_extract(guide_json,'$.recs') r FROM seo_pages WHERE slug IN (${slugs.map(s => `'${s}'`).join(",")})`;
const out = execSync(`npx wrangler d1 execute gift-finder --remote --json --command "${sql}"`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64e6 });
for (const r of JSON.parse(out)[0].results) {
  console.log(`== ${r.slug} (${r.n} items)`);
  const j = r.r ? JSON.parse(r.r) : null;
  if (!j) { console.log("  no top picks"); continue; }
  for (const p of j.picks) console.log(`  [${p.label}] ${p.why || p.reason || ""}`);
  if (j.skip) console.log(`  skip: ${j.skip}`);
}
