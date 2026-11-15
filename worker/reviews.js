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

// Kings Camo, from kingscamo.com on 2026-11-15 (CJ advertiser 7016567). The site said it was showing a price test, so the
// page quotes ranges and regular prices only and sends readers to the site for today's price.
const KC = { home: 15774549, best: 17290376, hats: 16994771, kids: 17271947, gifts: 16993510 };
function kingsPage() {
  const slug = "kings-camo-gift-guide", h1 = "Kings Camo gifts for hunters: what to buy at every budget";
  const rows = [["Under $40", "A logo or patch hat ($19.99 to $39.99), a beanie, or a camp hoodie ($44.99 is just over)."],
    ["$50 to $150", "A fleece hoodie, a shirt jacket, hunting pants, or a kids' insulated jacket."],
    ["$150 and up", "Kings' XKG technical line: soft-shell, transition and down jackets that run about $200 to $330 at regular price."],
    ["Not sure of size or pattern", "An emailed gift card, from $10 to $500."]];
  const body = `${head("Reviews", h1, "Checked November 15, 2026 · Kings Camo")}
<div class="guide">
<p>Kings Camo is a hunting-clothes brand from Lindon, Utah, best known for its own camouflage patterns, starting with Desert Shadow in 2002. Today its patterns include XK7 and KC Ultra. It's a good fit for a hunter who already has the basics and would use another layer, hat or pair of pants every season.</p>
<p>We haven't worn this gear for this page. Everything below comes from Kings Camo's own site on November 15, 2026. <b>We earn a commission if you buy through the links on this page</b>, at no extra cost to you. When we checked, the site said some visitors were seeing test prices, so treat the prices here as a guide and check the price on the site.</p>
${H2("What to buy at each budget")}
<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;min-width:480px;font-size:.92rem"><thead><tr>
${["Budget", "What fits"].map(h => `<th style="text-align:left;padding:8px 10px;border-bottom:2px solid #d1d5db">${h}</th>`).join("")}</tr></thead><tbody>
${rows.map(([a, b]) => `<tr><td style="${td};white-space:nowrap"><b>${esc(a)}</b></td><td style="${td}">${esc(b)}</td></tr>`).join("")}
</tbody></table></div>
${btn(KC.hats, "Kings hats")}${btn(KC.best, "Best sellers")}${btn(KC.gifts, "Kings' holiday gift guide")}
${H2("Before you buy")}
<ul>
<li><b>Match their country.</b> Camo patterns are made for terrain. Ask what they hunt, or look at the pattern on gear they already own and buy the same one.</li>
<li><b>Sizes.</b> Each product has its own size chart. Hats are the safe choice: snapbacks adjust, and the fitted R-Flex caps come in S/M and L/XL.</li>
<li><b>Returns.</b> Kings takes returns within 60 days if the item is new, with tags on and in its packaging. A restocking fee may apply if the tags are off and it's been worn.</li>
<li><b>Shipping.</b> Standard shipping is free on orders of $200 and up in the lower 48 states, and Kings often runs free-shipping promotions below that. In-stock orders take about 4 to 10 business days, so order early for the holidays.</li>
<li><b>Gift cards</b> arrive by email in amounts from $10 to $500 and stay good until they're used up.</li>
</ul>
${H2("For young hunters")}
<p>Kings makes a kids' line of hoodies, pants and insulated jackets, mostly from about $35 to $110 at regular price.</p>
${btn(KC.kids, "Kids' camo")}${btn(KC.home, "Shop Kings Camo")}
<p>Want boots to go with it? See <a href="/reviews/muck-boots-gift-guide">Muck boots as a gift</a>, or <a href="/gifts/gifts-for-hunters">all gifts for hunters</a>.</p>
</div>`;
  return { title: "Kings Camo gifts for hunters: hats, hoodies and jackets by budget (2026) | gift.directory",
    meta: "What to buy a hunter from Kings Camo at every budget, from $20 hats to technical jackets, plus sizing, returns and gift cards.", body, jsonld: [article(h1, slug)] };
}

