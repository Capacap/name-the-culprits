// The game view: one long strip read downward, with the player's workspace
// (../player/workspace.js) over it.
// The strip:
//   A day opens on a wide panel of the house, the rooms where the bodies lay
//     marked, Veronique presenting it.
//   An account is a wide panel of the speaker alone, on alternating sides
//     (a guest with a set of places stands at the left of theirs),
//     under it the house lit with the way the account walks that day, then
//     their words. The map is the same on every screen and covers no art.
//     Beside the speaker's name stand the player's marks for them.
//   An examination is a wide panel: the examiner grave, the dead a grey
//     headshot beside them.
//   A charge is a wide panel, the accused's headshot and the accuser
//     pointing at it, its words in the text under it; only it shakes.
//   Every figure is zoomed so the cast's heads come out one size. The account that
//     follows a charge stands named under its panel; after an
//     examination it is a panel of its own.
//   Every text is one width, the column's, and every panel one height but
//     for a guest's set, which is taller.
//   A guest with a set (cast.js SETS) stands cut out over a place of their
//     own, in the turn's mood, in a taller panel; no room of the house is
//     drawn behind a figure.
//   A line that names a slot has the slot's sign before it and its word set
//     bold.
//   The lines a charge is about are marked, in the accuser's account and in
//     the accused's.
//   The dawn's question and its answers are bare lines under the speaker's
//     name, with no portrait.
//   Veronique's words are captions; she presents the game in a wide panel at
//     the start and bows in one at the challenge.
// Every figure is --frame tall (story.css) before its guest's zoom.

import {reader, story, names, mark, el, svg, dayInView, deathMap, found, accountMap} from "../reader.js";
import {framed, cutout, preload, head, zoom, set} from "../cast.js";
import {tools} from "../player/tools.js";
import {context} from "../player/context.js";
import {mount as workspace} from "../player/workspace.js";

const $ = id => document.getElementById(id);
const log = $("log");
preload(story.cast.map(c => c.id));

const img = (src, cls = "") => el("img", {class: cls, src, alt: ""});
// A character's figure, zoomed so the cast's heads come out one size (cast.js HEADS).
const fig = (who, mood, key, cls = "fig") => { const i = img(framed(who, mood, key), cls); i.style.cssText = zoom(who); return i; };
// The speaker in a panel: over their own place where they have a set for
// the mood (cast.js set, story.css .place), otherwise their figure.
function stand(p, who, mood, key, cls) {
  const s = set(who, mood);
  if (!s) return p.append(fig(who, mood, key, cls));
  const figure = img(s.figure, "cut");
  figure.style.cssText = s.style;
  p.classList.add("set");
  p.prepend(el("div", {class: "place"}, el("div", {class: "plate", style: `background-image: url("${s.plate}"); ${s.at}`}), figure));
}
// A character's headshot, the square around their head in the picture given (story.css .head).
const headshot = (who, src, mood) => el("div", {class: "head", style: `${head(who, mood)}; background-image: url("${src}")`});
function panel(kind, day) {
  const p = el("figure", {class: `panel ${kind} new`});
  p.dataset.day = day;
  return p;
}
const shown = p => requestAnimationFrame(() => requestAnimationFrame(() => p.classList.remove("new")));

let side = 0, last = null;    // last: where a turn that continues the latest account goes
let fresh = null;             // the block the last step added, to bring into view
const aimed = [];             // what the last step added or grew, for the camera
let beat = null;              // the latest beat, which a continuing turn joins
const blocks = [];            // every panel, for lighting by day

// The player's marks for the speaker beside their name on an account:
// suspect or cleared for that day, culprit for the whole story (tools.js).
const marks = (entry, turn, day) => entry.querySelector(".who")?.append(ctx.tools.markChips(day, turn.speaker));

function row(b) {
  side = 1 - side;
  const p = el("div", {class: "pair solo new"});
  p.dataset.day = b.day;
  const pn = panel("together", b.day);
  pn.classList.remove("new");
  stand(pn, b.turn.speaker, "neutral", "", `fig ${side ? "a" : "b"}`);
  const body = el("div", {class: "body"});
  log.insertBefore(p, b.entry);
  body.append(b.entry);
  p.append(pn, accountMap(b.turn, b.day), body);
  marks(b.entry, b.turn, b.day);
  blocks.push(p);
  return {block: p, col: body};
}

// The story's last day, on which Veronique looks up from her work at the player.
const lastDay = day => day === story.days.length;

function wide(b) {
  const {turn} = b, who = turn.speaker;
  // The speaker in a mood at the right, the guests the turn is about as
  // headshots at the left (story.css .behind).
  const faced = (kind, mood, ids, src) => {
    const p = panel(kind, b.day);
    const behind = el("div", {class: "behind"});
    for (const id of ids) behind.append(headshot(id, src(id), kind === "charge" ? "accused" : ""));
    p.append(behind);
    stand(p, who, mood, b.i);
    return p;
  };
  // The accused's headshot is the head of their accused picture.
  if (turn.kind === "charge") return faced("charge", "accusing", turn.against, a => cutout(a, framed(a, "accused", `${b.i}:${a}`)));
  if (turn.kind === "examination") return faced("examination", "grave", turn.bodies || [], cutout);
  const p = panel("bow", b.day);
  p.append(fig("narrator", lastDay(b.day) ? "lookup" : b.mood, ""));
  return p;
}

