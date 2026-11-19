// Click counts: what is counted, what is refused, and that nothing about the visitor is stored.
import { countClick, clickReport, cleanPath, cleanMerchant, CLICK_SCRIPT } from "../clicks.js";
import { shell } from "../seo.js";
import { readFileSync } from "node:fs";
import { d1 } from "./d1shim.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);
const db = d1(join(dirname(fileURLToPath(import.meta.url)), "..", "migrations"));

eq("a guide path is kept", cleanPath("/gifts/gifts-for-gardeners"), "/gifts/gifts-for-gardeners");
ok("a path with a query, markup or no slash is refused", !cleanPath("/gifts/x?e=a@b.com") && !cleanPath("/<script>") && !cleanPath("gifts") && !cleanPath("/" + "a".repeat(200)));
eq("a store name is kept", cleanMerchant("Abracadabra NYC"), "Abracadabra NYC");
eq("markup is stripped from a store name", cleanMerchant("<b>levenger.com</b>"), "blevenger.com/b");
ok("an empty store name is refused", cleanMerchant("") === null && cleanMerchant("?") === null);

const person = { host: "gift.directory", ua: "Mozilla/5.0 (Windows NT 10.0) Chrome/130", lang: "en-US", day: "2026-11-19" };
const body = (p, m) => JSON.stringify({ p, m });
ok("a reader's click is counted", await countClick(db, { ...person, raw: body("/gifts/gifts-for-gardeners", "levenger.com") }));
await countClick(db, { ...person, raw: body("/gifts/gifts-for-gardeners", "levenger.com") });
await countClick(db, { ...person, raw: body("/sales", "macys.com") });
ok("a crawler's is not", !(await countClick(db, { ...person, ua: "Googlebot/2.1", raw: body("/sales", "macys.com") })));
ok("nor a request with no language header", !(await countClick(db, { ...person, lang: null, raw: body("/sales", "macys.com") })));
ok("nor a malformed report", !(await countClick(db, { ...person, raw: "not json" })) && !(await countClick(db, { ...person, raw: body("/sales?x=1", "macys.com") })) && !(await countClick(db, { ...person, raw: body("/sales", "") })));
const rows = (await db.prepare("SELECT * FROM link_clicks ORDER BY path").all()).results;
eq("two rows, one per page and store", rows.length, 2);
eq("the same click twice is a count of two", rows[0].n, 2);
eq("a row holds only day, site, page, store and count", Object.keys(rows[0]).sort().join(","), "day,host,merchant,n,path");

await db.prepare("INSERT INTO page_views (day,host,path,kind,n) VALUES ('2026-11-19','gift.directory','/gifts/gifts-for-gardeners','human',40)").run();
const rep = await clickReport(db, 7, Date.parse("2026-11-20T00:00:00Z"));
eq("the report totals the clicks", rep.clicks, 3);
ok("and sets them beside the page's views", rep.top_pages[0].path === "/gifts/gifts-for-gardeners" && rep.top_pages[0].clicks === 2 && rep.top_pages[0].views === 40);
eq("and ranks the stores", rep.top_stores[0].merchant, "levenger.com");
eq("an old click falls out of a seven-day report", (await clickReport(db, 7, Date.parse("2026-12-20T00:00:00Z"))).clicks, 0);

ok("every page built on the shared shell carries the click reporter", shell("t", "m", "https://gift.directory/x", "<p>b</p>").includes(CLICK_SCRIPT));
ok("the reporter only watches links marked as leaving for a store", CLICK_SCRIPT.includes('a[rel~="sponsored"]') && CLICK_SCRIPT.includes("sendBeacon") && !/cookie|localStorage/.test(CLICK_SCRIPT));

for (const f of ["index.html", "registry.html", "pool.html"]) {
  const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "public", f), "utf8");
  eq(`${f} carries the same reporter, once`, page.split(CLICK_SCRIPT).length - 1, 1);
}
ok("a store card's link names its store", readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "public", "index.html"), "utf8").includes('data-m="${esc(p.merchant || "")}"'));
ok("the reporter prefers the link's own store name", CLICK_SCRIPT.includes('getAttribute("data-m")'));
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