// AbracadabraNYC, from abracadabranyc.com on 2026-11-15 (CJ advertiser 7889430).
const AB = { home: 17277658, magic: 17267165, masks: 17267167, gifts: 17267163, pranks: 17267161 };
const KITS = [["Mysteries of the Master Magicians Royal Magic Set", 45.95, 39.95], ["Secrets of the Great Magicians Royal Magic Set", 62.95, 54.95],
  ["Penn & Teller VR Magic Lab Kit (beginner friendly)", 105.95, 64.95], ["Doctor Strange Multiverse of Magic Collectible Set", 65.95, 44.95],
  ["MARVEL Card Guard with Collectible Card Deck", 29.95, 19.95], ["Magic of Science Super-Pi-Riffic Experiment Set", 34.95, 24.95]];
function abracadabraPage() {
  const slug = "magic-kits-and-costume-gifts", h1 = "Magic kits, masks and costume gifts from a New York magic shop";
  const body = `${head("Reviews", h1, "Checked November 15, 2026 · AbracadabraNYC")}
<div class="guide">
<p>AbracadabraNYC is a costume, magic and party shop in Manhattan's Flatiron district that started in 1981. Online it sells magic kits, masks, costumes, wigs, makeup, props and novelty gifts. A magic kit is a gift that gets a kid off a screen and performing for the family by dinner.</p>
<p>We haven't tried these kits for this page. Everything below comes from AbracadabraNYC's own site on November 15, 2026. <b>We earn a commission if you buy through the links on this page</b>, at no extra cost to you.</p>
<p style="border-left:4px solid #b45309;padding:6px 12px;background:#fffbeb"><b>Read this before you buy:</b> the store's policy says all sales are final, with no refunds, returns or exchanges. It replaces only items that arrive defective or damaged, and you have to report it within 48 hours. Buy the size and item you're sure of, or give a gift card.</p>
${H2("Magic kits")}
<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;min-width:480px;font-size:.92rem"><thead><tr>
${["Kit", "Regular", "Sale when checked"].map(h => `<th style="text-align:left;padding:8px 10px;border-bottom:2px solid #d1d5db">${h}</th>`).join("")}</tr></thead><tbody>
${KITS.map(([n, r, s]) => `<tr><td style="${td}">${esc(n)}</td><td style="${td}">${money(r)}</td><td style="${td}">${money(s)}</td></tr>`).join("")}
</tbody></table></div>
<p class="muted small">Some bigger kits, like Shin Lim's Evolushin set and Criss Angel's Mind Freak kit, were sold out when we checked. The store doesn't list age ranges for its kits, so check the box details for younger kids.</p>
${btn(AB.magic, "Shop magic kits")}
${H2("Masks and dress-up")}
<p>Venetian and masquerade masks start around $15, with laser-cut metal masks near $37. The store also sells licensed character masks, wigs, hats and FX makeup for costume fans.</p>
${btn(AB.masks, "Shop masks")}${btn(AB.gifts, "Unique gifts")}${btn(AB.pranks, "Pranks and jokes")}
${H2("Good to know")}
<ul>
<li><b>Gift cards</b> come by email in $10, $25, $50, $100, $250 and $500, can be scheduled for a date, and don't expire.</li>
<li><b>Shipping.</b> The site advertises free shipping on orders of $85 and up. Standard shipping usually takes about 3 business days.</li>
<li><b>In New York?</b> The store offers same-day delivery in the city, and the shop at 19 W 21st Street is open Monday to Saturday.</li>
</ul>
${btn(AB.home, "Visit AbracadabraNYC")}
<p>Shopping for a kid? See our gift guides by age, starting with <a href="/gifts/gifts-for-8-year-old-boys">8-year-old boys</a> and <a href="/gifts/gifts-for-8-year-old-girls">8-year-old girls</a>.</p>
</div>`;
  return { title: "Magic kits and costume gifts: prices and what to know before you buy (2026) | gift.directory",
    meta: "Magic kits from $20 to $65 on sale, masks and costume gifts from a New York magic shop since 1981, plus its all-sales-final policy.", body, jsonld: [article(h1, slug)] };
}

