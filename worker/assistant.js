// The store owner's AI assistant: the owner says what they want in plain English, the model answers
// with a short reply and a list of proposed steps, and nothing changes until the owner clicks Apply.
// Pure functions here (prompt, parsing, matching); searching and applying are in worker.js.

const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const strs = (a, n, len) => (Array.isArray(a) ? a : []).map(x => clip(x, len)).filter(Boolean).slice(0, n);
export const MAX_STEPS = 6, MAX_SHELVES = 3, SHELF_MAX = 12;

export const ASSIST_SYSTEM = `You are the AI assistant inside a gift store builder (gift.directory). The store owner tells you what they want; you plan concrete changes to their store.
Answer with JSON only: {"reply": "1-3 friendly sentences explaining what you propose (or answering their question)", "steps": [ ... ]}.
Allowed steps (use only these, at most ${MAX_STEPS}, and only what the owner asked for or clearly implied):
- {"type":"add_shelf","collection":"shelf title shoppers see, max 40 chars","queries":["4-6 product searches, each 2-6 words naming ONE concrete product kind, different kinds so the shelf is varied"],"max_price":dollars or null,"count":4-${SHELF_MAX}}  (at most ${MAX_SHELVES} shelves per request)
- {"type":"remove_shelf","collection":"exact name of an existing shelf"}
- {"type":"hide","words":["words that, if in a product title, mean hide it"]}
- {"type":"settings","changes":{"name"?: "...", "tagline"?: "max 90 chars", "occasions"?: ["full list, 3-12"], "recipient_examples"?: ["up to 3"], "search_guidance"?: "max 300 chars", "avoid"?: "max 200 chars", "tee_banner"?: true|false}}
- {"type":"connect_etsy","shop":"Etsy shop name"}
- {"type":"connect_shopify","url":"shop web address"}
Rules: when the owner only asks a question or for ideas, give ideas in "reply" and propose steps they could apply. Shelf queries must name concrete product kinds that fit the store (e.g. for nurse stocking stuffers: "nurse badge reel", "compression socks", "nurse hand cream", not "stocking stuffers"). Never invent shelf names to remove that are not in the store. For occasions, return the whole new list (existing ones plus changes). No prices or claims you can't know. No years in queries. Write the reply in plain English only.`;

// What the model sees about the store.
export function storeBrief(store, cfg, shelves, sources) {
  return JSON.stringify({
    name: store.name, tagline: store.tagline || "", niche: store.niche || "",
    occasions: cfg.occasions || [], recipient_examples: cfg.recipient_examples || [],
    search_guidance: cfg.search_guidance || "", avoid: cfg.avoid || "", tee_banner: cfg.tee_banner !== false,
    shelves: shelves.map(s => ({ collection: s.title, products: s.count })),
    connected_shops: sources.map(s => ({ kind: s.kind, url: s.url })),
  });
}
export function assistPrompt(brief, message, history = []) {
  const h = strs(history.map(x => `${x.role === "owner" ? "Owner" : "Assistant"}: ${clip(x.text, 400)}`), 6, 420);
  return `Store: ${brief}\n${h.length ? `Earlier in this chat:\n${h.join("\n")}\n` : ""}Owner: ${clip(message, 600)}`;
}

// Model JSON -> safe, bounded steps. Unknown or malformed steps are dropped.
export function parseAssist(j, shelfNames = []) {
  // (the model sometimes slips a CJK word into English text; drop those characters)
  const reply = clip(String((j && j.reply) || "").replace(/[\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]+/g, "").replace(/\s*,(\s*,)+/g, ","), 600) || "Here's what I'd do.";
  const out = []; let shelves = 0;
  for (const s of (Array.isArray(j && j.steps) ? j.steps : []).slice(0, MAX_STEPS * 2)) {
    if (!s || typeof s !== "object") continue;
    if (s.type === "add_shelf" && shelves < MAX_SHELVES) {
      const collection = clip(s.collection, 40), queries = strs((Array.isArray(s.queries) ? s.queries : [s.query]).map(q => String(q ?? "").replace(/\b(19|20)\d\d\b/g, "")), 6, 80), query = queries.join(", ");
      if (!collection || !queries.length) continue;
      const mp = Number(s.max_price), count = Math.max(4, Math.min(SHELF_MAX, Math.round(Number(s.count) || 8)));
      out.push({ type: "add_shelf", collection, query, queries, max_cents: mp > 0 ? Math.round(mp * 100) : null, count }); shelves++;
    } else if (s.type === "remove_shelf") {
      const c = clip(s.collection, 40); const hit = shelfNames.find(n => n.toLowerCase() === c.toLowerCase());
      if (hit) out.push({ type: "remove_shelf", collection: hit });
    } else if (s.type === "hide") {
      const words = strs(s.words, 10, 40).map(w => w.toLowerCase()).filter(w => w.length >= 3);
      if (words.length) out.push({ type: "hide", words });
    } else if (s.type === "settings" && s.changes && typeof s.changes === "object") {
      const c = s.changes, ch = {};
      if (c.name) ch.name = clip(c.name, 40);
      if (c.tagline != null) ch.tagline = clip(c.tagline, 90);
      if (Array.isArray(c.occasions)) { const o = strs(c.occasions, 12, 40); if (o.length >= 3) ch.occasions = o; }
      if (Array.isArray(c.recipient_examples)) ch.recipient_examples = strs(c.recipient_examples, 3, 60);
      if (c.search_guidance != null) ch.search_guidance = clip(c.search_guidance, 300);
      if (c.avoid != null) ch.avoid = clip(c.avoid, 200);
      if (typeof c.tee_banner === "boolean") ch.tee_banner = c.tee_banner;
      if (Object.keys(ch).length) out.push({ type: "settings", changes: ch });
    } else if (s.type === "connect_etsy" && clip(s.shop, 60)) out.push({ type: "connect_etsy", shop: clip(s.shop, 60) });
    else if (s.type === "connect_shopify" && clip(s.url, 200)) out.push({ type: "connect_shopify", url: clip(s.url, 200) });
    if (out.length >= MAX_STEPS) break;
  }
  return { reply, steps: out };
}

