// Long-tail gift guides at gift.directory/gifts/<slug>: one keyword per page, real products from
// Channel3 with AI reasons, a short guide and FAQ written once and stored, server-rendered for crawlers.

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = c => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
const P = (slug, keyword, recipient, occasion, budget, opts = {}) => ({ slug, keyword, recipient, occasion, budget_cents: budget * 100, ...opts });

// Holiday long-tail first. `store` links the page into a gift.directory store (and its group gifts).
export const PAGES = [
  // lawyers & law
  P("christmas-gifts-for-lawyers", "Christmas gifts for lawyers", "a lawyer", "Christmas", 200, { store: "lawyers", topic: "Law" }),
  P("gifts-for-attorneys-under-100", "Gifts for attorneys under $100", "an attorney", "any occasion", 100, { store: "lawyers", topic: "Law" }),
  P("thank-you-gifts-for-your-lawyer", "Thank you gifts for your lawyer", "my lawyer, from a grateful client", "won my case", 200, { store: "lawyers", topic: "Law" }),
  P("gifts-for-new-lawyers", "Gifts for new lawyers", "a newly admitted lawyer", "sworn in", 150, { store: "lawyers", topic: "Law" }),
  P("bar-exam-passed-gifts", "Gifts for passing the bar exam", "someone who just passed the bar", "passed the bar", 150, { store: "lawyers", topic: "Law" }),
  P("law-school-graduation-gifts", "Law school graduation gifts", "a law school graduate", "graduation", 150, { store: "lawyers", topic: "Law" }),
  P("gifts-for-law-students", "Gifts for law students", "a law student", "Christmas", 75, { store: "lawyers", topic: "Law" }),
  P("judge-retirement-gifts", "Retirement gifts for a judge", "a judge", "retirement", 300, { store: "lawyers", topic: "Law" }),
  P("gifts-for-paralegals", "Gifts for paralegals", "a paralegal", "Christmas", 75, { store: "lawyers", topic: "Law" }),
  P("scales-of-justice-gifts", "Scales of justice gifts", "a lawyer", "any occasion", 300, { store: "lawyers", topic: "Law", notes: "scales of justice, Lady Justice, gavel themed gifts" }),
  P("gifts-for-female-lawyers", "Gifts for female lawyers", "a woman who is a lawyer", "Christmas", 200, { store: "lawyers", topic: "Law" }),
  P("law-office-secret-santa-gifts", "Secret Santa gifts for a law office", "a coworker at a law firm", "Secret Santa", 30, { store: "lawyers", topic: "Law" }),
  // nurses & healthcare
  P("christmas-gifts-for-nurses", "Christmas gifts for nurses", "a nurse", "Christmas", 100, { store: "nurses", topic: "Nurses & healthcare" }),
  P("nurse-appreciation-gifts", "Nurse appreciation gifts", "a nurse", "thank you", 75, { store: "nurses", topic: "Nurses & healthcare" }),
  P("thank-you-gifts-for-nurses-from-patients", "Thank you gifts for nurses from patients", "the nurse who cared for me", "thank you", 75, { store: "nurses", topic: "Nurses & healthcare" }),
  P("gifts-for-night-shift-nurses", "Gifts for night shift nurses", "a nurse who works nights", "Christmas", 75, { store: "nurses", topic: "Nurses & healthcare", notes: "night shift, sleep, comfort" }),
  P("gifts-for-nursing-students", "Gifts for nursing students", "a nursing student", "graduation", 75, { store: "nurses", topic: "Nurses & healthcare" }),
  P("nurse-retirement-gifts", "Nurse retirement gifts", "a retiring nurse", "retirement", 150, { store: "nurses", topic: "Nurses & healthcare" }),
  P("christmas-gifts-for-doctors", "Christmas gifts for doctors", "a doctor", "Christmas", 200, { topic: "Nurses & healthcare" }),
  // office & work
  P("christmas-gifts-for-coworkers-under-25", "Christmas gifts for coworkers under $25", "a coworker", "Christmas", 25, { topic: "Work & office" }),
  P("secret-santa-gifts-under-25", "Secret Santa gifts under $25", "a coworker", "Secret Santa", 25, { topic: "Work & office" }),
  P("secret-santa-gifts-under-50", "Secret Santa gifts under $50", "a coworker or friend", "Secret Santa", 50, { topic: "Work & office" }),
  P("white-elephant-gifts-under-30", "White elephant gifts under $30", "anyone at a gift exchange", "white elephant", 30, { topic: "Work & office", notes: "fun, crowd-pleasing, gets stolen" }),
  P("christmas-gifts-for-boss", "Christmas gifts for your boss", "my boss", "Christmas", 100, { topic: "Work & office" }),
  P("group-gifts-for-boss-from-team", "Group gifts for a boss from the team", "our boss, from the whole team", "Christmas", 300, { topic: "Work & office" }),
  P("christmas-gifts-for-clients", "Christmas gifts for clients", "a client", "Christmas", 100, { topic: "Work & office" }),
  P("christmas-gifts-for-employees", "Christmas gifts for employees", "an employee", "Christmas", 50, { topic: "Work & office" }),
  P("retirement-gifts-for-coworkers", "Retirement gifts for coworkers", "a retiring coworker", "retirement", 150, { topic: "Work & office" }),
  P("group-gifts-for-teachers-from-class", "Group gifts for a teacher from the class", "our child's teacher, from the whole class", "Christmas", 200, { topic: "Work & office" }),
  // holidays
  P("what-to-bring-to-thanksgiving-not-food", "What to bring to Thanksgiving if you're told not to bring food", "the Thanksgiving host", "Thanksgiving dinner, as a guest who was told not to bring food", 60,
    { topic: "Holidays", notes: "a host or hostess gift that is NOT food: candles, table linens, serving pieces, a houseplant or lasting flowers, wine or bar accessories, after-dinner games, keepsakes; answer the question directly and include etiquette (don't expect it to be used that night)" }),
  // family & interests
  P("christmas-gifts-for-dad-who-has-everything", "Christmas gifts for a dad who has everything", "my dad, who has everything", "Christmas", 150, { topic: "Family & interests" }),
  P("christmas-gifts-for-mom-who-wants-nothing", "Christmas gifts for a mom who says she wants nothing", "my mom", "Christmas", 150, { topic: "Family & interests" }),
  P("christmas-gifts-for-grandparents", "Christmas gifts for grandparents", "my grandparents", "Christmas", 100, { topic: "Family & interests" }),
  P("gifts-for-coffee-lovers-under-50", "Gifts for coffee lovers under $50", "someone who loves coffee", "Christmas", 50, { topic: "Family & interests", notes: "coffee" }),
  P("gifts-for-whiskey-lovers", "Gifts for whiskey lovers", "someone who loves whiskey", "Christmas", 150, { topic: "Family & interests", notes: "whiskey, bourbon" }),
  P("gifts-for-golfers-under-50", "Gifts for golfers under $50", "a golfer", "Christmas", 50, { topic: "Family & interests", notes: "golf" }),
  P("stocking-stuffers-for-adults", "Stocking stuffers for adults", "an adult", "Christmas stocking", 30, { topic: "Family & interests" }),
];
export const pageBySlug = slug => PAGES.find(p => p.slug === slug) || null;