const table = (heads, rows) => `<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;min-width:480px;font-size:.92rem"><thead><tr>
${heads.map(h => `<th style="text-align:left;padding:8px 10px;border-bottom:2px solid #d1d5db">${h}</th>`).join("")}</tr></thead><tbody>
${rows.map(r => `<tr>${r.map(c => `<td style="${td}">${esc(c)}</td>`).join("")}</tr>`).join("")}
</tbody></table></div>`;

// Aceable driver's ed, from aceable.com on 2026-11-15 (CJ advertiser 5514618). The site lists a regular and a sale price.
function aceablePage() {
  const slug = "drivers-ed-as-a-gift", h1 = "Driver's ed as a gift: the present a 15-year-old actually wants";
  const body = `${head("Reviews", h1, "Checked November 15, 2026 · Aceable")}
<div class="guide">
<p>For a teenager close to permit age, nothing beats the keys. An online driver's ed course is the step before them: many states require teens to finish an approved course before they can get a license, and paying for it is a gift that says "we trust you." Aceable sells state-approved driver's ed that runs on a phone or a computer.</p>
<p>We haven't taken these courses for this page. Everything below comes from Aceable's own site on November 15, 2026. <b>We earn a commission if you buy through the links on this page</b>, at no extra cost to you.</p>
${H2("Prices in the states Aceable covers")}
${table(["Course", "Regular", "Sale when checked"], [["California Drivers Ed", "$80", "$49"], ["Texas Parent Taught Drivers Ed (ages 14 to 17)", "$115", "about $70"],
  ["Texas Adult Drivers Ed (ages 18 to 24)", "$99", "$49"], ["Ohio Teen Drivers Ed", "$109", "$79"], ["Georgia Drivers Ed", "$50", "$30"],
  ["Oklahoma Parent Taught Drivers Ed", "$100", "$75"], ["Nevada Drivers Ed", "$69", "$49"], ["Illinois Adult Drivers Ed", "$85", "$49"], ["Florida teen course (DETS)", "$36", "$20"]])}
<p class="muted small">Aceable runs frequent discounts, so check today's price. Texas's parent-taught program also has a $20 packet fee paid to the state.</p>
${btn(15205093, "See Aceable driver's ed")}
${H2("Before you buy")}
<ul>
<li><b>It has to be their state.</b> Driver's ed is approved state by state. Aceable lists courses for California, Florida, Georgia, Illinois, Nevada, Ohio, Oklahoma and Texas.</li>
<li><b>Check the age.</b> Aceable's California course is built for teens 15 to 17½. Texas's parent-taught course is for ages 14 to 17, and Texas requires new drivers aged 18 to 24 to take a 6-hour course.</li>
<li><b>Parent-taught means a parent drives too.</b> In Texas and Oklahoma the parent is the instructor for the driving hours, so talk to the parents before giving this to someone else's kid.</li>
<li><b>Set it up together.</b> Aceable doesn't list gift cards, so the easiest way is to sign the teen up with them, or give a card that says the course is paid for.</li>
<li><b>Money-back guarantee.</b> Aceable's course pages advertise a 100% money-back guarantee. Read the terms at checkout.</li>
</ul>
<p>Pair it with something for the car: see <a href="/gifts/car-emergency-kit-gifts">car emergency kit gifts</a>.</p>
</div>`;
  return { title: "Driver's ed as a gift: online courses, prices by state and what to know (2026) | gift.directory",
    meta: "Give a teen online driver's ed: which states Aceable covers, regular and sale prices, age rules and what parents need to know.", body, jsonld: [article(h1, slug)] };
}

