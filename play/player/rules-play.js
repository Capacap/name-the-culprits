// The rules told in play: Veronique's own lines carry underlined words, and
// pressing one brings a new caption of hers saying more, which may carry an
// underlined word of its own, at most three captions deep. Each such caption
// ends in a button that opens the Rules card. No question is
// put in the player's mouth and no line is in small type. The user's pick
// of 1 November 2026 ("condensed") from rounds of trial ways.
//
// Where a chain starts, in the order the player meets them:
//   her opening       "rooms" (seeing) and "doors" (trips);
//   her house         the story's `house` turn, first on the first day: each
//                     room with a rule of its own, then "culprits" and "lie"
//                     just before the first guest speaks. A room's rule
//                     starts only here; the day maps carry no mark for it
//                     (the user, 1 November 2026);
//   her own lines     the first line of hers that shows a chain still
//                     untold: a body "lying still", "raised the alarm",
//                     and from the second day "At dawn".
// The opening carries rooms and doors because no line of hers about trips
// or seeing is guaranteed: over the 100 alpha stories (1 November 2026) "made a trip"
// first falls on day 1 in 80, later in 19, never in 1; "kept to" or "set
// foot" on day 1 in 45, later in 41, never in 14.
// The Rules card lists every chain's first line, touched for its drawing and
// the rest of the chain; her closing points back to the underlines and the
// card. Every line was checked against the rules the stories carry on 1
// November 2026; a line that a room of the house bends says so ("%U").

import {PICTURE, OWN_PICTURE} from "./pictures.js";
import {wrapMatch, escape} from "./text.js";

// Her opening, in place of the story's objective: a welcome and the
// challenge, the user's wording (1 and 6 November 2026).
export const OPENING = ["Welcome to my house. Keep in mind its rooms and its doors, for it may not look the same next time.",
  "I challenge you to name the culprits of the crimes that will take place here."];
// "%U" becomes UNLESS where a room of the house has a rule matching `unless`.
const UNLESS = ", unless a room says otherwise";

// Each chain: [her line, its underlined word] a caption, the last with no
// word. The "lie" chain and the trip chain's first two lines are
// the user's (the trip line with "within one slot" and "the same way" put
// back, the omission line with "among my guests", since she leaves truths
// out too); the rest is the session's wording. The house turn's words are
// the story file's.
export const CHAINS = {
  culprits: {levels: [["There are no more than two culprits. A culprit kills at least once and is alive when the story ends; if there are two, both kill. A murder cannot be shared."]]},
  complete: {levels: [["Only a culprit can lie, other accounts are always true.", "true"],
    ["A lie by omission is still a lie: among my guests, only a culprit can choose to omit a fact."]]},
  narrator: {levels: [["I speak only truth, though not every truth.", "truth"],
    ["And where I say at least one person, it may be one or more than one."]]},
  named: {levels: [["Everyone in the house is a guest you know by name. There is no one else."]]},
  murder: {levels: [["A murder victim lies where they were murdered. The killer was in that room with the victim, never just passing through.", "killer"],
    ["No innocent but the victims is in the room of a murder during its slot. There is no witness but a culprit."]]},
  trip: {unless: /tunnel|see each other/, levels: [
    ["A guest can make one trip a day, within one slot, taking a route with no detours. The guest either visits another room then returns the same way, or they stay at their destination for the rest of the day.", "route"],
    ["A guest can only travel through the doors of the map, there is no other way, nor can a guest pass another undetected%U. Every trip takes time.", "time"],
    ["No guest can leave a room and be back within the time another guest is away from it."]]},
  seen: {unless: /see each other/, levels: [["Guests who share a room in the same slot see each other%U."]]},
  anyroom: {unless: /begins every later day/, levels: [["A new day. A guest may begin it in any room, wherever they ended the last%U.", "day"],
    ["A day is split into noon, dusk and midnight. No day passes without at least one body discovered."]]},
  ended: {levels: [["A day may be cut short by the discovery of a body. When someone raises the alarm, the day ends with that slot."]]},
};

