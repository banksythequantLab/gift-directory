// "This season": the guides that match the next few weeks, for the home page and the guides hub.
// Each group has a window in US Eastern dates; a guide link is shown only when `listed` (a Set of built slugs) has it.
import { blackFridayDates } from "./deals.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// First and last full day of Hanukkah (it begins the evening before the first date). Add a year before it runs out.
const HANUKKAH = { 2026: [12, 5, 12, 12], 2027: [12, 25, 1, 1], 2028: [12, 13, 12, 20] };
const ymd = (y, m, d) => y * 10000 + m * 100 + d;

export function seasonGroups(nowMs = Date.now()) {
  const et = new Date(new Date(nowMs).toLocaleString("en-US", { timeZone: "America/New_York" }));
  const y = et.getFullYear(), today = ymd(y, et.getMonth() + 1, et.getDate());
  const bf = blackFridayDates(y), thanksDay = Number(bf.thanksgiving.match(/(\d+)$/)[1]);
  const cm = new Date(Date.UTC(y, 10, thanksDay + 4)), cyberDay = ymd(y, cm.getUTCMonth() + 1, cm.getUTCDate());
  const h = HANUKKAH[y], groups = [];
  if (today >= ymd(y, 11, 1) && today <= ymd(y, 11, thanksDay))
    groups.push({ title: `Thanksgiving (${bf.thanksgiving})`, links: [
      ["/gifts/what-to-bring-to-thanksgiving-not-food", "What to bring when you're told not to bring food"],
      ["/gifts/thanksgiving-hostess-gifts-under-25", "Thanksgiving hostess gifts under $25"],
      ["/gifts/friendsgiving-host-gifts", "Friendsgiving host gifts"]] });
  if (today >= ymd(y, 11, 13) && today <= cyberDay)
    groups.push({ title: `Black Friday (${bf.blackFriday}) and Cyber Monday`, links: [
      ["/black-friday", "Black Friday gift deals, price-checked"],
      ["/gifts/black-friday-gift-ideas", "Black Friday gift ideas"],
      ["/gifts/cyber-monday-gift-ideas", "Cyber Monday gift ideas"]] });
  if (h && today >= ymd(y, 11, 13) && today <= ymd(h[2] === 1 ? y + 1 : y, h[2], h[3]))
    groups.push({ title: "Hanukkah", links: [
      ["/gifts/eight-nights-of-hanukkah-gifts", "Eight nights of Hanukkah gifts"],
      ["/gifts/hanukkah-gifts-for-adults", "Hanukkah gifts for adults"],
      ["/gifts/hanukkah-gifts-for-kids", "Hanukkah gifts for kids"],
      ["/gifts/hanukkah-hostess-gifts", "Hanukkah hostess gifts"]] });
  if (today >= ymd(y, 11, 1) && today <= ymd(y, 12, 24))
    groups.push({ title: "Christmas", links: [
      ["/christmas-shipping-deadlines", "Christmas shipping deadlines: when to order"],
      ...(today >= ymd(y, 12, 12) ? [["/gifts/last-minute-christmas-gifts", "Last-minute Christmas gifts"]] : []),
      ["/gifts/secret-santa-gifts-under-25", "Secret Santa gifts under $25"],
      ["/gifts/white-elephant-gifts-under-30", "White elephant gifts under $30"],
      ["/gifts/stocking-stuffers-for-adults", "Stocking stuffers for adults"],
      ["/gifts/christmas-gifts-under-20", "Christmas gifts under $20"],
      ["/gifts/christmas-gifts-for-dad-who-has-everything", "For the dad who has everything"],
      ["/gifts/christmas-gifts-for-mom-who-wants-nothing", "For the mom who wants nothing"]] });
  return groups;
}

// listed: Set of guide slugs that are built and listed; links to other guides are left out.
export function seasonBox(nowMs = Date.now(), listed = null) {
  const keep = ([href]) => !href.startsWith("/gifts/") || !listed || listed.has(href.slice(7));
  const groups = seasonGroups(nowMs).map(g => ({ ...g, links: g.links.filter(keep) })).filter(g => g.links.length);
  if (!groups.length) return "";
  return `<section class="season" style="margin:18px 0"><h2 class="hh" style="font-family:Georgia,serif">This season</h2>
${groups.map(g => `<p style="margin:10px 0 4px"><b>${esc(g.title)}</b></p><nav class="rel" aria-label="${esc(g.title)}">${g.links.map(([href, t]) => `<a href="${esc(href)}">${esc(t)}</a>`).join("")}</nav>`).join("\n")}</section>`;
}
