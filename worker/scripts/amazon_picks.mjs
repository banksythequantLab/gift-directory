// Prints the hand-picked Amazon products on the team guides as JSON: one entry per ASIN, with the leagues that use it
// and the line in seo.js that defines it. Used by the nightly Amazon-pick check. Run from worker/: node scripts/amazon_picks.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const seoPath = fileURLToPath(new URL("../seo.js", import.meta.url));
const S = await import(new URL("../seo.js", import.meta.url));
const lines = readFileSync(seoPath, "utf8").split("\n");
const byAsin = new Map();
for (const p of S.TEAM_PAGES) {
  const a = p.amazonPicks, items = Array.isArray(a) ? a : (a && a.items) || [];
  for (const it of items) {
    const e = byAsin.get(it.asin) || { asin: it.asin, name: it.name, leagues: new Set(), pages: 0,
      line: lines.findIndex(l => l.includes(`"${it.asin}"`)) + 1 };
    e.leagues.add(p.team.league); e.pages++; byAsin.set(it.asin, e);
  }
}
console.log(JSON.stringify([...byAsin.values()].map(e => ({ ...e, leagues: [...e.leagues] })), null, 1));
