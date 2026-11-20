// Which guides search engines may index: team-fan guides never (while INDEX_TEAM_PAGES is false); other guides from
// MIN_LISTED picks, or with the owner's own picks. IndexNow pings follow the same rule.
import { indexable, INDEX_TEAM_PAGES, MIN_LISTED, TEAM_PAGES, PAGES, noindexed } from "../seo.js";
import { changedUrls } from "../indexnow.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };

const team = TEAM_PAGES[0], plain = PAGES.find(p => !p.team && !p.ownerPicks), owner = PAGES.find(p => p.ownerPicks);
ok("team pages are kept out of the index", INDEX_TEAM_PAGES === false);
ok("a team page with plenty of picks is not indexable", indexable(team, 30) === false);
ok("a plain guide at MIN_LISTED picks is indexable", indexable(plain, MIN_LISTED) === true);
ok("a plain guide below MIN_LISTED is not", indexable(plain, MIN_LISTED - 1) === false);
ok("an owner-picks guide is indexable even when thin", indexable(owner, 0) === true);
ok("unknown page is not indexable", indexable(undefined, 99) === false);
ok("noindexed adds the robots tag", noindexed('<link rel="canonical" href="x">').includes('noindex,follow'));

// IndexNow: a fake D1 that returns one team guide and one plain guide, both with many picks.
const rows = [{ slug: team.slug, n: 30, updated_at: "2026-11-20T00:00:00Z" }, { slug: plain.slug, n: 12, updated_at: "2026-11-20T00:00:00Z" }];
const db = { prepare: () => ({ bind: () => ({ all: async () => ({ results: rows }) }), all: async () => ({ results: rows }) }) };
const urls = await changedUrls(db, { all: true });
ok("IndexNow pings the plain guide", urls.some(u => u.endsWith("/gifts/" + plain.slug)));
ok("IndexNow skips the team guide", !urls.some(u => u.endsWith("/gifts/" + team.slug)));

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
