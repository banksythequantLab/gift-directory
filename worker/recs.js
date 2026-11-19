// Top picks on a gift guide: which of the page's products to choose, for whom, and when to choose one over another.
// The model only chooses among the products already on the page and may use only what their listings say. The label
// that carries a number ("Best under $50") is worked out here from the real price, never written by the model, and a
// pick that does not hold up (wrong id, a "budget" pick from the expensive half, a claim of testing or reviews) is dropped.
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = c => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });

export const RECS_SYSTEM =
  "You are a careful gift editor. From the real products listed for one gift-guide page, choose the standout picks and explain each " +
  "choice the way a knowledgeable friend would. Each reason is two sentences that together say what kind of person or situation the gift suits and when to choose it rather than " +
  "the other things on the page (for example, when they already own the basics, when you do not know their size, when it is from a group). " +
  "Vary how the reasons begin: no two may open with the same words, and none may open with 'This gift', 'This pick', 'This', 'Choose' or 'Ideal'. " +
  "The skip sentence must fit this recipient as described (a fan is not a player; someone who loves their dog is not a breeder). Write about the person and the giving, not a list of features. " +
  "Use ONLY what each product's title, brand, price and listed features say. Never invent specifications, materials, sizes, " +
  "ratings, reviews, awards, popularity or any claim that anyone tested, tried or owns the product, and never promise results " +
  "(no 'ensures', 'guarantees'). No hype words (perfect, amazing, must-have, ultimate, stunning). Do not state prices or discounts. " +
  "Plain sentences, no exclamation marks. " +
  'Answer only JSON: {"overall":{"id":"...","why":"2 sentences, 30 to 55 words"},' +
  '"budget":{"id":"...","why":"..."},"splurge":{"id":"...","why":"..."},' +
  '"for":{"id":"...","who":"3 to 6 lowercase words naming one narrower kind of person within this page\'s audience, starting with the word the","why":"..."},' +
  '"skip":"one sentence under 30 words about a general kind of gift that is NOT on this page and is usually a poor choice for this recipient, and why. Never mention or criticize a product from the list."}. ' +
  "Every id must be different and copied exactly from the list. budget must be one of the cheaper products and splurge one of the more " +
  "expensive ones. Leave out budget or splurge if the prices are all close together.";