// Her house turn's words besides its rooms' names, as the generator
// writes them.
const HOUSE = [{on: /\bculprits\b/, id: "culprits"}, {on: /\blie\b/, id: "complete"}];
// Her opening's words and the chains they start.
const OPENS = [{on: /\brooms\b/, id: "seen"}, {on: /\bdoors\b/, id: "trip"}];
// Her own lines' words: the first match still untold, one a line.
const LINES = [
  {on: /At dawn/, id: "anyroom", from: 2},
  {on: /lying still/, id: "murder"},
  {on: /raised the alarm/, id: "ended"},
];
// The Rules card's sections; the house's own rules head it.
const CARD = [
  ["The culprits", ["culprits"]],
  ["The truth", ["complete", "narrator"]],
  ["The murders", ["murder"]],
  ["The trips", ["trip"]],
  ["The house", ["named", "seen", "anyroom", "ended"]],
];
const CLOSING = "Every word I marked still holds more. All my rules are under Rules, below.";

// The tables agree: every id named has a chain, every chain is on the card,
// and every underlined word is in its line; a slip throws on load rather
// than leaving a chain unreachable.
for (const id of [...OPENS, ...LINES, ...HOUSE].map(o => o.id).concat(CARD.flatMap(([, ids]) => ids)))
  if (!CHAINS[id]) throw new Error(`rules-play: no chain "${id}"`);
for (const id of Object.keys(CHAINS))
  if (!CARD.some(([, ids]) => ids.includes(id))) throw new Error(`rules-play: chain "${id}" is not on the card`);
for (const [id, {levels}] of Object.entries(CHAINS))
  levels.forEach(([text, word], k) => {
    if (word && !new RegExp(`\\b${escape(word)}\\b`).test(text)) throw new Error(`rules-play: "${word}" is not in ${id}'s line ${k + 1}`);
  });