// The guide text: written once per page by the model, checked, stored.
export const GUIDE_SYSTEM =
  "You write short, genuinely useful gift-guide copy for a page targeting one search phrase. Be specific and " +
  "practical, warm but not gushing. Never invent statistics, prices, brands or claims about specific products. " +
  "Answer only JSON: {\"meta\":\"meta description, 140-155 characters, includes the phrase\",\"intro\":[\"2 or 3 short paragraphs\"]," +
  "\"faq\":[{\"q\":\"a question people ask about this\",\"a\":\"2-3 sentence answer\"}] (4 items)}";
export function guidePrompt(p) {
  return `Search phrase: ${p.keyword}\nWho it's for: ${p.recipient}\nOccasion: ${p.occasion}\nTypical budget: up to $${p.budget_cents / 100}` +
    (p.notes ? `\nNotes: ${p.notes}` : "") + "\nIt's the holiday season. Mention that several people can chip in on one gift if that fits.";
}
export function parseGuide(j, p) {
  const clip = (s, n) => String(s ?? "").trim().slice(0, n);
  const intro = (Array.isArray(j && j.intro) ? j.intro : []).map(x => clip(x, 700)).filter(x => x.length > 40).slice(0, 3);
  const faq = (Array.isArray(j && j.faq) ? j.faq : []).map(f => ({ q: clip(f && f.q, 160), a: clip(f && f.a, 500) })).filter(f => f.q && f.a).slice(0, 5);
  let meta = clip(j && j.meta, 160);
  if (meta.length < 80) meta = `${p.keyword}: real, in-stock gift ideas picked by AI, with live prices from top retailers. Chip in together with PayPal.`.slice(0, 158);
  if (!intro.length) return null;
  return { meta, intro, faq };
}
// What the finder is asked for this page.
export const pageBrief = p => ({ recipient: p.recipient, occasion: p.occasion, relationship: "", notes: p.notes || "", budget_cents: p.budget_cents });

