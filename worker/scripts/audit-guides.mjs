// Read-only: checks every built guide's saved picks against its own definition and writes guide-audit.txt.
// Usage (from worker): export seo_pages to <dir>/seo-<n>.json with wrangler d1 execute --json, then node scripts/audit-guides.mjs <dir>
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { PAGES, allowed } from "../seo.js";
const dir = process.argv[2];
const rows = readdirSync(dir).filter(f => /^seo-\d+\.json$/.test(f)).flatMap(f => JSON.parse(readFileSync(`${dir}/${f}`, "utf8").replace(/^\uFEFF/, ""))[0].results);
const NEW = new Set(process.argv[3] ? readFileSync(process.argv[3], "utf8").split(/\s+/) : []);
const sing = w => w.replace(/(ss|x|ch|sh)es$/, "$1").replace(/([^s])s$/, "$1");
const norm = t => String(t || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const ODD = /\b(replacement|refill|gift card|e-gift|digital code|pretend play|costume|toddler|infant|baby bodysuit|onesie|for dogs|dog toy|cat toy|bulk|pack of \d{2,}|case of|wholesale|sample|mirror|wig|vibrator|lingerie|sexy)\b/;
const out = [], stats = { pages: 0, cards: 0, flagged_pages: 0 };
const byProblem = {};
const add = (slug, kind, detail) => { (byProblem[kind] ||= []).push(`${slug}: ${detail}`); };
for (const r of rows) {
  const p = PAGES.find(x => x.slug === r.slug); if (!p) { add(r.slug, "orphan (no definition)", ""); continue; }
  if (NEW.has(r.slug)) continue;
  const cards = JSON.parse(r.cards_json); stats.pages++; stats.cards += cards.length;
  const before = Object.values(byProblem).flat().length;
  const want = p.count || (p.slots ? p.slots.length : 8);
  if (cards.length < Math.min(want, 6)) add(p.slug, "thin (under 6 picks)", `${cards.length} picks`);
  const seen = new Map();
  cards.forEach((c, i) => {
    const t = norm(c.title), key = t.split(" ").slice(0, 5).join(" ");
    if (seen.has(key)) add(p.slug, "near-duplicate picks", `"${c.title.slice(0, 50)}" ~ #${seen.get(key)}`); else seen.set(key, i);
    if (!allowed(p, c)) add(p.slug, "fails the page's own exclude rules", c.title.slice(0, 70));
    if (c.price_cents > p.budget_cents * 1.05) add(p.slug, "over the page's budget", `${c.title.slice(0, 45)} $${c.price_cents / 100} > $${p.budget_cents / 100}`);
    if (!c.image) add(p.slug, "no image", c.title.slice(0, 60));
    if (!c.reason) add(p.slug, "no reason text", c.title.slice(0, 60));
    const m = t.match(ODD); if (m && !norm(p.keyword + " " + (p.slots || []).join(" ")).includes(m[1])) add(p.slug, "odd word in title", `[${m[1]}] ${c.title.slice(0, 60)}`);
    if (p.slots) {
      const hit = p.slots.some(s => { const ws = norm(s).split(" ").map(sing).filter(w => w.length > 2); const last = ws[ws.length - 1]; return t.split(" ").map(sing).includes(last) || ws.filter(w => t.includes(w)).length >= Math.min(2, ws.length); });
      if (!hit) add(p.slug, "matches none of the page's slots", c.title.slice(0, 70));
    }
    if (p.team) { const names = [p.team.full, p.team.nick, p.team.city].filter(Boolean).map(norm); if (names.length && !names.some(n => t.includes(n))) add(p.slug, "team page pick without the team's name", c.title.slice(0, 70)); }
  });
  const merch = {}; cards.forEach(c => merch[c.merchant] = (merch[c.merchant] || 0) + 1);
  const top = Object.entries(merch).sort((a, b) => b[1] - a[1])[0];
  if (top && cards.length >= 6 && top[1] / cards.length > 0.6) add(p.slug, "one merchant dominates", `${top[0]} ${top[1]}/${cards.length}`);
  const age = (Date.now() - Date.parse(r.updated_at)) / 864e5; if (age > 21) add(p.slug, "prices not refreshed in 3+ weeks", `${Math.round(age)} days`);
  if (Object.values(byProblem).flat().length > before) stats.flagged_pages++;
}
const built = new Set(rows.map(r => r.slug));
const unbuilt = PAGES.filter(p => !built.has(p.slug)).map(p => p.slug);
let txt = `pages checked ${stats.pages}, picks ${stats.cards}, pages with any flag ${stats.flagged_pages}, defined but unbuilt ${unbuilt.length}\n`;
for (const [k, v] of Object.entries(byProblem).sort((a, b) => b[1].length - a[1].length)) txt += `\n## ${k} (${v.length})\n` + v.join("\n") + "\n";
txt += `\n## unbuilt (${unbuilt.length})\n` + unbuilt.join("\n") + "\n";
writeFileSync(`${dir}/guide-audit.txt`, txt);
console.log(txt.split("\n")[0]); for (const [k, v] of Object.entries(byProblem).sort((a, b) => b[1].length - a[1].length)) console.log(`${v.length}\t${k}`);
