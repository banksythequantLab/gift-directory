// About, Contact, Privacy, Terms for gift.directory. Plain server-rendered pages (AdSense reviewers and
// crawlers read them). Operator: Banksy AI LLC. Draft for the owner's legal review.
import { shell } from "./seo.js";

const UPDATED = "November 12, 2026";
const CONTACT = "hello@gift.directory";
const h1 = t => `<h1 style="font-family:Georgia,serif;margin:6px 0 10px">${t}</h1>`;
const sec = (t, ...ps) => `<h2 style="font-family:Georgia,serif;margin-top:22px">${t}</h2>${ps.map(p => `<p style="max-width:780px">${p}</p>`).join("")}`;

export const LEGAL = {
  about: { title: "About gift.directory", meta: "gift.directory helps people find real, in-stock gifts with AI and give them together with PayPal. Anyone can launch a niche gift store in minutes.",
    body: h1("About gift.directory") +
      `<p style="max-width:780px">gift.directory helps people find a good gift fast, and give it together. Every page shows real products that are in stock right now at well-known retailers, with live prices. An AI asks a few quick questions between the products and moves the best matches to the front, with a short reason for each.</p>` +
      sec("Why we built it", "Thanking someone usually ends with an hour of scrolling and a round of payment requests. We wanted a place that knows who you're shopping for, shows real products from the first second, and lets a group chip in without one person fronting the money.") +
      sec("How it works",
        "<b>Real products only.</b> Products, prices and links come from Channel3's catalog of retailers. The AI can only choose from what the catalog returns, so it never makes up a product or a price.",
        "<b>Group gifts.</b> Anyone can start a group gift on a product and share one link. Each person pays their share with PayPal, straight to the organizer's PayPal account. gift.directory never holds the money.",
        "<b>Niche stores.</b> Anyone can launch a gift store for their people, such as nurses, golfers or a law firm, at <i>yourname</i>.gift.directory. The AI drafts the store and the owner edits it; stores run on a PayPal subscription.") +
      sec("Who runs it", "gift.directory is operated by Banksy AI LLC and was founded by Derek Soltis, a New York attorney. The first store, Lawyer Gifts, came out of years of watching clients and colleagues try to say thank you.") +
      sec("How we make money", "Store owners pay a monthly subscription. When you buy through a retailer link, we may earn a commission at no extra cost to you. Gift-guide pages may show an advertisement at the bottom of the page.") },
  contact: { title: "Contact gift.directory", meta: "How to reach gift.directory about stores, group gifts, the gift guides, or partnerships.",
    body: h1("Contact us") +
      `<p style="max-width:780px">Email <a href="mailto:${CONTACT}">${CONTACT}</a>. We read everything and usually answer within two business days.</p>` +
      sec("Before you write",
        "<b>An order from a retailer</b> (shipping, returns, a wrong item): the retailer you bought from handles the order. Their contact details are on their site and in your order confirmation.",
        "<b>A group-gift payment</b>: contributions go straight to the organizer's PayPal account. For a refund, ask the organizer. For a problem with a payment itself, PayPal's Resolution Center can help.",
        "<b>Your store or subscription</b>: log in at <a href=\"/admin\">gift.directory/admin</a> with the PayPal account that pays for the store. You can cancel the subscription any time in PayPal.") },
  privacy: { title: "Privacy Policy — gift.directory", meta: "What gift.directory collects, how it is used, cookies, advertising, and your choices.",
    body: h1("Privacy Policy") + `<p class="muted">Last updated ${UPDATED}</p>` +
      `<p style="max-width:780px">This policy explains what Banksy AI LLC ("we") collects when you use gift.directory, its stores (*.gift.directory) and related addresses, and what we do with it.</p>` +
      sec("What we collect",
        "<b>What you type to find a gift</b>: the occasion, who it's for, budget and interests. We use it to search for products and pick suggestions, and keep it to improve results. Please don't type sensitive personal information into these fields.",
        "<b>Group gifts</b>: the organizer's name and PayPal email, the gift chosen, and each contributor's name (unless they choose to hide it), message and amount. Names and messages appear on the group-gift page for anyone with the link. The organizer's email is never shown publicly.",
        "<b>Gift registries</b>: the registry's name, date, the owner's name and (optionally) PayPal email, the gifts on it, and the names guests give when they mark a gift as bought (shown only to the owner). If a guest asks for a reminder, we keep their email only until we send that one reminder a week before the date (sent through Cloudflare), then delete it; every reminder has an unsubscribe link that deletes it immediately.",
        "<b>Shop orders</b>: when you buy from the gift.directory shop, we keep what you ordered (including any text you chose and any photo you uploaded), the shipping name and address, your email for the receipt, and the PayPal reference. We send the order and address to our print partner Printful, which makes and ships it. A photo you upload for a photo product is stored only so it can be printed: it is deleted after 30 days if you don't order, and kept for up to one year after an order so a damaged item can be reprinted, then deleted. Printful receives the photo to print it. To have a photo deleted sooner, write to us with your order number.",
        "<b>Stores</b>: the owner's email, store settings and PayPal subscription details. When you log in with PayPal, PayPal tells us your verified email address(es), name and PayPal account ID. We never receive your PayPal password.",
        "<b>Payments</b> are handled by PayPal. We receive confirmation of a payment (amount, status and a PayPal reference), never your card or bank details. PayPal's own privacy statement applies to what you give PayPal.",
        "<b>Technical data</b>: like most sites, our hosting provider (Cloudflare) processes IP addresses and request details to deliver and protect the site.") +
      sec("Cookies",
        "We use a small number of cookies: a login cookie for store owners, and on test addresses a cookie remembering which store you picked. Store owners' browsers may also keep a private link to manage their store or group gift.",
        "<b>Advertising.</b> Gift-guide pages may show ads from Google AdSense. Google and its partners use cookies to serve ads based on your visits to this and other websites. You can opt out of personalized advertising at <a href=\"https://adssettings.google.com\" rel=\"nofollow\">Google Ads Settings</a> or <a href=\"https://www.aboutads.info/choices/\" rel=\"nofollow\">aboutads.info</a>. Learn more in <a href=\"https://policies.google.com/technologies/partner-sites\" rel=\"nofollow\">how Google uses information from sites that use its services</a>.") +
      sec("Retailer links and commissions", "Product links go to the retailer's own site, where their privacy policy applies. Some links are tracked so we can earn a commission when you buy; the retailer or our product-data partner (Channel3) may set their own cookies for that.") +
      sec("Who we share with", "We share data only as needed to run the service: PayPal (payments, subscriptions, login), Cloudflare (hosting, database and email), Printful (making and shipping shop orders), Channel3 (product search, which receives search terms but not your name or email), and our AI provider (which receives the gift details you type, to suggest products). We don't sell your personal information.") +
      sec("How long we keep it", "We keep group-gift and store records while they are active and for a reasonable period afterwards for records and disputes. Login sessions expire after 14 days. You can ask us to delete your information at any time.") +
      sec("Your choices", `Email <a href="mailto:${CONTACT}">${CONTACT}</a> to see, correct or delete your information. Depending on where you live, you may have additional rights under local law, and we will honor them.`) +
      sec("Children", "gift.directory is not directed to children under 13, and we don't knowingly collect their information.") +
      sec("Changes", "If we change this policy, we'll update the date above. Significant changes will be noted on the site.") },
  terms: { title: "Terms of Use — gift.directory", meta: "The terms for using gift.directory, its stores, gift guides and group gifts.",
    body: h1("Terms of Use") + `<p class="muted">Last updated ${UPDATED}</p>` +
      `<p style="max-width:780px">These terms apply to gift.directory, its stores and related addresses, operated by Banksy AI LLC. By using the site you agree to them.</p>` +
      sec("We're not the seller", "gift.directory shows products sold by other retailers. When you buy, you buy from that retailer, on its terms. Prices, stock and details come from retailers through Channel3 and can change or be wrong; the retailer's site is what counts. AI suggestions and reasons are recommendations only.") +
      sec("Group gifts", "An organizer starts a group gift and receives contributions directly in their PayPal account. The organizer is responsible for using the money for the gift, ordering it, and refunding contributors if the gift doesn't happen. gift.directory does not hold, transfer or guarantee these funds. PayPal's terms apply to every payment.") +
      sec("Stores and subscriptions", "Store owners pay a monthly subscription through PayPal and may cancel at any time in PayPal; the store goes offline when the subscription ends. Owners are responsible for their store's name, content and curation, and must not use a store for anything unlawful, misleading, or infringing on others' rights. We may suspend stores that do.") +
      "<!--shop-->" +
      sec("Commissions and ads", "We may earn a commission when you buy through a retailer link, and some pages may show advertisements. This doesn't change the price you pay.") +
      sec("No warranty", "The site is provided as is. To the fullest extent the law allows, Banksy AI LLC is not liable for indirect or consequential losses, or for products, retailers, payments between users, or third-party services.") +
      sec("Governing law", "These terms are governed by the laws of the State of New York.") +
      sec("Contact", `Questions: <a href="mailto:${CONTACT}">${CONTACT}</a>.`) },
};
// The shop's terms appear only once the shop is public (SHOP_PUBLIC=1). Draft for the owner's legal review.
export const SHOP_TERMS = sec("The gift.directory shop",
  "Items in the gift.directory shop are the exception to the section above: Banksy AI LLC is the seller. Each item is made to order and shipped by our print partner, Printful, to US addresses only. Prices are in US dollars; shipping is shown before you pay, and sales tax is added where we collect it (currently New Jersey). Payment is through PayPal.",
  "<b>Your text and photos.</b> You are responsible for the words and photos you ask us to print. Only upload photos you took or have the right to use, and only of people who are happy to be on the item. Don't submit anything unlawful, hateful, or sexually explicit, or that uses someone else's trademark, logo, or copyrighted work. We may decline an order we won't print and refund it in full. We print what the preview shows, so please check spelling and names before you pay.",
  "<b>Changes and cancellations.</b> Write to us right away if you need to change or cancel an order. Once it has gone into production we can't change or cancel it.",
  `<b>Returns and problems.</b> Because each item is made for you, we don't accept returns or exchanges for a change of mind, a size you chose, or text you typed. If an item arrives damaged, defective, or misprinted, or never arrives, email <a href=\"mailto:${CONTACT}\">${CONTACT}</a> within 30 days of delivery (or of the estimated delivery date) with your order number and a photo, and we'll reprint it or refund you.`,
  "<b>Delivery.</b> Delivery dates are estimates from Printful and the carrier, not guarantees. A gift message, if you add one, is printed on the packing slip.");
export const LEGAL_SLUGS = Object.keys(LEGAL);
export function renderLegal(slug, { shop = false } = {}) {
  const p = LEGAL[slug];
  return p ? shell(p.title, p.meta, `https://gift.directory/${slug}`, p.body.replace("<!--shop-->", shop ? SHOP_TERMS : "")) : null;
}
