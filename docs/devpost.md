# gift.directory — Devpost submission text

**Tagline (under 200 chars):** Launch an AI gift store for your people in two minutes: real in-stock products, questions woven between them, and group gifts where everyone chips in with PayPal.

## Inspiration
I'm a New York attorney. Clients want to thank their lawyer, firms want to thank their staff, and colleagues want to go in together when someone makes partner. Every one of those ends the same way: someone scrolls Amazon for an hour, then chases six people on Venmo. Gift guides are static and generic, and "chip in" means one person fronting the money. I wanted something that knows the world it's shopping for, shows real products from the first second, and makes the chipping-in part effortless. Then I realized every niche has the same problem: nurses, teachers, golfers, new parents. So it became a platform.

## What it does
**Shopping (any store):**
- The store opens on a grid of real, in-stock gifts for its niche, pulled live from thousands of retailers through Channel3.
- Questions appear *between* the products: occasion, who it's for, budget, your relationship, what they love. Each tap re-ranks the grid. The AI's picks move to the front with a one-line reason written for that person.
- **Group gift:** start a pool on any product and share one link. Each person chips in through PayPal Checkout, and the money goes straight to the organizer's PayPal account. A live progress bar and a "who's in" list update with each payment.
- Lawyer Gifts knows that judges and court staff are restricted from accepting gifts. Choose "for a judge or clerk" and it shows the rule (22 NYCRR Part 100 in New York) instead of a shopping list.

**Running a store:**
- Type who your store is for. The AI drafts the whole store (name, web address, tagline, occasions, search guidance, color) and you edit anything with a live preview.
- Publish with a $19/month PayPal Subscription. The store is live at yourname.gift.directory while the subscription is active.

## How we built it
- **Cloudflare Workers + D1**, no framework. One worker serves the platform and every store and decides which store a request is for from its hostname.
- **PayPal Orders v2:** each contribution is its own order with `payee` set to the organizer, captured when the contributor returns. The capture response is what moves the tally, in a single status-guarded transaction, so a refresh, a second tab or a replay can never count money twice.
- **PayPal Subscriptions v1:** a catalog product and a $19/month plan, with one subscription per store linked by `custom_id`. The store's status follows PayPal's own (ACTIVE → live; SUSPENDED/CANCELLED → offline).
- **Channel3** product search for live prices, stock and retailer links.
- **AI (Qwen3-235B on Nebius Token Factory, about 2 s per call)** for three jobs: drafting stores, planning searches, and picking gifts. The picker may only choose products Channel3 actually returned, by ID. Anything it invents is dropped, and every price and link comes from Channel3, never from the model. If the model is down, the grid still fills.
- 121 automated tests run against real SQLite built from the production migrations.

## Challenges we ran into
- **Paying someone who isn't us.** I tested sending contributions directly to another account's PayPal (`payee`). When the organizer's email had no PayPal account, the capture came back `PENDING / UNILATERAL`: the contributor had paid, but the money was waiting to be claimed. I changed the tally to count it and show the organizer a "claim your money" notice.
- **A redirect that ate the gift's ID.** The static-asset server quietly redirected `/pool.html` to `/pool`, dropping the `/g/<id>` from the address bar. It's fixed by asking for the bare path.
- **Keeping the AI honest about products.** Models happily invent a "Montblanc pen, $89". The pick step only accepts product IDs from the search results, and the tests prove an invented one is dropped.

## Accomplishments we're proud of
- A real end-to-end flow on the PayPal sandbox: AI-picked gift → group gift → contributions paid to the organizer → live tally, plus a paid store subscription that brought a second store (Nurse Gifts) online.
- Stores feel tailored. The same engine gives a nurse store spa sets and badge reels and a lawyer store fountain pens and leather portfolios.

## What we learned
PayPal's `payee` field plus the capture response gives you a "pay a friend" group gift with no platform custody of funds. And product-first, question-second makes for a much better shopping experience than a questionnaire.

## What's next
- Revenue share: Channel3 affiliate commissions split with store owners via PayPal Payouts.
- Custom domains for stores (Cloudflare for SaaS).
- Reminders for unpaid group-gift invitees, and a deadline that refunds automatically if a pool isn't filled.

## Built with
paypal-orders-api · paypal-subscriptions-api · channel3 · nebius-token-factory · qwen · cloudflare-workers · cloudflare-d1 · javascript

## Links
- Platform: https://gift.directory
- Store #1: https://gifts.nota.lawyer
- Code: https://github.com/banksythequantLab/gift-directory
