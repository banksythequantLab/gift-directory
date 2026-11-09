// Registry reminders: when they go out, who can sign up, and what the email says.
import { reminderSendOn, validateReminder, reminderEmail, REMIND_DAYS } from "../registry.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);
const has = (n, s, sub) => ok(n, String(s).includes(sub), `missing ${JSON.stringify(sub)} in ${String(s).slice(0, 200)}`);

eq("a week before", REMIND_DAYS, 7);
eq("event far off: 7 days before", reminderSendOn("2026-12-20", "2026-11-08"), "2026-12-13");
eq("event in 3 days: tomorrow's run", reminderSendOn("2026-11-11", "2026-11-08"), "2026-11-09");
eq("event exactly 8 days out: 7 days before", reminderSendOn("2026-11-16", "2026-11-08"), "2026-11-09");
eq("event exactly 7 days out: tomorrow", reminderSendOn("2026-11-15", "2026-11-08"), "2026-11-09");
eq("event in 2 days: tomorrow", reminderSendOn("2026-11-10", "2026-11-08"), "2026-11-09");
eq("event tomorrow: no reminder (it would land on the day)", reminderSendOn("2026-11-09", "2026-11-08"), null);
eq("event today: no reminder", reminderSendOn("2026-11-08", "2026-11-08"), null);
eq("past event: no reminder", reminderSendOn("2026-10-01", "2026-11-08"), null);
eq("no date: no reminder", reminderSendOn(null, "2026-11-08"), null);
eq("bad date: no reminder", reminderSendOn("next June", "2026-11-08"), null);
eq("month boundary", reminderSendOn("2027-01-03", "2026-11-08"), "2026-12-27");

eq("email is lowercased", validateReminder({ email: "  Guest@Example.COM " }).email, "guest@example.com");
ok("bad email refused", !!validateReminder({ email: "not an email" }).error);
ok("missing body refused", !!validateReminder(null).error);
ok("very long email refused", !!validateReminder({ email: "a".repeat(64) + "@" + "b".repeat(180) + ".com" }).error);

const reg = { title: "Maria & Sam's wedding", occasion: "Wedding", event_date: "2026-12-20", owner_name: "Maria", paypal_email: "m@example.com" };
const m = reminderEmail(reg, "https://gift.directory/r/maria", "https://gift.directory/api/registry/unsubscribe?t=abc", 3);
has("subject names the registry and date", m.subject, "Reminder: Maria & Sam's wedding is Sunday, December 20");
has("text has the date", m.text, "Maria's wedding is coming up on Sunday, December 20");
has("text says what's left", m.text, "3 gifts are still on the list.");
has("text has the link", m.text, "https://gift.directory/r/maria");
has("text has unsubscribe", m.text, "unsubscribe?t=abc");
has("mentions group gifts when the registry has PayPal", m.text, "go in together on a big gift with PayPal");
has("html escapes the title", m.html, "Maria &amp; Sam&#39;s wedding");
ok("html has no raw ampersand title", !m.html.includes("Maria & Sam's"));
has("one left is singular", reminderEmail(reg, "u", "x", 1).text, "1 gift is still on the list.");
has("nothing left says so", reminderEmail(reg, "u", "x", 0).text, "Every gift on the list is spoken for");
ok("no PayPal: no group-gift line", !reminderEmail({ ...reg, paypal_email: null }, "u", "x").text.includes("PayPal"));
ok("'Other' occasion isn't named", !reminderEmail({ ...reg, occasion: "Other" }, "u", "x").text.includes("other"));

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