// ---------- HTML ----------
const ROOT = "https://gift.directory";
function card(c) {
  return `<article class="card gift">${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.title)}" loading="lazy" width="300" height="300">` : ""}
<h3>${esc(c.title)}</h3><div class="muted" style="font-size:.82rem">${esc(c.brand || "")}${c.brand ? " · " : ""}${esc(c.merchant)}</div>
<div class="price">${money(c.price_cents)}${c.was_cents && c.was_cents > c.price_cents ? `<span class="was">${money(c.was_cents)}</span>` : ""}</div>
${c.reason ? `<p class="why">${esc(c.reason)}</p>` : `<p class="why"></p>`}
<div class="acts"><a class="btn sec" href="${esc(c.url)}" target="_blank" rel="noopener sponsored nofollow">View at ${esc(c.merchant)}</a></div></article>`;
}
// The one ad slot: bottom of the page, after everything a reader came for. Never in the header, and the
// ad script itself loads down here too. Empty until real AdSense ids are configured.
// The AdSense publisher id, set once per request by the worker (ownership tag only; no ad code in <head>).
let ADS_CLIENT = "";
export function configureAds(env) { ADS_CLIENT = /^ca-pub-\d{10,20}$/.test((env && env.ADSENSE_CLIENT) || "") ? env.ADSENSE_CLIENT : ""; }
export function adSlot(env) {
  const client = env && env.ADSENSE_CLIENT, slot = env && env.ADSENSE_SLOT;
  if (!/^ca-pub-\d{10,20}$/.test(client || "") || !/^\d{6,15}$/.test(slot || "")) return "";
  return `<aside aria-label="Advertisement" style="margin:30px 0 6px"><div class="muted" style="font-size:.72rem;letter-spacing:.4px;text-transform:uppercase">Advertisement</div>
<ins class="adsbygoogle" style="display:block" data-ad-client="${client}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}" crossorigin="anonymous"></script>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script></aside>`;
}
const shell = (title, meta, canonical, body, jsonld = [], ad = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">${ADS_CLIENT ? `<meta name="google-adsense-account" content="${ADS_CLIENT}">` : ""}<title>${esc(title)}</title>
<meta name="description" content="${esc(meta)}"><link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(meta)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="website">
<link rel="stylesheet" href="/style.css"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("")}
<style>.wrap{max-width:1180px}.grid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}.guide p{max-width:760px}.crumbs{font-size:.85rem;margin-bottom:6px}
.gift .why{font-style:italic;color:#374151}.cta{background:var(--accent);color:#fff;border-radius:14px;padding:18px;margin:22px 0}.cta a{color:#fff;font-weight:700}
.rel{display:flex;flex-wrap:wrap;gap:8px}.rel a{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 12px;font-size:.88rem;text-decoration:none;color:var(--ink)}</style>
</head><body><div class="wrap">${body}
${ad}
<footer><a href="/">gift.directory</a> · <a href="/gifts">All gift guides</a> · Prices and stock come live from retailers through Channel3 and may change; links go to the retailer.</footer></div></body></html>`;

