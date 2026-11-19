// CJ programs worth applying to for a gift site: asks the live worker for advertisers not yet joined across a set of
// gift keywords, keeps active English-language ones, and ranks them by CJ's network rank and three-month earnings per
// hundred clicks. Usage (from worker): node scripts/cj-shortlist.mjs [out.txt]
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
const token = readFileSync(homedir() + "/.gd_build_token", "utf8").trim().replace(/^[A-Z_]+=/, "");
const get = async (q, joined = false, page = 1) => (await fetch(`https://gift.directory/api/seo/cj-advertisers?q=${encodeURIComponent(q)}${joined ? "&joined=1" : ""}&page=${page}`, { headers: { "x-build-token": token }, signal: AbortSignal.timeout(60000) })).json();
const KEYS = ["gifts", "personalized gifts", "flowers", "gift baskets", "gourmet food", "chocolate", "toys", "jewelry", "candles", "wine gifts", "home decor", "baby gifts", "pet gifts", "stationery", "experiences", "subscription box"];
const all = new Map(), lines = [];
for (const k of KEYS) { const r = await get(k); if (r.error) { lines.push(`${k}: ${r.error}`); continue; }
  for (const a of r.advertisers) if (!all.has(a.id)) all.set(a.id, { ...a, key: k }); lines.push(`${k}: ${r.total} matched, ${r.advertisers.length} read`); }
const joined = await get("", true);
const us = [...all.values()].filter(a => a.status === "Active" && a.language === "en" && !/\.(co\.uk|de|fr|it|es|nl|com\.au|ca|se|dk|pl|ie|at|ch|be|in|jp)(\/|$)/i.test(a.url));
us.sort((a, b) => (Number(b.rank) || 0) - (Number(a.rank) || 0) || (Number(b.epc90) || 0) - (Number(a.epc90) || 0));
lines.push("", `joined now: ${joined.total ?? "?"} (${(joined.advertisers || []).map(a => a.name).join("; ").slice(0, 600)})`, `not joined, active, English, not obviously non-US: ${us.length}`, "", "rank | 3-mo EPC | 7-day EPC | commission | name | category | site | id");
for (const a of us.slice(0, 70)) lines.push(`${a.rank || "-"} | $${a.epc90 || "-"} | $${a.epc7 || "-"} | ${a.commission || "-"} | ${a.name} | ${a.category} | ${a.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} | ${a.id}`);
const text = lines.join("\n");
if (process.argv[2]) writeFileSync(process.argv[2], text); else console.log(text);
