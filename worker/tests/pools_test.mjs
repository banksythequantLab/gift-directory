// Group gift pools: validation, the PayPal order, and the tally against real SQLite (d1shim).
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { d1 } from "./d1shim.mjs";
import { validatePool, contributionError, buildContributionOrder, readCapture, applyCapture, publicPool } from "../pools.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  — " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

const good = { title: "For Maria — made partner", organizer_name: "Derek", organizer_email: "Org@Example.com",
  product: { title: "Montblanc pen", url: "https://shop.example/pen", price_cents: 45000, merchant: "Shop" } };
eq("a good pool validates", validatePool(good).error, undefined);
eq("the target defaults to the price", validatePool(good).pool.target_cents, 45000);
eq("the email is normalised", validatePool(good).pool.organizer_email, "org@example.com");
ok("a bad email is refused", validatePool({ ...good, organizer_email: "nope" }).error);
ok("no gift is refused", validatePool({ ...good, product: {} }).error);
ok("a non-https link is refused", validatePool({ ...good, product: { ...good.product, url: "javascript:alert(1)" } }).error);
ok("a target below the price is refused", validatePool({ ...good, target_cents: 100 }).error);
eq("a target a little over the price is fine", validatePool({ ...good, target_cents: 50000 }).pool.target_cents, 50000);
ok("a target over double is refused", validatePool({ ...good, target_cents: 100000 }).error);

const open = { status: "open", target_cents: 45000, raised_cents: 40000 };
eq("a contribution inside what's left is fine", contributionError(open, 5000), null);
ok("more than what's left is refused", contributionError(open, 5001));
ok("under a dollar is refused", contributionError(open, 50));
ok("a funded pool takes no more", contributionError({ ...open, status: "funded" }, 100));
ok("fractions of a cent are refused", contributionError(open, 100.5));

const poolRow = { id: "p1", title: "For Maria", organizer_name: "Derek", organizer_email: "org@example.com",
  product_json: JSON.stringify(good.product), target_cents: 45000, raised_cents: 0, status: "open" };
const o = buildContributionOrder(poolRow, { id: "c1", amount_cents: 2500 }, "https://gifts.example");
eq("the money goes to the organizer", o.purchase_units[0].payee.email_address, "org@example.com");
eq("for the amount chosen", o.purchase_units[0].amount.value, "25.00");
eq("tagged with the contribution", o.purchase_units[0].custom_id, "c1");
eq("no address is asked for", o.payment_source.paypal.experience_context.shipping_preference, "NO_SHIPPING");
eq("returning to our capture", o.payment_source.paypal.experience_context.return_url, "https://gifts.example/api/pools/return");

const capBody = v => ({ payer: { name: { given_name: "Ann", surname: "Lee" } }, purchase_units: [{ payments: { captures: [
  { id: "CAP" + v, status: "COMPLETED", amount: { currency_code: "USD", value: v } }] } }] });
eq("a capture is read", readCapture(capBody("25.00")).amount_cents, 2500);
eq("with the payer's name", readCapture(capBody("25.00")).payer_name, "Ann Lee");
eq("no capture is NONE", readCapture({}).status, "NONE");

// ---------- the tally ----------
const t = "2026-11-05T00:00:00Z";
const db = d1(join(root, "migrations"));
db.raw.prepare("INSERT INTO pools (id,manage_hash,title,organizer_name,organizer_email,product_json,target_cents,raised_cents,status,created_at,updated_at) VALUES ('p1','h','For Maria','Derek','org@example.com',?,45000,0,'open',?,?)")
  .run(poolRow.product_json, t, t);
const add = (id, cents) => { db.raw.prepare("INSERT INTO contributions (id,pool_id,paypal_order_id,amount_cents,status,created_at,updated_at) VALUES (?,?,?,?,'pending',?,?)").run(id, "p1", "ORD-" + id, cents, t, t);
  return db.raw.prepare("SELECT * FROM contributions WHERE id=?").get(id); };