export function renderGuide(p, row, related, storeUrl, ad = "") {
  const g = JSON.parse(row.guide_json), cards = JSON.parse(row.cards_json || "[]");
  const url = `${ROOT}/gifts/${p.slug}`, updated = String(row.updated_at).slice(0, 10);
  const title = `${p.keyword} (${new Date(row.updated_at).getUTCFullYear()}) — real gifts in stock | gift.directory`;
  const body = `<div class="crumbs"><a href="/">gift.directory</a> › <a href="/gifts">Gift guides</a> › ${esc(p.topic)}</div>
<h1 style="font-family:Georgia,serif;margin:4px 0 6px">${esc(p.keyword)}</h1>
<p class="muted" style="margin:0 0 12px">Updated ${esc(updated)} · ${cards.length} gifts in stock now</p>
<section class="guide">${g.intro.map(x => `<p>${esc(x)}</p>`).join("")}</section>
${cards.length ? `<h2 style="font-family:Georgia,serif">Our picks</h2><div class="grid">${cards.map(card).join("")}</div>` : ""}
<div class="cta"><b style="font-size:1.1rem">Going in together?</b><br>${storeUrl
    ? `Find more and start a group gift at <a href="${esc(storeUrl)}">${esc(storeUrl.replace(/^https:\/\//, "").replace(/\/$/, ""))}</a> — everyone chips in with PayPal, straight to the organizer.`
    : `Every store on <a href="/">gift.directory</a> lets a group chip in with PayPal, straight to the organizer. <a href="/">Start your own gift store →</a>`}</div>
${g.faq.length ? `<h2 style="font-family:Georgia,serif">Questions people ask</h2>${g.faq.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("")}` : ""}
<h2 style="font-family:Georgia,serif">More gift guides</h2><nav class="rel">${related.map(r => `<a href="/gifts/${r.slug}">${esc(r.keyword)}</a>`).join("")}</nav>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "ItemList", name: p.keyword, url, itemListElement: cards.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: c.url, name: c.title })) },
    ...(g.faq.length ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: g.faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Gift guides", item: `${ROOT}/gifts` }, { "@type": "ListItem", position: 2, name: p.keyword, item: url }] },
  ];
  return shell(title, g.meta, url, body, ld, ad);
}
export function renderHub(built, ad = "") {
  const byTopic = {}; for (const p of PAGES) if (built.has(p.slug)) (byTopic[p.topic] ||= []).push(p);
  const body = `<h1 style="font-family:Georgia,serif">Gift guides</h1><p class="muted">Real, in-stock gifts picked by AI for the people on your list — with live prices, and group gifts paid through PayPal.</p>
${Object.entries(byTopic).map(([t, ps]) => `<h2 style="font-family:Georgia,serif">${esc(t)}</h2><nav class="rel">${ps.map(p => `<a href="/gifts/${p.slug}">${esc(p.keyword)}</a>`).join("")}</nav>`).join("")}`;
  return shell("Gift guides — real gifts in stock, picked by AI | gift.directory", "Christmas and year-round gift guides for lawyers, nurses, coworkers, family and more: real, in-stock gifts with live prices, picked by AI.", `${ROOT}/gifts`, body, [], ad);
}
export function related(p, n = 8) {
  const same = PAGES.filter(x => x.topic === p.topic && x.slug !== p.slug), other = PAGES.filter(x => x.topic !== p.topic);
  return [...same, ...other].slice(0, n);
}
export function sitemap(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(String(u.lastmod).slice(0, 10))}</lastmod>` : ""}</url>`).join("\n") + "\n</urlset>\n";
}
