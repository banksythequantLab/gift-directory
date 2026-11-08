# gift.directory — Devpost submission text

**Tagline (under 200 chars):** AI gift stores, gift guides and a gift registry from every store, with real in-stock products and group gifts where everyone chips in with PayPal.

## Inspiration
I'm a New York attorney. Clients want to thank their lawyer, firms want to thank their staff, and colleagues want to go in together when someone makes partner. Every one of those ends the same way: someone scrolls Amazon for an hour, then chases six people on Venmo. Gift guides are static and generic, "chip in" means one person fronting the money, and gift registries lock you into one store. I wanted something that knows the world it's shopping for, shows real products from the first second, and makes the chipping-in part effortless. Then I realized every niche has the same problem: nurses, teachers, golfers, new parents, couples. So it became a platform.

## What it does
**Shopping (any store):**
- The store opens on a grid of real, in-stock gifts for its niche, pulled live from thousands of retailers through Channel3 and CJ Affiliate brands.
- Questions appear *between* the products: occasion, who it's for, budget, your relationship, what they love. Each tap re-ranks the grid. The AI's picks move to the front with a one-line reason written for that person.
- **Group gift:** start a pool on any product and share one link. Each person chips in through PayPal Checkout, and the money goes straight to the organizer's PayPal account. A live progress bar and a "who's in" list update with each payment.

**Gift registry from every store (new):**
- Make a free registry at gift.directory/registry, no account needed. Add gifts by telling the AI what you want ("a KitchenAid stand mixer, 2 cozy throw blankets under $80 and a burr coffee grinder"), by searching hundreds of stores, or by pasting any product link.
- Guests open one link, buy from whichever store sells it, and tap "I bought this" so nothing is doubled. The owner sees who bought what; other guests don't.
- Big items get **"Go in together"**: a PayPal group gift for that item, paid straight to the couple. Once it's fully funded, the item shows as bought.

**Running a store:**
- Type who your store is for. The AI drafts the whole store (name, web address, tagline, occasions, search guidance, color), and you can edit anything with a live preview.
- **AI store assistant (new):** owners say what they want in plain English ("add a shelf of stocking stuffers for nurses under $25 and hide anything with skulls"). The assistant shows a plan with the actual products it found, and nothing changes until the owner clicks Apply.
- **Sell your own products:** connect a Shopify store or an **Etsy shop** (Etsy Open API v3), paste product links or upload a CSV. They sit on a "From our shop" shelf and the AI can recommend them. Shops re-sync daily.
- Publish with a $19/month PayPal Subscription. The store is live at yourname.gift.directory while the subscription is active.

**569 gift guides** (gift.directory/gifts): professions, holidays, hobbies, outdoors and preparedness, fan pages for NFL, MLB, NBA, NHL, WNBA, MLS and college teams and major soccer clubs, fandoms, dog breeds, birthdays and anniversaries. Each has real products, AI reasons and an FAQ, and links into a store where a group can chip in with PayPal.

## How we built it
- **Cloudflare Workers + D1**, no framework. One worker serves the platform, every store, the guides and the registries, and decides which store a request is for from its hostname.
- **PayPal Orders v2:** each contribution is its own order with `payee` set to the organizer (or the registry's owner), captured when the contributor returns. The capture response is what moves the tally, in a single status-guarded transaction, so a refresh, a second tab or a replay can never count money twice.
- **PayPal Subscriptions v1:** a catalog product and a $19/month plan, with one subscription per store linked by `custom_id`. The store's status follows PayPal's own (ACTIVE → live; SUSPENDED/CANCELLED → offline).
- **Log in with PayPal** for store owners: the dashboard belongs to the PayPal account that pays for the store.
- **Channel3** product search, **CJ Affiliate** (GraphQL product search with tracked links) and the **Etsy Open API** for live prices, stock and retailer links.
- **AI (Qwen3-235B on Nebius Token Factory)** for drafting stores, planning searches, picking gifts, the store assistant and the registry helper. The model may only pick products the searches actually returned, by ID or position. Anything it invents is dropped, and every price and link comes from the retailer data, never from the model.
- 424 automated tests run against real SQLite built from the production migrations.

## Challenges we ran into
- **Paying someone who isn't us.** I tested sending contributions directly to another account's PayPal (`payee`). When the organizer's email had no PayPal account, the capture came back `PENDING / UNILATERAL`: the contributor had paid, but the money was waiting to be claimed. I changed the tally to count it and show the organizer a "claim your money" notice.
- **AI shelves full of the same thing.** Asked for "stocking stuffers", one search returned four ornaments. Now the assistant searches 4–6 different product kinds, the model ranks them, and code takes the best of each kind in turn.
- **Words that mean two things.** "Bow case" found double-bass cases and "deer call" found a hair spray. Every guide slot now has words the product title must contain, plus per-page exclusions.
- **Keeping the AI honest about products.** Models happily invent a "Montblanc pen, $89". The pick step only accepts products from the search results, and the tests prove an invented one is dropped.

## Accomplishments we're proud of
- A real end-to-end flow on the PayPal sandbox: AI-picked gift → group gift → contributions paid to the organizer → live tally, plus a paid store subscription that brought a second store (Nurse Gifts) online.
- A registry that isn't tied to one store, with PayPal group gifts built in.
- Store owners get an assistant that does the tedious curation, but never changes anything without their OK.

## What we learned
PayPal's `payee` field plus the capture response gives you a "pay a friend" group gift with no platform custody of funds, and the same pattern turns a registry's big items into group gifts. Product-first, question-second makes for a much better shopping experience than a questionnaire. And an AI that proposes while a person approves is the right shape for anything that changes a live store.

## What's next
- Revenue share: affiliate commissions split with store owners via PayPal Payouts.
- Emailed registry reminders before the event date.
- Custom domains for stores (Cloudflare for SaaS).
- Deadlines that refund a group gift automatically if it isn't filled.

## How to test (PayPal sandbox, about 5 minutes)
Step-by-step guide: https://gift.directory/#judges

- **Sandbox buyer (pays):** `BUYER_EMAIL` / `BUYER_PASSWORD`
- **Sandbox receiver (organizer / registry PayPal email):** `sb-7bf7453357370@personal.example.com`

1. Ask the AI gift finder at https://gifts.nota.lawyer for a gift.
2. Tap **Group gift** on a pick, use the receiver email as organizer, open the share link and chip in with the buyer.
3. Make a registry at https://gift.directory/registry and mark or pool an item from the share link.
4. Launch a store at https://gift.directory using the buyer email, approve the $19/month sandbox subscription, then open **Edit this store**, where the AI assistant is.

## Built with
paypal-orders-api · paypal-subscriptions-api · log-in-with-paypal · channel3 · cj-affiliate · etsy-api · nebius-token-factory · qwen · cloudflare-workers · cloudflare-d1 · javascript

## Links
- Platform: https://gift.directory
- Gift registry: https://gift.directory/registry
- Gift guides: https://gift.directory/gifts
- Store #1: https://gifts.nota.lawyer
- Code: https://github.com/banksythequantLab/gift-directory