// Oedro, from oedro.com on 2026-11-15 (CJ advertiser 7455332).
const OE = { home: 17050091, mats: 17050549, steps: 17050550, tonneau: 17050548 };
function oedroPage() {
  const slug = "truck-accessories-gifts", h1 = "Truck accessories as a gift: floor mats, running boards and bed covers";
  const body = `${head("Reviews", h1, "Checked November 15, 2026 · OEDRO")}
<div class="guide">
<p>For someone who loves their truck, a part made for that exact truck beats another keychain. Oedro sells floor mats, running boards (side steps), tonneau (bed) covers and other accessories built to fit specific makes and models.</p>
<p>We haven't installed these parts for this page. Everything below comes from Oedro's own site on November 15, 2026. <b>We earn a commission if you buy through the links on this page</b>, at no extra cost to you.</p>
${H2("What it costs")}
${table(["Item (example from Oedro's site)", "Price when checked", "Was"], [["All-weather floor mats, 2015–2026 Ford F-150 SuperCab", "$109.99", "$229.99"],
  ["Floor mats, 2017–2026 Ford Super Duty Crew Cab", "$109.99", "$199.99"], ["Floor mats with under-seat storage, 2022–2026 Nissan Frontier Crew Cab", "$129.99", "$219.99"],
  ["Running boards, 2019–2026 Chevy Silverado / GMC Sierra Crew Cab", "$289.99", "$699.99"]])}
${btn(OE.mats, "Floor mats")}${btn(OE.steps, "Running boards")}${btn(OE.tonneau, "Tonneau covers")}
${H2("The one thing you need: their exact truck")}
<p>These parts are made to fit, so you need the <b>year, make, model and cab style</b> (for example, a 2021 Ford F-150 SuperCrew). The vehicle registration or insurance card in the glove box has the year, make and model. Count the doors for the cab style. Oedro's site asks for the vehicle before showing what fits.</p>
${H2("Good to know")}
<ul>
<li><b>Shipping</b> is free on all orders, according to the site.</li>
<li><b>Returns</b> within 30 days, and a 1-year warranty.</li>
<li><b>Floor mats are the easy gift.</b> They go in by hand. Running boards and bed covers bolt on, so check that they're happy to install them or plan a shop visit.</li>
</ul>
${btn(OE.home, "Shop Oedro")}
<p>More ideas: <a href="/gifts/gifts-for-car-guys">gifts for car guys</a> and <a href="/gifts/car-emergency-kit-gifts">car emergency kits</a>.</p>
</div>`;
  return { title: "Truck accessories as a gift: floor mats, running boards and tonneau covers (2026) | gift.directory",
    meta: "Truck accessories that fit their exact truck: example prices for floor mats and running boards, what you need to know to order, and returns.", body, jsonld: [article(h1, slug)] };
}

