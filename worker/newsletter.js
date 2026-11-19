// The weekly sales email: the week's best price-checked markdowns, on Fridays, to people who asked for it and then
// confirmed their address. Nobody is mailed until they click the link in the confirmation email, every issue has an
// unsubscribe link that deletes the address, and no issue goes out at all until MAIL_ADDRESS (the sender's postal
// address, which US law requires in a commercial email) is set.
import { validEmail, alertPage } from "./alerts.js";
import { listedDeals } from "./deals.js";

export const NEWS_FROM = "reminders@gift.directory", NEWS_PENDING_PER_DAY = 300, NEWS_BATCH = 40, NEWS_ITEMS = 10, NEWS_MIN_ITEMS = 5;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = c => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
const ROOT = "https://gift.directory";

// On the sales pages. A plain form; `website` is a trap for form-filling bots.
export function signupForm() {
  return `<section class="guide" style="margin:22px 0"><b style="font-family:Georgia,serif;font-size:1.1rem">The ten best markdowns, every Friday</b>
<p style="margin:6px 0 10px">One short email a week with the biggest price-checked markdowns from this page. No other email, and one click to stop.</p>
<form method="post" action="/api/subscribe" style="display:flex;gap:8px;flex-wrap:wrap;max-width:520px">
<input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<input type="email" name="email" required placeholder="you@example.com" aria-label="Your email" style="flex:1 1 220px;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit">
<button class="btn" type="submit">Send me the list</button></form>
<p class="muted" style="font-size:.8rem;margin:8px 0 0">We email you a link to confirm first. <a href="/privacy">Privacy</a></p></section>`;
}

export function confirmEmail(token) {
  return { subject: "Confirm your gift.directory weekly sales email",
    text: `Someone (we hope you) asked for gift.directory's weekly list of marked-down gifts at this address.\n\nTo start getting it, open this link:\n${ROOT}/api/subscribe/confirm?t=${token}\n\nIf that wasn't you, do nothing. Without that click we will not email this address again, and we delete it after a week.\n\ngift.directory` };
}

