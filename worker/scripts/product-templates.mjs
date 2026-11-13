// Reads Printful's blank product photo and print-area position for each personalized tee and hoodie (the mug template is a layout diagram, so mugs keep the drawn preview), and
// writes them to shop-stages.json so the shop can show the buyer's text on a photo of the product.
// Usage (from worker): node scripts/product-templates.mjs     The Printful token is read from ~/.gd_printful.
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
const token = readFileSync(homedir() + "/.gd_printful", "utf8").trim().replace(/^[A-Z_]+=/, "");
const H = { Authorization: `Bearer ${token}`, "X-PF-Store-Id": "19038070" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function pf(path) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch("https://api.printful.com" + path, { headers: H });
    if (r.status === 429) { await sleep(62000); continue; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(j.error || j.result || j).slice(0, 200)}`);
    return j.result;
  }
  throw new Error(path + " still rate-limited");
}
const cards = (await (await fetch("https://gift.directory/api/shop/products")).json()).products;
const out = {}, byCatalog = {};
for (const c of cards.filter(c => c.kind === "tpl" && ["tee", "hoodie"].includes(c.ptype))) {
  try {
    const d = await pf(`/store/products/${c.id}`), v = d.sync_variants.find(x => !x.is_ignored) || d.sync_variants[0];
    const pid = v.product.product_id;
    const t = byCatalog[pid] ||= await pf(`/mockup-generator/templates/${pid}`);
    const m = (t.variant_mapping || []).find(x => x.variant_id === v.variant_id) || (t.variant_mapping || [])[0];
    const want = (m && m.templates || []).find(x => /front|default/i.test(x.placement)) || (m && m.templates || [])[0];
    const tpl = want && (t.templates || []).find(x => x.template_id === want.template_id);
    if (!tpl) { console.log(c.id, c.title, "no template"); continue; }
    out[c.id] = { image: tpl.image_url, bg: tpl.background_url || null, bgColor: tpl.background_color || null, w: tpl.template_width, h: tpl.template_height,
      left: tpl.print_area_left, top: tpl.print_area_top, pw: tpl.print_area_width, ph: tpl.print_area_height, placement: want.placement, overlay: !!tpl.is_template_on_front };
    console.log(c.id, c.title, c.ptype, JSON.stringify(out[c.id]).slice(0, 330));
  } catch (e) { console.log(c.id, c.title, "failed:", String(e.message || e).slice(0, 200)); }
}
writeFileSync(new URL("../shop-stages.json", import.meta.url), JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, "products written");
