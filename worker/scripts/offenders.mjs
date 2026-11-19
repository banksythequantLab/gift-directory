// Guides that still show a product the shared gates now refuse (joke-shop stock on an ordinary page, crude or
// horror items where they don't belong). Prints one line per guide and writes the slugs to the file named.
// Usage (from worker): node scripts/offenders.mjs [out-file]      then: node scripts/rebuild.mjs @out-file
import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { allowed, pageBySlug } from "../seo.js";
const out = execSync(`npx wrangler d1 execute gift-finder --remote --json --command "SELECT slug, cards_json FROM seo_pages"`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 256e6 });
const bad = [];
for (const r of JSON.parse(out)[0].results) {
  const p = pageBySlug(r.slug); if (!p) continue;
  // Only the shared gates: the page's own exclude/require lists are judged per slot at build time.
  const gate = { slug: p.slug, novelty: p.novelty, horror: p.horror };
  const hits = JSON.parse(r.cards_json || "[]").filter(c => !allowed(gate, c));
  if (hits.length) { bad.push(r.slug); console.log(`${r.slug}: ${hits.map(c => String(c.title).slice(0, 44)).join(" | ")}`); }
}
console.log(`${bad.length} guides`);
if (process.argv[2]) writeFileSync(process.argv[2], bad.join("\n") + "\n");
