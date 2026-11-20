// "This season": the right groups for the date, and no links to guides that are not listed.
import { seasonGroups, seasonBox } from "../season.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };
const at = s => Date.parse(s), titles = ms => seasonGroups(ms).map(g => g.title.split(" (")[0]);

ok("Nov 20: Thanksgiving, Black Friday, Hanukkah, Christmas", JSON.stringify(titles(at("2026-11-20T17:00:00Z"))) === JSON.stringify(["Thanksgiving", "Black Friday", "Hanukkah", "Christmas"]), JSON.stringify(titles(at("2026-11-20T17:00:00Z"))));
ok("Thanksgiving group carries the date", seasonGroups(at("2026-11-20T17:00:00Z"))[0].title.includes("November 26"));
ok("Nov 27: Thanksgiving gone, Black Friday still on", !titles(at("2026-11-27T17:00:00Z")).includes("Thanksgiving") && titles(at("2026-11-27T17:00:00Z")).includes("Black Friday"));
ok("Cyber Monday still shows Black Friday", titles(at("2026-11-30T17:00:00Z")).includes("Black Friday"));
ok("Dec 1: Black Friday gone", !titles(at("2026-12-01T17:00:00Z")).includes("Black Friday"));
ok("Dec 13: Hanukkah gone, last-minute added", !titles(at("2026-12-13T17:00:00Z")).includes("Hanukkah") && seasonGroups(at("2026-12-13T17:00:00Z")).find(g => g.title === "Christmas").links.some(l => l[0].includes("last-minute")));
ok("Dec 26: nothing", seasonGroups(at("2026-12-26T17:00:00Z")).length === 0 && seasonBox(at("2026-12-26T17:00:00Z")) === "");
ok("July: nothing", seasonGroups(at("2026-07-04T17:00:00Z")).length === 0);
ok("Nov 1 late evening ET is still Nov 1", titles(at("2026-11-02T03:00:00Z")).includes("Christmas"));
const box = seasonBox(at("2026-11-20T17:00:00Z"), new Set(["what-to-bring-to-thanksgiving-not-food"]));
ok("unlisted guides are left out", box.includes("what-to-bring-to-thanksgiving-not-food") && !box.includes("friendsgiving-host-gifts") && !box.includes("eight-nights"));
ok("non-guide pages stay", box.includes('href="/black-friday"') && box.includes('href="/christmas-shipping-deadlines"'));
ok("a group with no listed guides drops out", !box.includes("<b>Hanukkah</b>"));

console.log(`season_test: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
