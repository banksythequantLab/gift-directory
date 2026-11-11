// Builds guide pages through the live build endpoint, one at a time (each is several searches and two model calls).
// Usage (from worker): node scripts/build-guides.mjs [--cards] [--log=<file>] <slug> [<slug> ...]
//   --cards   refresh the picks only and keep the page's written guide text
// The build token is read from ~/.gd_build_token.
import { readFileSync, appendFileSync } from "fs";
import { homedir } from "os";
const token = readFileSync(homedir() + "/.gd_build_token", "utf8").trim().replace(/^[A-Z_]+=/, "");
const args = process.argv.slice(2), cards = args.includes("--cards");
const log = (args.find(a => a.startsWith("--log=")) || "").slice(6) || null;
const slugs = args.filter(a => !a.startsWith("--"));
const say = line => { console.log(line); if (log) appendFileSync(log, line + "\n"); };
for (const slug of slugs) {
  let line;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await fetch(`https://gift.directory/api/seo/build/${slug}${cards ? "?cards=1" : ""}`, { method: "POST", headers: { "x-build-token": token }, signal: AbortSignal.timeout(170000) });
      const j = await r.json().catch(() => ({}));
      line = `${slug}\t${r.status}\t${j.ok ? `ok products=${j.products}` : `FAIL ${j.error || ""}`}\ttry${attempt}`;
      if (j.ok) break;
    } catch (e) { line = `${slug}\tERR ${e.message}\ttry${attempt}`; }
  }
  say(line);
}
say("DONE");
