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

const btn = (id, label) => `<a class="btn" href="${cj(id)}" target="_blank" rel="noopener sponsored nofollow" style="display:inline-block;margin:6px 8px 6px 0">${esc(label)} →</a>`;
const H2 = t => `<h2 style="font-family:Georgia,serif">${t}</h2>`;
const td = "padding:8px 10px;border-bottom:1px solid #e5e7eb";
const head = (crumb, h1, sub) => `<div class="crumbs"><a href="/">gift.directory</a> › <a href="/gifts">Gift guides</a> › ${crumb}</div>
<h1 style="font-family:Georgia,serif;margin:4px 0 6px">${h1}</h1><p class="muted" style="margin:0 0 14px">${sub}</p>`;
const article = (headline, slug) => ({ "@context": "https://schema.org", "@type": "Article", headline, dateModified: "2026-11-13",
  author: { "@type": "Organization", name: "gift.directory" }, publisher: { "@type": "Organization", name: "gift.directory" }, mainEntityOfPage: `https://gift.directory/reviews/${slug}` });

// Muck Boot Company, from muckbootcompany.com on 2026-11-13 (regular prices; CJ advertiser 5535808).
const MUCK = [
  ["Men's Chore Classic Work Boot", 130, "The original barn and yard boot. Pulls on, waterproof, all-season."],
  ["Men's Arctic Sport Tall", 175, "Insulated tall boot for snow and cold mornings."],
  ["Men's Arctic Ice 12\" Insulated Mid Boot", 190, "Insulated, with a Vibram Arctic Grip outsole for ice."],
  ["Men's Muckmaster Tall", 160, "Tall all-purpose boot, sold only by Muck."],
  ["Men's Wetland Boot", 165, "Tall boot for marsh, mud and duck blinds."],
  ["Men's Muckster II Ankle Boot", 100, "Low, light slip-on for the garden and quick trips outside."],
  ["Women's Muckster II Mid Boot", 110, "Mid-height slip-on for gardening and dog walks."],
  ["Women's Arctic Sport II Mid Boot", 145, "Insulated mid boot for winter."],
  ["Women's Originals Ankle Boot", 115, "Slip-on ankle boot for everyday wear."],
];
const L = { home: 15343525, chore: 15341659, farm: 14584814, hunting: 14584813, kids: 15398271, wideCalf: 15338102 };
function muckPage() {
  const slug = "muck-boots-gift-guide", h1 = "Muck boots as a gift: which pair, and how to get the size right";
  const body = `${head("Reviews", h1, "Checked November 13, 2026 · Muck Boot Company")}
<div class="guide">
<p>Muck boots are pull-on rubber-and-neoprene boots made for mud, barns, gardens, hunting and snow. They're a practical gift that gets used every day by people who work or play outside: farmers, gardeners, hunters, dog owners and anyone who shovels their own driveway.</p>
<p>We haven't worn these boots for this page. The models, prices and policies below come from Muck Boot Company's own site on November 13, 2026. <b>We earn a commission if you buy through the links on this page</b>, at no extra cost to you.</p>
${H2("Best sellers and what they're for")}
<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;min-width:520px;font-size:.92rem"><thead><tr>
${["Boot", "Good for", "Regular price"].map(h => `<th style="text-align:left;padding:8px 10px;border-bottom:2px solid #d1d5db">${h}</th>`).join("")}</tr></thead><tbody>
${MUCK.map(([n, p, f]) => `<tr><td style="${td}">${esc(n)}</td><td style="${td}">${esc(f)}</td><td style="${td};white-space:nowrap">${money(p)}</td></tr>`).join("")}
</tbody></table></div>
<p class="muted small">Regular prices on Muck's site. Muck runs holiday sales, so check today's price.</p>
${btn(L.home, "Shop all Muck boots")}${btn(L.chore, "Chore boots")}${btn(L.farm, "Farm and ranch boots")}${btn(L.hunting, "Hunting boots")}
${H2("Getting the size right without asking")}
<ul>
<li><b>Whole sizes only.</b> Muck makes boots in whole sizes and says they stretch to fit half sizes. For a man who wears a half size, Muck says to go up to the next whole size. For a woman, go down.</li>
<li><b>Unisex styles are in men's sizes.</b> For a woman, Muck says to order one size down from the men's size shown.</li>
<li><b>Width.</b> Boots come in a standard (D) width, which Muck says stretches to fit up to EEE. A few men's styles come in wide.</li>
<li><b>Calves.</b> Neoprene stretches around most calves. Muck also sells wide-calf tall boots for men and women.</li>
<li><b>Peek at their current boots.</b> The size printed inside a pair they already own is the safest guess.</li>
</ul>
${btn(L.wideCalf, "Women's wide-calf boots")}
${H2("If the size is wrong")}
<ul>
<li><b>Returns.</b> Free returns on U.S. orders over $99 within 30 days, if the boots are unworn and you have proof of purchase. This holiday season Muck lists extended returns through January 31.</li>
<li><b>Warranty.</b> A 1-year limited warranty against defects, and boots with Muck waterproof construction are guaranteed waterproof for 6 months.</li>
<li><b>Bought from a store?</b> Pairs bought from a dealer go back to that dealer, not to Muck.</li>
</ul>
${H2("For kids")}
<p>Muck's kids' boots run from $50 (Mini Muck rain boots) to $100 at regular price. Kids outgrow boots fast, so buy for this season's foot plus a little room.</p>
${btn(L.kids, "Kids' Muck boots")}
${H2("Which pair to choose")}
<p><b>For the barn, yard or job site:</b> Chore Classic. <b>For snow and cold:</b> Arctic Sport, or Arctic Ice if they walk on ice. <b>For the garden or dog walks:</b> Muckster II. <b>For hunting and marsh:</b> Wetland or Muckmaster.</p>
<p>Not sure boots are right? <a href="/gifts">Browse all gift guides</a>.</p>
</div>`;
  return { title: "Muck boots as a gift: best sellers, prices and sizing (2026) | gift.directory",
    meta: "Which Muck boot to give, what each best seller costs, how to pick the size without asking, and the return policy if it's wrong.", body, jsonld: [article(h1, slug)] };
}

