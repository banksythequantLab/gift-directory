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
