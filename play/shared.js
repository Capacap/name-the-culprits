// The game's helpers: loading a story, the steps the reader reveals one at
// a time, names marked in a line, the way an account walks, keys and slot
// signs. ?story=<id> picks the story.

export const STORY = new URLSearchParams(location.search).get("story");
export const ART = "../art/drawn";
export const NARRATOR = "Veronique";

export const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
};
export const svg = (tag, attrs = {}) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

// The story, its names by id, and the steps: a day's title, then each turn.
export async function load() {
  const story = await (await fetch(`../stories/${STORY}.json`)).json();
  const names = {narrator: NARRATOR};
  for (const c of story.cast) names[c.id] = c.name;
  for (const r of story.house.rooms) names[r.id] = r.name;
  const steps = story.days.flatMap((d, day) =>
    [{title: d.title, day}, ...d.turns.map(turn => ({turn, day}))]);
  return {story, names, steps};
}

// A line's text with each guest's and room's name in a span of class
// guest-name or room-name, carrying the id; the format does not mark names,
// so they are found as whole words.
export function mark(text, story) {
  const words = [...story.house.rooms.map(r => [r.name, "room-name", r.id]),
                 ...story.cast.map(c => [c.name, "guest-name", c.id])]
    .sort((a, b) => b[0].length - a[0].length);
  const by = new Map(words.map(w => [w[0], w]));
  const pattern = new RegExp(`\\b(${words.map(w => w[0]).join("|")})\\b`, "g");
  const out = document.createDocumentFragment();
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const [, cls, id] = by.get(m[0]);
    out.append(text.slice(last, m.index), el("span", {class: cls, "data-id": id}, m[0]));
    last = m.index + m[0].length;
  }
  out.append(text.slice(last));
  return out;
}

// The way an account walks, slot by slot (from the turn's `places`, the rooms
// it names in the order told): for each slot the rooms it names, the rooms
// passed between them unnamed and the doors walked, each door a pair as
// `house.doors` writes it. The house is a tree, so the way between two rooms
// is its one path; an account never claims the tunnel (FORMAT.md). A room
// `within` another has no doors: the way runs to the room it is in, which
// counts as passed where the account does not name it.
export function route(story, turn) {
  const next = {};
  for (const [a, b] of story.house.doors) { (next[a] ||= []).push(b); (next[b] ||= []).push(a); }
  const home = id => story.house.rooms.find(r => r.id === id)?.within || id;
  const pair = (a, b) => story.house.doors.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const path = (a, b) => {
    const from = {[a]: null}, queue = [a];
    for (const r of queue) for (const n of next[r] || []) if (!(n in from)) { from[n] = r; queue.push(n); }
    const way = [b];
    while (from[way[0]] != null) way.unshift(from[way[0]]);
    return way[0] === a ? way : [a, b];
  };
  return (turn?.places || []).map(named => {
    const passed = new Set(), doors = [];
    named.forEach((r, k) => {
      if (k === 0) return;
      const way = path(home(named[k - 1]), home(r));
      for (const x of [named[k - 1], r]) if (home(x) !== x) passed.add(home(x));
      way.slice(1, -1).forEach(x => passed.add(x));
      way.forEach((x, j) => {
        const d = j && pair(way[j - 1], x);
        if (d && !doors.includes(d)) doors.push(d);
      });
    });
    for (const r of named) passed.delete(r);
    return {named, passed: [...passed], doors};
  });
}


// Space, Enter or the right arrow; a view passes what each key does. Keys
// typed into a field are left to it.
export function keys(map) {
  addEventListener("keydown", e => {
    if (e.target.closest?.("textarea, input, select")) return;
    const f = map[e.key] || map[e.key.toLowerCase()] || map[e.key.toUpperCase()];
    if (f && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); f(e); }
  });
}
export const ADVANCE = [" ", "Enter", "ArrowRight"];

// A slot's sign drawn in SVG, centred on (x, y) with radius r: one circle's
// outline, full at noon, half filled at dusk and empty at midnight (the
// user, 6 November 2026: a sun and a crescent "tend to become noise"), all
// in currentColor, so `color` sets it.
export const SLOT_NAMES = ["noon", "dusk", "midnight"];
export function slotSign(slot, x, y, r, cls = "sign") {
  const R = r * 0.8;
  const g = svg("g", {class: `${cls} ${SLOT_NAMES[slot]}`, fill: "currentColor", stroke: "currentColor", "stroke-width": r * 0.18});
  g.append(svg("circle", {cx: x, cy: y, r: R, fill: slot === 0 ? "currentColor" : "none"}));
  if (slot === 1) g.append(svg("path", {d: `M${x} ${y - R} A${R} ${R} 0 0 0 ${x} ${y + R} Z`, stroke: "none"}));
  return g;
}
// The three signs as a small inline legend.
export function slotLegend(color) {
  const box = el("span", {class: "legend"});
  SLOT_NAMES.forEach((name, i) => {
    const s = svg("svg", {viewBox: "-10 -10 20 20", width: 16, height: 16, style: `vertical-align: -2px; color: ${color}`});
    s.append(slotSign(i, 0, 0, 8));
    box.append(s, ` ${name}  `);
  });
  return box;
}
