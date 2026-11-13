// Written advice that sits above a guide's picks, under the author's byline. Plain data, rendered escaped.
// Blocks: ["p", text] or ["ul" | "ol", [[lead, text], ...]] (lead is shown in bold; "" for none).
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const EXPERT_AUTHOR = "Derek Soltis, New York attorney";
export const EXPERT_UPDATED = "2026-11-13";
export const EXPERT = {
  "judge-retirement-gifts": { title: "Before you buy: who are you to the judge?", blocks: [
    ["p", "Before you pick a gift for a judge, work out who you are to that judge. Judges live under gift rules most people never see, and those rules turn on the giver more than on the gift."],
    ["p", "In New York, a judge may not accept a gift from anyone unless an exception applies. Ordinary social hospitality is one of the things the state's judicial ethics committee has allowed, such as dinner with lawyers who appear in the judge's court. The same committee said no to a food platter sent by a lawyer practicing in front of the judge."],
    ["p", "Federal judges and court staff may not accept a gift from anyone seeking official action from, or doing business with, the court. Relatives and friends may give for a special occasion, if the gift is in keeping with the occasion and the relationship. Colleagues inside the judiciary may give on a retirement."],
    ["ul", [
      ["Family and friends.", "Choose what fits the person. The picks below are for you."],
      ["Fellow judges and court staff.", "A group gift from chambers or the courthouse is the usual way."],
      ["Lawyers who appear before the judge.", "Skip the personal gift while the judge is still hearing cases, including a judge who keeps serving after the retirement party. Give through the bar association instead. New York's state bar ethics committee approved lawyers chipping in $50 to $150 each toward a courthouse portrait of a retiring justice, because the portrait is a gift to the court, not to the judge."],
      ["Not sure which you are.", "Call chambers and ask, or send a handwritten letter."],
    ]],
  ] },
  "thank-you-gifts-for-your-lawyer": { title: "Can you give your lawyer a gift?", blocks: [
    ["p", "Yes. A modest thank-you present that you chose on your own is a normal thing to give a lawyer. A few things make it land better."],
    ["ul", [
      ["Wait until the matter is over.", "A gift in the middle of a case can feel like it comes with expectations. After the closing, the verdict or the signed agreement, it reads as thanks."],
      ["Keep it modest.", "Something in the range of a nice dinner, not a watch. A lawyer who has to wonder whether to accept it will not enjoy it."],
      ["Think of the whole office.", "The paralegal and the assistant did a lot of the work on your file. A gift the office can share gets noticed by everyone who helped."],
      ["Ask first if your lawyer works for the government or legal aid.", "Many public and legal aid offices limit what their lawyers may accept. If yours does, send a letter, and send a copy to their supervisor."],
      ["A review or a referral counts too.", "If you were happy, say so in public or send a friend."],
    ]],
  ] },
  "christmas-gifts-for-clients": { title: "Three checks before you buy a client gift", blocks: [
    ["p", "A client gift can do harm if the person receiving it is not allowed to keep it."],
    ["ol", [
      ["Their employer's gift policy.", "Many companies cap what an employee may accept from a vendor or outside firm, and some ban gifts outright. If your contact works in purchasing, compliance or finance, assume a limit exists and ask."],
      ["Government clients.", "Public employees work under strict gift limits, and the rules differ by agency and state. When in doubt, send a card."],
      ["Timing.", "Do not send a gift while a bid, a renewal or a negotiation with that client is open. The same basket that says thank you in January can look like pressure in the middle of a deal."],
    ]],
    ["ul", [
      ["Send it to the team, not one person.", "Something the office can share avoids the policy problem and thanks the people who actually worked with you."],
      ["Go easy on the logo.", "A gift covered in your branding reads as advertising. Put your name on the card."],
      ["Skip alcohol unless you know them.", "Good coffee, food or something for the desk is safe for everyone."],
    ]],
    ["p", "On taxes: the IRS limits the deduction for business gifts to a fixed amount per recipient each year. Ask your accountant how that applies to you before you set a budget."],
  ] },
  "bar-exam-passed-gifts": { title: "What a new lawyer needs right after passing", blocks: [
    ["p", "Passing the bar is not the finish line, and the best gifts know that. Between the results and the first day as a lawyer there is still the character review, the swearing-in and a list of fees."],
    ["ul", [
      ["Something for the swearing-in.", "It is the one day family comes to court on purpose. A good pen, or a frame sized for the admission certificate, gets used that day and kept."],
      ["Something that says \"you are one of us now.\"", "A business card holder, a padfolio, a proper bag. They have been a student for three years and own a backpack."],
      ["Help with the costs.", "Admission and registration fees arrive at the same time as loan payments. Covering one of those bills is not romantic, and it is remembered."],
      ["Rest.", "They studied for months. A dinner out or a weekend away is a fair gift for the person and for whoever lived with them through it."],
    ]],
    ["p", "What to skip: gavels, scales-of-justice bookends and anything that says \"trust me, I'm a lawyer.\" New lawyers tend to get several of each."],
  ] },
  "gifts-for-new-lawyers": { title: "What gets used in the first year", blocks: [
    ["p", "The first year of practice is long days, a lot of reading and more time on your feet than law school suggested. The gifts that get used are the ones that make those days easier."],
    ["ul", [
      ["A bag that holds a laptop and a file.", "It goes to court, to depositions and home every night."],
      ["Good headphones.", "Document review and drafting happen in open offices and on trains."],
      ["A portable charger and a spare cable.", "Outlets are hard to find on a court day."],
      ["Comfortable dress shoes, or the gift card to buy them.", "Nobody warns you about the standing."],
      ["Coffee, done properly.", "A good travel mug or a subscription is a daily thank-you."],
      ["A real notebook and pen.", "Some courtrooms limit laptops and phones, so notes are still taken by hand."],
    ]],
    ["p", "What sits in a drawer: desk gavels, novelty \"lawyer\" mugs and framed quotes about justice. Give something for the work they are actually doing."],
  ] },
};
const item = ([lead, text]) => `<li>${lead ? `<b>${esc(lead)}</b> ` : ""}${esc(text)}</li>`;
export function expertNote(slug) {
  const e = EXPERT[slug]; if (!e) return "";
  return `<section class="guide expert" style="border-left:4px solid var(--accent);padding:2px 0 2px 16px;margin:14px 0 18px">
<h2 style="font-family:Georgia,serif;margin:0 0 4px">${esc(e.title)}</h2>
<p class="muted" style="margin:0 0 10px;font-size:.9rem">By ${esc(EXPERT_AUTHOR)} · Updated ${EXPERT_UPDATED}</p>
${e.blocks.map(([k, v]) => k === "p" ? `<p>${esc(v)}</p>` : `<${k} style="max-width:760px;line-height:1.55;padding-left:20px">${v.map(item).join("")}</${k}>`).join("\n")}
<p class="muted" style="font-size:.82rem">General information, not legal or tax advice. Rules differ by state, court and employer.</p></section>`;
}
