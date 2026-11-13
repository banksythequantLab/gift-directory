// Review pages: one merchant's products laid side by side, from the merchant's own published details.
// Nothing here claims we tried the products. Prices are the merchant's list prices on the date in `checked`;
// the merchant runs frequent sales, and the page says so. Links are CJ tracking links for the gift.directory
// property (PID 101922999): https://www.tkqlhce.com/click-<PID>-<link id>.
import { shell } from "./seo.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cj = id => `https://www.tkqlhce.com/click-101922999-${id}`;
const money = n => `$${n.toFixed(2)}`;

// Amazing Clubs, from amazingclubs.com on 2026-11-13. price: list price per month on the ongoing plan.
const CLUBS = [
  { key: "beer", name: "Beer of the Month Club", link: 10379954, price: 70.95, ships: "12 craft beers from 2 breweries: 4 beers, 3 of each", note: "21+. An adult must show ID at delivery.", for: "Anyone who likes trying new craft beer" },
  { key: "wine", name: "Wine Club", link: 15670980, price: 70.95, ships: "2 or 4 bottles (750 ml) from 2 wineries: red, white or a mix", note: "21+. An adult must show ID at delivery.", for: "Wine drinkers who like a surprise bottle" },
  { key: "coffee", name: "Coffee of the Month Club", link: 10379957, price: 49.95, ships: "2 coffees from different regions, 12 oz each, whole bean or ground", note: "100% Arabica. No decaf or flavored coffee.", for: "The person who grinds their own beans" },
  { key: "chocolate", name: "Chocolate of the Month Club", link: 10379955, price: 66.95, ships: "1 lb of chocolate from a different chocolatier: dark, milk and white", note: "No repeats within 12 months, the club says.", for: "A sweet tooth, or a family to share with" },
  { key: "cheese", name: "Cheese of the Month Club", link: 10453270, price: 60.95, ships: "3 farmhouse cheeses, half a pound each (1.5 lb), cold packed", note: "Raw-milk cheeses. Check before sending to someone who is pregnant.", for: "Hosts and anyone who builds a cheese board" },
  { key: "flower", name: "Flower of the Month Club", link: 10379956, price: 60.95, ships: "1 arrangement of fresh-cut flowers, sent by express", note: "The club doesn't list stem counts.", for: "A long-distance mom, grandmother or partner" },
  { key: "tea", name: "Tea of the Month Club", link: 10453265, price: 34.95, ships: "2 teas, 20 tea bags each (40 cups)", note: "Caffeinated teas only.", for: "The lowest-cost club in this list" },
  { key: "hotsauce", name: "Hot Sauce of the Month Club", link: 10379963, price: 35.95, ships: "2 full-size bottles, usually 5 to 8 oz each", note: "", for: "Someone who puts hot sauce on everything" },
  { key: "cupcake", name: "Cupcake of the Month Club", link: 14042871, price: 81.95, ships: "6 double-size cupcakes in glass jars: 3 flavors, 2 of each", note: "", for: "Birthdays and office treats" },
  { key: "icecream", name: "Ice Cream of the Month Club", link: 10442649, price: 88.95, ships: "4 different pints, shipped frozen", note: "The most expensive club in this list.", for: "Kids, or the friend who has everything" },
];