// Mounts the rules on the workspace. Returns {card, closing}: the Rules
// card's contents, and what her closing caption becomes.
export function rulesInPlay(ctx) {
  const {el, log, story} = ctx;
  document.body.classList.add("rules-play");
  const ownRules = story.house.rooms.flatMap(r => r.rules || []);
  const own = [...new Set(ownRules)].map(rule => ({rule, rooms: story.house.rooms.filter(r => r.rules?.includes(rule))}));

  // An item is {id} for a chain or {rule, room} for a room's own rule.
  const keyOf = item => item.id || item.rule;
  // An item's captions, [[text, word]], "%U" filled for this house.
  function levelsOf(item) {
    if (!item.id) return [[item.rule]];
    const c = CHAINS[item.id], bent = c.unless && ownRules.some(r => c.unless.test(r));
    return c.levels.map(([t, w]) => [t.replace("%U", bent ? UNLESS : ""), w]);
  }
  const pictureOf = (item, k) => item.id ? PICTURE[item.id]?.(k) : OWN_PICTURE(item.rule, k);

  const caption = (...body) => el("div", {class: "entry narrator answer current"},
    el("div", {class: "who"}, "Veronique"), el("div", {class: "text"}, ...body));
  // The button under a caption of a rule, which opens the Rules card (the
  // workspace answers "rules").
  function toRules() {
    const b = el("button", {class: "torules"}, "All the rules");
    b.onclick = e => { e.stopPropagation(); ctx.emit("rules"); };
    return b;
  }
  const uncurrent = () => { for (const c of log.querySelectorAll(".entry.current")) c.classList.remove("current"); };
  // A new caption in the strip: at its end the strip settles, else it
  // scrolls into view.
  function placed(node) {
    if (!node.nextElementSibling || node.nextElementSibling === ctx.next) ctx.settle();
    else node.scrollIntoView({block: "nearest", behavior: "smooth"});
  }
  // The level-k caption's word, underlined, brings level k + 1 after `reply`.
  function chain(levels, k, reply, line) {
    const [, word] = levels[k];
    if (!word || !levels[k + 1]) return;
    const b = el("button", {class: "press"});
    if (!wrapMatch(line, new RegExp(`\\b${escape(word)}\\b`), b)) return;
    b.onclick = e => {
      e.stopPropagation();
      if (b.classList.contains("spent")) return;
      b.classList.add("spent");
      const next = el("span", {class: "line"}, levels[k + 1][0]);
      const r = el("div", {class: "reply follow"}, caption(next, toRules()));
      uncurrent();
      reply.after(r);
      chain(levels, k + 1, r, next);
      placed(r);
    };
  }
  // The first caption of an item's chain, with its drawing.
  function first(item) {
    const levels = levelsOf(item);
    const line = el("span", {class: "line"}, levels[0][0]);
    const her = caption(line);
    const drawn = pictureOf(item, 1.5);
    if (drawn) her.append(el("div", {class: "drawn"}, drawn));
    her.append(toRules());
    const reply = el("div", {class: "reply"}, her);
    chain(levels, 0, reply, line);
    return reply;
  }

  // Told chains, and the underlines that start each.
  const told = new Set(), started = new Set(), offered = new Map();
  // Starts an item's chain after `after`, below any chain already there.
  function start(item, after) {
    const key = keyOf(item);
    if (started.has(key)) return;
    started.add(key);
    for (const n of offered.get(key) || []) { n.classList.add("asked"); n.disabled = true; }
    const r = first(item);
    uncurrent();
    let tail = after;
    while (tail.nextElementSibling?.matches(".reply")) tail = tail.nextElementSibling;
    tail.after(r);
    placed(r);
  }
  // Underlines the words `on` of `line` in `entry` to start the item.
  function offer(item, entry, line, on) {
    const b = el("button", {class: "press"});
    if (!wrapMatch(line, on, b)) return;
    b.onclick = e => { e.stopPropagation(); start(item, entry); };
    const key = keyOf(item);
    offered.set(key, [...(offered.get(key) || []), b]);
  }

  // Her opening.
  const opening = ctx.beats[0].entry.querySelector(".text");
  const said = el("span", {class: "line"}, OPENING[0]);
  opening.replaceChildren(said, el("span", {class: "line"}, OPENING[1]));
  for (const o of OPENS) { told.add(o.id); offer({id: o.id}, ctx.beats[0].entry, said, o.on); }

  // Her house turn: each room with a rule of its own, for its rule, and
  // "culprits" and "lie", wherever the turn names them.
  const houseOffers = HOUSE.map(p => [{id: p.id}, p.on]);
  for (const p of HOUSE) told.add(p.id);
  for (const o of own) for (const r of o.rooms) houseOffers.push([{rule: o.rule, room: o.rooms[0].name}, new RegExp(`\\b${escape(r.name)}\\b`)]);

  // Her lines as they enter: the house's words, else on each line the first
  // chain of LINES it shows that is still untold.
  const turns = story.days.flatMap(d => d.turns);
  const dayOf = turn => story.days.findIndex(d => d.turns.includes(turn)) + 1;
  ctx.on("entry", (entry, turn) => {
    if (turn.speaker !== "narrator") return;
    const spans = entry.querySelectorAll(".text > .line");
    if (turn.kind === "house") {
      for (const [item, on] of houseOffers) {
        const k = turn.lines.findIndex(l => on.test(l.text));
        if (k >= 0) offer(item, entry, spans[k], on);
        else reportError(new Error(`rules-play: ${on} is not in her house turn`));
      }
      return;
    }
    if (!turns.includes(turn)) return;
    turn.lines.forEach((l, k) => {
      const p = LINES.find(p => !told.has(p.id) && (!p.from || dayOf(turn) >= p.from) && p.on.test(l.text));
      if (!p) return;
      told.add(p.id);
      offer({id: p.id}, entry, spans[k], p.on);
    });
  });

  // The Rules card: each chain's first line, touched for its drawing and
  // the rest of the chain; the house's own rules first, each in full.
  function row(item) {
    const levels = levelsOf(item);
    const r = el("div", {class: "qa"});
    const b = el("button", {class: "q"}, levels[0][0]);
    b.onclick = () => {
      if (!r.querySelector(".drawn")) {
        const p = pictureOf(item, 1.2);
        r.append(el("div", {class: "drawn"}, ...(p ? [p] : []), ...levels.slice(1).map(([t]) => el("p", {class: "cited"}, t))));
      }
      r.classList.toggle("open");
    };
    r.append(b);
    return r;
  }
  function card() {
    const box = el("div", {class: "rules ref qa-card"});
    if (own.length) box.append(el("section", {class: "own"}, el("h4", {}, "This house"),
      ...own.map(o => row({rule: o.rule, room: o.rooms[0].name}))));
    box.append(el("p", {class: "every"}, "The same in every story"));
    for (const [title, ids] of CARD) box.append(el("section", {class: "standing"}, el("h4", {}, title), ...ids.map(id => row({id}))));
    return [el("p", {class: "hint"}, "Touch a line for more."), box];
  }
  // Her closing before the challenge.
  const closing = remind => remind.querySelector(".text").replaceChildren(el("span", {class: "line"}, CLOSING));

  return {card, closing};
}