// Angi, from angi.com on 2026-11-15 (CJ advertiser 7439025). Requesting quotes is free; the giver pays the pro.
const AN = { home: 17141197, cleaning: 17142832, handyman: 17141193, moving: 17141190, lawn: 17142834, snow: 17252546 };
function angiPage() {
  const slug = "gift-a-home-service", h1 = "Give help instead of stuff: booking a home service as a gift";
  const body = `${head("Reviews", h1, "Checked November 15, 2026 · Angi")}
<div class="guide">
<p>For a new homeowner, a new parent or a parent who's getting older, the best gift can be an afternoon of work they don't have to do. A deep clean, a handyman visit, help with a move, the lawn cut or the driveway cleared of snow. Angi (formerly Angie's List) is a marketplace for finding local pros for that kind of work.</p>
<p>We haven't hired pros through Angi for this page. Everything below comes from Angi's own site on November 15, 2026. <b>We earn a commission when you request or book a pro through the links on this page</b>, at no extra cost to you.</p>
${H2("Ideas by who it's for")}
${table(["For", "Book"], [["New homeowners", "A move-in deep clean, a handyman for the list of small fixes, or help with the move itself"],
  ["New parents", "A house cleaning in the first weeks home"], ["Parents and grandparents", "Lawn care in summer, snow removal in winter, or a handyman for the jobs on a ladder"]])}
${btn(AN.cleaning, "House cleaning")}${btn(AN.handyman, "Handyman")}${btn(AN.moving, "Movers")}${btn(AN.lawn, "Lawn care")}${btn(AN.snow, "Snow removal")}
${H2("How it works")}
<ul>
<li><b>Requesting quotes is free.</b> Angi says homeowners can book services, request quotes and research local pros at no charge. Angi recommends getting at least three quotes.</li>
<li><b>Screening.</b> For pros marked "Angi Approved," Angi says the owner or a manager must pass a criminal background check and the business must keep its required licenses.</li>
<li><b>Guarantee.</b> Angi's Happiness Guarantee covers jobs you book and pay for through Angi, up to the price you paid, with limited damage protection.</li>
<li><b>Plan it with them.</b> Angi doesn't list gift cards, so you'll book for their address and pay the pro yourself. Agree on a date with them first, and put a card in the mail saying what's coming.</li>
</ul>
${btn(AN.home, "Find a pro on Angi")}
<p>Want something to wrap too? See <a href="/gifts/gifts-for-new-homeowners">gifts for new homeowners</a> and <a href="/gifts/housewarming-gifts">housewarming gifts</a>.</p>
</div>`;
  return { title: "Give a home service as a gift: cleaning, handyman, movers and lawn care (2026) | gift.directory",
    meta: "Gift a deep clean, a handyman visit or snow removal to a new homeowner, new parent or aging parent: how booking through Angi works.", body, jsonld: [article(h1, slug)] };
}

export const REVIEWS = { "gift-of-the-month-clubs": clubsPage, "muck-boots-gift-guide": muckPage, "graphicaudio-gift-guide": graphicAudioPage,
  "kings-camo-gift-guide": kingsPage, "magic-kits-and-costume-gifts": abracadabraPage, "drivers-ed-as-a-gift": aceablePage,
  "truck-accessories-gifts": oedroPage, "gift-a-home-service": angiPage };
