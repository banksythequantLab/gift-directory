// "Email me if the price drops": one email per product per address, and the address is deleted when that email is
// sent, when the reader unsubscribes, or after ALERT_DAYS, whichever comes first. Only products shown on a guide can
// be watched, and only those the catalog can re-price by id (not the affiliate-feed products, whose ids carry a colon).
import { checkPrice } from "./deals.js";

export const ALERT_MAX_PER_EMAIL = 20, ALERT_MAX_ROWS = 5000, ALERT_DAYS = 90, ALERT_MIN_DROP = 0.05, ALERT_MIN_CENTS = 100;
export const ALERT_FROM = "reminders@gift.directory";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = c => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });

const EMAIL_RE = /^[^\s@<>"',;:\\]+@[^\s@<>"',;:\\]+\.[a-z]{2,}$/i;
export function validEmail(e) {
  e = String(e || "").trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) && !/@([^@]*\.)?example\.(com|org|net)$/.test(e) ? e : null;
}
export const watchable = c => !!(c && /^[A-Za-z0-9_-]{4,64}$/.test(String(c.product_id || "")) && c.price_cents > 0 && c.url);
// A drop worth an email: at least 5% and at least a dollar below the price when they asked.
export const dropped = (was, now) => was > 0 && now > 0 && now <= was * (1 - ALERT_MIN_DROP) && was - now >= ALERT_MIN_CENTS;

// The sign-up, under a product card. A plain form: it works without scripts. `website` is a trap for form-filling bots.
export function alertForm(c, slug) {
  if (!slug || !watchable(c)) return "";
  return `<details class="pa"><summary>Email me if the price drops</summary><form method="post" action="/api/alerts">
<input type="hidden" name="p" value="${esc(c.product_id)}"><input type="hidden" name="s" value="${esc(slug)}">
<input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<input type="email" name="email" required placeholder="you@example.com" aria-label="Your email"><button class="btn sec" type="submit">Watch price</button>
<p class="muted">One email if it drops, then we delete your address. <a href="/privacy">Privacy</a></p></form></details>`;
}
export const ALERT_CSS = `.pa{margin:8px 0 0;font-size:.82rem}.pa summary{cursor:pointer;color:var(--accent,#1e3a5f)}.pa form{margin:8px 0 0}.pa input[type=email]{width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;margin:0 0 6px;font:inherit}.pa .btn{padding:6px 12px}.pa p{margin:6px 0 0;font-size:.75rem}`;

