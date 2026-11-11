// Builds guide pages through the live build endpoint, one at a time (each is several searches and two model calls).
// Usage: node scripts/build-guides.mjs <slug> [<slug> ...]      The build token is read from ~/.gd_build_token.
import { readFileSync } from "fs";
import { homedir } from "os";
const token = readFileSync(homedir() + "/.gd_build_token", "utf8").trim().replace(/^[A-Z_]+=/, "");
for (const slug of process.argv.slice(2)) {
  let line;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await fetch(`https://gift.directory/api/seo/build/${slug}`, { method: "POST", headers: { "x-build-token": token }, signal: AbortSignal.timeout(170000) });
      const j = await r.json().catch(() => ({}));
      line = `${slug}\t${r.status}\t${j.ok ? `ok products=${j.products}` : `FAIL ${j.error || ""}`}\ttry${attempt}`;
      if (j.ok) break;
    } catch (e) { line = `${slug}\tERR ${e.message}\ttry${attempt}`; }
  }
  console.log(line);
}
