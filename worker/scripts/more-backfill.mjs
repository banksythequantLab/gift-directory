// Refresh every guide's products so each kind of gift gets its runner-up (see more.js). One pass, three at a time.
// Pages whose title promises a number ("10 best ...") are skipped. A build that comes up short leaves the page as it was.
// Usage (from worker): node scripts/more-backfill.mjs [limit]
// The build token is read from ~/.gd_build_token (same as op.mjs). One line per guide on stdout.
import { readFileSync } from "fs";
import { homedir } from "os";
const token = readFileSync(homedir() + "/.gd_build_token", "utf8").trim().replace(/^[A-Z_]+=/, "");
const H = { "x-build-token": token, "content-type": "application/json" }, BASE = "https://gift.directory";
const limit = Number(process.argv[2]) || Infinity;
const all = (await (await fetch(`${BASE}/api/seo/recs-todo?all=1`, { headers: H })).json()).slugs;
const todo = all.filter(s => !/^\d+-best-/.test(s)).slice(0, limit);
console.log(`${todo.length} guides to do`);
let ok = 0, short = 0, bad = 0, items = 0, i = 0, streak = 0;
async function one(slug) {
  try {
    const r = await fetch(`${BASE}/api/seo/build/${slug}?cards=1`, { method: "POST", headers: H, body: "{}", signal: AbortSignal.timeout(150000) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok) { ok++; items += j.products; streak = 0; console.log(`200 ${slug} ${j.products}`); }
    else { r.ok ? short++ : bad++; streak++; console.log(`${r.status} ${slug} ${JSON.stringify(j).slice(0, 140)}`); }
  } catch (e) { bad++; streak++; console.log(`ERR ${slug} ${String(e.message).slice(0, 100)}`); }
}
// Fifteen misses in a row means something upstream is down or rate-limiting: stop instead of hammering it.
async function lane() { while (i < todo.length && streak < 15) await one(todo[i++]); }
await Promise.all([lane(), lane(), lane()]);
console.log(`${streak >= 15 ? "STOPPED EARLY" : "done"}: ${ok} rebuilt (${items} products), ${short} came up short and kept their old products, ${bad} failed, ${todo.length - i} not reached`);
