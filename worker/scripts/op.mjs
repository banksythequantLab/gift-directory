// Operator call to a build-token endpoint on the live worker.
// Usage (from worker): node scripts/op.mjs <path> [json-body | @file.json] [--get]
// The build token is read from ~/.gd_build_token (same as build-guides.mjs).
import { readFileSync } from "fs";
import { homedir } from "os";
const token = readFileSync(homedir() + "/.gd_build_token", "utf8").trim().replace(/^[A-Z_]+=/, "");
const args = process.argv.slice(2), get = args.includes("--get"), [path, raw] = args.filter(a => a !== "--get");
const body = raw ? (raw.startsWith("@") ? readFileSync(raw.slice(1), "utf8") : raw) : "{}";
const r = await fetch(`https://gift.directory${path}`, { method: get ? "GET" : "POST", headers: { "x-build-token": token, "content-type": "application/json" }, ...(get ? {} : { body }), signal: AbortSignal.timeout(170000) });
const text = await r.text();
console.log(r.status);
try { console.log(JSON.stringify(JSON.parse(text), null, 1)); } catch { console.log(text.slice(0, 4000)); }
