// Makes a Printful mockup of each store's "Personalize it" example and records it in shop-mockups.json.
// Usage (from worker): node scripts/make-store-mockups.mjs <store-slug> [<store-slug> ...]   (log: mockups.log)
// Printful allows about one mockup a minute, so a store's ten cards take ten minutes or so. Safe to re-run:
// cards that already have a mockup are skipped. The Printful token is read from ~/.gd_printful.
import { readFileSync, writeFileSync, appendFileSync } from "fs";
import { homedir } from "os";
import { storeShopShelf, PTYPES, printSize } from "../shop.js";
const token = readFileSync(homedir() + "/.gd_printful", "utf8").trim().replace(/^[A-Z_]+=/, "");
const H = { Authorization: `Bearer ${token}`, "X-PF-Store-Id": "19038070", "content-type": "application/json" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const say = s => { console.log(s); appendFileSync("mockups.log", s + "\n"); };
async function pf(path, opt = {}) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch("https://api.printful.com" + path, { ...opt, headers: H, body: opt.body ? JSON.stringify(opt.body) : undefined });
    if (r.status === 429) { await sleep(62000); continue; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(j.error || j.result || j).slice(0, 200)}`);
    return j.result;
  }
  throw new Error(path + " still rate-limited");
}
const FILE = new URL("../shop-mockups.json", import.meta.url);
const all = JSON.parse(readFileSync(FILE, "utf8"));
const cards = (await (await fetch("https://gift.directory/api/shop/products")).json()).products;
for (const slug of process.argv.slice(2)) {
  const shelf = storeShopShelf(cards, slug);
  if (!shelf) { say(`${slug}: no shelf defined`); continue; }
  all[slug] ||= {};
  for (const sc of shelf.cards) {
    const q = new URL(sc.url).searchParams, id = q.get("p"), card = cards.find(c => String(c.id) === id);
    if (all[slug][id]) { say(`${slug} ${id} ${sc.title}: already has a mockup`); continue; }
    try {
      const d = await pf(`/store/products/${id}`), v = d.sync_variants.find(x => !x.is_ignored) || d.sync_variants[0];
      const P = PTYPES[card.ptype], [w, h] = printSize(card.ptype, v.variant_id);
      const pq = new URLSearchParams(q); pq.delete("p"); pq.set("full", "1");
      const image_url = `https://gift.directory/api/shop/preview/${id}.png?${pq}`;
      const ok = await fetch(image_url); if (!ok.ok) throw new Error(`print file ${ok.status}`);
      const task = await pf(`/mockup-generator/create-task/${v.product.product_id}`, { method: "POST", body: { variant_ids: [v.variant_id], format: "jpg",
        files: (P.placements || [P.placement]).map(placement => ({ placement, image_url, position: { area_width: w, area_height: h, width: w, height: h, top: 0, left: 0 } })) } });
      let res = null;
      for (let i = 0; i < 40 && !res; i++) { await sleep(5000); const t = await pf(`/mockup-generator/task?task_key=${task.task_key}`); if (t.status === "completed") res = t; else if (t.status === "failed") throw new Error("mockup failed " + (t.error || "")); }
      if (!res) throw new Error("mockup timed out");
      const temp = res.mockups[0].mockup_url;
      // Mockup links expire; a copy in the file library has a lasting address.
      let f = await pf("/files", { method: "POST", body: { url: temp, type: "preview", filename: `gd-${slug}-${id}.jpg`, visible: false } });
      for (let i = 0; i < 20 && !(f.preview_url || (f.status === "ok" && f.url)); i++) { await sleep(3000); f = await pf(`/files/${f.id}`); }
      const url = f.preview_url || f.url; if (!url) throw new Error("file copy has no address yet");
      all[slug][id] = url; writeFileSync(FILE, JSON.stringify(all, null, 1) + "\n");
      say(`${slug} ${id} ${sc.title}: ${url}`);
    } catch (e) { say(`${slug} ${id} ${sc.title}: FAILED ${e.message}`); }
    await sleep(20000);
  }
}
say("DONE");