// GraphicAudio, from graphicaudio.net on 2026-11-13 (CJ advertiser 5802848).
const GA = { home: 15735849, genres: 14572808, newReleases: 14572805 };
function graphicAudioPage() {
  const slug = "graphicaudio-gift-guide", h1 = "GraphicAudio as a gift: full-cast audiobooks for fantasy and sci-fi fans";
  const body = `${head("Reviews", h1, "Checked November 13, 2026 · GraphicAudio")}
<div class="guide">
<p>GraphicAudio makes full-cast audio dramas of novels and comics, which it calls "a movie in your mind." Instead of one narrator, each book has a cast of actors, original music and sound effects. It's a good gift for someone who already loves a series, or who wants to revisit it in a new way.</p>
<p>We haven't listened to these for this page. Everything below comes from GraphicAudio's own site on November 13, 2026. <b>We earn a commission if you buy through the links on this page</b>, at no extra cost to you.</p>
${H2("Series fans will recognize")}
<p>GraphicAudio's catalog leans toward fantasy, science fiction and comics. Series on its site include Brandon Sanderson's <i>Mistborn</i> and <i>The Stormlight Archive</i>, <i>Red Rising</i>, <i>Throne of Glass</i>, <i>A Court of Thorns and Roses</i>, <i>The Dresden Files</i>, <i>The Murderbot Diaries</i>, <i>Hellboy</i> and <i>The Boys</i>. Genres run from fantasy and thrillers to horror, LitRPG, manga and a kids' section.</p>
${btn(GA.genres, "Browse GraphicAudio by genre")}${btn(GA.newReleases, "See new releases")}
${H2("What it costs")}
<ul>
<li><b>Long books come in parts.</b> Each part is sold separately. For example, <i>Mistborn: The Final Empire</i> is 3 parts of about 6 hours each.</li>
<li><b>Price per part.</b> That first part lists at $21.99. When we checked, it was on sale for $9.90, and the site was advertising a sale through November 30.</li>
<li><b>Formats.</b> Listening in GraphicAudio's app and web player is included. MP3 or M4B downloads add $2 a part, FLAC adds $3 and FLAC 5.1 surround adds $4.</li>
</ul>
${H2("How to give it")}
<ul>
<li><b>An eGift card is the easy way.</b> GraphicAudio sells eGift cards, so the person can pick the series and format they want.</li>
<li><b>They'll need an account on the website.</b> Titles can't be bought inside the app. They buy on graphicaudio.net, then listen in the GraphicAudio Access app (iPhone, Android, Apple CarPlay and Android Auto) or in a web browser.</li>
<li><b>Check the age rating.</b> Each title lists one. <i>Mistborn</i>, for example, is rated 13+, and some series are written for adults.</li>
<li><b>Downloads are worth keeping.</b> GraphicAudio recommends backing up download purchases because some titles may be removed later for licensing reasons.</li>
</ul>
${btn(GA.home, "Visit GraphicAudio")}
<p>Looking for something to unwrap? <a href="/gifts">Browse all gift guides</a>, or <a href="/shop">make a personalized gift</a>.</p>
</div>`;
  return { title: "GraphicAudio as a gift: full-cast audiobooks, prices and how to give them (2026) | gift.directory",
    meta: "What GraphicAudio's full-cast audio dramas are, which series it covers, what a part costs, and how to give one as a gift.", body, jsonld: [article(h1, slug)] };
}

export const REVIEWS = { "gift-of-the-month-clubs": clubsPage, "muck-boots-gift-guide": muckPage, "graphicaudio-gift-guide": graphicAudioPage };
export const REVIEW_SLUGS = Object.keys(REVIEWS);
export function renderReview(slug, ad = "") {
  const f = REVIEWS[slug]; if (!f) return null;
  const p = f();
  return shell(p.title, p.meta, `https://gift.directory/reviews/${slug}`, p.body, p.jsonld, ad);
}
