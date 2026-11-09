// Small drawings of the rules, in the house map's
// look: rooms as boxes, doors as short bars, a guest a dot, a culprit a dot
// with a dagger, a body a figure lying in red, the way a guest goes an
// arrow, and a red cross on what the rule forbids. PICTURE[id](scale)
// returns an <svg> drawn `scale` times its units (1.5 by default); a room's
// own rule is drawn by its kind, OWN_PICTURE(rule). Used by rules-play.js
// under the first caption of a chain and in the Rules card.

import {svg, slotSign} from "../shared.js";

const C = {room: "rgba(28, 22, 18, 0.95)", wall: "#5b4a33", door: "#7a6340", bone: "#efe6d6", dim: "#9b8f7e",
  red: "#e2493b", blood: "#c4271d", gold: "#cfa75e", dark: "#020101"};

let made = 0;
function sheet(w, h, scale = 1.5) {
  const s = svg("svg", {viewBox: `0 0 ${w} ${h}`, class: "picture", width: w * scale, height: h * scale});
  // Marker ids are per drawing, so a drawing removed from the page takes
  // none of another's arrowheads with it.
  const id = `p${made++}`;
  const defs = svg("defs", {});
  for (const color of ["gold", "dim"]) {
    const m = svg("marker", {id: `${id}-${color}`, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: "auto-start-reverse"});
    m.append(svg("path", {d: "M0 0 L10 5 L0 10 z", fill: C[color]}));
    defs.append(m);
  }
  s.append(defs);
  s.dataset.id = id;
  return s;
}
const room = (s, x, y, w, h, extra = {}) => s.append(svg("rect", {x, y, width: w, height: h, rx: 2, fill: C.room, stroke: C.wall, "stroke-width": 1.5, ...extra}));
const door = (s, x1, y1, x2, y2) => s.append(svg("line", {x1, y1, x2, y2, stroke: C.door, "stroke-width": 4}));
const dot = (s, x, y, fill = C.bone, extra = {}) => s.append(svg("circle", {cx: x, cy: y, r: 4.5, fill, ...extra}));
const ghost = (s, x, y) => dot(s, x, y, "none", {stroke: C.dim, "stroke-width": 1.2, "stroke-dasharray": "2 2"});
const go = (s, d, dashed = false, color = "gold") => s.append(svg("path", {d, fill: "none", stroke: C[color], "stroke-width": 1.6,
  "marker-end": `url(#${s.dataset.id}-${color})`, ...(dashed ? {"stroke-dasharray": "4 3"} : {})}));
function cross(s, x, y, r = 5) {
  s.append(svg("path", {d: `M${x - r} ${y - r} L${x + r} ${y + r} M${x + r} ${y - r} L${x - r} ${y + r}`, stroke: C.red, "stroke-width": 2.2, "stroke-linecap": "round"}));
}
function word(s, x, y, text) {
  const t = svg("text", {x, y, "text-anchor": "middle", "dominant-baseline": "middle", fill: C.dim, "font-family": "Playfair Display, serif", "font-style": "italic", "font-size": 13});
  t.textContent = text;
  s.append(t);
}
// A culprit: a guest with a small dagger raised beside them.
function culprit(s, x, y) {
  dot(s, x, y);
  const d = x + 8, t = y - 4;
  s.append(svg("path", {d: `M${d} ${t - 9} L${d + 1.7} ${t - 2} L${d - 1.7} ${t - 2} Z`, fill: C.bone}));
  s.append(svg("line", {x1: d - 3.2, y1: t - 2, x2: d + 3.2, y2: t - 2, stroke: C.gold, "stroke-width": 1.4}));
  s.append(svg("line", {x1: d, y1: t - 2, x2: d, y2: t + 1.8, stroke: C.gold, "stroke-width": 1.8}));
}
// A body, lying: a head and a body in red, centred on (x, y).
function body(s, x, y, extra = {}) {
  s.append(svg("circle", {cx: x - 8, cy: y, r: 3.3, fill: C.blood, ...extra}));
  s.append(svg("rect", {x: x - 4, y: y - 2.7, width: 15, height: 5.4, rx: 2.7, fill: C.blood, ...extra}));
}
function eye(s, x, y, color = C.gold) {
  s.append(svg("path", {d: `M${x - 12} ${y} Q${x} ${y - 9} ${x + 12} ${y} Q${x} ${y + 9} ${x - 12} ${y} Z`, fill: "none", stroke: color, "stroke-width": 1.4}));
  s.append(svg("circle", {cx: x, cy: y, r: 2.6, fill: color}));
}
function sign(s, slot, x, y, r = 6, color = C.gold) {
  const g = svg("g", {color});
  g.append(slotSign(slot, x, y, r));
  s.append(g);
}
// A visit: out along the top and back along the foot, from (x1) to (x2).
function visit(s, x1, x2, y, dashed = false, color = "gold") {
  const k = x2 > x1 ? 1 : -1, mid = (x1 + x2) / 2;
  go(s, `M${x1 + 6 * k} ${y - 4} C${mid} ${y - 16}, ${mid} ${y - 16}, ${x2} ${y - 5}`, dashed, color);
  go(s, `M${x2} ${y + 5} C${mid} ${y + 16}, ${mid} ${y + 16}, ${x1 + 7 * k} ${y + 5}`, dashed, color);
}
// A speech bubble whose tail points down-left at a guest below it.
function bubble(s, x, y, w, h) {
  s.append(svg("path", {d: `M${x + 4} ${y} H${x + w - 4} Q${x + w} ${y} ${x + w} ${y + 4} V${y + h - 4} Q${x + w} ${y + h} ${x + w - 4} ${y + h}
    H${x + 16} L${x + 4} ${y + h + 9} L${x + 9} ${y + h} H${x + 4} Q${x} ${y + h} ${x} ${y + h - 4} V${y + 4} Q${x} ${y} ${x + 4} ${y} Z`,
    fill: C.room, stroke: C.wall, "stroke-width": 1.4}));
}
function said(s, x, y, slots, gap = -1) {
  slots.forEach((slot, k) => {
    const yy = y + k * 13;
    sign(s, slot, x, yy, 4.5, C.dim);
    if (k === gap) s.append(svg("rect", {x: x + 9, y: yy - 3, width: 38, height: 6, rx: 1, fill: "none", stroke: C.dim, "stroke-width": 1, "stroke-dasharray": "2 2"}));
    else s.append(svg("line", {x1: x + 9, y1: yy, x2: x + 47, y2: yy, stroke: C.bone, "stroke-width": 2.4, "stroke-linecap": "round"}));
  });
}

