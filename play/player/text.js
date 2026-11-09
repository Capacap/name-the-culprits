// What a line of the story carries beyond its words: the
// sign of each slot it names, and whether a charge is about it.

import {el, svg, slotSign, SLOT_NAMES} from "../shared.js";

// The lines a charge is about: in the accuser's account that follows it,
// those telling any slot at issue (the story's `disputed`); in each
// accused's account of that day, those telling a slot at issue with them,
// marked .accused. A line carries the slots it tells as data-slots.
export function disputed(beats, charge, entry) {
  const tells = (line, slots) => {
    const [a, b] = (line.dataset.slots || "").split(",").map(Number);
    return line.dataset.slots && slots.some(t => t >= a && t <= b);
  };
  const mark = (part, slots, cls) => part.querySelectorAll(".line").forEach(l => { if (tells(l, slots)) l.classList.add(...cls); });
  const {against, disputed: at = []} = charge.turn;
  mark(entry, at.flat(), ["disputed"]);
  against.forEach((who, k) => {
    const said = beats.filter(b => b.day === charge.day && b.turn.speaker === who && b.turn.kind === "account").at(-1);
    for (const part of said?.parts || []) mark(part, at[k] || [], ["disputed", "accused"]);
  });
}

// Every line that names a slot gets its sign before it unless `signs` is
// false, and the slot's word wrapped (span.slotword), which is set bold.
const SLOT_WORD = new RegExp(`\\b(${SLOT_NAMES.join("|")})\\b`, "gi");
export function slotted(entry, signs = true) {
  for (const line of entry.querySelectorAll(".line")) {
    const found = [];
    const walk = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walk.nextNode()) texts.push(walk.currentNode);
    for (const t of texts) {
      const parts = t.data.split(SLOT_WORD);
      if (parts.length === 1) continue;
      const frag = document.createDocumentFragment();
      parts.forEach((x, k) => {
        if (k % 2) { found.push(SLOT_NAMES.indexOf(x.toLowerCase())); frag.append(el("span", {class: "slotword"}, x)); }
        else if (x) frag.append(x);
      });
      t.replaceWith(frag);
    }
    if (!signs || !found.length) continue;
    const box = el("span", {class: "slotsign"});
    for (const slot of [...new Set(found)]) {
      const g = svg("svg", {viewBox: "-10 -10 20 20", width: 15, height: 15});
      g.append(slotSign(slot, 0, 0, 8));
      box.append(g);
    }
    line.prepend(box);
  }
}

// The first match of `re` in the text of `node`, across its children
// (a line's names are spans of their own), wrapped in `wrap`; null if none.
export function wrapMatch(node, re, wrap) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), parts = [];
  let full = "";
  while (walker.nextNode()) { parts.push([walker.currentNode, full.length]); full += walker.currentNode.data; }
  const m = re.exec(full);
  if (!m) return null;
  const at = k => { const [n, o] = parts.findLast(([, o]) => o <= k); return [n, k - o]; };
  const range = document.createRange();
  range.setStart(...at(m.index));
  range.setEnd(...at(m.index + m[0].length - 1).map((v, j) => j ? v + 1 : v));
  wrap.append(range.extractContents());
  range.insertNode(wrap);
  return wrap;
}
export const escape = t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
