// Refresh the products on the named guides (text stays), three at a time. One line per guide.
// Usage (from worker): node scripts/rebuild.mjs <slug> [<slug> ...]   or   node scripts/rebuild.mjs @file-with-one-slug-per-line
// The build token is read from ~/.gd_build_token (same as op.mjs).
import { readFileSync } from "fs";
import { homedir } from "os";
const token = readFileSync(homedir() + "/.gd_build_token", "utf8").trim().replace(/^[A-Z_]+=/, "");
const H = { "x-build-token": token, "content-type": "application/json" };
const todo = process.argv.slice(2).flatMap(a => a.startsWith("@") ? readFileSync(a.slice(1), "utf8").split(/\s+/) : [a]).filter(s => /^[a-z0-9-]+$/.test(s));
console.log(`${todo.length} guides to do`);
let i = 0, ok = 0, miss = 0;
async function lane() { while (i < todo.length) { const slug = todo[i++];
  try { const r = await fetch(`https://gift.directory/api/seo/build/${slug}?cards=1`, { method: "POST", headers: H, body: "{}", signal: AbortSignal.timeout(150000) });
    const j = await r.json().catch(() => ({})); r.ok && j.ok ? ok++ : miss++; console.log(r.status, slug, j.ok ? j.products : JSON.stringify(j).slice(0, 140)); }
  catch (e) { miss++; console.log("ERR", slug, String(e.message).slice(0, 100)); } } }
await Promise.all([lane(), lane(), lane()]);
console.log(`done: ${ok} rebuilt, ${miss} kept their old products`);
