// What the game view and the player share around the reader: the bus they
// talk through, and what happens to each entry as it is told.
//   on(name, f) / emit(name, ...): the events "entry" (an entry told,
//     with the turn it tells), "step" (after each step), "day" (a day's
//     title), "end" (the challenge's entry), and the workspace's "card".
//   begin(b): a new beat; add(beat, entry, turn): a turn continuing the
//     beat's speaker, true for an account that answers a charge. Both set
//     the entry's speaker as data-speaker and its slot signs (none on the dawn's question and its answers, the
//     user's word of 7 November 2026), and emit "entry".
//   isChallenge(b): the beat of her closing challenge, which the reader
//     marks.
// The view sets beats, next, settle and reader once its reader exists.

import {slotted, disputed} from "./text.js";

export function context(base) {
  const ctx = {...base, beats: null, listeners: {}, foot: () => 0,
    on(name, f) { (ctx.listeners[name] ||= []).push(f); },
    emit(name, ...a) { for (const f of ctx.listeners[name] || []) f(...a); },
    number(entry, speaker, turn) { entry.dataset.speaker = speaker; slotted(entry, turn?.kind !== "defence"); ctx.emit("entry", entry, turn); },
    begin(b) { b.parts = [b.entry]; ctx.number(b.entry, b.turn.speaker, b.turn); },
    add(beat, entry, turn) {
      beat?.parts.push(entry);
      ctx.number(entry, turn.speaker, turn);
      const answer = beat?.turn.kind === "charge" && turn.kind === "account";
      if (answer) disputed(ctx.beats, beat, entry);
      return answer;
    },
    isChallenge: b => !!b.turn.challenge,
  };
  return ctx;
}