export const REVIEW_SLUGS = Object.keys(REVIEWS);
// Short link titles for the gift-guides hub.
export const REVIEW_INDEX = [
  { slug: "gift-of-the-month-clubs", title: "Gift of the month clubs compared" },
  { slug: "muck-boots-gift-guide", title: "Muck boots as a gift" },
  { slug: "graphicaudio-gift-guide", title: "GraphicAudio full-cast audiobooks" },
  { slug: "kings-camo-gift-guide", title: "Kings Camo gifts for hunters" },
  { slug: "magic-kits-and-costume-gifts", title: "Magic kits and costume gifts" },
  { slug: "drivers-ed-as-a-gift", title: "Driver's ed as a gift" },
  { slug: "truck-accessories-gifts", title: "Truck accessories as a gift" },
  { slug: "gift-a-home-service", title: "Give a home service as a gift" },
];
// Guides whose readers a review page fits: a short box after the picks links to it.
const REVIEW_FOR = {
  "gift-of-the-month-clubs": ["gifts-for-wine-lovers", "gifts-for-tea-lovers", "gifts-for-beer-lovers", "gifts-for-coffee-lovers-under-50", "long-distance-relationship-gifts",
    "christmas-gifts-for-people-who-are-hard-to-shop-for", "christmas-gifts-for-dad-who-has-everything", "christmas-gifts-for-mom-who-wants-nothing", "christmas-gifts-for-grandparents"],
  "muck-boots-gift-guide": ["gifts-for-hunters", "gifts-for-gardeners", "gifts-for-bow-hunters", "gifts-for-deer-hunters", "gifts-for-duck-hunters", "gifts-for-outdoorsmen"],
  "graphicaudio-gift-guide": ["gifts-for-book-lovers", "gifts-for-fantasy-ranger-fans", "gifts-for-dnd-players"],
  "kings-camo-gift-guide": ["gifts-for-hunters", "gifts-for-bow-hunters", "gifts-for-deer-hunters", "gifts-for-duck-hunters", "gifts-for-outdoorsmen"],
  "magic-kits-and-costume-gifts": ["gifts-for-7-year-old-boys", "gifts-for-7-year-old-girls", "gifts-for-8-year-old-boys", "gifts-for-8-year-old-girls", "gifts-for-9-year-old-boys",
    "gifts-for-9-year-old-girls", "gifts-for-10-year-old-boys", "gifts-for-10-year-old-girls", "christmas-gifts-for-kids-8-to-10", "white-elephant-gifts-under-30"],
  "drivers-ed-as-a-gift": ["gifts-for-15-year-old-boys", "gifts-for-15-year-old-girls", "gifts-for-16-year-old-boys", "gifts-for-16-year-old-girls",
    "christmas-gifts-for-teens", "christmas-gifts-for-teen-boys", "christmas-gifts-for-teen-girls"],
  "truck-accessories-gifts": ["gifts-for-car-guys", "car-emergency-kit-gifts", "gifts-for-truck-drivers"],
  "gift-a-home-service": ["gifts-for-new-homeowners", "housewarming-gifts", "closing-gifts-for-home-buyers", "gifts-for-new-parents",
    "christmas-gifts-for-grandparents", "christmas-gifts-for-mom-who-wants-nothing"],
};
const BOX = {
  "gift-of-the-month-clubs": ["A gift that keeps arriving", "Beer, wine, coffee, chocolate or flowers every month. We compared ten clubs: what each box holds and what it costs."],
  "muck-boots-gift-guide": ["Boots they'll wear every day", "Which Muck boot fits the way they spend time outside, what each costs, and how to get the size right without asking."],
  "graphicaudio-gift-guide": ["Their favorite series, as a full-cast drama", "GraphicAudio turns fantasy and sci-fi books into audio dramas with actors, music and sound effects. What it costs and how to give it."],
  "kings-camo-gift-guide": ["Camo they'll wear every season", "Kings Camo hats, hoodies and jackets for the hunter on your list, by budget, with sizing and returns."],
  "magic-kits-and-costume-gifts": ["A magic kit gets them performing by dinner", "Magic kits from a New York magic shop, with sale prices and the one policy to know before you buy."],
  "drivers-ed-as-a-gift": ["The gift before the keys", "Online driver's ed for teens: which states it covers, what it costs, and what parents need to know first."],
  "truck-accessories-gifts": ["A part made for their exact truck", "Floor mats, running boards and bed covers: example prices and the one thing you need to know before ordering."],
  "gift-a-home-service": ["Give an afternoon of help", "Book a deep clean, a handyman, movers or snow removal for them: how it works and what to plan."],
};
// One box per matching review (a hunting guide links both boots and camo).
export function reviewBox(guideSlug) {
  return Object.keys(REVIEW_FOR).filter(k => REVIEW_FOR[k].includes(guideSlug)).map(slug => { const [t, d] = BOX[slug];
    return `<aside style="border:2px solid var(--accent);background:#fff;border-radius:14px;padding:16px 18px;margin:22px 0">
<b style="font-size:1.1rem;font-family:Georgia,serif">${esc(t)}</b><p style="margin:6px 0 10px">${esc(d)}</p>
<a href="/reviews/${slug}" style="font-weight:700">Read the guide →</a></aside>`; }).join("");
}
export function renderReview(slug, ad = "") {
  const f = REVIEWS[slug]; if (!f) return null;
  const p = f();
  return shell(p.title, p.meta, `https://gift.directory/reviews/${slug}`, p.body, p.jsonld, ad);
}
