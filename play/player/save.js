// The reading kept per story in this browser, so a reload returns to where
// the player was: how many of the reader's steps were taken, each of her
// underlined words pressed (its place among the log's `button.press` at the
// press, with the step count then), whether the press that brings her
// challenge into view was made, and the place the log is scrolled to (the
// block at its top, by its number among the log's children, and how far it
// is scrolled past). On load the record is played back with transitions
// off (body.restoring) and the log scrolled at once (ctx.restoring, read
// by a view's settle); the view then calls ctx.place, which returns the
// log to the kept place, and calls it for the last time, as
// ctx.place(true), once everything that sets the log's height has loaded.
// A press is kept with its
// button's words, and played back only where the button at that place
// still has them, so an edit to her lines that moves the underlines drops
// the presses and keeps the steps.
import {topIn} from "../reader.js";

const key = id => `berndle:reading:${id}`;
// Set by `forget`, so that nothing pending writes the reading back.
let forgotten = false;

function read(id) {
  try { return JSON.parse(localStorage.getItem(key(id))); } catch { return null; }
}

// Whether a record holds a reading to play back.
const has = r => !!(r?.at || r?.presses?.length);
// Whether a reading of the story is kept.
export const kept = id => has(read(id));

// Forgets a story's reading, for a reading from the start.
export function forget(id) {
  forgotten = true;
  try { localStorage.removeItem(key(id)); } catch { /* storage blocked */ }
}

// Keeps the reading of ctx's story from here on, after playing back what
// was kept. `land()` makes the press that brings her challenge into view,
// at once; "landed" is the event a view's own press of it emits.
export function keep(ctx, land) {
  const {log, reader, story} = ctx;
  const rec = {at: 0, presses: [], landed: false, place: null};
  let quiet = false;
  const write = () => {
    if (quiet || forgotten) return;
    try { localStorage.setItem(key(story.id), JSON.stringify(rec)); } catch { /* storage blocked: the reading lasts the visit */ }
  };
  // Her answer panels' words (tools.js) are left out: they come after the
  // reading, and a reload shows them unpressed.
  const presses = () => [...log.querySelectorAll("button.press")].filter(b => !b.closest(".herpanel"));
  // In the capture phase, before rules-play's handler adds a caption, so
  // the index is the button's place in the log as it was.
  log.addEventListener("click", e => {
    const b = e.target.closest("button.press");
    if (quiet || !b || b.disabled || b.classList.contains("spent") || b.closest(".herpanel")) return;
    rec.presses.push([reader.at(), presses().indexOf(b), b.textContent]);
    write();
  }, true);
  ctx.on("step", () => { if (rec.at !== reader.at()) { rec.at = reader.at(); write(); } });
  ctx.on("landed", () => { rec.landed = true; write(); });
  // The place is kept once the log has rested a moment after a scroll, or
  // when the page is left before that, and not before a playback has
  // returned to the place kept before it. A scroll that only arrives where
  // ctx.place put the log (`own`) keeps nothing, since that place may be
  // short of the kept one while the log's content is still loading.
  let placed = false, rest = null, own = null;
  const here = () => {
    rest = null;
    if (!placed) return;
    const i = [...log.children].findIndex(n => n.offsetHeight && topIn(log, n) + n.offsetHeight > log.scrollTop);
    rec.place = i < 0 ? null : [i, Math.round(log.scrollTop - topIn(log, log.children[i]))];
    write();
  };
  log.addEventListener("scroll", () => {
    if (log.scrollTop === own) return;
    own = null;
    clearTimeout(rest);
    rest = setTimeout(here, 150);
  });
  addEventListener("pagehide", () => { if (rest) { clearTimeout(rest); here(); } });

  const saved = read(story.id);
  if (!has(saved)) { placed = true; return; }
  rec.place = saved.place || null;
  // The log goes to the kept place unless the player has moved it since
  // the page showed; places are kept again from the last call on, starting
  // with the one the player moved to.
  let moved = false;
  const move = () => { moved = true; };
  const MOVES = ["wheel", "touchstart", "pointerdown", "keydown"];
  for (const e of MOVES) addEventListener(e, move, {capture: true, passive: true});
  ctx.place = last => {
    const block = !moved && rec.place && log.children[rec.place[0]];
    if (block) {
      log.scrollTo({top: topIn(log, block) + rec.place[1], behavior: "instant"});
      own = log.scrollTop;
    }
    if (!last) return;
    for (const e of MOVES) removeEventListener(e, move, {capture: true});
    placed = true;
    if (moved) here();
  };
  quiet = true;
  ctx.restoring = true;
  document.body.classList.add("restoring");
  // Steps up to `n`, stopping where the story ends.
  const to = n => {
    while (reader.at() < n) {
      const was = reader.at();
      reader.step();
      if (reader.at() === was) break;
    }
  };
  // A fault in the playback still ends it, so the page is not left
  // without transitions and the reading is kept from then on.
  try {
    for (const [at, i, words] of saved.presses || []) {
      to(at);
      const b = presses()[i];
      if (!b || b.textContent !== words) continue;
      b.click();
      rec.presses.push([at, i, words]);
    }
    to(saved.at);
    if (saved.landed) { land(); rec.landed = true; }
  } finally {
    rec.at = reader.at();
    quiet = false;
    // A charge's panel keeps no shake to play when the class comes off,
    // and the blocks shown in the playback appear without fading in: a
    // view's "new" comes off here and is drawn while transitions are off,
    // since the view would take it off in the frame that turns them on.
    for (const n of log.querySelectorAll(".shake")) n.classList.remove("shake");
    for (const n of log.querySelectorAll(".new")) n.classList.remove("new");
    log.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.body.classList.remove("restoring");
      ctx.restoring = false;
    }));
  }
}