export const PICTURE = {
  // A culprit kills, at least once: one culprit or two, each beside a body.
  culprits(k) {
    const s = sheet(214, 56, k);
    room(s, 6, 8, 74, 42);
    culprit(s, 26, 30); body(s, 58, 34);
    word(s, 98, 30, "or");
    room(s, 116, 8, 92, 42);
    culprit(s, 132, 24); body(s, 160, 25);
    culprit(s, 160, 42); body(s, 192, 41);
    return s;
  },
  // An innocent's account has every part; one with a part missing is no
  // innocent's.
  complete(k) {
    const s = sheet(196, 72, k);
    bubble(s, 14, 4, 64, 46); said(s, 24, 14, [0, 1, 2]); dot(s, 14, 64);
    bubble(s, 116, 4, 64, 46); said(s, 126, 14, [0, 1, 2], 1); dot(s, 116, 64);
    cross(s, 175, 54);
    return s;
  },
  // The killer was in the room with the victim; one passing through is not.
  murder(k) {
    const s = sheet(232, 64, k);
    room(s, 6, 8, 64, 50); room(s, 84, 8, 64, 50); room(s, 162, 8, 64, 50);
    door(s, 70, 33, 84, 33); door(s, 148, 33, 162, 33);
    culprit(s, 98, 44); body(s, 128, 44);
    culprit(s, 24, 26); go(s, "M44 22 L192 22", true); cross(s, 116, 22);
    return s;
  },
  // No witness but a culprit: an innocent in the room of a murder is not.
  alone(k) {
    const s = sheet(160, 56, k);
    room(s, 6, 6, 148, 44);
    culprit(s, 30, 30); body(s, 70, 32);
    dot(s, 122, 28); cross(s, 122, 28, 7);
    return s;
  },
  // One trip a day: a trip at dusk, and none after it at midnight.
  trip(k) {
    const s = sheet(232, 64, k);
    [6, 86, 166].forEach(x => room(s, x, 22, 60, 36));
    door(s, 66, 40, 86, 40); door(s, 146, 40, 166, 40);
    ghost(s, 36, 40); go(s, "M43 40 L108 40"); dot(s, 116, 40);
    go(s, "M123 40 L190 40", true); cross(s, 156, 40);
    sign(s, 1, 76, 10); sign(s, 2, 156, 10);
    return s;
  },
  // Through the doors, room by room; never across a wall.
  road(k) {
    const s = sheet(200, 64, k);
    [6, 80, 154].forEach(x => room(s, x, 24, 40, 32));
    door(s, 46, 40, 80, 40); door(s, 120, 40, 154, 40);
    dot(s, 26, 40); go(s, "M33 40 L164 40");
    go(s, "M24 24 C60 -4, 136 -4, 172 22", true, "dim"); cross(s, 100, 6);
    return s;
  },
  // While one is away from a room, no other goes out from it and back.
  time(k) {
    const s = sheet(232, 72, k);
    [6, 86, 166].forEach(x => room(s, x, 18, 60, 46));
    door(s, 66, 41, 86, 41); door(s, 146, 41, 166, 41);
    sign(s, 1, 116, 8);
    dot(s, 128, 41); visit(s, 128, 192, 41);
    dot(s, 104, 41); visit(s, 104, 38, 41, true, "dim"); cross(s, 70, 41);
    return s;
  },
  // Two in one room in one slot see each other.
  seen(k) {
    const s = sheet(130, 60, k);
    room(s, 8, 8, 114, 44);
    dot(s, 36, 34); dot(s, 94, 34);
    s.append(svg("line", {x1: 44, y1: 34, x2: 86, y2: 34, stroke: C.gold, "stroke-width": 1.2, "stroke-dasharray": "2 3"}));
    eye(s, 65, 20);
    return s;
  },
  // A guest ends one day in one room and may begin the next in another.
  anyroom(k) {
    const s = sheet(230, 60, k);
    for (const x0 of [6, 136]) [0, 30, 60].forEach(j => room(s, x0 + j, 22, 26, 26));
    dot(s, 19, 35); dot(s, 209, 35);
    sign(s, 2, 49, 10, 6, C.dim); sign(s, 0, 179, 10, 7);
    go(s, "M30 35 C80 60, 150 60, 200 37", true);
    return s;
  },
  // A murder victim lies where they were murdered; none is moved before it is found.
  lies(k) {
    const s = sheet(176, 56, k);
    room(s, 6, 8, 70, 42); room(s, 100, 8, 70, 42);
    door(s, 76, 29, 100, 29);
    culprit(s, 24, 30); body(s, 56, 34);
    go(s, "M62 20 C80 6, 110 6, 126 20", true, "dim"); body(s, 140, 34, {opacity: 0.45}); cross(s, 140, 32, 7);
    return s;
  },
};

