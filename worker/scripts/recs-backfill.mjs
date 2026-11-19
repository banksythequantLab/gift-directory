// Write "top picks" for every guide that has none yet. One pass over the to-do list, three at a time.
// Usage (from worker): node scripts/recs-backfill.mjs [limit]
// The build token is read from ~/.gd_build_token (same as op.mjs). Progress goes to stdout, one line per guide.
import { readFileSync } from "fs";
import { homedir } from "os";
const token = readFileSync(homedir() + "/.gd_build_token", "utf8").trim().replace(/^[A-Z_]+=/, "");
const H = { "x-build-token": token, "content-type": "application/json" }, BASE = "https://gift.directory";
const limit = Number(process.argv[2]) || Infinity;
const todo = (await (await fetch(`${BASE}/api/seo/recs-todo`, { headers: H })).json()).slugs.slice(0, limit);
console.log(`${todo.length} guides to do`);
let ok = 0, empty = 0, bad = 0, i = 0;
async function one(slug) {
  try {
    const r = await fetch(`${BASE}/api/seo/recs/${slug}`, { method: "POST", headers: H, body: "{}", signal: AbortSignal.timeout(120000) });
    const j = await r.json().catch(() => ({}));
    const n = (j.recs && j.recs.picks ? j.recs.picks.length : j.picks ?? j.n ?? 0);
    if (r.ok && n) ok++; else if (r.ok) empty++; else bad++;
    console.log(`${r.status} ${slug} ${n || JSON.stringify(j).slice(0, 120)}`);
  } catch (e) { bad++; console.log(`ERR ${slug} ${String(e.message).slice(0, 100)}`); }
}
async function lane() { while (i < todo.length) await one(todo[i++]); }
await Promise.all([lane(), lane(), lane()]);
console.log(`done: ${ok} written, ${empty} with no usable picks, ${bad} failed`);