// The workspace sets foot() to the height of the dock across the window's foot.
const ctx = context({story, names, log, el, mark});

const r = reader({
  log, next: $("next"), before: $("next"), map: $("map"), legend: $("legend"), bigMap: true,
  turn(b) {
    const {turn} = b, who = turn.speaker;
    beat = b;
    ctx.begin(b);
    if (who === "narrator" && turn.lines) {
      aimed.push(b.entry);
      last = null;
      return;
    }
    // The day's question and its answers stand under the speaker's name
    // with no portrait, as her lines do, so the exchange takes the room of
    // its words.
    if (turn.kind === "defence") {
      aimed.push(b.entry);
      last = null;
      return;
    }
    if (turn.kind === "account") {
      last = row(b);
      fresh = last.block;
      aimed.push(fresh);
      shown(fresh);
      return;
    }
    last = null;
    const p = wide(b);
    log.insertBefore(p, b.entry);
    b.anchor = p;
    blocks.push(p);
    fresh = p;
    aimed.push(p, b.entry);
    shown(p);
    if (turn.kind === "charge") p.classList.add("shake");
    if (ctx.isChallenge(b)) ctx.emit("end", b.entry);
  },
  // A turn that continues its speaker's last joins its column; an account
  // that follows a wide panel carries the speaker's name, so it is not read
  // as the next speaker's: after a charge it stands under the charge's
  // panel, after an examination in a row of its own with their figure.
  more(entry, turn) {
    const answer = ctx.add(beat, entry, turn);
    if (last) { last.col.append(entry); aimed.push(last.block || entry); return; }
    aimed.push(entry);
    if (turn.kind !== "account") return;
    entry.prepend(el("div", {class: "who"}, el("span", {class: "speaker", "data-id": turn.speaker}, names[turn.speaker])));
    // An account that answers a charge has no panel of its own; its map
    // stands over its words, under the charge.
    if (answer) {
      entry.classList.add("answer");
      const map = accountMap(turn, beat.day);
      map.classList.add("answer");
      entry.before(map);
      marks(entry, turn, beat.day);
      aimed.push(map);
      return;
    }
    last = row({turn, day: beat.day, entry});
    aimed.push(last.block);
    shown(last.block);
  },
  title(h, day) {
    last = null;
    const p = panel("house", day);
    const map = svg("svg", {class: "map"});
    const lay = el("div", {class: "lay"});
    const bodies = found(day);
    const cap = el("figcaption", {class: "caption"},
      bodies.length ? `Where ${bodies.map(f => f.who.map(id => names[id]).join(" and ")).join(", ")} ${bodies.length > 1 || bodies[0].who.length > 1 ? "were" : "was"} found` : "The house");
    lay.append(map, cap);
    p.append(lay, fig("narrator", lastDay(day) ? "lookup" : "doll-presenting", ""));
    log.insertBefore(p, h.nextSibling);
    deathMap(map, day, true);
    blocks.push(p);
    fresh = h;
    aimed.push(h, p);
    shown(p);
    ctx.emit("day", p, day);
  },
  settle,
});
ctx.beats = r.beats;
ctx.reader = r;
ctx.settle = () => settle();
ctx.next = $("next");

function light() {
  const seen = dayInView(log, r.day());
  for (const b of blocks) b.classList.toggle("past", +b.dataset.day !== seen);
}
log.addEventListener("scroll", light);

// After a step that told a turn: the strip centres what it added, the
// speaker's panel or row with their words, or a day's title, house and her
// lines; one taller than the window has its top near the window's top.
// After a step that told none (a rules reply): the strip moves only as far
// as brings continue into view, and never so far that the new block's top
// leaves the window.
function settle() {
  ctx.emit("step");
  const foot = log.scrollHeight - log.clientHeight;
  const top = log.getBoundingClientRect().top, bottom = innerHeight - ctx.foot();
  let move;
  if (aimed.length) {
    const rects = aimed.map(n => n.getBoundingClientRect());
    const a = Math.min(...rects.map(r => r.top)), z = Math.max(...rects.map(r => r.bottom));
    move = z - a > (bottom - top) * 0.9 ? a - (top + innerHeight * 0.05) : (a + z) / 2 - (top + bottom) / 2;
  } else {
    const below = $("next").getBoundingClientRect().bottom - (bottom - 24);
    move = Math.max(0, below);
    if (fresh) move = Math.min(move, fresh.getBoundingClientRect().top - innerHeight * 0.05);
  }
  aimed.length = 0;
  fresh = null;
  log.scrollTo({top: Math.min(foot, Math.max(0, log.scrollTop + move)), behavior: ctx.restoring ? "instant" : "smooth"});
  light();
}

ctx.tools = tools(ctx);
document.body.classList.add("ui-dock");
workspace(ctx);
// Once the fonts have set the text, and her panels on a finished story
// have their lines (tools.js), the strip settles on its step. A reading
// played back (save.js) returns instead to the place it was left at: now,
// before the page shows, and again then.
ctx.place?.();
await Promise.all([document.fonts.ready, ctx.tools.loaded()]);
if (ctx.place) ctx.place(true);
else settle();
