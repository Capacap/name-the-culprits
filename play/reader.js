// The reader under the game view: the log a turn at a time, the house on a
// grid lighting an account's rooms, Veronique's poses, the guests dead so
// far, the day in view and the house on demand. The view builds its own
// page and passes its elements and what to do at each turn.

import {grid, MAX_COLS} from "./house.js";
import {load, mark, route, el, svg, keys, ADVANCE, slotSign, slotLegend} from "./shared.js";

export const {story, names, steps} = await load();
export {mark, el, svg};

// A name on the map, a room's or the dead's (`weight` its font weight), in a
// font small enough to fit `room` units of its box: `size` is its size in
// reader.css (.map text.name, .map text.dead and their .map.big sizes),
// and the measure is taken again once that font has loaded, since a
// fallback font is narrower or wider than Libre Caslon Text.
const ruler = document.createElement("canvas").getContext("2d");
function fit(t, line, size, room, weight = "700") {
  const font = `${weight} ${size}px "Libre Caslon Text", serif`;
  const measure = () => {
    ruler.font = font;
    const w = ruler.measureText(line).width;
    t.style.fontSize = w > room ? `${(size * room / w).toFixed(1)}px` : "";
  };
  measure();
  document.fonts.load(font, line).then(measure, () => {});
}

// The house: every map MAX_COLS rooms wide, a narrower house centred, each
// room a box with a short hallway to each room it has a door to (the user's
// pick of 1 November 2026, "L2": rooms 134 wide in a 150
// cell, so a hallway is 16 long). A hallway is drawn centre to centre under
// the rooms, which hide all but the stretch between two walls, and a cut in
// each wall where it meets a room opens the doorway. Drawn `big` (by default
// on a narrow screen, or where a view sets the map in a narrow box) the
// rooms are taller with larger names, a name of two words on two lines, so
// they stay legible at a phone's width. With `trim` the picture is cut to
// the house's own width, so a narrow house is drawn larger. Returns show(turn), which lights the
// way the turn's account walks all day: every room on it with a sign for
// each slot the way takes its speaker there, the rooms passed between two
// named ones included (the user, 11 November 2026), and the doors walked;
// show(null) clears.
export function drawMap(map, legend, big = innerWidth < 700, trim = false) {
  if (legend) legend.replaceChildren(slotLegend("#cfa75e"));
  map.classList.toggle("big", big);
  const {rooms, place, cols, rows} = grid(story);
  const W = 150, H = big ? 96 : 60, dx = (MAX_COLS - cols) * W / 2;
  const bw = 134, bh = big ? 80 : 44, r = big ? 10 : 7;
  map.setAttribute("viewBox", trim ? `${dx - 3} -3 ${cols * W + 6} ${rows * H + 6}` : `-3 -3 ${MAX_COLS * W + 6} ${rows * H + 6}`);
  const centre = id => [dx + place[id][0] * W + W / 2, place[id][1] * H + H / 2];
  const halls = svg("g", {class: "halls"}), cuts = svg("g", {class: "cuts"});
  const door = (a, b) => [a, b].sort().join(" ");
  for (const cls of ["wall", "floor"])
    for (const [a, b] of story.house.doors) {
      if (!(a in place && b in place)) continue;
      const [x1, y1] = centre(a), [x2, y2] = centre(b);
      halls.append(svg("line", {class: cls, x1, y1, x2, y2, "data-door": door(a, b)}));
    }
  for (const [a, b] of story.house.doors) {
    if (!(a in place && b in place)) continue;
    const [x1, y1] = centre(a), [x2, y2] = centre(b), across = y1 === y2;
    for (const [x, y, s, end] of [[x1, y1, 1, a], [x2, y2, -1, b]])
      cuts.append(across
        ? svg("rect", {x: x + s * Math.sign(x2 - x1) * bw / 2 - 4, y: y - 9, width: 8, height: 18, "data-door": door(a, b), "data-end": end})
        : svg("rect", {x: x - 9, y: y + s * Math.sign(y2 - y1) * bh / 2 - 4, width: 18, height: 8, "data-door": door(a, b), "data-end": end}));
  }
  map.append(halls);
  for (const room of rooms) {
    const [x, y] = centre(room.id), g = svg("g", {class: room.kind, "data-room": room.id});
    g.append(svg("rect", {x: x - bw / 2, y: y - bh / 2, width: bw, height: bh}));
    const words = big ? room.name.split(" ") : [room.name];
    const lines = words.length > 2 ? [words.slice(0, -1).join(" "), words.at(-1)] : words;
    // A two-line name sits at y-19 and y+3, clear of the top wall; a body's
    // names and the slot signs go at y+27, under its second line.
    lines.forEach((line, k) => {
      const t = svg("text", {class: "name", x, y: big ? (lines.length === 2 ? y - 19 + k * 22 : y - 12) : y - 5});
      t.textContent = line;
      fit(t, line, big ? 23 : 15, bw - 14);
      g.append(t);
    });
    g.append(svg("g", {class: "when", "data-x": x, "data-y": y + (big ? 27 : 11)}));
    map.append(g);
  }
  // The cuts go over the rooms' walls and under nothing a room holds, since
  // a cut is only 4 deep into a room.
  map.append(cuts);
  return function show(turn) {
    const signs = {}, walked = new Set();
    route(story, turn).forEach(({named, passed, doors}, slot) => {
      for (const room of named) (signs[room] ||= new Set()).add(slot);
      for (const room of passed) (signs[room] ||= new Set()).add(slot);
      for (const [a, b] of doors) walked.add(door(a, b));
    });
    for (const n of map.querySelectorAll("[data-door]"))
      n.classList.toggle("lit", walked.has(n.dataset.door));
    for (const g of map.querySelectorAll("g[data-room]")) {
      const s = signs[g.dataset.room];
      g.classList.toggle("lit", !!s);
      const w = g.querySelector(".when"), x = +w.dataset.x, y = +w.dataset.y;
      w.replaceChildren(...[...(s || [])].sort().map((slot, i, all) => slotSign(slot, x + (i - (all.length - 1) / 2) * r * 2.8, y, r)));
    }
  };
}

