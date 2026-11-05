// The gift finder: a brief in, a short list of real, in-stock gifts out.
//
//   1. the brief is checked for a judge or court employee (gift rules, not a shopping problem)
//   2. the AI turns the brief into a few product searches
//   3. Channel3 runs them: real products, real retailers, live price and stock
//   4. the AI picks the best few FROM THOSE RESULTS ONLY and says why
// The model never invents a product, a price or a link: anything it names that Channel3 did not
// return is dropped, and if the model fails the shopper still gets the in-budget results.

const C3 = "https://api.trychannel3.com";
const clip = (s, n) => String(s ?? "").slice(0, n);

// ---------- 1. judges and court staff ----------
const COURT = /\b(judge|justice|magistrate|surrogate|hearing officer|law clerk|court clerk|clerk of (?:the )?court|chambers|court (?:officer|attorney|employee|staff)|referee)\b/i;
export const COURT_NOTE =
  "Judges and court staff are restricted by judicial-conduct rules from accepting gifts, especially from " +
  "lawyers and parties who appear before them. In New York see the Rules Governing Judicial Conduct, " +
  "22 NYCRR Part 100. A handwritten note is always allowed; check the rules before sending anything more.";
export function courtCheck(brief) {
  const text = [brief.recipient, brief.relationship, brief.occasion, brief.notes].filter(Boolean).join(" ");
  const m = text.match(COURT);
  return m ? { flagged: true, matched: m[0], note: COURT_NOTE } : { flagged: false };
}

// ---------- the brief ----------
export function validateBrief(b) {
  if (!b || typeof b !== "object") return { error: "missing brief" };
  const brief = {
    recipient: clip(String(b.recipient || "").trim(), 120),        // "my litigator", "new associate"
    occasion: clip(String(b.occasion || "").trim(), 80),           // "won my case", "made partner", "wedding"
    relationship: clip(String(b.relationship || "").trim(), 80),   // "client", "colleague", "the whole office"
    notes: clip(String(b.notes || "").trim(), 400),                // likes, dislikes, practice area
    budget_cents: Math.round(Number(b.budget_cents)),
  };
  if (!brief.recipient && !brief.occasion) return { error: "Tell us who it's for or what it's for." };
  if (!(brief.budget_cents >= 1000 && brief.budget_cents <= 500000)) return { error: "Budget must be between $10 and $5,000." };
  return { brief };
}

// ---------- 2. searches ----------
export const PLAN_SYSTEM =
  "You are a gift concierge for lawyers, law firms and the people who thank them. Turn the brief into " +
  "3 to 5 short product searches for an online catalog of new retail products. Prefer specific, giftable, " +
  "well-made items (desk, pens, leather goods, books, framed art, bar and coffee, experiences in a box). " +
  "Avoid novelty gag gifts unless asked. Never search for work supplies, uniforms, ID or badge accessories, " +
  "consumables or anything usually sold in bulk. Answer only JSON: " +
  '{"searches":[{"query":"2-6 words","why":"one short phrase"}]}';