// Cards whose titles contain any of the words (case-insensitive), deduped by product id.
export function matchHide(cards, words) {
  const seen = new Set();
  return cards.filter(c => c && c.product_id && !seen.has(c.product_id) && words.some(w => String(c.title || "").toLowerCase().includes(w)) && seen.add(c.product_id));
}

// Search results -> a shelf: under the price cap, no duplicates or near-duplicate titles, at most `count`.
export function pickShelf(cards, { max_cents = null, count = 8 } = {}, exclude = new Set()) {
  const out = [], titles = new Set();
  for (const c of cards) {
    if (!c || !c.product_id || exclude.has(c.product_id)) continue;
    if (max_cents && c.price_cents > max_cents) continue;
    const key = String(c.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean).slice(0, 3).join(" ");
    if (titles.has(key)) continue;
    titles.add(key); out.push(c);
    if (out.length >= count) break;
  }
  return out;
}

// Second pass: the model picks the best products for each new shelf from the search candidates.
export const PICK_SYSTEM = `You pick products for gift-store shelves. For each shelf you get the store, the shelf title, what the owner asked for, and numbered candidate products.
Choose the products a thoughtful shop owner would actually put on that shelf: on-topic for the shelf and the store's audience, real gifts (not party decorations, banners, baby items, replacement parts or bulk packs unless asked), no two products of the same kind, no licensed TV/movie characters unless asked.
Answer JSON only: {"shelves":[{"i": shelf index, "pick": [candidate numbers, best first]}]}. Pick up to the requested count; pick fewer rather than include a poor fit.`;
export function pickPrompt(storeName, niche, shelves) {
  return `Store: ${clip(storeName, 60)}${niche ? ` (${clip(niche, 120)})` : ""}\n` + shelves.map((s, i) =>
    `Shelf ${i}: "${s.collection}" — owner asked for: ${s.query}${s.max_cents ? `, under $${Math.round(s.max_cents / 100)}` : ""}; pick up to ${s.count}\n` +
    s.pool.map((c, k) => `  ${k}. ${clip(c.title, 90)} — $${(c.price_cents / 100).toFixed(2)} — ${c.merchant}`).join("\n")).join("\n\n");
}
// -> cards per shelf; a shelf the model skipped keeps its first `count` candidates.
export function applyPicks(j, shelves) {
  const got = new Map((Array.isArray(j && j.shelves) ? j.shelves : []).map(x => [Number(x && x.i), Array.isArray(x && x.pick) ? x.pick : null]));
  return shelves.map((s, i) => {
    const pick = got.get(i);
    if (!pick) return s.pool.slice(0, s.count);
    const seen = new Set();
    return pick.map(Number).filter(k => Number.isInteger(k) && k >= 0 && k < s.pool.length && !seen.has(k) && seen.add(k)).slice(0, s.count).map(k => s.pool[k]);
  });
}

// At most ceil(count / kinds) products from any one search (each card carries its search index in _k), so a
// four-kind shelf of 8 has about 2 of each; spare places go to the remaining kinds.
export function capKinds(cards, count, kinds) {
  // Round-robin over kinds in ranked order: the best of each kind first, then second-bests, so a shelf only
  // repeats a kind once every kind has a place. At most ceil(count / kinds) of any one kind.
  const per = Math.max(1, Math.ceil(count / Math.max(1, kinds))), groups = new Map();
  for (const c of cards) { const k = c._k ?? 0; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); }
  const out = [];
  for (let r = 0; r < per && out.length < count; r++) for (const g of groups.values()) if (g[r] && out.length < count) out.push(g[r]);
  return out.map(({ _k, ...c }) => c);
}

// One line per step, for the plan the owner approves.
export function describeStep(s) {
  if (s.type === "add_shelf") return `Add a shelf "${s.collection}" with ${s.cards ? s.cards.length : s.count} products${s.max_cents ? ` under $${Math.round(s.max_cents / 100)}` : ""}`;
  if (s.type === "remove_shelf") return `Remove the shelf "${s.collection}"`;
  if (s.type === "hide") return s.cards && s.cards.length ? `Hide ${s.cards.length} product${s.cards.length === 1 ? "" : "s"} matching ${s.words.join(", ")}` : `Hide anything matching ${s.words.join(", ")} (nothing on your store matches right now; it will also go into what the AI avoids)`;
  if (s.type === "settings") return "Update settings: " + Object.entries(s.changes).map(([k, v]) => `${k.replace("_", " ")} → ${Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "on" : "off") : `"${v}"`}`).join("; ");
  if (s.type === "connect_etsy") return `Connect the Etsy shop ${s.shop}`;
  if (s.type === "connect_shopify") return `Connect the Shopify store ${s.url}`;
  return "";
}
