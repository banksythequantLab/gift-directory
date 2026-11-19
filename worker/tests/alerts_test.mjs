// Price-drop alerts: who can sign up for what, when the one email goes out, and that the address is gone afterwards.
import { validEmail, watchable, dropped, alertForm, addAlert, removeAlert, alertEmail, runAlerts, addedPage, ALERT_MAX_PER_EMAIL, ALERT_DAYS } from "../alerts.js";
import { renderGuide, pageBySlug } from "../seo.js";
import { isDeal, DEAL_MAX_PCT } from "../deals.js";
import { d1 } from "./d1shim.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);
const makeDb = () => d1(join(dirname(fileURLToPath(import.meta.url)), "..", "migrations"));

eq("an email is trimmed and lowercased", validEmail("  Pat@Mail.Test "), "pat@mail.test");
for (const bad of ["", "pat", "pat@", "pat@x", "a b@x.com", "pat@example.com", "x@y.com,z@y.com", "<pat@x.com>"]) ok(`not an address: ${JSON.stringify(bad)}`, validEmail(bad) === null);
const c3 = { product_id: "AbC123xyz", title: "Garden Kneeler", url: "https://shop.test/k", price_cents: 4000, image: "https://shop.test/k.jpg", merchant: "shop.test" };
const cj = { ...c3, product_id: "cj:7889430:55" };
ok("a catalog product can be watched", watchable(c3));
ok("an affiliate-feed product cannot (no way to re-price it by id)", !watchable(cj));
ok("5% and a dollar is a drop", dropped(4000, 3800) && !dropped(4000, 3900) && !dropped(1000, 940) && !dropped(4000, 4000) && !dropped(4000, 0));
ok("the form names the product and the guide", alertForm(c3, "gifts-for-gardeners").includes('name="p" value="AbC123xyz"') && alertForm(c3, "gifts-for-gardeners").includes('action="/api/alerts"'));
eq("no form for a product we can't watch", alertForm(cj, "gifts-for-gardeners"), "");
eq("no form without a guide", alertForm(c3, ""), "");

const p = pageBySlug("gifts-for-gardeners");
const page = renderGuide(p, { guide_json: JSON.stringify({ intro: ["x"], tips: [], faq: [] }), cards_json: JSON.stringify([c3, cj]), updated_at: "2026-11-19T00:00:00Z" }, [], null);
eq("a guide shows the form once per watchable product", page.split('action="/api/alerts"').length - 1, 1);

const db = makeDb(), T0 = Date.parse("2026-11-19T12:00:00Z");
await db.prepare("INSERT INTO seo_pages (slug,guide_json,cards_json,updated_at,created_at) VALUES (?,?,?,?,?)").bind("gifts-for-gardeners", "{}", JSON.stringify([c3, cj]), "2026-11-19", "2026-11-19").run();
const count = async () => (await db.prepare("SELECT COUNT(*) AS n FROM price_alerts").first()).n;

ok("a bad address is refused", !(await addAlert(db, { email: "nope", product_id: "AbC123xyz", slug: "gifts-for-gardeners" }, T0)).ok);
ok("a product that isn't on that guide is refused", !(await addAlert(db, { email: "pat@mail.test", product_id: "zzzz9999", slug: "gifts-for-gardeners" }, T0)).ok);
ok("an affiliate-feed product is refused", !(await addAlert(db, { email: "pat@mail.test", product_id: cj.product_id, slug: "gifts-for-gardeners" }, T0)).ok);
ok("a bot that fills the trap is thanked and stored nowhere", (await addAlert(db, { email: "bot@mail.test", product_id: "AbC123xyz", slug: "gifts-for-gardeners", website: "http://spam" }, T0)).quiet && await count() === 0);
const added = await addAlert(db, { email: "Pat@Mail.Test", product_id: "AbC123xyz", slug: "gifts-for-gardeners" }, T0);
ok("a real sign-up is stored with today's price", added.ok && added.price_cents === 4000 && await count() === 1);
await addAlert(db, { email: "pat@mail.test", product_id: "AbC123xyz", slug: "gifts-for-gardeners" }, T0);
eq("asking twice is one watch", await count(), 1);
ok("the thank-you page says what happens", (await addedPage(added).text()).includes("one email") && addedPage(added).headers.get("x-robots-tag") === "noindex");
eq("a refusal is a 400", addedPage({ ok: false, error: "x" }).status, 400);

const sent = [], env = { EMAIL: { send: async m => { sent.push(m); } }, CHANNEL3_API_KEY: "k" };
const catalog = price => async () => new Response(JSON.stringify({ id: "AbC123xyz", title: "Garden Kneeler", url: "https://shop.test/k", brands: [], images: [{ url: "https://shop.test/k.jpg" }],
  offers: [{ url: "https://shop.test/k", domain: "shop.test", price: { price: price / 100, currency: "USD" }, availability: "InStock" }] }), { status: 200, headers: { "content-type": "application/json" } });
let r = await runAlerts(db, env, { fetchImpl: catalog(3950), nowMs: T0 + 3600e3 });
ok("a small dip sends nothing and keeps the watch", r.sent === 0 && sent.length === 0 && await count() === 1, JSON.stringify(r));
r = await runAlerts(db, env, { fetchImpl: catalog(3400), nowMs: T0 + 7200e3 });
ok("a real drop sends one email", r.sent === 1 && sent.length === 1 && sent[0].to === "pat@mail.test" && /Now \$34/.test(sent[0].text) && /Was \$40/.test(sent[0].text), JSON.stringify(r) + JSON.stringify(sent[0] || null));
eq("and the address is deleted with it", await count(), 0);
ok("the email says it is the only one and discloses the commission", /only email/.test(sent[0].text) && /commission/.test(sent[0].text) && sent[0].from === "reminders@gift.directory");

await addAlert(db, { email: "lee@mail.test", product_id: "AbC123xyz", slug: "gifts-for-gardeners" }, T0);
r = await runAlerts(db, env, { fetchImpl: async () => new Response("", { status: 404 }), nowMs: T0 + 3600e3 });
ok("a product the catalog dropped ends its watches", r.gone === 1 && await count() === 0);
await addAlert(db, { email: "lee@mail.test", product_id: "AbC123xyz", slug: "gifts-for-gardeners" }, T0);
r = await runAlerts(db, { CHANNEL3_API_KEY: "k" }, { fetchImpl: catalog(1000), nowMs: T0 + (ALERT_DAYS + 1) * 864e5 });
ok("after ninety days the address is deleted even with no email service", r.expired === 1 && await count() === 0);
await addAlert(db, { email: "lee@mail.test", product_id: "AbC123xyz", slug: "gifts-for-gardeners" }, T0);
const tok = (await db.prepare("SELECT token FROM price_alerts").first()).token;
ok("a watch can be removed by its token, and only a real token", await removeAlert(db, "x' OR 1=1") === 0 && await removeAlert(db, tok) === 1 && await count() === 0);
ok("one address cannot watch without limit", ALERT_MAX_PER_EMAIL <= 20);

eq("markdowns stop at 60% off", DEAL_MAX_PCT, 60);
ok("a 75%-off 'regular price' is not listed as a sale", !isDeal({ title: "Bracelet", url: "https://x.test/b", image: "https://x.test/b.jpg", price_cents: 16500, was_cents: 64988 }) && isDeal({ title: "Bracelet", url: "https://x.test/b", image: "https://x.test/b.jpg", price_cents: 30000, was_cents: 64988 }));

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
