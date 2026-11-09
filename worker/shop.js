// gift.directory's own shop: Printful print-on-demand products sold directly (no Etsy fees), paid with PayPal,
// made and shipped by Printful. Pure functions; the Printful/PayPal calls and storage are in worker.js.
// While SHOP_PUBLIC is unset the shop is only reachable at /shop (noindex, unlinked), and Printful orders are
// created as drafts (nothing prints until someone confirms them in the Printful dashboard).

const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
export const usd = c => (Math.round(c) / 100).toFixed(2);
const cents = v => Math.round(Number(v) * 100);

// "Outlast the Hurricane Shirt, Hurricane Season Tee, Front and Back Print, ..." -> "Outlast the Hurricane Shirt"
export const shortTitle = name => clip(String(name || "").split(",")[0], 80);
export const kindOf = name => /custom text/i.test(name) ? "text" : /photo/i.test(name) ? "photo" : "fixed";

// One card per Printful sync product (from GET /store/products/{id}). Photo shirts wait for uploads, so they're skipped.
export function shopCard(d) {
  const p = d.sync_product, vs = (d.sync_variants || []).filter(v => !v.is_ignored && v.availability_status !== "discontinued");
  const kind = kindOf(p.name);
  if (kind === "photo" || !vs.length) return null;
  const prev = vs.map(v => (v.files || []).find(f => f.type === "preview")).find(Boolean);
  const name = String(p.name || ""), rest = clip(name.slice(name.indexOf(",") + 1), 140);
  return {
    id: p.id, kind, title: shortTitle(name), subtitle: name.includes(",") ? rest : "",
    image: (prev && (prev.preview_url || prev.thumbnail_url)) || p.thumbnail_url || null,
    price_cents: Math.min(...vs.map(v => cents(v.retail_price))),
    variants: vs.map(v => ({ id: v.id, catalog_id: v.variant_id, color: v.color || "", size: v.size || "", price_cents: cents(v.retail_price) })),
  };
}

export const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
// Characters the bundled print font has (Latin-1 + curly quotes, dashes, ellipsis).
const PRINTABLE = /^[\x20-\x7E -ÿ‘-”…–—]*$/;
export const MAX_LINE = 22;

export function validateRecipient(r) {
  if (!r || typeof r !== "object") return { error: "Add a shipping address." };
  const o = { name: clip(r.name, 60), address1: clip(r.address1, 100), address2: clip(r.address2, 100) || null, city: clip(r.city, 60),
    state_code: clip(r.state_code, 2).toUpperCase(), zip: clip(r.zip, 10), country_code: "US", email: clip(r.email, 200).toLowerCase() };
  if (!o.name) return { error: "Add the name to ship to." };
  if (!o.address1 || !o.city) return { error: "Add the street address and city." };
  if (!STATES.includes(o.state_code)) return { error: "Pick a US state (we ship within the US for now)." };
  if (!/^\d{5}(-\d{4})?$/.test(o.zip)) return { error: "The ZIP code should look like 10001." };
  if (!EMAIL.test(o.email)) return { error: "Add an email for the receipt." };
  return { recipient: o };
}

// The buyer's two lines for a custom-text shirt.
export function validateLines(lines) {
  const ls = (Array.isArray(lines) ? lines : []).slice(0, 2).map(l => String(l ?? "").replace(/\s+/g, " ").trim());
  if (!ls[0]) return { error: "Type at least the first line for your shirt." };
  if (ls.some(l => l.length > MAX_LINE)) return { error: `Keep each line to ${MAX_LINE} characters.` };
  if (ls.some(l => !PRINTABLE.test(l))) return { error: "Use letters, numbers and common punctuation (no emoji)." };
  return { lines: ls.filter(Boolean) };
}

// Everything a checkout needs, checked against the live product.
export function validateShopOrder(b, card) {
  if (!card) return { error: "That product isn't available." };
  const v = card.variants.find(x => x.id === Number(b && b.variant_id));
  if (!v) return { error: "Pick a size." };
  const qty = Math.round(Number((b && b.qty) || 1));
  if (!(qty >= 1 && qty <= 10)) return { error: "Quantity should be 1 to 10." };
  const r = validateRecipient(b && b.recipient); if (r.error) return r;
  let lines = null;
  if (card.kind === "text") { const l = validateLines(b.lines); if (l.error) return l; lines = l.lines; }
  return { order: { card, variant: v, qty, lines, gift_message: clip(b && b.gift_message, 200) || null, recipient: r.recipient } };
}

// Printful's shipping answer: the STANDARD rate if there is one, else the cheapest.
export function pickRate(rates) {
  const rs = (Array.isArray(rates) ? rates : []).filter(r => r && Number(r.rate) >= 0);
  if (!rs.length) return null;
  const r = rs.find(x => x.id === "STANDARD") || rs.reduce((a, b) => (Number(b.rate) < Number(a.rate) ? b : a));
  return { id: r.id, name: clip(r.name, 120), cents: cents(r.rate), min_days: r.minDeliveryDays ?? null, max_days: r.maxDeliveryDays ?? null };
}

