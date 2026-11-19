// Counting clicks out to stores: which of our pages earned the click, and which store it went to. A count per day,
// nothing about the visitor. The page reports the click with a beacon as the reader leaves; the link itself is untouched.

// In every page's footer. "View at levenger.com" / "Shop at Oedro" name the store; otherwise the link's own host does.
export const CLICK_SCRIPT = `<script>addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest('a[rel~="sponsored"]');if(!a||!navigator.sendBeacon)return;try{var t=(a.textContent||"").trim(),m=/^(?:View|Shop) at (.+)$/.exec(t);navigator.sendBeacon("/api/click",JSON.stringify({p:location.pathname,m:m?m[1]:new URL(a.href).hostname}))}catch(_){}},true)</script>`;

export const cleanPath = p => { p = String(p || ""); return /^\/[A-Za-z0-9/_.-]{0,119}$/.test(p) ? p : null; };
export const cleanMerchant = m => { m = String(m || "").replace(/[^\p{L}\p{N} .&'\/–-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 60); return m.length >= 2 ? m : null; };

// One click. `raw` is the beacon's body (text). Crawlers and malformed reports are dropped without a word.
export async function countClick(db, { raw, host, ua, lang, day }) {
  if (!ua || !lang || /bot|crawl|spider|slurp|preview|monitor|curl|wget|python|node|headless|lighthouse|scrap|fetch|http-client|axios|go-http/i.test(ua)) return false;
  let j; try { j = JSON.parse(String(raw || "").slice(0, 600)); } catch { return false; }
  const path = cleanPath(j && j.p), merchant = cleanMerchant(j && j.m);
  if (!path || !merchant || !/^[a-z0-9.-]{1,80}$/i.test(String(host || ""))) return false;
  await db.prepare("INSERT INTO link_clicks (day,host,path,merchant,n) VALUES (?,?,?,?,1) ON CONFLICT(day,host,path,merchant) DO UPDATE SET n=n+1").bind(day, host, path, merchant).run();
  return true;
}
// The operator's report: clicks and human page views for the last `days` days, by page and by store.
export async function clickReport(db, days = 7, nowMs = Date.now()) {
  const since = new Date(nowMs - Math.max(1, Math.min(90, days | 0)) * 864e5).toISOString().slice(0, 10);
  const q = (sql) => db.prepare(sql).bind(since).all().then(r => r.results);
  const [total, pages, stores, views] = await Promise.all([
    q("SELECT COALESCE(SUM(n),0) AS n FROM link_clicks WHERE day >= ?"),
    q("SELECT host, path, SUM(n) AS clicks FROM link_clicks WHERE day >= ? GROUP BY host, path ORDER BY clicks DESC LIMIT 25"),
    q("SELECT merchant, SUM(n) AS clicks FROM link_clicks WHERE day >= ? GROUP BY merchant ORDER BY clicks DESC LIMIT 25"),
    q("SELECT host, path, SUM(n) AS views FROM page_views WHERE day >= ? AND kind='human' GROUP BY host, path ORDER BY views DESC LIMIT 25"),
  ]);
  const v = new Map(views.map(r => [r.host + r.path, r.views]));
  return { since, clicks: total[0].n, top_pages: pages.map(r => ({ ...r, views: v.get(r.host + r.path) ?? null })), top_stores: stores, most_viewed: views };
}
