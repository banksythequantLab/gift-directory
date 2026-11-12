# Going live with real PayPal payments

The worker reads one switch, `PAYPAL_ENV` in `worker/wrangler.jsonc`. With `"sandbox"` it uses the sandbox
secrets. With `"live"` it uses the live secrets (`PAYPAL_LIVE_CLIENT_ID`, `PAYPAL_LIVE_CLIENT_SECRET`) and the live
plan (`PAYPAL_LIVE_PLAN_ID`). If live is selected but those are missing, payments and store billing report
"not configured". The worker never falls back to sandbox keys.

**Keep `sandbox` until hackathon judging ends.** The Devpost entry tells judges to test with sandbox accounts.

## A. Derek (PayPal website, about 10 minutes)

1. Make sure the PayPal **business** account that will receive the $19/month store fees is verified, with a
   confirmed email and a linked bank account: https://www.paypal.com/myaccount/summary
2. Create the live app: https://developer.paypal.com/dashboard/applications/live, then **Create App**, named "gift.directory".
3. In that app, open **Features**, tick **Log in with PayPal**, and set the return URL to:
   `https://gift.directory/api/auth/paypal/callback`. Save.
4. Copy the live **Client ID** and **Secret** into a new file `C:\Users\solti\.gd_paypal_live` (two lines, no quotes):
   ```
   PAYPAL_CLIENT_ID=...
   PAYPAL_CLIENT_SECRET=...
   ```
   The file stays on Vesper. Nothing gets pasted into chat.

## B. Claude (one pass, nothing goes live yet)

1. Create the live product and $19/month plan:
   `PAYPAL_ENV=live node scripts/setup-plan.mjs C:\Users\solti\.gd_paypal_live` prints the plan id. Put it in
   `PAYPAL_LIVE_PLAN_ID` in `wrangler.jsonc`.
2. Store the live secrets on the worker (read from the file):
   `wrangler secret put PAYPAL_LIVE_CLIENT_ID` / `PAYPAL_LIVE_CLIENT_SECRET`.
3. Deploy. The site still runs on sandbox.

## C. Flip (after judging)

1. In `wrangler.jsonc`, set `"PAYPAL_ENV": "live"`, then deploy.
2. Close the remaining sandbox group gifts so nobody chips in to a sandbox order:
   `UPDATE pools SET status='closed' WHERE status='open'`
3. Smoke test with real money, kept small:
   - Start a group gift, chip in $1 from a second PayPal account, and check that the tally moves and the money reaches the organizer.
   - Log in with PayPal at https://gift.directory/login.
   - Optionally, publish a test store with your own card, then cancel the subscription in PayPal (Settings, Payments, Automatic payments).
4. Update the Devpost testing notes (they say "sandbox").

## Notes

- Existing stores keep working after the flip. Nurse Gifts' sandbox subscription can't be checked against live
  PayPal, so the store simply stays as it is (active). Lawyer Gifts is the house store and has no subscription.
- Rollback: set `"PAYPAL_ENV": "sandbox"` and deploy.

## D. After judging closes (Nov 12, noon PST): the `post-judging` branch

Prepared and tested on Nov 11, not deployed. In order:

1. Merge and deploy: `git checkout main; git merge post-judging; cd worker; npx wrangler deploy`
   - Privacy and Terms now cover uploaded photos (review the wording first).
   - Photo products and uploads are off while the shop is hidden. Set `SHOP_PHOTOS` to `"1"` to test them.
   - "Personalize it" examples for the teachers, doctors, realtors and police stores (shown once the shop is public).
   - Seven holiday guides are defined but not built.
2. Build the holiday guides, then read each page's picks:
   (from `worker`) `node scripts/build-guides.mjs black-friday-gift-ideas cyber-monday-gift-ideas christmas-gifts-for-firefighters christmas-gifts-for-lawyers-under-50 christmas-gifts-for-nurses-under-25 stocking-stuffers-for-nurses stocking-stuffers-for-teachers`
3. Detach the Firefighter store's unfinished sandbox subscription, so a PayPal status check can't mark the store lapsed:
   `UPDATE stores SET paypal_subscription_id=NULL, subscription_status=NULL WHERE slug='firefighter-gifts'`
4. Finder speed: fresh answers took 20 to 30 seconds on Nov 11 (9 to 14 before). Time the model call and the searches separately before changing anything.
5. Then sections A to C above (PayPal live), and set the Nurses store's owner email back.
6. Shop opening: one full paid test order first, then `SHOP_PUBLIC` and `SHOP_FULFILL` to `"1"`.
7. Guide audit (Nov 11, all 610 guides): rebuild these with `?cards=1` so the new exclude rules apply, then read the picks.
   Wrong picks: nurse-appreciation-gifts nursing-school-graduation-gifts what-to-get-a-computer-geek police-academy-graduation-gifts teacher-retirement-gifts firefighter-retirement-gifts police-retirement-gifts military-retirement-gifts fire-academy-graduation-gifts secret-santa-gifts-for-police-officers secret-santa-gifts-for-nurses secret-santa-gifts-under-25 gifts-for-your-boss-under-50 gifts-for-club-america-fans gifts-for-tottenham-hotspur-fans gifts-for-usmnt-fans gifts-for-calgary-flames-fans gifts-for-pokemon-fans
   Near-duplicates: christmas-gifts-under-20 gifts-for-13-year-old-girls gifts-for-boston-red-sox-fans gifts-for-german-shepherd-lovers gifts-for-san-antonio-spurs-fans gifts-for-tennessee-titans-fans gifts-for-texas-a-m-aggies-fans gifts-for-toronto-blue-jays-fans gifts-for-morocco-soccer-fans
   Thin (4 or 5 picks): 24 pages, mostly NBA and WNBA teams and dog breeds; listed by `scripts/audit-guides.mjs`.
   `scripts/build-guides.mjs` needs a `--cards` option for this (not written yet).

## E. Split mode (on since Nov 12, 2026)

`PAYPAL_ENV` is `split`: PayPal sandbox test accounts (`sb-...@personal.example.com` / `@business.example.com`) stay on the sandbox for
group gifts, registries, store billing and owner login; everyone else is on live PayPal. Hackathon judging runs Dec 1-15
(not Nov 12, which was the submission deadline). After Dec 15 8am PST set `PAYPAL_ENV` to `live` to retire the sandbox side.
Rollback: set `PAYPAL_ENV` back to `sandbox` and deploy.
The live plan was created through `POST /api/seo/live-plan` (build token), which uses the live keys the worker holds.
