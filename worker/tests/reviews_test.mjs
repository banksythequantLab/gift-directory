// Review pages: the gift-of-the-month-clubs comparison renders, discloses the commission, and links through CJ.
import { REVIEW_SLUGS, renderReview } from "../reviews.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };

ok("slug listed", REVIEW_SLUGS.includes("gift-of-the-month-clubs"));
ok("unknown slug", renderReview("nope") === null);
const h = renderReview("gift-of-the-month-clubs");
ok("is a page", h.startsWith("<!doctype html>") && h.includes("</html>"));
ok("canonical", h.includes('<link rel="canonical" href="https://gift.directory/reviews/gift-of-the-month-clubs">'));
ok("discloses the commission", /earn a commission if you buy through the links/.test(h));
ok("says we didn't taste them", h.includes("We have not tasted these clubs."));
const links = [...h.matchAll(/href="(https:\/\/www\.tkqlhce\.com\/[^"]+)"/g)].map(m => m[1]);
ok("ten club links", links.length === 10, String(links.length));
ok("CJ links use the gift.directory property", links.every(u => /^https:\/\/www\.tkqlhce\.com\/click-101922999-\d{8}$/.test(u)));
ok("affiliate links are sponsored nofollow", [...h.matchAll(/<a [^>]*tkqlhce[^>]*>/g)].every(m => /rel="noopener sponsored nofollow"/.test(m[0])));
ok("no review stars or ratings claimed", !/aggregateRating|ratingValue/.test(h));
ok("table anchors resolve", [...h.matchAll(/href="#([a-z]+)"/g)].every(m => h.includes(`id="${m[1]}"`)));
ok("ad slot passed through", renderReview("gift-of-the-month-clubs", "<aside>AD</aside>").includes("<aside>AD</aside>"));

for (const [slug, want] of [["muck-boots-gift-guide", 6], ["graphicaudio-gift-guide", 3]]) {
  ok(`${slug} listed`, REVIEW_SLUGS.includes(slug));
  const g = renderReview(slug);
  ok(`${slug} canonical`, g.includes(`<link rel="canonical" href="https://gift.directory/reviews/${slug}">`));
  ok(`${slug} discloses the commission`, /earn a commission if you buy through the links/.test(g));
  ok(`${slug} says we didn't try them`, /We haven't (worn|listened)/.test(g));
  const ls = [...g.matchAll(/href="(https:\/\/www\.tkqlhce\.com\/[^"]+)"/g)].map(m => m[1]);
  ok(`${slug} link count`, ls.length === want, String(ls.length));
  ok(`${slug} CJ property`, ls.every(u => /^https:\/\/www\.tkqlhce\.com\/click-101922999-\d{8}$/.test(u)));
  ok(`${slug} sponsored`, [...g.matchAll(/<a [^>]*tkqlhce[^>]*>/g)].every(m => /rel="noopener sponsored nofollow"/.test(m[0])));
  ok(`${slug} no ratings claimed`, !/aggregateRating|ratingValue/.test(g));
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
