# gift.directory

**Launch an AI gift store for your people in two minutes.** Real products with live prices, an AI that asks the right questions between the products, and group gifts where everyone chips in through PayPal.

- Platform and store wizard: **https://gift.directory**
- Store #1, Lawyer Gifts: **https://gifts.nota.lawyer**
- Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com). Everything runs on the **PayPal sandbox**.

## What it does

**For shoppers (any store):**
- The store opens on a grid of real, in-stock gifts for its niche, live from thousands of retailers through [Channel3](https://trychannel3.com).
- Questions sit *between* the products ("What's the occasion?", "Who's it for?", "Budget?"). Each tap re-ranks the grid. The AI's picks move to the front with a one-line reason.
- **Group gift:** start a pool on any product and share the link. Everyone chips in with **PayPal Checkout**, and the money goes **straight to the organizer's PayPal**. The site never holds it.

**For store owners:**
- Say who the store is for ("nurses and the patients who thank them"). The AI drafts the name, address, tagline, occasions, search guidance and color, and you can edit any of it.
- Publish with a **$19/month PayPal Subscription**. The store is live at `yourname.gift.directory` while the subscription is active, and goes offline if it's cancelled or suspended.

## How PayPal is used

| Flow | PayPal API | Notes |
|---|---|---|
| Chip in to a group gift | Orders v2 (`intent: CAPTURE`, `payee.email_address` = organizer) | Captured on return; the tally only moves on a completed capture. Replays can't double-count (status-guarded writes in one transaction). |
| Organizer without a PayPal account | Orders v2 capture `PENDING / UNILATERAL` | Counted as paid, and the organizer is told to claim it within 30 days. |
| Publish a store | Catalog Products + Billing Plans + Subscriptions v1 | `custom_id` ties the subscription to the store. The store's status follows PayPal's (re-checked on return and at most every 6 hours). |

## How AI is used

- **Store drafting:** niche → full store configuration (JSON, validated: slug rules, reserved names, text-contrast check on the color).
- **Search planning:** brief → 3–5 catalog searches, steered by each store's own guidance.
- **Picking:** chooses from **only the products Channel3 returned**, by ID. A product the model invents is dropped, and prices and links always come from Channel3. If the model is down, the grid still fills.
- Model: `Qwen/Qwen3-235B-A22B-Instruct-2507` on Nebius Token Factory (about 2 s per call).

## Stack

Cloudflare Workers + D1 + static assets. No framework, no build step.

```
worker/
  worker.js        routes: store resolution by host, finder, browse, pools, store publishing
  finder.js        AI search plan, Channel3 search, cards, AI picks, front-page grid
  pools.js         group gifts: validation, PayPal order, capture → tally
  stores.js        AI store draft, slugs, subscription body/status, host routing
  paypal-core.js   OAuth token (with stale-token recovery), REST wrapper, webhook verify
  migrations/      D1 schema
  public/          store page (grid + questions), pool page, platform wizard
  scripts/setup-plan.mjs   one-time: PayPal product + $19/mo plan
  tests/           node tests against real SQLite built from the migrations
```

## Run it

```bash
cd worker
npx wrangler d1 create gift-finder            # put the id in wrangler.jsonc
for f in migrations/*.sql; do npx wrangler d1 execute gift-finder --remote --yes --file=$f; done
node scripts/setup-plan.mjs path/to/.dev.vars # prints PAYPAL_PLAN_ID for wrangler.jsonc
npx wrangler secret put PAYPAL_CLIENT_ID
npx wrangler secret put PAYPAL_CLIENT_SECRET
npx wrangler secret put CHANNEL3_API_KEY
npx wrangler secret put NEBIUS_API_KEY
npx wrangler deploy
node tests/run.mjs                            # 121 tests
```

Stores on `*.gift.directory` need a proxied wildcard DNS record (`AAAA * 100::`). On `*.workers.dev`, add `?store=<slug>` to pick a store.

## Provenance

Written during the hackathon (November 2026). `paypal-core.js` and the test helpers (`tests/d1shim.mjs`, `tests/run.mjs`) were carried over from the author's earlier Bottle Tree project (October 2026), as noted at the top of each file.

## License

MIT. See [LICENSE](LICENSE).
