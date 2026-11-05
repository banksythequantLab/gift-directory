// gift.directory stores: slugs, the AI draft, publishing checks, subscription, host routing.
import { slugify, slugError, parseDraft, darkEnough, validateStore, storePlanSystem, subscriptionBody,
         storeStatusFor, hostKey, publicStore } from "../stores.js";
import { findGifts } from "../finder.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  — " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

eq("slugify", slugify("  Nurse Gifts! "), "nurse-gifts");
eq("accents", slugify("Café Gifts"), "cafe-gifts");
eq("a good slug", slugError("nurses"), null);
ok("too short", slugError("ab"));
ok("reserved", slugError("www"));
ok("no leading dash", slugError("-nurses"));

const d = parseDraft({ name: "Nurse Gifts", slug: "Nurse Gifts", tagline: "For the people who care", occasions: ["Nurses Week", "Graduation", "Retirement", "Night shift"],
  recipient_examples: ["my ER nurse"], search_guidance: "Comfortable, practical luxuries.", accent: "#0b4f6c" }, "nurses");
eq("the draft keeps the AI's name", d.name, "Nurse Gifts");
eq("its slug is cleaned", d.slug, "nurse-gifts");
eq("a dark accent is kept", d.accent, "#0b4f6c");
eq("a light accent is replaced (white text must stay readable)", parseDraft({ accent: "#ffee88" }, "nurses").accent, "#1f3a5f");
eq("a junk draft still gives a store", parseDraft(null, "golfers").name, "Golfers Gifts");
eq("with default occasions", parseDraft(null, "golfers").occasions.length, 6);
ok("navy is dark", darkEnough("#1f3a5f"));
ok("yellow is not", !darkEnough("#ffdd00"));

ok("publishing needs an email", validateStore({ niche: "nurses", draft: d }).error);
eq("a good store validates", validateStore({ niche: "nurses", owner_email: "A@B.com", draft: d }).store.slug, "nurse-gifts");
ok("the owner can't take a reserved address", validateStore({ niche: "nurses", owner_email: "a@b.com", draft: { ...d, slug: "admin" } }).error);

const sys = storePlanSystem({ name: "Nurse Gifts", niche: "nurses", search_guidance: "Comfortable, practical luxuries.", avoid: "scrubs" });
ok("the store's planner knows its niche", sys.includes("nurses") && sys.includes("practical luxuries") && sys.includes("scrubs"));
{
  let seenSys = null;
  await findGifts({ recipient: "my nurse", budget_cents: 10000 }, { planSystem: sys, ai: async s => { seenSys ??= s; return {}; }, search: async () => [] });
  eq("and the finder uses it", seenSys, sys);
}

const sb = subscriptionBody({ id: "st1" }, "P-1", "https://gift.directory");
eq("subscription is for the plan", sb.plan_id, "P-1");
eq("tagged with the store", sb.custom_id, "st1");
eq("returning to our activation", sb.application_context.return_url, "https://gift.directory/api/stores/st1/subscribed");

eq("ACTIVE publishes", storeStatusFor("ACTIVE", "draft"), "active");
eq("a cancelled live store lapses", storeStatusFor("CANCELLED", "active"), "lapsed");
eq("a never-paid store stays a draft", storeStatusFor("CANCELLED", "draft"), "draft");
eq("a lapsed store comes back when payment resumes", storeStatusFor("ACTIVE", "lapsed"), "active");
eq("pending approval changes nothing", storeStatusFor("APPROVAL_PENDING", "draft"), "draft");

eq("apex is the platform", hostKey("gift.directory").platform, true);
eq("www too", hostKey("www.gift.directory").platform, true);
eq("a subdomain is a store", hostKey("nurses.gift.directory").slug, "nurses");
eq("case and port don't matter", hostKey("Nurses.Gift.Directory:443").slug, "nurses");
eq("a deeper name is not a store", hostKey("a.b.gift.directory").platform, true);
eq("another host is looked up as a custom host", hostKey("gifts.nota.lawyer").host, "gifts.nota.lawyer");

const pub = publicStore({ slug: "nurses", name: "Nurse Gifts", tagline: "t", niche: "nurses", status: "active", owner_email: "x@y.com", manage_hash: "h",
  config_json: JSON.stringify({ ...d, search_guidance: "secret sauce" }) });
eq("the public store hides the owner's email", JSON.stringify(pub).includes("x@y.com"), false);
eq("and the search guidance", JSON.stringify(pub).includes("secret sauce"), false);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
