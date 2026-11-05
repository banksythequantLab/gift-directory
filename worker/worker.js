// Gift Finder — API worker. Static pages (finder, pool page) are served from ./public.
import { paypalFetch, link } from "./paypal-core.js";
import { validateBrief, findGifts, browseGifts, channel3Search, courtCheck, toCard, mergeCards } from "./finder.js";
import { validatePool, contributionError, buildContributionOrder, readCapture, applyCapture, publicPool } from "./pools.js";
import { ROOT, DRAFT_SYSTEM, parseDraft, validateStore, storePlanSystem, subscriptionBody, storeStatusFor, hostKey, publicStore, darkEnough } from "./stores.js";
import { authorizeUrl, paypalWebBase, parseUserinfo, ownsStore, validateSettings, validateItem, shelves, withoutHidden } from "./owners.js";

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const J = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
async function readJson(req) { try { return await req.json(); } catch { return null; } }
const shortId = () => { const a = "abcdefghjkmnpqrstuvwxyz23456789", b = crypto.getRandomValues(new Uint8Array(8)); return [...b].map(x => a[x % a.length]).join(""); };
async function sha256(s) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join(""); }
const paypalOn = env => !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);

// The finder's model: OpenAI-compatible chat on Nebius Token Factory, JSON out.
function aiFor(env) {
  return async (system, user) => {
    if (!env.NEBIUS_API_KEY) throw new Error("no model key");
    const base = (env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1").replace(/\/+$/, "");
    const r = await fetch(`${base}/chat/completions`, { method: "POST",
      headers: { authorization: `Bearer ${env.NEBIUS_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: env.TEXT_MODEL || "Qwen/Qwen3-235B-A22B-Instruct-2507", temperature: 0.4, max_tokens: 1200,
        response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      signal: AbortSignal.timeout(25000) });
    if (!r.ok) throw new Error(`model ${r.status}`);
    const j = await r.json();
    return JSON.parse(j.choices[0].message.content);
  };
}

// Gift box on a rounded square, 64-unit grid (scripts/make-favicon.py draws the same for the .ico).
const faviconSvg = accent => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
  `<rect width="64" height="64" rx="14" fill="${accent}"/>` +
  `<rect x="13" y="30" width="38" height="22" rx="3" fill="#fff"/><rect x="10" y="22" width="44" height="9" rx="3" fill="#fff"/>` +
  `<rect x="29" y="22" width="6" height="30" fill="#b08d57"/>` +
  `<ellipse cx="25" cy="17" rx="5" ry="4" fill="none" stroke="#b08d57" stroke-width="4"/>` +
  `<ellipse cx="39" cy="17" rx="5" ry="4" fill="none" stroke="#b08d57" stroke-width="4"/></svg>`;

// ---------- owners: sessions, Log in with PayPal ----------
function cookieVal(request, name) {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(request.headers.get("cookie") || ""); return m ? m[1] : null;
}
// One login across gift.directory and every <slug>.gift.directory; host-only anywhere else.
function sessionCookie(url, value, maxAge) {
  const dom = url.hostname === ROOT || url.hostname.endsWith("." + ROOT) ? `; Domain=${ROOT}` : "";
  return `gd_s=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}${dom}`;
}
async function currentUser(db, request) {
  const sid = cookieVal(request, "gd_s"); if (!sid) return null;
  const s = await db.prepare("SELECT * FROM sessions WHERE id=? AND expires_at > ?").bind(await sha256(sid), now()).first();
  return s ? { payer_id: s.payer_id, emails: JSON.parse(s.emails_json), name: s.name } : null;
}
async function ownedStores(db, user) {
  const all = (await db.prepare("SELECT * FROM stores ORDER BY created_at").all()).results;
  return all.filter(s => ownsStore(user, s));
}
// The code PayPal handed back → who this person is. The PayPal token is used once and never stored.
async function paypalLogin(env, code) {
  const base = env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const t = await fetch(`${base}/v1/oauth2/token`, { method: "POST",
    headers: { authorization: "Basic " + btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`), "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=authorization_code&code=${encodeURIComponent(code)}` });
  if (!t.ok) return null;
  const tok = (await t.json()).access_token; if (!tok) return null;
  for (const path of ["/v1/identity/oauth2/userinfo?schema=paypalv1.1", "/v1/identity/openidconnect/userinfo?schema=openid"]) {
    const r = await fetch(base + path, { headers: { authorization: `Bearer ${tok}` } });
    if (r.ok) { const u = parseUserinfo(await r.json()); if (u) return u; }
  }
  return null;
}
async function storeItems(db, storeId) {
  return (await db.prepare("SELECT * FROM store_items WHERE store_id=?").bind(storeId).all()).results;
}
// A typed search: any price from $5 to $500, junk and duplicates out. No model: it should feel instant.
async function searchCards(env, q) {
  if (!env.CHANNEL3_API_KEY) return [];
  const brief = { budget_cents: 50000, min_cents: 500 };
  const ps = await channel3Search(env, q, brief).catch(() => []);
  return mergeCards([ps.map(p => toCard(p, brief.budget_cents)).filter(Boolean)]).slice(0, 24);
}

// ---------- stores ----------
const isWorkersDev = h => h.endsWith(".workers.dev");
// A store's address. On workers.dev (testing, before DNS) stores are picked with ?store=<slug>.
function storeUrl(env, url, slug) {
  return isWorkersDev(url.hostname) ? `${url.origin}/?store=${slug}` : `https://${slug}.${ROOT}/`;
}
function withCookie(resP, cookie) {
  if (!cookie) return resP;
  return Promise.resolve(resP).then(r => { const h = new Headers(r.headers); h.append("set-cookie", cookie); return new Response(r.body, { status: r.status, headers: h }); });
}
// Ask PayPal about a store's subscription and move the store to match. Never more often than every
// 6 hours per store from page views; always when the owner comes back from approving.
async function refreshSubscription(db, env, s) {
  const r = await paypalFetch(env, `/v1/billing/subscriptions/${encodeURIComponent(s.paypal_subscription_id)}`);
  if (r.status >= 300 || !r.body) return s;
  // The subscription must be ours, for this store, on our plan: an id pasted from elsewhere changes nothing.
  if (r.body.custom_id !== s.id || r.body.plan_id !== env.PAYPAL_PLAN_ID) return s;
  const status = storeStatusFor(r.body.status, s.status), t = now();
  // Whoever paid owns the store: their PayPal payer id is what "Log in with PayPal" matches later.
  const payer = (r.body.subscriber && r.body.subscriber.payer_id) || null;
  await db.prepare("UPDATE stores SET status=?, subscription_status=?, owner_payer_id=COALESCE(owner_payer_id,?), checked_at=?, updated_at=? WHERE id=?")
    .bind(status, r.body.status, payer, t, t, s.id).run();
  return { ...s, status, subscription_status: r.body.status, owner_payer_id: s.owner_payer_id || payer, checked_at: t };
}
async function resolveStore(db, env, url, request) {
  let key = hostKey(url.hostname);
  let setCookie = null;
  if (isWorkersDev(url.hostname)) {
    // Testing on workers.dev: ?store=<slug> picks a store and is remembered; ?store= alone returns
    // to the platform; with neither, the house store (Lawyer Gifts) answers, as it always has.
    const q = url.searchParams.get("store");
    const cookie = /(?:^|;\s*)store=([a-z0-9-]*)/.exec(request.headers.get("cookie") || "");
    const pick = q !== null ? q : cookie ? cookie[1] : "lawyers";
    if (q !== null) setCookie = `store=${q}; Path=/; Secure; SameSite=Lax; Max-Age=86400`;
    key = pick ? { slug: pick } : { platform: true };
  }
  if (key.platform) return { platform: true, setCookie };
  let store = key.slug ? await db.prepare("SELECT * FROM stores WHERE slug=?").bind(key.slug).first()
                       : await db.prepare("SELECT * FROM stores WHERE custom_host=?").bind(key.host).first();
  if (store && store.paypal_subscription_id && store.status !== "draft" &&
      (!store.checked_at || Date.now() - Date.parse(store.checked_at) > 6 * 3600 * 1000)) {
    try { store = await refreshSubscription(db, env, store); } catch {}
  }
  return { store, setCookie };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const m = request.method;
    const db = env.DB;
    try {
      const { store, platform, setCookie } = await resolveStore(db, env, url, request);
      const page = path => withCookie(env.ASSETS.fetch(new Request(new URL(path, url), request)), setCookie);
      // The tab icon, in the store's own color (the platform's navy elsewhere). Same drawing as favicon.ico.
      if (url.pathname === "/favicon.svg") {
        let accent = "#1f3a5f";
        try { const a = store && JSON.parse(store.config_json).accent; if (/^#[0-9a-fA-F]{6}$/.test(a || "")) accent = a; } catch {}
        return new Response(faviconSvg(accent), { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
      }
      if (parts[0] !== "api") {
        // Ask for bare names ("/pool", not "/pool.html"): the asset server answers .html with a 307
        // to the bare name, and that redirect reached the browser and threw away /g/<id>.
        if (parts[0] === "g" && parts[1]) return page("/pool");
        // Logins all go through gift.directory, the one callback address registered with PayPal.
        if (parts[0] === "login") {
          if (url.hostname !== ROOT && !isWorkersDev(url.hostname)) return Response.redirect(`https://${ROOT}/login`, 302);
          const state = uid();
          await db.prepare("INSERT INTO oauth_states (state,created_at) VALUES (?,?)").bind(state, now()).run();
          return Response.redirect(authorizeUrl(env, `${url.origin}/api/auth/paypal/callback`, state), 302);
        }
        if (parts[0] === "admin") {
          if (url.hostname !== ROOT && !isWorkersDev(url.hostname) && url.hostname.endsWith("." + ROOT)) return Response.redirect(`https://${ROOT}/admin`, 302);
          return page("/admin");
        }
        if (platform && (parts.length === 0 || parts[0] === "new")) return page("/platform");
        if (parts.length === 0) return page("/");
        return env.ASSETS.fetch(request);
      }

      // ---------- which store is this ----------
      if (parts[1] === "store" && m === "GET") {
        if (platform) return J({ platform: true });
        if (!store) return J({ error: "No store here." }, 404);
        const user = await currentUser(db, request);
        return withCookie(Promise.resolve(J({ ...publicStore(store), shelves: shelves(await storeItems(db, store.id)),
          can_edit: ownsStore(user, store) })), setCookie);
      }

      // ---------- the front-page grid ----------
      if (parts[1] === "browse" && m === "GET") {
        if (!store || store.status !== "active") return J({ error: "This store isn't open." }, 404);
        const hit = await db.prepare("SELECT cards_json, created_at FROM browse_cache WHERE store_id=?").bind(store.id).first();
        const items = await storeItems(db, store.id);
        if (hit && Date.now() - Date.parse(hit.created_at) < 6 * 3600 * 1000) return J({ cards: withoutHidden(JSON.parse(hit.cards_json), items), cached: true });
        if (!env.CHANNEL3_API_KEY) return J({ cards: [] });
        const cfg = JSON.parse(store.config_json);
        const planSystem = cfg.house ? undefined : storePlanSystem({ ...cfg, name: store.name, niche: store.niche });
        const r = await browseGifts(store.niche, { ai: aiFor(env), search: (q, b) => channel3Search(env, q, b), planSystem, queries: cfg.browse_searches });
        if (r.cards.length) await db.prepare("INSERT INTO browse_cache (store_id,cards_json,created_at) VALUES (?,?,?) ON CONFLICT(store_id) DO UPDATE SET cards_json=excluded.cards_json, created_at=excluded.created_at")
          .bind(store.id, JSON.stringify(r.cards), now()).run();
        return J({ cards: withoutHidden(r.cards, items), cached: false });
      }

      // ---------- the finder ----------
      if (parts[1] === "find" && m === "POST") {
        if (!store || store.status !== "active") return J({ error: "This store isn't open." }, 404);
        const v = validateBrief(await readJson(request));
        if (v.error) return J({ error: v.error }, 400);
        const court = courtCheck(v.brief); // gift rules first: nothing is searched for a judge
        if (court.flagged) return J({ court, plan: [], picks: [] });
        if (!env.CHANNEL3_API_KEY) return J({ error: "Product search is not configured yet." }, 503);
        const cfg = JSON.parse(store.config_json);
        const planSystem = cfg.house ? undefined : storePlanSystem({ ...cfg, name: store.name, niche: store.niche });
        const r = await findGifts(v.brief, { ai: aiFor(env), search: q => channel3Search(env, q, v.brief), planSystem });
        const items = await storeItems(db, store.id);
        r.picks = withoutHidden(r.picks || [], items); r.more = withoutHidden(r.more || [], items);
        const id = uid();
        await db.prepare("INSERT INTO searches (id,brief_json,plan_json,picks_json,created_at,store_id) VALUES (?,?,?,?,?,?)")
          .bind(id, JSON.stringify(v.brief), JSON.stringify(r.plan), JSON.stringify(r.picks), now(), store.id).run();
        return J({ search_id: id, ...r });
      }

      // ---------- shopper search (the store's search bar) ----------
      if (parts[1] === "search" && m === "GET") {
        if (!store || store.status !== "active") return J({ error: "This store isn't open." }, 404);
        const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
        if (q.length < 2) return J({ cards: [] });
        const items = await storeItems(db, store.id);
        return J({ q, cards: withoutHidden(await searchCards(env, q), items) });
      }

      // ---------- Log in with PayPal ----------
      if (parts[1] === "auth") {
        if (parts[2] === "paypal" && parts[3] === "callback" && m === "GET") {
          const state = url.searchParams.get("state") || "", code = url.searchParams.get("code") || "";
          const st = state && await db.prepare("DELETE FROM oauth_states WHERE state=? RETURNING created_at").bind(state).first();
          if (!st || Date.now() - Date.parse(st.created_at) > 15 * 60 * 1000 || !code) return Response.redirect(`${url.origin}/admin?login=failed`, 303);
          const user = await paypalLogin(env, code);
          if (!user) return Response.redirect(`${url.origin}/admin?login=failed`, 303);
          const sid = uid() + uid().replace(/-/g, ""), t = new Date();
          await db.prepare("INSERT INTO sessions (id,payer_id,emails_json,name,created_at,expires_at) VALUES (?,?,?,?,?,?)")
            .bind(await sha256(sid), user.payer_id, JSON.stringify(user.emails), user.name, t.toISOString(), new Date(+t + 14 * 864e5).toISOString()).run();
          return new Response(null, { status: 303, headers: { location: `${url.origin}/admin`, "set-cookie": sessionCookie(url, sid, 14 * 86400) } });
        }
        if (parts[2] === "logout" && m === "POST") {
          const sid = cookieVal(request, "gd_s");
          if (sid) await db.prepare("DELETE FROM sessions WHERE id=?").bind(await sha256(sid)).run();
          return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json", "set-cookie": sessionCookie(url, "", 0) } });
        }
      }

      // ---------- the owner's back end ----------
      if (parts[1] === "admin") {
        const user = await currentUser(db, request);
        if (!user) return J({ error: "Log in with PayPal first.", login: `${url.origin}/login` }, 401);
        const mine = await ownedStores(db, user);
        if (parts[2] === "me" && m === "GET")
          return J({ user: { name: user.name, emails: user.emails }, stores: mine.map(s => ({ id: s.id, slug: s.slug, name: s.name, status: s.status, url: storeUrl(env, url, s.slug) })) });
        if (parts[2] === "stores" && parts[3]) {
          const s = mine.find(x => x.id === parts[3]);
          if (!s) return J({ error: "Not your store." }, 403);
          const cfg = JSON.parse(s.config_json);
          if (parts.length === 4 && m === "GET") {
            const items = await storeItems(db, s.id);
            const pools = (await db.prepare("SELECT id,title,raised_cents,target_cents,status,created_at FROM pools WHERE store_id=? ORDER BY created_at DESC LIMIT 50").bind(s.id).all()).results;
            const searches = await db.prepare("SELECT COUNT(*) n FROM searches WHERE store_id=?").bind(s.id).first();
            const fc = await db.prepare("SELECT cards_json FROM browse_cache WHERE store_id=?").bind(s.id).first();
            const front = fc ? JSON.parse(fc.cards_json) : [];
            return J({ store: { id: s.id, slug: s.slug, name: s.name, tagline: s.tagline, niche: s.niche, status: s.status, url: storeUrl(env, url, s.slug), house: !!cfg.house,
                       occasions: cfg.occasions, recipient_examples: cfg.recipient_examples || [], search_guidance: cfg.search_guidance || "", avoid: cfg.avoid || "", accent: cfg.accent },
                       subscription: { id: s.paypal_subscription_id, status: s.subscription_status, checked_at: s.checked_at, manage_url: `${paypalWebBase(env)}/myaccount/autopay/` },
                       items: items.map(i => ({ product_id: i.product_id, status: i.status, collection: i.collection, card: JSON.parse(i.card_json) })),
                       front, pools, searches: searches.n });
          }
          if (parts[4] === "settings" && m === "PUT") {
            const v = validateSettings(await readJson(request), darkEnough);
            if (v.error) return J({ error: v.error }, 400);
            const next = { ...cfg, ...v.settings, accent: v.settings.accent || cfg.accent }; delete next.name; delete next.tagline;
            await db.batch([
              db.prepare("UPDATE stores SET name=?, tagline=?, config_json=?, updated_at=? WHERE id=?").bind(v.settings.name, v.settings.tagline, JSON.stringify(next), now(), s.id),
              db.prepare("DELETE FROM browse_cache WHERE store_id=?").bind(s.id),   // the grid follows the new guidance
            ]);
            return J({ ok: true });
          }
          if (parts[4] === "search" && m === "GET") {
            const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
            return J({ cards: q.length >= 2 ? await searchCards(env, q) : [] });
          }
          if (parts[4] === "items" && parts.length === 5 && m === "PUT") {
            const v = validateItem(await readJson(request));
            if (v.error) return J({ error: v.error }, 400);
            const n = await db.prepare("SELECT COUNT(*) n FROM store_items WHERE store_id=?").bind(s.id).first();
            if (n.n >= 300) return J({ error: "That's the most a store can curate." }, 409);
            await db.prepare("INSERT INTO store_items (store_id,product_id,status,collection,card_json,sort,created_at) VALUES (?,?,?,?,?,?,?) " +
              "ON CONFLICT(store_id,product_id) DO UPDATE SET status=excluded.status, collection=excluded.collection, card_json=excluded.card_json")
              .bind(s.id, v.item.card.product_id, v.item.status, v.item.collection, JSON.stringify(v.item.card), n.n, now()).run();
            return J({ ok: true });
          }
          if (parts[4] === "items" && parts[5] && m === "DELETE") {
            await db.prepare("DELETE FROM store_items WHERE store_id=? AND product_id=?").bind(s.id, decodeURIComponent(parts[5])).run();
            return J({ ok: true });
          }
        }
        return J({ error: "not found" }, 404);
      }

      // ---------- gift.directory: draft and publish a store ----------
      if (parts[1] === "stores") {
        if (parts[2] === "draft" && m === "POST") {
          const b = (await readJson(request)) || {};
          const niche = String(b.niche || "").trim().slice(0, 120);
          if (niche.length < 3) return J({ error: "Tell us who the store is for." }, 400);
          let j = null; try { j = await aiFor(env)(DRAFT_SYSTEM, `The store is for: ${niche}`); } catch { j = null; }
          const draft = parseDraft(j, niche);
          // Offer a free address: add -2, -3 … if the AI's slug is taken.
          for (let n = 2, base = draft.slug; await db.prepare("SELECT 1 FROM stores WHERE slug=?").bind(draft.slug).first(); n++) draft.slug = `${base}-${n}`.slice(0, 30);
          return J({ niche, draft, ai_drafted: !!j });
        }
        if (parts.length === 2 && m === "POST") {
          if (!paypalOn(env) || !env.PAYPAL_PLAN_ID) return J({ error: "Store billing is not configured." }, 503);
          const v = validateStore(await readJson(request));
          if (v.error) return J({ error: v.error }, 400);
          const s = v.store;
          if (await db.prepare("SELECT 1 FROM stores WHERE slug=?").bind(s.slug).first()) return J({ error: `${s.slug}.${ROOT} is taken.` }, 409);
          const id = uid(), token = uid(), t = now();
          const cfg = { occasions: s.occasions, recipient_examples: s.recipient_examples, search_guidance: s.search_guidance, avoid: s.avoid, accent: s.accent };
          await db.prepare("INSERT INTO stores (id,slug,name,tagline,niche,config_json,owner_email,manage_hash,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'draft',?,?)")
            .bind(id, s.slug, s.name, s.tagline, s.niche, JSON.stringify(cfg), s.owner_email, await sha256(token), t, t).run();
          const r = await paypalFetch(env, "/v1/billing/subscriptions", { method: "POST", body: subscriptionBody({ id }, env.PAYPAL_PLAN_ID, url.origin),
            headers: { "PayPal-Request-Id": `sub-${id}` } });
          const href = r.status < 300 && r.body ? (link(r.body, "approve") || {}).href : null;
          if (!href) return J({ error: "PayPal could not start the subscription.", paypal_status: r.status, paypal_error: r.body && (r.body.name || r.body.message) }, 502);
          await db.prepare("UPDATE stores SET paypal_subscription_id=?, subscription_status=?, updated_at=? WHERE id=?").bind(r.body.id, r.body.status || null, now(), id).run();
          return J({ id, slug: s.slug, manage_token: token, approve_url: href, store_url: storeUrl(env, url, s.slug) }, 201);
        }
        // PayPal sends the owner back here after approving. PayPal's own record decides.
        if (parts[3] === "subscribed" && m === "GET") {
          const s = await db.prepare("SELECT * FROM stores WHERE id=?").bind(parts[2]).first();
          if (!s || !s.paypal_subscription_id) return Response.redirect(`${url.origin}/new`, 303);
          const fresh = await refreshSubscription(db, env, s);
          return Response.redirect(fresh.status === "active" ? `${storeUrl(env, url, s.slug)}?welcome=1` : `${url.origin}/new?pending=${s.id}`, 303);
        }
      }

      // ---------- group gift pools ----------
      if (parts[1] === "pools") {
        if (parts.length === 2 && m === "POST") {
          if (!store || store.status !== "active") return J({ error: "This store isn't open." }, 404);
          const v = validatePool(await readJson(request));
          if (v.error) return J({ error: v.error }, 400);
          const id = shortId(), token = uid(), t = now(), p = v.pool;
          await db.prepare("INSERT INTO pools (id,manage_hash,title,occasion,organizer_name,organizer_email,product_json,target_cents,created_at,updated_at,store_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
            .bind(id, await sha256(token), p.title, p.occasion, p.organizer_name, p.organizer_email, JSON.stringify(p.product), p.target_cents, t, t, store.id).run();
          return J({ id, manage_token: token, share_url: `${url.origin}/g/${id}` }, 201);
        }
        // PayPal sends the contributor back here; the capture is what counts the money.
        if (parts[2] === "return" && m === "GET") {
          const orderId = url.searchParams.get("token");
          const c = orderId && await db.prepare("SELECT * FROM contributions WHERE paypal_order_id=?").bind(orderId).first();
          if (!c) return Response.redirect(`${url.origin}/`, 303);
          if (c.status === "pending") {
            const r = await paypalFetch(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
              { method: "POST", body: {}, headers: { "PayPal-Request-Id": `cap-${c.id}`, Prefer: "return=representation" } });
            let cap = r.status < 300 ? readCapture(r.body) : null;
            // Already captured (a refresh, a second tab, a retry): read the order instead of guessing.
            const already = r.body && (r.body.name === "ORDER_ALREADY_CAPTURED" ||
              (r.body.details || []).some(d => d && d.issue === "ORDER_ALREADY_CAPTURED"));
            if (!cap && already) { const g = await paypalFetch(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}`); cap = g.status < 300 ? readCapture(g.body) : null; }
            if (!cap) cap = { status: "PENDING", reason: `capture HTTP ${r.status}` };
            const res = await applyCapture(db, c, cap);
            return Response.redirect(`${url.origin}/g/${c.pool_id}?paid=${res.outcome === "paid" || res.outcome === "already" ? 1 : 0}`, 303);
          }
          return Response.redirect(`${url.origin}/g/${c.pool_id}?paid=${c.status === "paid" ? 1 : 0}`, 303);
        }
        if (parts[2] === "cancel" && m === "GET") {
          const orderId = url.searchParams.get("token");
          const c = orderId && await db.prepare("SELECT * FROM contributions WHERE paypal_order_id=?").bind(orderId).first();
          if (c) await db.prepare("UPDATE contributions SET status='cancelled', note='Cancelled at PayPal.', updated_at=? WHERE id=? AND status='pending'").bind(now(), c.id).run();
          return Response.redirect(c ? `${url.origin}/g/${c.pool_id}?cancelled=1` : `${url.origin}/`, 303);
        }
        const pool = parts[2] && await db.prepare("SELECT * FROM pools WHERE id=?").bind(parts[2]).first();
        if (!pool) return J({ error: "not found" }, 404);
        if (parts.length === 3 && m === "GET") {
          const cs = (await db.prepare("SELECT * FROM contributions WHERE pool_id=? ORDER BY paid_at").bind(pool.id).all()).results;
          return J(publicPool(pool, cs));
        }
        if (parts[3] === "contribute" && m === "POST") {
          if (!paypalOn(env)) return J({ error: "PayPal is not configured." }, 503);
          const b = (await readJson(request)) || {};
          const cents = Math.round(Number(b.amount_cents));
          const err = contributionError(pool, cents);
          if (err) return J({ error: err }, 409);
          const c = { id: uid(), pool_id: pool.id, amount_cents: cents };
          const r = await paypalFetch(env, "/v2/checkout/orders", { method: "POST", body: buildContributionOrder(pool, c, url.origin),
            headers: { "PayPal-Request-Id": c.id } });
          const href = r.status < 300 && r.body ? (link(r.body, "payer-action") || link(r.body, "approve") || {}).href : null;
          if (!href) return J({ error: "PayPal could not start the payment.", paypal_status: r.status, paypal_error: r.body && (r.body.name || r.body.message), detail: r.body && r.body.details }, 502);
          const t = now();
          await db.prepare("INSERT INTO contributions (id,pool_id,paypal_order_id,amount_cents,name,message,hide_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'pending',?,?)")
            .bind(c.id, pool.id, r.body.id, cents, String(b.name || "").slice(0, 60) || null, String(b.message || "").slice(0, 280) || null, b.hide_name ? 1 : 0, t, t).run();
          return J({ url: href });
        }
        // The organizer's controls: private token, never in the share link.
        if (parts[3] === "close" && m === "POST") {
          const tok = request.headers.get("x-manage-token") || "";
          if (!tok || (await sha256(tok)) !== pool.manage_hash) return J({ error: "not allowed" }, 403);
          await db.prepare("UPDATE pools SET status='closed', updated_at=? WHERE id=? AND status IN ('open','funded')").bind(now(), pool.id).run();
          return J({ id: pool.id, status: "closed" });
        }
      }
      return J({ error: "not found" }, 404);
    } catch (e) {
      return J({ error: String((e && e.message) || e) }, 500);
    }
  },
};
