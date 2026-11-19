// Write "top picks" for guides. By default only guides that have none; --all rewrites every built guide.
// --skip @file leaves out the slugs listed in that file (one per line). One pass, three at a time.
// Usage (from worker): node scripts/recs-backfill.mjs [--all] [--skip @file] [limit]
// The build token is read from ~/.gd_build_token (same as op.mjs). Progress goes to stdout, one line per guide.
import { readFileSync } from "fs";
import { homedir } from "os";
const token = readFileSync(homedir() + "/.gd_build_token", "utf8").trim().replace(/^[A-Z_]+=/, "");
const H = { "x-build-token": token, "content-type": "application/json" }, BASE = "https://gift.directory";
const args = process.argv.slice(2), all = args.includes("--all"), si = args.indexOf("--skip");
const skip = new Set(si >= 0 && args[si + 1] ? readFileSync(args[si + 1].replace(/^@/, ""), "utf8").split(/\s+/).filter(Boolean) : []);
const limit = Number(args.find(a => /^\d+$/.test(a))) || Infinity;
const todo = (await (await fetch(`${BASE}/api/seo/recs-todo${all ? "?all=1" : ""}`, { headers: H })).json()).slugs.filter(s => !skip.has(s)).slice(0, limit);
console.log(`${todo.length} guides to do`);
let ok = 0, empty = 0, bad = 0, i = 0;
async function one(slug) {
  try {
    const r = await fetch(`${BASE}/api/seo/recs/${slug}`, { method: "POST", headers: H, body: "{}", signal: AbortSignal.timeout(120000) });
    const j = await r.json().catch(() => ({}));
    const n = Array.isArray(j.picks) ? j.picks.length : 0;
    if (r.ok && n) ok++; else if (r.ok) empty++; else bad++;
    console.log(`${r.status} ${slug} ${n || JSON.stringify(j).slice(0, 120)}`);
  } catch (e) { bad++; console.log(`ERR ${slug} ${String(e.message).slice(0, 100)}`); }
}
async function lane() { while (i < todo.length) await one(todo[i++]); }
await Promise.all([lane(), lane(), lane()]);
console.log(`done: ${ok} written, ${empty} with no usable picks (they keep what they had), ${bad} failed`);
