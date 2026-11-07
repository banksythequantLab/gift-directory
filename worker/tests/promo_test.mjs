// The custom-tee banner: sayings that fit the store, price fallback, Etsy notice.
import { TEE, teeSayings, teePromo } from "../promo.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

eq("lawyer store", teeSayings({ slug: "lawyers", name: "Lawyer Gifts" })[0][0], "I OBJECT");
eq("nurse store", teeSayings({ slug: "nurses", name: "Nurse Gifts" })[0][0], "NIGHT SHIFT");
eq("firefighter store", teeSayings({ slug: "firefighter-gifts", name: "Firefighter Gifts Co." })[0][0], "I RUN IN");
eq("friend store", teeSayings({ slug: "friend-gifts", name: "Friend Gifts" })[0][0], "BEST FRIENDS");
eq("unknown store gets general lines", teeSayings({ slug: "145132-geeta-colony", name: "Kanika Varshney" })[0][0], "YOUR WORDS");
eq("no store", teeSayings(null)[0][0], "YOUR WORDS");
ok("themed stores also get one general line", teeSayings({ slug: "nurses" }).some(l => l[0] === "YOUR WORDS"));
ok("every saying is two short lines", [null, { slug: "lawyers" }, { slug: "nurses" }, { slug: "fire" }, { slug: "friend" }, { name: "teacher" }, { name: "dad" }]
  .every(s => teeSayings(s).every(l => l.length === 2 && l.every(t => t.length > 0 && t.length <= 22))));
const p = teePromo({ slug: "nurses" }, 2799);
eq("live price used", p.price_cents, 2799);
eq("fallback price", teePromo({}, 0).price_cents, TEE.price_cents);
eq("links to the listing", p.url, "https://www.etsy.com/listing/4585376842");
ok("Etsy notice", p.note.startsWith("The term 'Etsy' is a trademark of Etsy, Inc."));

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