// Where the day's bodies lay, from Veronique's words, since the format gives
// no field for it: [{who: [ids], room}] for each line saying who was "lying
// still", the room named in it or, after "raised the alarm from the X", in
// the line before. `day` counts from 1.
export function found(day) {
  const lines = story.days[day - 1].turns.filter(t => t.speaker === "narrator").flatMap(t => t.lines.map(l => l.text));
  const named = (line, list) => list.filter(x => new RegExp(`\\b${x.name}\\b`).test(line)).map(x => x.id);
  const out = [];
  lines.forEach((line, k) => {
    if (!line.includes("lying still")) return;
    const room = named(line, story.house.rooms)[0] || named(lines[k - 1] || "", story.house.rooms)[0];
    out.push({who: named(line, story.cast), room});
  });
  return out;
}

// The house with where the bodies lay: the map drawn in `map` with each such
// room marked and the names of who lay there under it.
export function deathMap(map, day, big) {
  drawMap(map, null, big)(null);
  for (const {who, room} of found(day)) {
    const g = map.querySelector(`g[data-room="${room}"]`);
    if (!g) continue;
    g.classList.add("body");
    const w = g.querySelector(".when"), t = svg("text", {class: "dead", x: w.dataset.x, y: +w.dataset.y + 1});
    t.textContent = who.map(id => names[id]).join(", ");
    fit(t, t.textContent, big ? 19 : 13, 120, "italic 600");
    g.append(t);
  }
}

// An account's map: the house cut to its own width, lit with the way the
// account walks all day, the rooms where the day's bodies lay red. It
// names no body, since two names do not fit a room and the red tells it
// (the user, 11 November 2026). `day` counts from 1.
export function accountMap(turn, day) {
  const map = svg("svg", {class: "map"});
  drawMap(map, null, true, true)(turn);
  for (const {room} of found(day)) map.querySelector(`g[data-room="${room}"]`)?.classList.add("body");
  return map;
}