const xml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
// The custom-text print file: white, heavy, centered, high on the chest. 12x16 in at 150 dpi, transparent.
export const PRINT_W = 1800, PRINT_H = 2400;
export function textPrintSvg(lines) {
  const ls = lines.filter(Boolean).slice(0, 2), longest = Math.max(...ls.map(l => l.length), 4);
  const fs = Math.max(120, Math.min(300, Math.floor(1650 / (longest * 0.7)))), gap = Math.round(fs * 1.12), top = 260 + fs;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PRINT_W}" height="${PRINT_H}" viewBox="0 0 ${PRINT_W} ${PRINT_H}">` +
    ls.map((l, i) => `<text x="${PRINT_W / 2}" y="${top + i * gap}" text-anchor="middle" font-family="Inter Display" font-weight="900" font-size="${fs}" fill="#ffffff">${xml(l)}</text>`).join("") + `</svg>`;
}

export function shopPayPalOrder(o, origin) {
  const unit = o.variant.price_cents, sub = unit * o.qty, total = sub + o.shipping_cents, r = o.recipient;
  const label = [o.variant.color, o.variant.size].filter(Boolean).join(" / ");
  return {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: o.id, custom_id: o.id, description: clip(`gift.directory: ${o.card.title}`, 127),
      amount: { currency_code: "USD", value: usd(total), breakdown: { item_total: { currency_code: "USD", value: usd(sub) }, shipping: { currency_code: "USD", value: usd(o.shipping_cents) } } },
      items: [{ name: clip(`${o.card.title}${label ? " (" + label + ")" : ""}`, 127), quantity: String(o.qty), unit_amount: { currency_code: "USD", value: usd(unit) }, category: "PHYSICAL_GOODS", sku: `pf-${o.variant.id}` }],
      shipping: { name: { full_name: r.name }, address: { address_line_1: r.address1, ...(r.address2 ? { address_line_2: r.address2 } : {}), admin_area_2: r.city, admin_area_1: r.state_code, postal_code: r.zip, country_code: "US" } },
    }],
    payment_source: { paypal: { experience_context: {
      brand_name: "gift.directory", shipping_preference: "SET_PROVIDED_ADDRESS", user_action: "PAY_NOW", landing_page: "LOGIN",
      return_url: `${origin}/api/shop/return`, cancel_url: `${origin}/api/shop/cancel`,
    } } },
  };
}

// The Printful order once PayPal has captured. Custom text is ordered from the catalog with our print file;
// fixed designs by their synced variant. `confirm` stays false unless the shop is live and fulfilment is on.
export function printfulOrder(row, printUrl) {
  const r = JSON.parse(row.recipient_json);
  const item = row.kind === "text"
    ? { variant_id: row.pf_catalog_variant_id, quantity: row.qty, retail_price: usd(row.unit_cents), name: row.title, files: [{ type: "front", url: printUrl }] }
    : { sync_variant_id: row.pf_sync_variant_id, quantity: row.qty, retail_price: usd(row.unit_cents) };
  return {
    external_id: row.id, shipping: "STANDARD",
    recipient: { name: r.name, address1: r.address1, ...(r.address2 ? { address2: r.address2 } : {}), city: r.city, state_code: r.state_code, country_code: "US", zip: r.zip, email: r.email },
    items: [item],
    retail_costs: { currency: "USD", subtotal: usd(row.subtotal_cents), shipping: usd(row.shipping_cents), tax: "0.00" },
    ...(row.gift_message ? { gift: { subject: "A gift for you", message: row.gift_message } } : {}),
    packing_slip: { store_name: "gift.directory", email: "hello@gift.directory", message: "Thank you for shopping gift.directory." },
  };
}

const escH = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function receiptEmail(row) {
  const r = JSON.parse(row.recipient_json), lines = row.lines_json ? JSON.parse(row.lines_json) : null;
  const what = `${row.title}${row.variant_label ? " (" + row.variant_label + ")" : ""} × ${row.qty}`;
  const subject = `Your gift.directory order: ${row.title}`;
  const text = `Thanks for your order!\n\n${what}${lines ? `\nYour text: ${lines.join(" / ")}` : ""}\n\nItems: $${usd(row.subtotal_cents)}\nShipping: $${usd(row.shipping_cents)}\nTotal paid: $${usd(row.total_cents)}\n\n` +
    `Shipping to: ${r.name}, ${r.address1}${r.address2 ? ", " + r.address2 : ""}, ${r.city}, ${r.state_code} ${r.zip}\n\nIt's printed to order by our partner Printful and shipped to that address. Order number: ${row.id}\nQuestions? Reply to hello@gift.directory.\n\n— gift.directory`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;color:#1d2433;line-height:1.5">
<p style="font-size:1.05rem"><b>Thanks for your order!</b></p><p>${escH(what)}${lines ? `<br>Your text: <b>${escH(lines.join(" / "))}</b>` : ""}</p>
<p>Items: $${usd(row.subtotal_cents)}<br>Shipping: $${usd(row.shipping_cents)}<br><b>Total paid: $${usd(row.total_cents)}</b></p>
<p>Shipping to: ${escH(r.name)}, ${escH(r.address1)}${r.address2 ? ", " + escH(r.address2) : ""}, ${escH(r.city)}, ${escH(r.state_code)} ${escH(r.zip)}</p>
<p style="color:#6b7280">It's printed to order by our partner Printful and shipped to that address. Order number: ${escH(row.id)}. Questions? Write to hello@gift.directory.</p>
<p style="color:#6b7280;font-size:.85rem">— gift.directory</p></div>`;
  return { subject, text, html };
}
