// Link previews: the Open Graph tags shared group gifts, registries and stores carry.
import { ogTags, poolMeta, registryMeta, storeMeta, OG_FALLBACK, money } from "../meta.js";

let passed = 0, failed = 0;
const ok = (n, c, d = "") => { c ? passed++ : (failed++, console.log(`FAIL  ${n}${d ? "  - " + d : ""}`)); };
const eq = (n, a, b) => ok(n, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);
const has = (n, s, sub) => ok(n, String(s).includes(sub), `missing ${JSON.stringify(sub)} in ${String(s).slice(0, 300)}`);

const t = ogTags({ title: `Maria's "big" day <3`, description: "Help & chip in", image: "https://cdn.example.com/a.jpg", url: "https://gift.directory/g/x" });
has("title is escaped", t, `content="Maria&#39;s &quot;big&quot; day &lt;3"`);
has("description is escaped", t, `og:description" content="Help &amp; chip in"`);
has("product photo is the image", t, `og:image" content="https://cdn.example.com/a.jpg"`);
has("product photo uses the small card", t, `twitter:card" content="summary"`);
has("url is set", t, `og:url" content="https://gift.directory/g/x"`);
ok("no script can get in", !/<script/i.test(ogTags({ title: "</title><script>x</script>", description: "", image: "" })));
const f = ogTags({ title: "x", description: "y", image: "javascript:alert(1)" });
has("non-http image falls back", f, `og:image" content="${OG_FALLBACK}"`);
has("fallback uses the large card", f, `summary_large_image`);
ok("long titles are clipped", /og:title" content="[^"]{1,90}"/.test(ogTags({ title: "a".repeat(300), description: "" })));

eq("money", money(19300), "$193");
eq("money with cents", money(2990), "$29.90");
const pm = poolMeta({ title: "For Maria - made partner", organizer_name: "Sam", target_cents: 19300, raised_cents: 4000, status: "open" },
  { title: "Brass Balance Scale", image: "https://cdn.example.com/s.jpg" }, "https://gifts.nota.lawyer/g/abc");
eq("pool title", pm.title, "For Maria - made partner — group gift");
has("pool progress", pm.description, "$40 of $193 raised.");
has("pool names the gift and organizer", pm.description, "Chip in on Brass Balance Scale with PayPal, straight to Sam.");
eq("pool image is the product", pm.image, "https://cdn.example.com/s.jpg");
has("funded pool says so", poolMeta({ title: "x", target_cents: 100, raised_cents: 100, status: "funded" }, {}, "u").description, "Fully funded: $1 raised.");
has("pool without a product still reads", poolMeta({ title: "x", target_cents: 5000, raised_cents: 0 }, {}, "u").description, "Chip in on a gift with PayPal, straight to the organizer.");

const rm = registryMeta({ title: "Maria & Sam's wedding", occasion: "Wedding", owner_name: "Maria", paypal_email: "m@example.com" },
  [{ title: "Mixer" }, { title: "Dutch oven", image: "https://cdn.example.com/d.jpg" }], "https://gift.directory/r/maria");
has("registry counts gifts", rm.description, "Maria's wedding registry on gift.directory: 2 gifts from any store.");
has("registry mentions group gifts when it has PayPal", rm.description, "go in together with PayPal");
eq("registry image is the first gift with a photo", rm.image, "https://cdn.example.com/d.jpg");
ok("registry without PayPal skips group gifts", !registryMeta({ title: "x", owner_name: "A" }, [{}], "u").description.includes("PayPal"));
has("one gift is singular", registryMeta({ title: "x", owner_name: "A" }, [{}], "u").description, "1 gift from");

const sm = storeMeta({ name: "Lawyer Gifts", tagline: "Real gifts for lawyers." }, "https://gifts.nota.lawyer/", "https://cdn.example.com/p.jpg");
eq("store title", sm.title, "Lawyer Gifts");
has("store tagline", sm.description, "Real gifts for lawyers. Chip in on a gift together with PayPal.");
has("tagline without a period gets one", storeMeta({ name: "Nurse Gifts", tagline: "Gifts with care" }, "u").description, "Gifts with care. Chip in");
has("store name is the site name", ogTags(sm), `og:site_name" content="Lawyer Gifts"`);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