// The reader. `view` holds:
//   log, next, before (the node entries go before, or null for the end),
//   map, legend (optional), bigMap (optional, drawMap's big),
//   turn(beat): a new beat {entry, turn, mood, day, dead, i, first}, where a
//     closing challenge's turn has `challenge` set, and where a
//     turn that continues its speaker's last one is no new beat and calls
//     nothing, and dead is the set of guests examined so far;
//   more(entry, turn): optional, a turn that continues its speaker's last;
//   title(h2, day): a day's title entered;
//   settle(): after every step, to lay out and scroll.
// The view's map is the plain house, lit by nothing. Returns {beats, step,
// day(), at()}; at() counts the steps taken.
export function reader(view) {
  if (view.map) drawMap(view.map, view.legend, view.bigMap)(null);
  const beats = [];
  let at = 0, day = 0, dayStart = true, lastKind = null;
  const dead = new Set();

  function entry(speaker, kind, lines, turn) {
    for (const e of view.log.querySelectorAll(".entry.current")) e.classList.remove("current");
    const e = el("div", {class: `entry current ${speaker === "narrator" ? "narrator" : ""} ${kind}`});
    e.dataset.day = day;
    if (!turn?.continues) e.append(el("div", {class: "who"}, el("span", {class: "speaker", "data-id": speaker}, names[speaker])));
    const text = el("div", {class: "text"});
    for (const line of lines) {
      const span = el("span", {class: "line"});
      span.append(mark(line.text, story));
      if (line.slots && turn?.places) span.dataset.slots = line.slots.join(",");
      text.append(span);
    }
    e.append(text);
    view.log.insertBefore(e, view.before);
    return e;
  }
  function beat(e, turn, mood) {
    const b = {entry: e, turn, mood, day, dead: new Set(dead), i: beats.length, first: beats.length === 0};
    e.dataset.beat = b.i;
    beats.push(b);
    view.turn(b);
  }
  // Veronique's pose: presenting the game and each day's news, bowing at the
  // challenge, her head tilted at what follows a charge, else still.
  function pose() {
    if (at >= steps.length) return "doll-bow";
    if (lastKind === "charge") return "doll-tilt";
    return dayStart ? "doll-presenting" : "doll-neutral";
  }

  function step() {
    if (at >= steps.length) return;
    const item = steps[at++];
    if (item.title) {
      day++;
      const h = el("h2", {}, item.title);
      h.dataset.day = day;
      view.log.insertBefore(h, view.before);
      dayStart = true;
      view.title?.(h, day);
      view.settle();
      return;
    }
    const turn = item.turn, who = turn.speaker;
    const mood = who === "narrator" ? pose() : turn.kind === "examination" ? "grave" : "neutral";
    const e = entry(who, turn.kind, turn.lines, turn);
    if (turn.kind === "examination") for (const b of turn.bodies || []) dead.add(b);
    if (!turn.continues) beat(e, turn, mood);
    else view.more?.(e, turn);
    lastKind = turn.kind;
    // Her house turn presents too, and leaves the dawn its news.
    if (who === "narrator" && turn.kind !== "house") dayStart = false;
    if (at >= steps.length) {
      const end = entry("narrator", "narration", [{text: story.challenge}]);
      beat(end, {speaker: "narrator", kind: "narration", challenge: true}, "doll-bow");
      view.next.disabled = true;
    }
    view.settle();
  }

  // The objective, in her voice, before the first day.
  const first = entry("narrator", "narration", story.objective.map(text => ({text})));
  beat(first, {speaker: "narrator", kind: "narration"}, "doll-presenting");
  view.next.onclick = step;
  view.next.disabled = false;
  keys(Object.fromEntries(ADVANCE.map(k => [k, step])));
  return {beats, step, day: () => day, at: () => at};
}

// A node's top within the log's scrolled content, however deep it sits.
export const topIn = (log, node) => node.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop;

// The day in view: the one whose title last passed the log's middle, or the
// latest while the log is at its foot.
export function dayInView(log, latest) {
  if (log.scrollTop + log.clientHeight >= log.scrollHeight - 4) return latest;
  const mid = log.scrollTop + log.clientHeight / 2;
  return [...log.querySelectorAll("h2")].filter(h => topIn(log, h) <= mid).length;
}

// The house on demand: `toggle` shows or hides it, by H or the `button`.
export function houseOnDemand(button, toggle) {
  button.onclick = toggle;
  addEventListener("keydown", e => { if (!e.target.closest?.("textarea, input, select") && e.key.toLowerCase() === "h" && !e.ctrlKey && !e.metaKey && !e.altKey) toggle(); });
}