const pool = () => db.raw.prepare("SELECT * FROM pools WHERE id='p1'").get();

const c1 = add("c1", 20000);
eq("a captured contribution is paid", (await applyCapture(db, c1, readCapture(capBody("200.00")), { now: () => t })).outcome, "paid");
eq("and counts toward the gift", pool().raised_cents, 20000);
eq("the pool is still open", pool().status, "open");
eq("the same capture again is not counted twice", (await applyCapture(db, c1, readCapture(capBody("200.00")), { now: () => t })).outcome, "already");
eq("so the total is unchanged", pool().raised_cents, 20000);

const c2 = add("c2", 25000);
eq("a short capture is not counted", (await applyCapture(db, c2, readCapture(capBody("1.00")), { now: () => t })).outcome, "short capture");
eq("total still unchanged", pool().raised_cents, 20000);
await applyCapture(db, c2, readCapture(capBody("250.00")), { now: () => t });
eq("the last contribution fills it", pool().raised_cents, 45000);
eq("and the pool is funded", pool().status, "funded");

const c3 = add("c3", 1000);
const dec = capBody("10.00"); dec.purchase_units[0].payments.captures[0].status = "DECLINED";
eq("a declined payment cancels the contribution", (await applyCapture(db, c3, readCapture(dec), { now: () => t })).outcome, "cancelled");
eq("and adds nothing", pool().raised_cents, 45000);

{
  const db2 = d1(join(root, "migrations"));
  db2.raw.prepare("INSERT INTO pools (id,manage_hash,title,organizer_name,organizer_email,product_json,target_cents,raised_cents,status,created_at,updated_at) VALUES ('p2','h','T','D','x@y.com',?,10000,0,'open',?,?)").run(poolRow.product_json, t, t);
  db2.raw.prepare("INSERT INTO contributions (id,pool_id,paypal_order_id,amount_cents,status,created_at,updated_at) VALUES ('u1','p2','O-u1',2500,'pending',?,?)").run(t, t);
  const u = capBody("25.00"); u.purchase_units[0].payments.captures[0].status = "PENDING";
  u.purchase_units[0].payments.captures[0].status_details = { reason: "UNILATERAL" };
  eq("an unclaimed payment is read with its reason", readCapture(u).reason, "UNILATERAL");
  const r = await applyCapture(db2, db2.raw.prepare("SELECT * FROM contributions WHERE id='u1'").get(), readCapture(u), { now: () => t });
  eq("money waiting for the organizer to claim counts as paid", r.outcome, "paid");
  eq("toward the gift", db2.raw.prepare("SELECT raised_cents r FROM pools WHERE id='p2'").get().r, 2500);
  const pv = publicPool(db2.raw.prepare("SELECT * FROM pools WHERE id='p2'").get(), db2.raw.prepare("SELECT * FROM contributions").all());
  eq("and the pool shows how much is unclaimed", pv.unclaimed_cents, 2500);
  const other = capBody("25.00"); other.purchase_units[0].payments.captures[0].status = "PENDING";
  other.purchase_units[0].payments.captures[0].status_details = { reason: "ECHECK" };
  db2.raw.prepare("INSERT INTO contributions (id,pool_id,paypal_order_id,amount_cents,status,created_at,updated_at) VALUES ('u2','p2','O-u2',2500,'pending',?,?)").run(t, t);
  eq("an eCheck still clearing does not count yet", (await applyCapture(db2, db2.raw.prepare("SELECT * FROM contributions WHERE id='u2'").get(), readCapture(other), { now: () => t })).outcome, "waiting");
}

const pub = publicPool(pool(), db.raw.prepare("SELECT * FROM contributions").all());
eq("the public view hides the organizer's email", JSON.stringify(pub).includes("org@example.com"), false);
eq("and shows only paid contributors", pub.contributors.length, 2);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
