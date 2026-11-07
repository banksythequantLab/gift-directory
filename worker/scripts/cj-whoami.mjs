// Finds the CJ publisher (company) id and promotional properties for the token in ~/.gd_cj. Prints ids and names only.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
const cfg = Object.fromEntries(readFileSync(`${homedir()}/.gd_cj`, "utf8").split(/\r?\n/).map(l => l.match(/^\s*(CJ_\w+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(m => [m[1], m[2]]));
const tok = cfg.CJ_TOKEN, cid = (cfg.CJ_CID || "").trim();
const hide = s => String(s).split(tok).join("***");
console.log("CID in file looks like a CJ id (digits only):", /^\d{5,9}$/.test(cid), `(${cid.length} chars, digits: ${(cid.match(/\d/g) || []).length})`);
const gql = async (q) => { const r = await fetch("https://accounts.api.cj.com/graphql", { method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" }, body: JSON.stringify({ query: q }) });
  const t = await r.text(); return { status: r.status, body: hide(t).slice(0, 900) }; };
const fields = "totalCount resultList { id publisherId name status isPrimary propertyTypeDetails { type ... on PromotionalPropertyWebsiteDetails { websiteUrl } } }";
console.log("A) without publisherId:", JSON.stringify(await gql(`{ promotionalProperties(limit: 20) { ${fields} } }`)));
if (/^\d+$/.test(cid)) console.log("B) with CID from file:", JSON.stringify(await gql(`{ promotionalProperties(publisherId: ${cid}, limit: 20) { ${fields} } }`)));