// Six hundred guides written to one pattern read as one template, so each page is asked for one of several shapes,
// fixed by its slug (the same page always gets the same shape).
const STYLES = [
  "Begin each reason with the person (\"A fan who...\", \"Someone who...\"), then say what tips the choice toward this product.",
  "Begin each reason with the giver's situation (\"When you don't know their size, ...\", \"If this is from a group, ...\"), then say who it fits.",
  "Begin each reason by naming the product by its plain kind (\"The hoodie is for...\", \"The mug works when...\"), then say when to pick it.",
  "Write each reason as direct advice to the giver (\"Go with the blanket if...\", \"Pick the jersey for...\"), then give the reason in a second sentence.",
  "Begin each reason with what sets the product apart from the other kinds of gift on the page, then say who that suits.",
  "Give one sentence about the person and one short sentence naming the kind of gift on the page it beats for them, and why.",
];
export function recsStyle(slug) {
  let h = 0; for (const ch of String(slug || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return "\n\nShape for this page: " + STYLES[h % STYLES.length];
}
export function recsPrompt(p, cards) {
  return `Page: ${p.keyword}\nWho it's for: ${p.recipient}\nOccasion: ${p.occasion}\n\nProducts:\n` + cards.map(c =>
    `${c.product_id} | ${c.title}${c.brand ? " by " + c.brand : ""} | $${(c.price_cents / 100).toFixed(2)} at ${c.merchant}` +
    ((c.features || []).length ? ` | ${c.features.slice(0, 4).join("; ")}` : "") + (c.group ? ` | section: ${c.group}` : "")).join("\n");
}
// Things a model must not claim, because nobody did them.
const UNTRUE = /\b(we|i|our team|our testers?|testers?|reviewers?|customers?|buyers?|users?|owners?)\b[^.]{0,40}\b(tested|tried|tests?|reviews?|rated|rave|love[ds]?|swear|report)|\b\d(\.\d)?[- ]stars?\b|\bbest[- ]sell(er|ing)\b|\baward[- ]winning\b|\btop[- ]rated\b|\bhighly rated\b|\$\s?\d/i;
const HYPE = /\b(perfect|amazing|must-have|ultimate|stunning|incredible|game[- ]changer|ensur(e|es|ing)|guarantee[sd]?)\b/i;
// "What to skip" is about a kind of gift, never about one of the page's own products.
const POINTS_AT_PAGE = /\b(this|these|that|those) (model|one|product|item|set|kit|bag|pair|option|pick)s?\b|\bon (this|the) (page|list)\b|\b(listed|shown) (here|above)\b|\bthe one above\b/i;
const STEPS = [10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500];
export const underLabel = cents => { const s = STEPS.find(x => x * 100 >= cents); return s ? `Best under $${s}` : "Best value"; };
const why = s => { s = String(s ?? "").replace(/\s+/g, " ").trim(); return s.length >= 40 && s.length <= 420 && !UNTRUE.test(s) && !HYPE.test(s) && !/!/.test(s) ? s : null; };

export function parseRecs(j, cards) {
  if (!j || typeof j !== "object" || !Array.isArray(cards) || cards.length < 4) return null;
  const byId = new Map(cards.map(c => [String(c.product_id), c])), used = new Set(), picks = [];
  const sorted = [...cards].sort((a, b) => a.price_cents - b.price_cents), half = Math.ceil(cards.length / 2);
  const cheap = new Set(sorted.slice(0, half).map(c => c.product_id)), dear = new Set(sorted.slice(-half).map(c => c.product_id));
  const take = (role, label, test = () => true) => {
    const r = j[role], c = r && byId.get(String(r.id)), w = r && why(r.why);
    if (!c || !w || used.has(c.product_id) || !test(c, r)) return null;
    const l = typeof label === "function" ? label(c, r) : label; if (!l) return null;
    used.add(c.product_id); picks.push({ id: c.product_id, role, label: l, why: w }); return c;
  };
  if (!take("overall", "Best overall")) return null;
  const budget = take("budget", c => underLabel(c.price_cents), c => cheap.has(c.product_id));
  take("splurge", "Worth the splurge", c => dear.has(c.product_id) && (!budget || c.price_cents >= budget.price_cents * 1.5));
  take("for", (c, r) => { const who = String(r.who ?? "").replace(/\s+/g, " ").trim().toLowerCase().replace(/[.!]+$/, "");
    return /^[a-z][a-z0-9 ,'’&-]{5,47}$/.test(who) && who.split(" ").length <= 8 && !HYPE.test(who) ? "Best for " + who : null; });
  if (picks.length < 2) return null;
  const skip = String(j.skip ?? "").replace(/\s+/g, " ").trim();
  // It must not name a product on the page either: two or more words of any title (beyond small words) is taken as naming it.
  const names = s => cards.some(c => { const w = String(c.title || "").toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length > 3); return w.length && w.filter(x => new RegExp("\\b" + x + "\\b", "i").test(s)).length >= Math.min(2, w.length); });
  return { picks, ...(skip.length >= 30 && skip.length <= 240 && !UNTRUE.test(skip) && !HYPE.test(skip) && !POINTS_AT_PAGE.test(skip) && !names(skip) && !/!/.test(skip) ? { skip } : {}) };
}
// Only picks whose product is still on the page (the products refresh; the saved picks may be older).
export function liveRecs(recs, cards) {
  if (!recs || !Array.isArray(recs.picks)) return null;
  const byId = new Map((cards || []).map(c => [String(c.product_id), c]));
  const picks = recs.picks.map(p => ({ ...p, card: byId.get(String(p.id)) })).filter(p => p.card && p.label && p.why)
    .map(p => p.role === "budget" ? { ...p, label: underLabel(p.card.price_cents) } : p);      // the price may have moved since
  return picks.length >= 2 && picks[0].role === "overall" ? { picks, skip: recs.skip || "" } : null;
}

export const RECS_CSS = `.tp{display:grid;gap:12px;margin:12px 0 4px}.tp article{display:grid;grid-template-columns:112px 1fr;gap:14px;align-items:start;background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px}
.tp img{width:112px;height:112px;object-fit:contain;border:1px solid var(--line);border-radius:10px;background:#fff}.tp .lab{font-size:.74rem;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--accent)}
.tp h3{margin:2px 0 4px;font-size:1.05rem}.tp p{margin:0 0 8px}.how{border-left:4px solid var(--gold);background:#fff;padding:12px 16px;margin:22px 0;border-radius:0 12px 12px 0}.how p{margin:6px 0}
@media(max-width:520px){.tp article{grid-template-columns:72px 1fr}.tp img{width:72px;height:72px}}`;
// `badge`: the sale badge for a card (passed in so this file needs nothing from the pages that use it).
export function renderRecs(live, badge = () => "") {
  if (!live) return "";
  return `<h2 style="font-family:Georgia,serif">Top picks</h2><div class="tp">${live.picks.map(({ label, why, card: c }) => `<article>${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.title)}" loading="lazy" width="112" height="112">` : "<span></span>"}
<div><div class="lab">${esc(label)}</div><h3>${esc(c.title)}</h3><p>${esc(why)}</p>
<div><b>${money(c.price_cents)}</b>${c.was_cents && c.was_cents > c.price_cents ? ` <span class="was">${money(c.was_cents)}</span>` : ""}${badge(c)} · <a href="${esc(c.url)}" target="_blank" rel="noopener sponsored nofollow">View at ${esc(c.merchant)}</a></div></div></article>`).join("")}</div>
${live.skip ? `<p class="muted" style="max-width:760px"><b>What to skip:</b> ${esc(live.skip)}</p>` : ""}`;
}
// Said on every guide, in the same words, because it is how every guide is made.
export function howWeChose(p, n, updated) {
  return `<aside class="how"><b style="font-family:Georgia,serif;font-size:1.05rem">How we chose</b>
<p>These ${n} gifts were in stock at the retailers shown when this page was last updated (${esc(updated)}). We searched retailer catalogs for ${esc(p.recipient)}, kept to a budget of about $${Math.round(p.budget_cents / 100)}, removed things that are not really gifts (bulk packs, refills, office supplies), and kept a spread of different kinds of gift so the page is not eight versions of one thing.</p>
<p>An AI model sorted what was left and wrote the reason for each pick from the product's own listing. We have not handled or tested these products, and we do not show ratings because we have none of our own. Prices and stock change; the retailer's page has the current ones. We may earn a commission when you buy through a link, at no extra cost to you.</p></aside>`;
}
