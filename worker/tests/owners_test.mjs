// Store owners: Log in with PayPal parsing, ownership, settings, curation.
import { authorizeUrl, parseUserinfo, ownsStore, validateSettings, validateItem, shelves, withoutHidden } from "../owners.js";
import { darkEnough } from "../stores.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  — " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

const u = new URL(authorizeUrl({ PAYPAL_CLIENT_ID: "cid" }, "https://gift.directory/api/auth/paypal/callback", "st8"));
eq("login goes to PayPal sandbox", u.origin, "https://www.sandbox.paypal.com");
eq("for a code", u.searchParams.get("response_type"), "code");
eq("asking for email", u.searchParams.get("scope").includes("email"), true);
eq("with our state", u.searchParams.get("state"), "st8");
eq("live mode uses paypal.com", new URL(authorizeUrl({ PAYPAL_ENV: "live", PAYPAL_CLIENT_ID: "c" }, "x", "s")).origin, "https://www.paypal.com");

const v11 = parseUserinfo({ user_id: "https://www.paypal.com/webapps/auth/identity/user/abc", payer_id: "PAYER1", name: "Ann Lee",
  emails: [{ value: "Ann@Example.com", primary: true, confirmed: true }, { value: "old@x.com", confirmed: false }] });
eq("paypalv1.1 shape: payer id", v11.payer_id, "PAYER1");
eq("only confirmed emails, lower-cased", v11.emails.join(","), "ann@example.com");
const oidc = parseUserinfo({ sub: "x", email: "B@x.com", email_verified: true, given_name: "Bo", family_name: "Ng" });
eq("openid shape: email", oidc.emails[0], "b@x.com");
eq("and name", oidc.name, "Bo Ng");
eq("an unverified-only answer is no login", parseUserinfo({ email: "c@x.com", email_verified: false }), null);
eq("nothing is no login", parseUserinfo({}), null);

eq("the payer who paid owns the store", ownsStore({ payer_id: "P1", emails: [] }, { owner_payer_id: "P1", owner_email: "z@z.com" }), true);
eq("so does the verified setup email", ownsStore({ payer_id: "P9", emails: ["owner@x.com"] }, { owner_email: "Owner@x.com" }), true);
eq("a stranger does not", ownsStore({ payer_id: "P9", emails: ["me@x.com"] }, { owner_payer_id: "P1", owner_email: "owner@x.com" }), false);
eq("nobody logged in owns nothing", ownsStore(null, { owner_email: "a@b.com" }), false);

const good = { name: "Nurse Gifts", tagline: "t", occasions: ["a", "b", "c"], accent: "#2c5f2d" };
eq("good settings pass", validateSettings(good, darkEnough).settings.name, "Nurse Gifts");
ok("a name is required", validateSettings({ ...good, name: " " }, darkEnough).error);
ok("three occasions at least", validateSettings({ ...good, occasions: ["a"] }, darkEnough).error);
eq("tee banner on by default", validateSettings(good, darkEnough).settings.tee_banner, true);
eq("tee banner can be switched off", validateSettings({ ...good, tee_banner: false }, darkEnough).settings.tee_banner, false);
eq("tee banner only off when exactly false", validateSettings({ ...good, tee_banner: "no" }, darkEnough).settings.tee_banner, true);
ok("a light color is refused", validateSettings({ ...good, accent: "#ffee99" }, darkEnough).error);

const card = { product_id: "p1", title: "Snow Globe", url: "https://shop/x", price_cents: 7000, image: "https://img/x" };
eq("pin with a collection", validateItem({ status: "pinned", collection: "Night shift", card }).item.collection, "Night shift");
eq("hidden items have no collection", validateItem({ status: "hidden", collection: "x", card }).item.collection, null);
ok("an unknown status is refused", validateItem({ status: "starred", card }).error);
ok("a non-https link is refused", validateItem({ status: "pinned", card: { ...card, url: "javascript:x" } }).error);

const it = (id, status, collection, sort = 0) => ({ product_id: id, status, collection, sort, created_at: "2026", card_json: JSON.stringify({ product_id: id }) });
const sh = shelves([it("a", "pinned", "Under $50", 1), it("b", "pinned", null, 2), it("c", "hidden", null), it("d", "pinned", "Under $50", 0)]);
eq("'Our picks' comes first", sh[0].title, "Our picks");
eq("then the collections", sh[1].title, "Under $50");
eq("in the owner's order", sh[1].cards.map(c => c.product_id).join(","), "d,a");
eq("hidden items are not on a shelf", sh.flatMap(s => s.cards).some(c => c.product_id === "c"), false);
eq("hidden products never show", withoutHidden([{ product_id: "c" }, { product_id: "x" }], [it("c", "hidden")]).length, 1);

