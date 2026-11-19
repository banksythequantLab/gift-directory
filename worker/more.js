// A second product for each kind of gift on a guide: the runner-up from the same search that found the first.
// A page whose title promises a number ("10 best ...") keeps exactly that number.
import { mergeCards } from "./finder.js";

export const fixedCount = p => /^\d+\s/.test(String((p && p.keyword) || "")) || /^\d+-best-/.test(String((p && p.slug) || ""));
const titleKey = c => String(c.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// `cands[i]`: the candidates for slot i, best first, already filtered for the page. `main`: the products chosen so far.
// One runner-up per slot (`per`), never a product or a title already on the page, and it needs a price and a picture.
export function pickAlternates(p, cands, main, per = 1) {
  if (!p || fixedCount(p)) return [];
  const ids = new Set((main || []).map(c => c.product_id)), titles = new Set((main || []).map(titleKey)), out = [];
  (cands || []).forEach((list, i) => {
    let n = 0;
    for (const c of list || []) {
      if (n >= per) break;
      // Same title under two ids is one product from two sellers: it counts once.
      if (!c || ids.has(c.product_id) || titles.has(titleKey(c)) || !(c.price_cents > 0) || !c.image) continue;
      // The shared junk filter gets a say too (bulk packs, replacement parts and the like).
      if (!mergeCards([[c]]).length) continue;
      ids.add(c.product_id); titles.add(titleKey(c)); n++;
      const group = p.slotGroups ? p.slotGroups[i] : undefined;
      const { reason, ...bare } = c;   // a reason written for another page or search doesn't follow the product here
      out.push({ ...bare, alt: true, ...(group ? { group } : {}) });
    }
  });
  return out;
}
