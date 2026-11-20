// The weekly email: nobody is mailed without confirming, an issue never goes out without a postal address or an
// unsubscribe link, and stopping deletes the address.
import { subscribe, confirm, unsubscribe, sendWeekly, weeklyEmail, pickItems, issueFor, signupForm, confirmEmail, subscribedPage, NEWS_BATCH } from "../newsletter.js";
import { renderSales } from "../deals.js";
import { d1 } from "./d1shim.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);
const db = d1(join(dirname(fileURLToPath(import.meta.url)), "..", "migrations"));
const FRI = Date.parse("2026-11-20T16:00:00Z"), THU = Date.parse("2026-11-19T16:00:00Z");   // Friday 11am ET, Thursday 11am ET
const sent = [], send = async m => { sent.push(m); };
const rows = async () => (await db.prepare("SELECT * FROM subscribers ORDER BY email").all()).results;

ok("a bad address is refused and nothing is sent", !(await subscribe(db, { email: "nope" }, { send, nowMs: THU })).ok && sent.length === 0);
ok("a bot that fills the trap is thanked and stored nowhere", (await subscribe(db, { email: "bot@mail.test", website: "x" }, { send, nowMs: THU })).quiet && (await rows()).length === 0);
ok("with no mailer the sign-up says so", !(await subscribe(db, { email: "pat@mail.test" }, { nowMs: THU })).ok && (await rows()).length === 0);
const r1 = await subscribe(db, { email: " Pat@Mail.Test " }, { send, nowMs: THU });
ok("a sign-up sends one confirmation link and stores the address unconfirmed", r1.pending && sent.length === 1 && sent[0].to === "pat@mail.test" && /\/api\/subscribe\/confirm\?t=[0-9a-f-]{36}/.test(sent[0].text) && (await rows())[0].confirmed_at === null);
await subscribe(db, { email: "pat@mail.test" }, { send, nowMs: THU + 3600e3 });
eq("asking again the same day does not send the link again", sent.length, 1);
ok("a mailer that fails leaves no row behind", !(await subscribe(db, { email: "lee@mail.test" }, { send: async () => { throw new Error("x"); }, nowMs: THU })).ok && (await rows()).length === 1);

const env = { EMAIL: { send }, MAIL_ADDRESS: "Example Co, 1 Main Street, Springfield, NY 10001" };
const mk = (id, merchant, price, was) => db.prepare("INSERT INTO deals (product_id, slug, card_json, price_cents, was_cents, pct, on_sale, checked_at) VALUES (?,?,?,?,?,?,1,?)")
  .bind(id, "gifts-for-gardeners", JSON.stringify({ title: "Item " + id, url: "https://x.test/" + id, image: "https://x.test/" + id + ".jpg", merchant, price_cents: price, was_cents: was }), price, was, Math.round((1 - price / was) * 100), new Date(FRI - 3600e3).toISOString()).run();
for (let i = 0; i < 8; i++) await mk("a" + i, i < 5 ? "bigstore.test" : "shop" + i + ".test", 5000 + i * 100, 10000);

let w = await sendWeekly(db, env, { nowMs: FRI });
ok("an unconfirmed address is never mailed", w.sent === 0 && sent.length === 1, JSON.stringify(w));
const tok = (await rows())[0].token;
ok("a made-up token confirms nothing", !(await confirm(db, "x' OR 1=1")) && !(await confirm(db, "00000000-0000-0000-0000-000000000000")));
ok("the real link confirms", await confirm(db, tok, THU) && (await rows())[0].confirmed_at !== null);
ok("not on a Thursday", (await sendWeekly(db, env, { nowMs: THU })).sent === 0 && sent.length === 1);
ok("not without a postal address", /MAIL_ADDRESS/.test((await sendWeekly(db, { EMAIL: { send } }, { nowMs: FRI })).skipped) && sent.length === 1);
w = await sendWeekly(db, env, { nowMs: FRI });
ok("on Friday the confirmed reader gets the issue", w.sent === 1 && sent.length === 2 && sent[1].to === "pat@mail.test", JSON.stringify(w));
const body = sent[1].text;
ok("the issue carries the postal address and an unsubscribe link with their token", body.includes("1 Main Street") && body.includes("/api/subscribe/unsubscribe?t=" + tok));
ok("it says why they are getting it and discloses the commission", /because you asked/.test(body) && /commission/.test(body));
ok("its links go to our own pages, not straight to a store", !body.includes("https://x.test/") && body.includes("https://gift.directory/gifts/gifts-for-gardeners"));
ok("prices are stated with the regular price and the percentage", /\$50 at bigstore\.test \(regular price \$100, 50% off\)/.test(body));
eq("one store cannot fill the list", (body.match(/bigstore\.test/g) || []).length, 2);
ok("the same issue is not sent twice", (await sendWeekly(db, env, { nowMs: FRI + 3600e3 })).sent === 0 && sent.length === 2);
ok("next Friday they get the next one", (await (async () => { for (let i = 0; i < 8; i++) await db.prepare("UPDATE deals SET checked_at=?").bind(new Date(FRI + 7 * 864e5 - 3600e3).toISOString()).run(); return sendWeekly(db, env, { nowMs: FRI + 7 * 864e5 }); })()).sent === 1);
ok("unsubscribing deletes the address", await unsubscribe(db, tok) && (await rows()).length === 0 && !(await unsubscribe(db, tok)));

await subscribe(db, { email: "old@mail.test" }, { send, nowMs: THU });
await sendWeekly(db, env, { nowMs: THU + 8 * 864e5 });
eq("an address never confirmed is deleted after a week", (await rows()).length, 0);

ok("Friday 10am to 8pm Eastern is an issue; other times are not", issueFor(FRI) === "2026-11-20" && issueFor(THU) === null && issueFor(Date.parse("2026-11-20T13:00:00Z")) === null && issueFor(Date.parse("2026-11-21T02:00:00Z")) === null);
eq("pickItems keeps two per store at most", pickItems([{ merchant: "a" }, { merchant: "a" }, { merchant: "a" }, { merchant: "b" }]).length, 3);
ok("the confirmation email promises nothing more without the click", /will not email this address again/.test(confirmEmail("t").text));
ok("the sign-up box posts to the right place and has the trap", signupForm().includes('action="/api/subscribe"') && signupForm().includes('name="website"'));
ok("off the sales page the box points to the sales page instead of 'this page'", signupForm({ onSales: false }).includes('href="/sales"') && !signupForm({ onSales: false }).includes("from this page") && signupForm().includes("from this page"));
ok("the sales page shows the box only when it is given one", renderSales({ deals: [], signup: signupForm() }).html.includes('action="/api/subscribe"') && !renderSales({ deals: [] }).html.includes('action="/api/subscribe"'));
eq("a refusal is a 400", subscribedPage({ ok: false, error: "x" }).status, 400);
ok("a batch is bounded", NEWS_BATCH <= 50);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
