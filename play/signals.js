// What this browser tells the site about a play, for the alpha: the story
// opened, how far it was read and the seconds spent, each team sealed, the
// truth opened, and the answers to Veronique's ask (feedback.js). The
// Worker (worker/index.js) keeps them; nothing sent names the player, and
// the notes' text never leaves the browser.
//
// A play is a random id made when the story is first opened and kept in
// localStorage with the seconds spent and whether the ask was answered;
// "Read it again from the start" drops it with the reading (tools.js), so a
// re-read is a new play. Where storage is blocked the play
// lasts the visit.
//
// A signal goes by sendBeacon, which outlives the page, and is lost in
// silence where the site has no Worker (play.sh, a plain file server).

import {STORY} from "./shared.js";
import {story, steps} from "./reader.js";
import {record} from "./progress.js";
import {kept} from "./player/save.js";

const key = id => `berndle:play:${id}`;
const KEY = key(STORY);
const API = "../../api/";

let rec = null, dropped = false;   // dropped: forgotten this visit, so the pagehide does not write it back
function play() {
  if (rec) return rec;
  try { rec = JSON.parse(localStorage.getItem(KEY)); } catch { /* storage blocked */ }
  if (!rec?.id) rec = {id: crypto.randomUUID(), seconds: 0, opened: false, answered: false, last: ""};
  write();
  return rec;
}
function write() {
  if (dropped) return;
  try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch { /* storage blocked: the play lasts the visit */ }
}
// Forgets a story's play, for a new one on the next load.
export function forgetPlay(id) {
  if (id === STORY) dropped = true;
  try { localStorage.removeItem(key(id)); } catch { /* storage blocked */ }
}

const body = (kind, data) => JSON.stringify({story: story.id, generator: story.generator, play: play().id, kind, data});
function beacon(kind, data) {
  try {
    const blob = new Blob([body(kind, data)], {type: "application/json"});
    if (navigator.sendBeacon?.(API + "signal", blob)) return;
    fetch(API + "signal", {method: "POST", body: blob, keepalive: true}).catch(() => {});
  } catch { /* nothing to send with */ }
}

// Seconds the page has been in view during this play, as a running total.
let since = document.visibilityState === "visible" ? Date.now() : null;
function seconds() {
  if (since !== null) { rec.seconds += Math.round((Date.now() - since) / 1000); since = Date.now(); }
  return rec.seconds;
}

// Starts the play's signals: "opened" once per play, with the progress
// this browser already had (so a replay of a solved story is told from a
// first play) and whether a kept reading was resumed; "read" whenever the
// page is hidden and at the challenge.
export function start(ctx) {
  const r = play();
  if (!r.opened) {
    const had = record(story.id);
    r.opened = true;
    write();
    beacon("opened", {state: had.state, guesses: had.guesses.length, resumed: kept(story.id)});
  }
  // A hide and the pagehide that follows it say the same thing once, and
  // so does a reload that goes nowhere new (`last` is kept with the play).
  const read = () => {
    const data = {at: ctx.reader.at(), of: steps.length, day: ctx.reader.day(), days: story.days.length, seconds: seconds()};
    const now = JSON.stringify(data);
    if (now === r.last) return;
    r.last = now;
    write();
    beacon("read", data);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { seconds(); since = null; write(); read(); }
    else since = Date.now();
  });
  addEventListener("pagehide", () => { seconds(); write(); read(); });
  ctx.on("end", read);
}

// A team sealed: its ids, the order picked, whether it is the team, and
// which accusation of the play it was.
export const sealed = (team, order, right, nth) => beacon("sealed", {team, order, right, nth});
// The truth opened before the team was named, after `guesses` teams.
export const revealed = guesses => beacon("revealed", {guesses});

// Whether this play has answered the ask, and the answers sent (once). The
// Worker's reply says whether they were kept.
export const answered = () => play().answered;
export async function feedback(answers) {
  const r = await fetch(API + "feedback", {method: "POST", headers: {"content-type": "application/json"},
    body: JSON.stringify({story: story.id, generator: story.generator, play: play().id, ...answers})});
  if (!r.ok && r.status !== 409) throw new Error(`feedback ${r.status}`);
  rec.answered = true;
  write();
}
