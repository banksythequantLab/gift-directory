// gift.directory stores: draft one from a niche, check it, publish it with a PayPal subscription,
// and find which store a request is for.

const clip = (s, n) => String(s ?? "").slice(0, n);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const ROOT = "gift.directory";
export const RESERVED = new Set(["www", "api", "app", "admin", "mail", "email", "gift", "gifts", "directory", "help", "support",
  "store", "stores", "static", "assets", "cdn", "status", "billing", "paypal", "login", "account", "dashboard", "new"]);

export function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim()
    .replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
}
export function slugError(slug) {
  if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(slug)) return "Use 3-30 letters, numbers or dashes.";
  if (RESERVED.has(slug)) return "That name is reserved.";
  return null;
}

// ---------- the AI's draft ----------
export const DRAFT_SYSTEM =
  "You design niche online gift stores. Given who the store is for, draft it. Answer only JSON: " +
  '{"name":"2-3 words, ends with Gifts","slug":"lowercase-with-dashes","tagline":"under 90 characters",' +
  '"occasions":["6 to 10 short occasion names"],"recipient_examples":["3 short examples of who a shopper buys for"],' +
  '"search_guidance":"one or two sentences telling a shopping assistant what kinds of products suit this niche",' +
  '"avoid":"one sentence on what not to suggest","accent":"#RRGGBB dark enough for white text"}';

const HEX = /^#[0-9a-fA-F]{6}$/;
// Dark enough for white text (WCAG relative luminance under ~0.18).
export function darkEnough(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] < 0.18;
}

export function parseDraft(j, niche) {
  const fallbackName = (clip(niche, 24).replace(/\b\w/g, c => c.toUpperCase()) + " Gifts").trim();
  j = j && typeof j === "object" ? j : {};
  const list = (a, n, len) => (Array.isArray(a) ? a : []).map(x => clip(String(x || "").trim(), len)).filter(Boolean).slice(0, n);
  const name = clip(String(j.name || "").trim(), 40) || fallbackName;
  let slug = slugify(j.slug || name);
  if (slugError(slug)) slug = slugify(name.replace(/gifts?$/i, "")) || "my-gifts";
  return {
    name, slug, tagline: clip(String(j.tagline || "").trim(), 90) || `Gifts for ${clip(niche, 60)}, picked by AI.`,
    occasions: (o => o.length >= 3 ? o : ["Birthday", "Thank you", "Holiday", "Milestone", "Retirement", "Just because"])(list(j.occasions, 10, 40)),
    recipient_examples: list(j.recipient_examples, 3, 60),
    search_guidance: clip(String(j.search_guidance || "").trim(), 300) || null,
    avoid: clip(String(j.avoid || "").trim(), 200) || null,
    accent: HEX.test(j.accent || "") && darkEnough(j.accent) ? j.accent : "#1f3a5f",
  };
}

// What publishing needs: a draft (possibly edited by the owner) plus who owns it.
export function validateStore(b) {
  if (!b || typeof b !== "object") return { error: "missing body" };
  const niche = clip(String(b.niche || "").trim(), 120);
  const owner_email = String(b.owner_email || "").trim().toLowerCase();
  if (niche.length < 3) return { error: "Who is the store for?" };
  if (!EMAIL.test(owner_email)) return { error: "Your email doesn't look right." };
  const d = parseDraft(b.draft || {}, niche);
  const slug = slugify((b.draft && b.draft.slug) || d.slug);
  const e = slugError(slug);
  if (e) return { error: `Store address: ${e}` };
  return { store: { ...d, slug, niche, owner_email } };
}

// ---------- the store's own finder ----------
// The finder's planning prompt, made for one store. The shopper's brief stays the user message.
export function storePlanSystem(cfg) {
  return `You are the gift concierge for "${cfg.name}", a store for ${cfg.niche}. ` +
    (cfg.search_guidance ? cfg.search_guidance + " " : "") + (cfg.avoid ? "Avoid: " + cfg.avoid + " " : "") +
    "Turn the brief into 3 to 5 short product searches for an online catalog of new retail products. " +
    "Prefer specific, giftable, well-made items. Never search for work supplies, uniforms, ID or badge accessories, " +
    "consumables or anything usually sold in bulk, even if the niche uses them at work: a gift is personal. " +
    "Answer only JSON: " + '{"searches":[{"query":"2-6 words","why":"one short phrase"}]}';
}

// ---------- PayPal subscription ----------
export function subscriptionBody(store, planId, origin) {
  return {
    plan_id: planId, custom_id: store.id,
    application_context: { brand_name: "gift.directory", user_action: "SUBSCRIBE_NOW", shipping_preference: "NO_SHIPPING",
      return_url: `${origin}/api/stores/${store.id}/subscribed`, cancel_url: `${origin}/new?cancelled=${store.id}` },
  };
}
// PayPal's subscription status decides whether the store is up. A store that was never paid for
// stays a draft; one whose payments stopped lapses (and comes back when they resume).
export function storeStatusFor(subStatus, current) {
  if (subStatus === "ACTIVE") return "active";
  if (["SUSPENDED", "CANCELLED", "EXPIRED"].includes(subStatus)) return current === "draft" ? "draft" : "lapsed";
  return current;
}

// ---------- which store is this request for ----------
// <slug>.gift.directory, a store's own host, or none (the platform itself).
export function hostKey(host, root = ROOT) {
  const h = String(host || "").toLowerCase().split(":")[0];
  if (h === root || h === "www." + root) return { platform: true };
  if (h.endsWith("." + root)) { const slug = h.slice(0, -(root.length + 1)); return slug.includes(".") ? { platform: true } : { slug }; }
  return { host: h };
}

// What a shopper's page may see about a store.
export function publicStore(s) {
  const cfg = JSON.parse(s.config_json);
  return { slug: s.slug, name: s.name, tagline: s.tagline, niche: s.niche, status: s.status,
           occasions: cfg.occasions, recipient_examples: cfg.recipient_examples, accent: cfg.accent };
}