// A room's own rule, by its kind: the Chapel (the dead carried in, no one
// else entering), a dark room (no one seen), a tunnel (a culprit's way) and
// a bell (rung by whoever enters).
const OWN = {
  chapel(k) {
    const s = sheet(214, 64, k);
    room(s, 6, 14, 70, 44); room(s, 138, 14, 70, 44);
    s.append(svg("path", {d: "M173 2 V12 M168 6 H178", stroke: C.dim, "stroke-width": 1.6}));
    body(s, 46, 28, {opacity: 0.45}); go(s, "M60 26 L156 26", true); body(s, 176, 28);
    dot(s, 38, 46); go(s, "M45 46 L132 46", true, "dim"); cross(s, 118, 46);
    return s;
  },
  dark(k) {
    const s = sheet(140, 60, k);
    room(s, 8, 8, 124, 44, {fill: C.dark, stroke: C.dim});
    dot(s, 36, 36, C.dim); dot(s, 104, 36, C.dim);
    eye(s, 70, 22, C.dim); cross(s, 70, 22, 7);
    return s;
  },
  tunnel(k) {
    const s = sheet(214, 84, k);
    room(s, 6, 6, 64, 40); room(s, 144, 6, 64, 40);
    s.append(svg("path", {d: "M40 46 C40 82, 174 82, 174 46", fill: "none", stroke: C.wall, "stroke-width": 11}));
    s.append(svg("path", {d: "M40 46 C40 82, 174 82, 174 46", fill: "none", stroke: C.room, "stroke-width": 7}));
    culprit(s, 26, 28); go(s, "M40 50 C42 76, 172 76, 174 52");
    dot(s, 188, 26); go(s, "M184 34 C180 50, 176 56, 172 60", true, "dim"); cross(s, 186, 54);
    return s;
  },
  bell(k) {
    const s = sheet(190, 72, k);
    room(s, 6, 28, 70, 38); room(s, 106, 28, 76, 38);
    door(s, 76, 47, 106, 47);
    s.append(svg("path", {d: "M136 20 C136 8, 152 8, 152 20 L155 23 H133 Z", fill: C.gold}));
    s.append(svg("circle", {cx: 144, cy: 25, r: 2, fill: C.gold}));
    for (const r of [7, 12]) s.append(svg("path", {d: `M${160 + r * 0.2} ${14 - r * 0.6} A${r} ${r} 0 0 1 ${160 + r * 0.2} ${14 + r * 0.6}`, fill: "none", stroke: C.gold, "stroke-width": 1.2}));
    ghost(s, 36, 47); go(s, "M43 47 L134 47"); dot(s, 142, 47);
    return s;
  },
};
export const ownKind = rule => /Chapel|carried/.test(rule) ? "chapel" : /see each other/.test(rule) ? "dark" : /tunnel/.test(rule) ? "tunnel" : /rings/.test(rule) ? "bell" : null;
export const OWN_PICTURE = (rule, k) => OWN[ownKind(rule)]?.(k) || null;
