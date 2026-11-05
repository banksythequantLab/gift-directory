// Gift Finder — API worker. Static pages (finder, pool page) are served from ./public.
import { paypalFetch, link } from "./paypal-core.js";
import { validateBrief, findGifts, browseGifts, channel3Search, courtCheck } from "./finder.js";
import { validatePool, contributionError, buildContributionOrder, readCapture, applyCapture, publicPool } from "./pools.js";
import { ROOT, DRAFT_SYSTEM, parseDraft, validateStore, storePlanSystem, subscriptionBody, storeStatusFor, hostKey, publicStore } from "./stores.js";

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
  await db.prepare("UPDATE stores SET status=?, subscription_status=?, checked_at=?, updated_at=? WHERE id=?").bind(status, r.body.status, t, t, s.id).run();
  return { ...s, status, subscription_status: r.body.status, checked_at: t };
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
        if (platform && (parts.length === 0 || parts[0] === "new")) return page("/platform");
        if (parts.length === 0) return page("/");
        return env.ASSETS.fetch(request);
      }

      // ---------- which store is this ----------
      if (parts[1] === "store" && m === "GET") {
        if (platform) return J({ platform: true });
        if (!store) return J({ error: "No store here." }, 404);
        return withCookie(Promise.resolve(J(publicStore(store))), setCookie);
      }

      // ---------- the front-page grid ----------
      if (parts[1] === "browse" && m === "GET") {
        if (!store || store.status !== "active") return J({ error: "This store isn't open." }, 404);
        const hit = await db.prepare("SELECT cards_json, created_at FROM browse_cache WHERE store_id=?").bind(store.id).first();
        if (hit && Date.now() - Date.parse(hit.created_at) < 6 * 3600 * 1000) return J({ cards: JSON.parse(hit.cards_json), cached: true });
        if (!env.CHANNEL3_API_KEY) return J({ cards: [] });
        const cfg = JSON.parse(store.config_json);
        const planSystem = cfg.house ? undefined : storePlanSystem({ ...cfg, name: store.name, niche: store.niche });
        const r = await browseGifts(store.niche, { ai: aiFor(env), search: (q, b) => channel3Search(env, q, b), planSystem });
        if (r.cards.length) await db.prepare("INSERT INTO browse_cache (store_id,cards_json,created_at) VALUES (?,?,?) ON CONFLICT(store_id) DO UPDATE SET cards_json=excluded.cards_json, created_at=excluded.created_at")
          .bind(store.id, JSON.stringify(r.cards), now()).run();
        return J({ cards: r.cards, cached: false });
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
        const id = uid();
        await db.prepare("INSERT INTO searches (id,brief_json,plan_json,picks_json,created_at,store_id) VALUES (?,?,?,?,?,?)")
          .bind(id, JSON.stringify(v.brief), JSON.stringify(r.plan), JSON.stringify(r.picks), now(), store.id).run();
        return J({ search_id: id, ...r });
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