export function planPrompt(brief) {
  return [
    `Recipient: ${brief.recipient || "not given"}`, `Occasion: ${brief.occasion || "not given"}`,
    `Relationship: ${brief.relationship || "not given"}`, `Budget: up to $${(brief.budget_cents / 100).toFixed(0)}`,
    brief.notes ? `Notes: ${brief.notes}` : "",
  ].filter(Boolean).join("\n");
}
export function parsePlan(j) {
  const list = (j && Array.isArray(j.searches) ? j.searches : [])
    .map(s => ({ query: clip(String((s && s.query) || "").trim(), 60), why: clip((s && s.why) || "", 80) }))
    .filter(s => s.query.length >= 2);
  const seen = new Set();
  return list.filter(s => { const k = s.query.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 5);
}
// When the model gives nothing usable, still search something sensible.
export function fallbackPlan(brief) {
  const base = /wedding/i.test(brief.occasion) ? ["wedding gift set", "engraved keepsake", "luxury serveware"]
    : ["executive desk accessory", "luxury fountain pen", "leather portfolio"];
  return base.map(q => ({ query: q, why: "a safe, well-made default" }));
}

// ---------- 3. Channel3 ----------
export function searchBody(query, brief) {
  return {
    query, limit: 12,
    config: { country: "US", currency: "USD", language: "en" },
    // A typed search (min_cents given) sets its own floor; AI-planned searches start at a fifth of the budget.
    filters: { price: { min_price: brief.min_cents != null ? brief.min_cents / 100 : Math.max(5, Math.round(brief.budget_cents * 0.2) / 100), max_price: brief.budget_cents / 100 },
               availability: ["InStock"] },
  };
}
export async function channel3Search(env, query, brief, { fetchImpl = fetch } = {}) {
  const r = await fetchImpl(`${C3}/v1/search`, {
    method: "POST", headers: { "x-api-key": env.CHANNEL3_API_KEY, "content-type": "application/json" },
    body: JSON.stringify(searchBody(query, brief)),
  });
  if (!r.ok) throw new Error(`channel3 ${r.status}`);
  const j = await r.json();
  return (j && j.products) || [];
}

// A Channel3 product reduced to one buyable card: the cheapest new, in-stock offer within budget.
export function toCard(p, budgetCents) {
  const offers = (p.offers || []).filter(o => o && o.availability === "InStock" && o.url && /^https:\/\//.test(o.url) &&
    o.price && Number.isFinite(o.price.price) && (o.condition == null || o.condition === "new"));
  const priced = offers.map(o => ({ ...o, cents: Math.round(o.price.price * 100) })).filter(o => o.cents > 0 && o.cents <= budgetCents);
  if (!priced.length) return null;
  priced.sort((a, b) => a.cents - b.cents);
  const best = priced[0];
  const img = (p.images || []).find(i => i.is_main_image) || (p.images || [])[0] || {};
  return {
    product_id: p.id, title: clip(p.title, 200), brand: (p.brands && p.brands[0] && p.brands[0].name) || null,
    image: img.cleaned_url || img.url || null, price_cents: best.cents,
    was_cents: best.price.compare_at_price ? Math.round(best.price.compare_at_price * 100) : null,
    merchant: best.domain, url: best.url, offers: priced.length,
    features: (p.key_features || []).slice(0, 4).map(f => clip(f, 120)),
  };
}
// Things that are never a gift, whatever a search returns: bulk and multi-packs (a $3 badge reel only
// clears a gift price floor as a pack of 20), craft blanks, print jobs, handout kits, ID accessories.
// ("11 Piece Set" is a gift set; piece counts are not a sign of bulk, pack/set counts are.)
const JUNK = /\b(pack of \d+|\d+[- ]?(?:pack|pk|count|ct|sets)\b|bulk|case of|wholesale|blanks?\b|postcards?|custom printed|handout|badge reel|lanyard|id holder|refill|replacement|toner|cartridge)\b/i;
export function isJunk(c) { return JUNK.test(c.title || ""); }

// Same product from two stores or two searches, under different ids: one card.
const titleKey = c => String(c.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function mergeCards(lists) {
  const byId = new Map(), byTitle = new Set();
  for (const c of lists.flat()) {
    if (!c || byId.has(c.product_id) || isJunk(c)) continue;
    const k = titleKey(c); if (byTitle.has(k)) continue;
    byTitle.add(k); byId.set(c.product_id, c);
  }
  return [...byId.values()];
}

// ---------- 4. picks ----------
export const PICK_SYSTEM =
  "You choose gifts from a list of real products. Pick the 4 to 6 best for the brief, ONLY from the list, " +
  "by their id. Spread the picks across kinds of gift. For each, write one warm, specific sentence a shopper " +
  "would read. Then list the ids of the OTHER products that are still a good, giftable choice for this brief " +
  "in \"also\"; leave out anything that is not a real gift (office or work supplies, multi-packs, consumables, " +
  "craft materials, generic items with no gift appeal, sports-team or fandom items the brief didn't ask for). " +
  'Answer only JSON: {"picks":[{"id":"...","reason":"..."}],"also":["id", ...]}';
// The front page has no brief: the model only sorts gifts from non-gifts.
export const GATE_SYSTEM =
  "You curate a gift store. From the list of products, return the ids of those a thoughtful person would be " +
  "glad to give or receive as a gift. Drop office or work supplies, ID and badge accessories, multi-packs and bulk " +
  "items, craft blanks, printing services, generic items with no gift appeal, and anything tied to a particular " +
  "sports team, school or fandom (nobody asked for one). Answer only JSON: {\"keep\":[\"id\", ...]}";
export function parseIds(j, key, cards) {
  const ids = new Set((j && Array.isArray(j[key]) ? j[key] : []).map(String));
  return cards.filter(c => ids.has(c.product_id));
}
export function pickPrompt(brief, cards) {
  return planPrompt(brief) + "\n\nProducts:\n" + cards.slice(0, 40).map(c =>
    `${c.product_id} | ${c.title}${c.brand ? " by " + c.brand : ""} | $${(c.price_cents / 100).toFixed(2)} at ${c.merchant}` +
    (c.features.length ? ` | ${c.features.slice(0, 2).join("; ")}` : "")).join("\n");
}
export function parsePicks(j, cards) {
  const byId = new Map(cards.map(c => [c.product_id, c]));
  const out = [], seen = new Set();
  for (const p of (j && Array.isArray(j.picks) ? j.picks : [])) {
    const c = p && byId.get(String(p.id));
    if (!c || seen.has(c.product_id)) continue;            // invented or repeated: dropped
    seen.add(c.product_id);
    out.push({ ...c, reason: clip(p.reason || "", 240) || null });
    if (out.length === 6) break;
  }
  return out;
}
// No model, or nothing usable from it: the best-priced spread of what Channel3 returned.
export function fallbackPicks(cards, n = 6) {
  return [...cards].sort((a, b) => b.price_cents - a.price_cents).slice(0, n).map(c => ({ ...c, reason: null }));
}

// The whole run. `ai(system, user)` returns parsed JSON or throws; `search(query)` returns products.
export async function findGifts(brief, { ai, search, planSystem = PLAN_SYSTEM }) {
  const court = courtCheck(brief);
  if (court.flagged) return { court, plan: [], picks: [] };
  let plan = [];
  try { plan = parsePlan(await ai(planSystem, planPrompt(brief))); } catch { plan = []; }
  if (!plan.length) plan = fallbackPlan(brief);
  const results = await Promise.all(plan.map(s => search(s.query).then(ps => ps.map(p => toCard(p, brief.budget_cents))).catch(() => [])));
  // Mixed across searches, then junk and duplicates out.
  const cards = mergeCards([interleave(results.map(l => l.filter(Boolean)))]);
  if (!cards.length) return { court, plan, picks: [], more: [], empty: true };
  let picks = [], also = null;
  try {
    const j = await ai(PICK_SYSTEM, pickPrompt(brief, cards));
    picks = parsePicks(j, cards);
    if (picks.length && j && Array.isArray(j.also)) also = parseIds(j, "also", cards);
  } catch { picks = []; }
  const top = picks.length ? picks : fallbackPicks(cards);
  const shown = new Set(top.map(p => p.product_id));
  // The rest of the grid: what the model vouched for as a gift, or (model down) what survived the junk filter.
  const more = (also || cards).filter(c => !shown.has(c.product_id)).slice(0, 18);
  return { court, plan, picks: top, more, ai_picked: picks.length > 0 };
}

// Round-robin across searches so the grid mixes kinds of gift instead of 12 coffee sets in a row.
export function interleave(lists) {
  const out = [], seen = new Set();
  for (let i = 0; lists.some(l => i < l.length); i++)
    for (const l of lists) { const c = l[i]; if (c && !seen.has(c.product_id)) { seen.add(c.product_id); out.push(c); } }
  return out;
}

// The store's front page: no brief yet, just a good spread for its niche. No picking step.
// The budget is modest on purpose: search starts at a fifth of it, and a high floor is what let bulk packs
// of cheap items (and nothing else at that price) fill the page.
export async function browseGifts(niche, { ai, search, planSystem = PLAN_SYSTEM, budget_cents = 15000 }) {
  const brief = { recipient: niche, occasion: "", relationship: "", notes: "a broad spread of the best gifts", budget_cents };
  let plan = [];
  try { plan = parsePlan(await ai(planSystem, planPrompt(brief) + "\nGive 5 searches covering different kinds of gift.")); } catch { plan = []; }
  if (!plan.length) plan = fallbackPlan(brief);
  const results = await Promise.all(plan.map(s => search(s.query, brief).then(ps => ps.map(p => toCard(p, budget_cents)).filter(Boolean)).catch(() => [])));
  const cards = mergeCards([interleave(results)]);
  // A second look by the model: real gifts only. If it fails, the junk filter's result stands.
  let kept = null;
  try { const k = parseIds(await ai(GATE_SYSTEM, cards.map(c => `${c.product_id} | ${c.title} | $${(c.price_cents / 100).toFixed(2)}`).join("\n")), "keep", cards); if (k.length >= 6) kept = k; } catch {}
  return { plan, cards: (kept || cards).slice(0, 24), gated: !!kept };
}