// Asking: store the address unconfirmed and send the confirmation link. `send` is env.EMAIL.send.
export async function subscribe(db, { email, website }, { nowMs = Date.now(), send } = {}) {
  if (website) return { ok: true, quiet: true };
  const to = validEmail(email);
  if (!to) return { ok: false, error: "That doesn't look like an email address." };
  if (!send) return { ok: false, error: "Email is not set up on this site yet. Please try again another day." };
  const t = new Date(nowMs).toISOString(), dayAgo = new Date(nowMs - 864e5).toISOString();
  const row = await db.prepare("SELECT token, confirmed_at, created_at FROM subscribers WHERE email=?").bind(to).first();
  if (row && row.confirmed_at) return { ok: true, already: true };
  if (row && row.created_at > dayAgo) return { ok: true, pending: true };            // asked in the last day: don't send the link again
  const recent = (await db.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE confirmed_at IS NULL AND created_at > ?").bind(dayAgo).first()).n;
  if (recent >= NEWS_PENDING_PER_DAY) return { ok: false, error: "Too many sign-ups today. Please try again tomorrow." };
  const token = crypto.randomUUID();
  await db.prepare("INSERT INTO subscribers (email,token,created_at) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET token=excluded.token, created_at=excluded.created_at").bind(to, token, t).run();
  try { await send({ to, from: NEWS_FROM, ...confirmEmail(token) }); }
  catch { await db.prepare("DELETE FROM subscribers WHERE email=? AND confirmed_at IS NULL").bind(to).run(); return { ok: false, error: "We couldn't send the confirmation email. Please check the address and try again." }; }
  return { ok: true, pending: true };
}
const isToken = t => /^[0-9a-f-]{36}$/i.test(String(t || ""));
export async function confirm(db, token, nowMs = Date.now()) {
  if (!isToken(token)) return false;
  const r = await db.prepare("UPDATE subscribers SET confirmed_at=COALESCE(confirmed_at, ?) WHERE token=?").bind(new Date(nowMs).toISOString(), token).run();
  return !!(r.meta && r.meta.changes);
}
export async function unsubscribe(db, token) {
  if (!isToken(token)) return false;
  const r = await db.prepare("DELETE FROM subscribers WHERE token=?").bind(token).run();
  return !!(r.meta && r.meta.changes);
}

// This week's ten: biggest markdowns first, at most two from any one store so one retailer's sale isn't the whole list.
export function pickItems(deals, n = NEWS_ITEMS) {
  const per = {}, out = [];
  for (const c of deals || []) { const m = c.merchant || "?"; per[m] = (per[m] || 0) + 1; if (per[m] <= 2) out.push(c); if (out.length >= n) break; }
  return out;
}
// Links go to our own pages (where the price is re-checked and the store link lives), not straight to a store.
export function weeklyEmail(items, { address, token, nowMs = Date.now() }) {
  const day = new Date(nowMs).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/New_York" });
  const lines = items.map((c, i) => { const pct = Math.round((1 - c.price_cents / c.was_cents) * 100);
    return `${i + 1}. ${c.title}\n   ${money(c.price_cents)} at ${c.merchant} (regular price ${money(c.was_cents)}, ${pct}% off)\n   ${ROOT}/gifts/${c.slug}`; });
  return { subject: `${items.length} gifts marked down this week (${day})`,
    text: `These were the biggest markdowns on gift.directory when we checked prices this morning. Each link opens the gift guide the product is in, with the store link and today's price.\n\n${lines.join("\n\n")}\n\nAll of today's markdowns: ${ROOT}/sales\n\n` +
      `Sales end without notice, so the store's page has the final price. gift.directory may earn a commission when you buy through its links, at no extra cost to you.\n\n` +
      `You are getting this because you asked for it at gift.directory and confirmed this address.\nStop these emails (one click, and we delete your address): ${ROOT}/api/subscribe/unsubscribe?t=${token}\n\ngift.directory\n${address}` };
}
// Friday, 10 am to 8 pm Eastern: the issue's date, else null.
export function issueFor(nowMs) {
  const et = new Date(new Date(nowMs).toLocaleString("en-US", { timeZone: "America/New_York" }));
  if (et.getDay() !== 5 || et.getHours() < 10 || et.getHours() >= 20) return null;
  return `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, "0")}-${String(et.getDate()).padStart(2, "0")}`;
}
// Called every hour. Sends this Friday's issue to confirmed readers who haven't had it, NEWS_BATCH at a time, and
// clears out addresses that were never confirmed after a week.
export async function sendWeekly(db, env, { nowMs = Date.now(), force = false } = {}) {
  const out = { sent: 0, errors: 0 };
  const stale = await db.prepare("DELETE FROM subscribers WHERE confirmed_at IS NULL AND created_at < ?").bind(new Date(nowMs - 7 * 864e5).toISOString()).run();
  out.unconfirmed_deleted = (stale.meta && stale.meta.changes) || 0;
  const issue = issueFor(nowMs) || (force ? new Date(nowMs).toISOString().slice(0, 10) : null);
  if (!issue) return { ...out, skipped: "not Friday 10am-8pm Eastern" };
  if (!env.EMAIL) return { ...out, skipped: "no EMAIL binding" };
  const address = String(env.MAIL_ADDRESS || "").trim();
  if (address.length < 10) return { ...out, skipped: "MAIL_ADDRESS is not set (a postal address is required in every issue)" };
  const due = (await db.prepare("SELECT email, token FROM subscribers WHERE confirmed_at IS NOT NULL AND (last_sent IS NULL OR last_sent < ?) ORDER BY confirmed_at LIMIT ?").bind(issue, NEWS_BATCH).all()).results;
  if (!due.length) return { ...out, issue, skipped: "everyone has this issue" };
  const items = pickItems(await listedDeals(db, { limit: 60, nowMs }));
  if (items.length < NEWS_MIN_ITEMS) return { ...out, issue, skipped: `only ${items.length} markdowns confirmed today` };
  for (const s of due) {
    try { await env.EMAIL.send({ to: s.email, from: NEWS_FROM, ...weeklyEmail(items, { address, token: s.token, nowMs }) }); out.sent++; }
    catch { out.errors++; continue; }
    await db.prepare("UPDATE subscribers SET last_sent=? WHERE email=?").bind(issue, s.email).run();
  }
  return { ...out, issue };
}
export function subscribedPage(r) {
  if (!r.ok) return alertPage("We couldn't sign you up", `<p>${esc(r.error)}</p>`, 400);
  if (r.quiet) return alertPage("Thanks", `<p>Done.</p>`);
  if (r.already) return alertPage("You're already on the list", `<p>That address is confirmed and gets the Friday email.</p><p><a href="/sales">Back to the sales</a></p>`);
  return alertPage("Check your email", `<p>We sent a link to confirm your address. The weekly email starts once you click it. If you don't, we delete the address after a week.</p><p><a href="/sales">Back to the sales</a></p>`);
}
export const confirmedPage = ok => ok ? alertPage("You're on the list", `<p>You'll get the ten best markdowns each Friday. Every email has a one-click link to stop.</p><p><a href="/sales">See today's sales</a></p>`)
  : alertPage("That link didn't work", `<p>It may have expired or already been used to unsubscribe. You can <a href="/sales">sign up again</a>.</p>`, 404);
export const unsubscribedPage = ok => alertPage("You're unsubscribed", ok ? `<p>We've deleted your address. You won't get the weekly email again.</p>` : `<p>That address isn't on the list, so there is nothing to stop.</p>`);