{
  const { paypalMode, paypalBase } = await import("../paypal-core.js");
  const both = { PAYPAL_ENV: "sandbox", PAYPAL_CLIENT_ID: "sb-id", PAYPAL_CLIENT_SECRET: "sb-sec", PAYPAL_PLAN_ID: "P-SB",
    PAYPAL_LIVE_CLIENT_ID: "live-id", PAYPAL_LIVE_CLIENT_SECRET: "live-sec", PAYPAL_LIVE_PLAN_ID: "P-LIVE", DB: "db" };
  eq("sandbox mode keeps sandbox keys", paypalMode(both).PAYPAL_CLIENT_ID, "sb-id");
  const live = paypalMode({ ...both, PAYPAL_ENV: "live" });
  eq("live mode uses live keys", live.PAYPAL_CLIENT_ID + "|" + live.PAYPAL_CLIENT_SECRET + "|" + live.PAYPAL_PLAN_ID, "live-id|live-sec|P-LIVE");
  eq("live mode talks to the live API", paypalBase(live), "https://api-m.paypal.com");
  eq("live mode keeps other bindings", live.DB, "db");
  const half = paypalMode({ PAYPAL_ENV: "live", PAYPAL_CLIENT_ID: "sb-id", PAYPAL_CLIENT_SECRET: "sb-sec" });
  eq("live without live keys never falls back to sandbox keys", half.PAYPAL_CLIENT_ID, "");
  eq("live login goes to paypal.com", authorizeUrl(live, "https://gift.directory/api/auth/paypal/callback", "s").startsWith("https://www.paypal.com/"), true);

  // Split: real visitors on live PayPal, PayPal's sandbox test accounts on the sandbox.
  const { paypalFor, isSandboxEmail, paypalToken, _resetTokenCache } = await import("../paypal-core.js");
  const split = paypalMode({ ...both, PAYPAL_ENV: "split" });
  eq("split: everyone else gets live keys", paypalFor(split, false).PAYPAL_CLIENT_ID + "|" + paypalBase(paypalFor(split, false)), "live-id|https://api-m.paypal.com");
  const sbx = paypalFor(split, true);
  eq("split: a test account gets sandbox keys", sbx.PAYPAL_CLIENT_ID + "|" + sbx.PAYPAL_PLAN_ID + "|" + paypalBase(sbx), "sb-id|P-SB|https://api-m.sandbox.paypal.com");
  eq("split: sandbox login goes to the sandbox", authorizeUrl(sbx, "https://gift.directory/api/auth/paypal/callback", "s").startsWith("https://www.sandbox.paypal.com/"), true);
  eq("split: sandbox side keeps other bindings", sbx.DB, "db");
  eq("live only: a test account still gets live (no sandbox side)", paypalFor(live, true).PAYPAL_CLIENT_ID, "live-id");
  eq("sandbox only: everyone gets sandbox", paypalFor(paypalMode(both), false).PAYPAL_CLIENT_ID, "sb-id");
  eq("PayPal sandbox buyer email", isSandboxEmail("sb-7bf7453357370@personal.example.com"), true);
  eq("PayPal sandbox business email", isSandboxEmail(" SB-abc123@business.example.com "), true);
  eq("a real email is not sandbox", isSandboxEmail("jane@gmail.com"), false);
  eq("example.com alone is not sandbox", isSandboxEmail("jane@example.com"), false);
  eq("lookalike domain is not sandbox", isSandboxEmail("sb-1@personal.example.com.evil.io"), false);
  eq("no email is not sandbox", isSandboxEmail(null), false);
  // Each side keeps its own access token: alternating sandbox and live must not re-fetch every time.
  _resetTokenCache();
  let calls = 0;
  const fetchImpl = async u => { calls++; return { ok: true, json: async () => ({ access_token: "t-" + (u.includes("sandbox") ? "sb" : "live"), expires_in: 3600 }) }; };
  const got = [];
  for (const e of [sbx, split, sbx, split]) got.push(await paypalToken(e, { fetchImpl }));
  eq("split: tokens never cross sides", got.join(","), "t-sb,t-live,t-sb,t-live");
  eq("split: one token request per side", calls, 2);
  _resetTokenCache();
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