export async function addAlert(db, { email, product_id, slug, website }, nowMs = Date.now()) {
  if (website) return { ok: true, quiet: true };                       // a bot filled the trap: say thanks, store nothing
  const to = validEmail(email);
  if (!to) return { ok: false, error: "That doesn't look like an email address." };
  const row = /^[a-z0-9-]{1,120}$/.test(String(slug || "")) ? await db.prepare("SELECT cards_json FROM seo_pages WHERE slug=?").bind(slug).first() : null;
  let card = null; try { card = row ? JSON.parse(row.cards_json || "[]").find(c => c && c.product_id === product_id) : null; } catch { card = null; }
  if (!watchable(card)) return { ok: false, error: "We can't watch that product's price." };
  const mine = (await db.prepare("SELECT COUNT(*) AS n FROM price_alerts WHERE email=?").bind(to).first()).n;
  if (mine >= ALERT_MAX_PER_EMAIL) return { ok: false, error: `That address is already watching ${ALERT_MAX_PER_EMAIL} products, which is the most we allow.` };
  const all = (await db.prepare("SELECT COUNT(*) AS n FROM price_alerts").first()).n;
  if (all >= ALERT_MAX_ROWS) return { ok: false, error: "Price watching is full right now. Please try again another day." };
  const t = new Date(nowMs).toISOString();
  await db.prepare("INSERT OR IGNORE INTO price_alerts (token,email,product_id,slug,title,url,price_cents,created_at,checked_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), to, card.product_id, slug, String(card.title).slice(0, 200), card.url, card.price_cents, t, t).run();
  return { ok: true, title: card.title, price_cents: card.price_cents, slug };
}
export async function removeAlert(db, token) {
  if (!/^[0-9a-f-]{36}$/i.test(String(token || ""))) return 0;
  const r = await db.prepare("DELETE FROM price_alerts WHERE token=?").bind(token).run();
  return (r.meta && r.meta.changes) || 0;
}
export function alertEmail(a, nowCents, guideUrl) {
  return { subject: `Price drop: ${String(a.title).slice(0, 80)}`,
    text: `You asked us to tell you if this went down in price.\n\n${a.title}\nWas ${money(a.price_cents)} when you asked. Now ${money(nowCents)}.\n\nSee it at the store:\n${a.url}\n\nThe gift guide it came from:\n${guideUrl}\n\n` +
      `Prices change; the store's page has the final price. gift.directory may earn a commission if you buy through this link, at no extra cost to you.\n\n` +
      `This is the only email you will get about this product. We have deleted your address from this price watch.\n\ngift.directory` };
}
// One round: drop watches past their time, then re-price the ones checked longest ago. At most `max` catalog lookups.
export async function runAlerts(db, env, { max = 10, fetchImpl = fetch, nowMs = Date.now(), root = "https://gift.directory" } = {}) {
  const out = { expired: 0, checked: 0, sent: 0, gone: 0, errors: 0 };
  const iso = ms => new Date(ms).toISOString();
  const ex = await db.prepare("DELETE FROM price_alerts WHERE created_at < ?").bind(iso(nowMs - ALERT_DAYS * 864e5)).run();
  out.expired = (ex.meta && ex.meta.changes) || 0;
  if (!env.EMAIL) return { ...out, skipped: "no EMAIL binding" };
  const ids = (await db.prepare("SELECT product_id, MIN(checked_at) AS c FROM price_alerts GROUP BY product_id ORDER BY c LIMIT ?").bind(max).all()).results.map(r => r.product_id);
  for (const id of ids) {
    const r = await checkPrice(env, id, { fetchImpl });
    if (r.error) { out.errors++; out.last_error = String(r.error).slice(0, 120); if (r.stop) break; continue; }
    out.checked++;
    if (r.gone) { await db.prepare("DELETE FROM price_alerts WHERE product_id=?").bind(id).run(); out.gone++; continue; }
    const now = r.card && r.card.price_cents;                          // no card: out of stock today, look again later
    const rows = (await db.prepare("SELECT * FROM price_alerts WHERE product_id=?").bind(id).all()).results;
    for (const a of rows) {
      if (now && dropped(a.price_cents, now)) {
        try { await env.EMAIL.send({ to: a.email, from: ALERT_FROM, ...alertEmail(a, now, `${root}/gifts/${a.slug}`) }); out.sent++; } catch { out.errors++; continue; }
        await db.prepare("DELETE FROM price_alerts WHERE token=?").bind(a.token).run();
      } else await db.prepare("UPDATE price_alerts SET checked_at=? WHERE token=?").bind(iso(nowMs), a.token).run();
    }
  }
  return out;
}
// The small page a reader lands on after the form or the unsubscribe link. Never indexed, never cached.
export function alertPage(title, bodyHtml, status = 200) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} | gift.directory</title><link rel="stylesheet" href="/style.css"><div class="wrap"><h1 style="font-family:Georgia,serif">${esc(title)}</h1>${bodyHtml}<p><a href="/gifts">All gift guides</a></p></div></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
export function addedPage(r) {
  if (!r.ok) return alertPage("We couldn't set that up", `<p>${esc(r.error)}</p>`, 400);
  if (r.quiet) return alertPage("Thanks", `<p>Done.</p>`);
  return alertPage("We're watching the price", `<p><b>${esc(r.title)}</b> is ${esc(money(r.price_cents))} today. If it drops by 5% or more in the next ${ALERT_DAYS} days we will send you one email, then delete your address.</p><p><a href="/gifts/${esc(r.slug)}">Back to the guide</a></p>`);
}