function clubsPage() {
  const checked = "November 13, 2026";
  const table = `<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;min-width:560px;font-size:.92rem">
<thead><tr>${["Club", "Each delivery", "List price / month"].map(h => `<th style="text-align:left;padding:8px 10px;border-bottom:2px solid #d1d5db">${h}</th>`).join("")}</tr></thead><tbody>
${CLUBS.map(c => `<tr><td style="padding:8px 10px;border-bottom:1px solid #e5e7eb"><a href="#${c.key}">${esc(c.name)}</a></td><td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${esc(c.ships)}</td><td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;white-space:nowrap">${money(c.price)}</td></tr>`).join("")}
</tbody></table></div>`;
  const sections = CLUBS.map(c => `<section id="${c.key}" style="border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:14px 0;background:#fff">
<h3 style="margin:0 0 6px;font-family:Georgia,serif">${esc(c.name)}</h3>
<p style="margin:4px 0"><b>Each delivery:</b> ${esc(c.ships)}.</p>
<p style="margin:4px 0"><b>List price:</b> ${money(c.price)} a month. <b>Good for:</b> ${esc(c.for)}.</p>
${c.note ? `<p class="muted" style="margin:4px 0">${esc(c.note)}</p>` : ""}
<a class="btn" href="${cj(c.link)}" target="_blank" rel="noopener sponsored nofollow" style="display:inline-block;margin-top:8px">See the ${esc(c.name.replace(/ of the Month Club| Club/, "").toLowerCase())} club at Amazing Clubs →</a></section>`).join("\n");
  const body = `<div class="crumbs"><a href="/">gift.directory</a> › <a href="/gifts">Gift guides</a> › Reviews</div>
<h1 style="font-family:Georgia,serif;margin:4px 0 6px">Gift of the month clubs: what each one sends and what it costs</h1>
<p class="muted" style="margin:0 0 14px">Checked ${checked} · Amazing Clubs, 10 clubs compared</p>
<div class="guide">
<p>A gift of the month club is a present that keeps arriving: you pay once, and the person gets a new box of beer, coffee, chocolate or flowers every month, every other month or every season. It suits people who are hard to shop for, people who live far away, and anyone who would rather try something new than own one more thing.</p>
<p>This page compares ten clubs from Amazing Clubs, which has run gift clubs since 2003. We have not tasted these clubs. Everything below, from what's in the box to the prices, comes from the clubs' own pages on ${checked}. <b>We earn a commission if you buy through the links on this page</b>, at no extra cost to you.</p>
<h2 style="font-family:Georgia,serif">The clubs side by side</h2>
${table}
<p class="muted small">List price per month on the ongoing plan. Amazing Clubs runs frequent sales, and 3-, 6- and 12-month gifts often cost less per month than this, so check the club's page for today's price.</p>
<h2 style="font-family:Georgia,serif">How the gift works</h2>
<ul>
<li><b>Pick a length.</b> 3, 6 or 12 months, a seasonal plan (4 deliveries, one every 3 months), or an ongoing plan that runs until it's canceled. Most clubs can also ship every other month.</li>
<li><b>Pick the first month.</b> Every club delivers in the last week of the month. Orders placed after the 15th may start the next month.</li>
<li><b>Tell them it's coming.</b> A gift announcement with your message goes out by mail or email, or you can print it, as early as the day you order. You can choose from 16 designs.</li>
<li><b>Shipping is free</b> in the continental U.S. Clubs ship to all 50 states, to homes and offices, but not to PO boxes or APO/FPO addresses.</li>
<li><b>The recipient can skip or pause.</b> They get a free account to see what's coming, track deliveries, and skip a month.</li>
</ul>
<h2 style="font-family:Georgia,serif">Before you buy</h2>
<ul>
<li><b>For Christmas, send the announcement, not the box.</b> Deliveries land in the last week of the month, so a December start may arrive after the 25th. Order early and email or print the gift announcement for Christmas morning.</li>
<li><b>Beer and wine need an adult at home.</b> Someone 21 or older must show ID when the box arrives, so an office address often works better.</li>
<li><b>Perishables come cold.</b> Ice cream, cheese and cupcakes ship cold or frozen. They don't need a signature, but the box shouldn't sit outside for long.</li>
<li><b>Refunds.</b> On every club except beer, the club's FAQ says you can cancel for a full refund of the deliveries that haven't shipped yet. The beer club's FAQ talks about skipping a month instead.</li>
</ul>
<h2 style="font-family:Georgia,serif">Each club</h2>
${sections}
<h2 style="font-family:Georgia,serif">Which one to choose</h2>
<p><b>On a budget:</b> tea (${money(34.95)} a month) or hot sauce (${money(35.95)}). Three months of either costs less than one month of ice cream.<br>
<b>For a couple or a household:</b> chocolate, cheese or ice cream, which are easy to share.<br>
<b>For someone far away:</b> flowers, which show up looking like you thought of them again this month.<br>
<b>For a client or your team:</b> coffee or tea. They're safe for everyone, and an office can share them.</p>
<p>Want something they can keep? <a href="/gifts">Browse all gift guides</a>, or <a href="/shop">make a personalized gift</a> with their name on it.</p>
</div>`;
  const jsonld = [{ "@context": "https://schema.org", "@type": "Article", headline: "Gift of the month clubs: what each one sends and what it costs",
    dateModified: "2026-11-13", author: { "@type": "Organization", name: "gift.directory" }, publisher: { "@type": "Organization", name: "gift.directory" } },
    { "@context": "https://schema.org", "@type": "ItemList", itemListElement: CLUBS.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, url: `https://gift.directory/reviews/gift-of-the-month-clubs#${c.key}` })) }];
  return { title: "Gift of the month clubs compared: beer, wine, coffee, chocolate and more (2026) | gift.directory",
    meta: "Ten gift of the month clubs side by side: what each delivery holds, the list price per month, and what to know before you send one.", body, jsonld };
}

export const REVIEWS = { "gift-of-the-month-clubs": clubsPage };
export const REVIEW_SLUGS = Object.keys(REVIEWS);
export function renderReview(slug, ad = "") {
  const f = REVIEWS[slug]; if (!f) return null;
  const p = f();
  return shell(p.title, p.meta, `https://gift.directory/reviews/${slug}`, p.body, p.jsonld, ad);
}
