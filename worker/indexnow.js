// IndexNow: tell Bing, Yandex and the other IndexNow engines which pages changed, so they recrawl them within hours.
// The key is public by design (it is served at /<key>.txt); only URLs on gift.directory itself are sent.
import { pageBySlug, indexable } from "./seo.js";
import { SALE_BUDGETS } from "./deals.js";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow", BING_ENDPOINT = "https://www.bing.com/indexnow";
const ROOT = "https://gift.directory";

export async function pingIndexNow(env, urls, { fetchFn = fetch } = {}) {
  const key = env.INDEXNOW_KEY;
  const list = [...new Set(urls)].filter(u => typeof u === "string" && u.startsWith(ROOT + "/")).slice(0, 10000);
  if (!key || !list.length) return { ok: false, skipped: true, n: 0 };
  const body = JSON.stringify({ host: "gift.directory", key, keyLocation: `${ROOT}/${key}.txt`, urlList: list });
  // The shared endpoint sometimes turns Cloudflare's addresses away (429); Bing's own endpoint shares with the others too.
  let status = 0;
  for (const ep of [INDEXNOW_ENDPOINT, BING_ENDPOINT]) {
    const r = await fetchFn(ep, { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body });
    status = r.status;
    if (status === 200 || status === 202) return { ok: true, status, n: list.length, via: ep };
  }
  return { ok: false, status, n: list.length };
}

// The pages that change every day, plus every listed guide rebuilt since `hours` ago (all listed guides with all: true).
export async function changedUrls(db, { nowMs = Date.now(), hours = 26, all = false } = {}) {
  const since = new Date(nowMs - hours * 3600e3).toISOString();
  const rows = (await db.prepare("SELECT slug, json_array_length(cards_json) AS n, updated_at FROM seo_pages" + (all ? "" : " WHERE updated_at > ?"))
    .bind(...(all ? [] : [since])).all()).results;
  const guides = rows.filter(r => { const p = pageBySlug(r.slug); return indexable(p, r.n); }).map(r => `${ROOT}/gifts/${r.slug}`);
  return [`${ROOT}/`, `${ROOT}/sales`, `${ROOT}/black-friday`, ...SALE_BUDGETS.map(b => `${ROOT}/sales/under-${b}`), ...guides];
}

export async function indexNowDaily(db, env, opts = {}) {
  return pingIndexNow(env, await changedUrls(db, opts), opts);
}
