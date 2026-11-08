// Link previews: Open Graph / Twitter tags for pages people share (a group gift, a registry, a store, the platform).
// Chat apps (WhatsApp, iMessage, Slack) read these from the HTML, so they go in server-side with HTMLRewriter.
export const OG_FALLBACK = "https://gift.directory/og.png";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n) => { s = String(s ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };
export const money = c => "$" + (Math.round(c || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: (c || 0) % 100 ? 2 : 0, maximumFractionDigits: 2 });
// Only http(s) images; anything else (or nothing) falls back to the gift.directory card.
const img = u => /^https?:\/\//i.test(String(u || "")) ? String(u) : OG_FALLBACK;

export function ogTags({ title, description, image, url, site = "gift.directory" }) {
  const t = clip(title, 90), d = clip(description, 200), i = img(image);
  const big = i === OG_FALLBACK; // product photos are often square: the small card shows them better
  return [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(site)}">`,
    `<meta property="og:title" content="${esc(t)}">`,
    `<meta property="og:description" content="${esc(d)}">`,
    `<meta property="og:image" content="${esc(i)}">`,
    url ? `<meta property="og:url" content="${esc(url)}">` : "",
    `<meta name="twitter:card" content="${big ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${esc(t)}">`,
    `<meta name="twitter:description" content="${esc(d)}">`,
    `<meta name="twitter:image" content="${esc(i)}">`,
  ].filter(Boolean).join("\n");
}

// What a shared group gift says: the gift, who it's for, and how far along it is.
export function poolMeta(pool, product, url) {
  const raised = pool.raised_cents || 0, target = pool.target_cents || 0;
  const gift = product && product.title ? product.title : "a gift";
  const progress = pool.status === "funded" || (target && raised >= target)
    ? `Fully funded: ${money(raised)} raised.`
    : `${money(raised)} of ${money(target)} raised.`;
  return { title: `${pool.title} — group gift`, url, image: product && product.image,
    description: `${progress} Chip in on ${gift} with PayPal, straight to ${pool.organizer_name || "the organizer"}.` };
}
export function registryMeta(reg, items, url) {
  const n = items.length, first = items.find(i => i.image);
  const occ = reg.occasion ? reg.occasion.toLowerCase() + " " : "";
  return { title: reg.title, url, image: first && first.image,
    description: `${reg.owner_name}'s ${occ}registry on gift.directory: ${n} gift${n === 1 ? "" : "s"} from any store. Mark what you buy so nobody doubles up${reg.paypal_email ? ", or go in together with PayPal" : ""}.` };
}
export function storeMeta(store, url, image) {
  return { title: store.name || "Gift store", url, image, site: store.name || "gift.directory",
    description: String(store.tagline || "Real gifts, picked by AI and in stock now.").trim().replace(/([^.!?])$/, "$1.") + " Chip in on a gift together with PayPal." };
}
export const REGISTRY_HOME_META = { title: "Free gift registry from any store | gift.directory", url: "https://gift.directory/registry",
  description: "One registry for gifts from hundreds of stores, Etsy shops or any product link. Guests mark what they buy, and big gifts can be shared with PayPal." };
export const PLATFORM_META = { title: "gift.directory — AI gift stores, registries and PayPal group gifts", url: "https://gift.directory/",
  description: "Launch an AI gift store for your people, make a registry from any store, or chip in on a gift together with PayPal." };
