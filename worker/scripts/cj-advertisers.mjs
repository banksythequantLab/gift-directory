// Ranks CJ advertisers for gift.directory: which programs to apply to (not joined) and which we already have (joined).
// Reads CJ_TOKEN / CJ_CID from C:\Users\solti\.gd_cj (never printed). Writes docs/cj-advertisers.csv (no secrets).
// Usage: node scripts/cj-advertisers.mjs [joined|notjoined]
// API: https://developers.cj.com/docs/rest-apis/advertiser-lookup (25 calls/minute, 100 records/page)
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

const cfg = Object.fromEntries(readFileSync(`${homedir()}/.gd_cj`, "utf8").split(/\r?\n/).map(l => l.match(/^\s*(CJ_\w+)\s*=\s*(.+?)\s*$/)).filter(Boolean).map(m => [m[1], m[2]]));
if (!cfg.CJ_TOKEN || !cfg.CJ_CID) { console.error("missing CJ_TOKEN or CJ_CID in ~/.gd_cj"); process.exit(1); }
const which = process.argv[2] === "joined" ? "joined" : "notjoined";
// Gift-shop words; each search is one API call (well under the 25/minute limit with the pause below).
const KEYWORDS = ["gift", "gifts", "jewelry", "personalized", "home decor", "kitchen", "toys", "games", "books", "apparel",
  "outdoor", "sports", "fan shop", "pets", "beauty", "spa", "candles", "flowers", "tech", "gadgets", "art", "crafts", "watches", "bags", "baby"];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : ""; };

const seen = new Map();
for (const kw of KEYWORDS) {
  for (let page = 1; page <= 2; page++) {
    const u = `https://advertiser-lookup.api.cj.com/v2/advertiser-lookup?requestor-cid=${encodeURIComponent(cfg.CJ_CID)}&advertiser-ids=${which}` +
      `&keywords=${encodeURIComponent(kw)}&records-per-page=100&page-number=${page}`;
    const r = await fetch(u, { headers: { authorization: `Bearer ${cfg.CJ_TOKEN}` } });
    if (!r.ok) { console.error(`lookup "${kw}" page ${page}: HTTP ${r.status}`); break; }
    const xml = await r.text(), ads = xml.split("<advertiser>").slice(1);
    for (const a of ads) {
      const id = tag(a, "advertiser-id"); if (!id || seen.has(id)) continue;
      if (!/active/i.test(tag(a, "account-status")) || !/^en/i.test(tag(a, "language") || "en")) continue;
      const sale = a.split("<action>").slice(1).map(x => ({ name: tag(x, "name"), type: tag(x, "type"), comm: tag(tag(x, "commission") ? x : "", "default") || tag(x, "commission") }))
        .find(x => /sale/i.test(x.type + " " + x.name));
      seen.set(id, { id, name: tag(a, "advertiser-name"), url: tag(a, "program-url"), category: [tag(a, "parent"), tag(a, "child")].filter(Boolean).join(" > "),
        epc3m: Number(tag(a, "three-month-epc")) || 0, epc7d: Number(tag(a, "seven-day-epc")) || 0, rank: Number(tag(a, "network-rank")) || 0,
        sale: sale ? sale.comm.replace(/\s+/g, " ") : "", status: tag(a, "relationship-status"), matched: kw });
    }
    if (ads.length < 100) break;
    await sleep(2600);
  }
  await sleep(2600);
}
const rows = [...seen.values()].sort((a, b) => b.epc3m - a.epc3m || b.rank - a.rank);
const csv = ["advertiser_id,name,program_url,category,three_month_epc,seven_day_epc,network_rank,sale_commission,relationship,matched_keyword",
  ...rows.map(r => [r.id, r.name, r.url, r.category, r.epc3m, r.epc7d, r.rank, r.sale, r.status, r.matched].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
const out = new URL(`../../docs/cj-advertisers-${which}.csv`, import.meta.url);
writeFileSync(out, csv);
console.log(`${rows.length} ${which} advertisers -> ${out.pathname}`);
for (const r of rows.slice(0, 40)) console.log(`${String(r.epc3m.toFixed(2)).padStart(7)}  ${r.sale.padEnd(14).slice(0, 14)}  ${r.name.slice(0, 40).padEnd(40)}  ${r.category.slice(0, 40)}`);
