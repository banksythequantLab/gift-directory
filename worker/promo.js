// The house banner at the bottom of every store: a custom two-line tee from the HeyAiMe Etsy shop,
// shown with sayings that fit the store. The sayings are ours (original lines), the shirt is the
// Etsy listing; the price is read live from Etsy when the key is set.
export const TEE = { listing_id: 4585376842, url: "https://www.etsy.com/listing/4585376842", price_cents: 2499, shop: "HeyAiMe" };

const SAYINGS = {
  law: [["I OBJECT", "TO MONDAYS"], ["BILLABLE HOURS", "FUELED BY COFFEE"], ["ASK ME", "AFTER THE RETAINER"], ["SUSTAINED", "BY CAFFEINE"]],
  nurse: [["NIGHT SHIFT", "SURVIVOR"], ["RUNS ON COFFEE", "AND CHARTING"], ["NURSE MODE", "ALWAYS ON"], ["12 HOURS DOWN", "COFFEE UP"]],
  fire: [["I RUN IN", "WHEN YOU RUN OUT"], ["STATION LIFE", "BEST LIFE"], ["SMOKE EATER", "COFFEE DRINKER"], ["ON SHIFT", "ON FIRE"]],
  friend: [["BEST FRIENDS", "SINCE FOREVER"], ["MY FRIEND", "IS BETTER THAN YOURS"], ["SAME BRAIN", "DIFFERENT SHIRT"], ["FRIENDS LIKE US", "ARE RARE"]],
  teacher: [["TEACHER MODE", "ALWAYS ON"], ["POWERED BY", "COFFEE AND CHALK"], ["ASK ME", "AFTER CLASS"]],
  dad: [["DAD JOKES", "LOADING"], ["WORLD'S OKAYEST", "GRILL MASTER"], ["ASK YOUR MOM", "SHE KNOWS"]],
  any: [["YOUR WORDS", "ON A BLACK TEE"], ["WORLD'S BEST", "WHOEVER YOU ARE"], ["MADE FOR", "ONE PERSON ONLY"], ["SAY IT", "WITH A SHIRT"]],
};
const KEYS = [["law", /law|attorney|legal|paralegal|judge/], ["nurse", /nurs|medic|doctor|health/], ["fire", /fire/],
  ["friend", /friend|bff|bestie/], ["teacher", /teach|school|class/], ["dad", /\bdads?\b|father/]];

export function teeSayings(store) {
  const hay = `${store && store.slug || ""} ${store && store.name || ""} ${store && store.tagline || ""}`.toLowerCase();
  const k = (KEYS.find(([, re]) => re.test(hay)) || ["any"])[0];
  return [...SAYINGS[k], ...(k === "any" ? [] : SAYINGS.any.slice(0, 1))];
}

export function teePromo(store, priceCents) {
  return { kind: "tee", title: "Put your own two lines on a tee", sub: "Custom text, printed on a black shirt by HeyAiMe on Etsy.",
    lines: teeSayings(store), url: TEE.url, price_cents: priceCents > 0 ? priceCents : TEE.price_cents,
    note: "The term 'Etsy' is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc." };
}
