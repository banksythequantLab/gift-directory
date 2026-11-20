// The Black Friday page (right dates, its own address, its questions) and the IndexNow ping (only our own pages, key attached).
import { blackFridayDates, renderSales } from "../deals.js";
import { pingIndexNow } from "../indexnow.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

const d26 = blackFridayDates(2026), d27 = blackFridayDates(2027), d25 = blackFridayDates(2025);
eq("Thanksgiving 2026", d26.thanksgiving, "Thursday, November 26");
eq("Black Friday 2026", d26.blackFriday, "Friday, November 27");
eq("Cyber Monday 2026", d26.cyberMonday, "November 30");
ok("no doubled weekday", !renderSales({ deals: [], bf: true, nowMs: Date.parse("2026-11-19T16:00:00Z") }).html.match(/Saturday Saturday|Monday Monday/));
eq("Black Friday 2027", d27.blackFriday, "Friday, November 26");
eq("Black Friday 2025", d25.blackFriday, "Friday, November 28");

const NOV19 = Date.parse("2026-11-19T16:00:00Z"), DEC10 = Date.parse("2026-12-10T16:00:00Z");
const bf = renderSales({ deals: [], promos: [], bf: true, nowMs: NOV19 }).html;
ok("the page has its own canonical address", bf.includes('rel="canonical" href="https://gift.directory/black-friday"'));
ok("it names this year's Black Friday", bf.includes("Friday, November 27") && bf.includes("Black Friday Gift Deals 2026"));
ok("it carries the questions as FAQ data", bf.includes('"FAQPage"') && bf.includes("When is Black Friday 2026?"));
ok("after the season it points at next year", renderSales({ deals: [], bf: true, nowMs: DEC10 }).html.includes("Black Friday Gift Deals 2027"));
const sales = renderSales({ deals: [], promos: [], nowMs: Date.parse("2026-11-21T16:00:00Z") }).html;
ok("the sales page links to it during the week", sales.includes('href="/black-friday"') && sales.includes('rel="canonical" href="https://gift.directory/sales"'));
ok("but not in July", !renderSales({ deals: [], nowMs: Date.parse("2026-07-10T16:00:00Z") }).html.includes('href="/black-friday"'));

const calls = [], fetchFn = async (u, o) => { calls.push({ u, body: JSON.parse(o.body) }); return { status: 202 }; };
const r = await pingIndexNow({ INDEXNOW_KEY: "abc123" }, ["https://gift.directory/sales", "https://gift.directory/sales", "https://evil.example/x", "https://gift.directory/black-friday"], { fetchFn });
ok("IndexNow: accepted", r.ok && r.n === 2, JSON.stringify(r));
eq("IndexNow: only our own pages, once each", JSON.stringify(calls[0].body.urlList), JSON.stringify(["https://gift.directory/sales", "https://gift.directory/black-friday"]));
eq("IndexNow: key file location", calls[0].body.keyLocation, "https://gift.directory/abc123.txt");
ok("IndexNow: nothing sent without a key", (await pingIndexNow({}, ["https://gift.directory/"], { fetchFn })).skipped && calls.length === 1);

console.log(`bf_test: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
