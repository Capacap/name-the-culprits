// Veronique's ask once a story is over: how it fitted (three steps), which
// of its guests the player would see again (a heart on each), and anything
// else, every part optional and sent once per play (signals.js). It is her
// panel at the end of the accusation (tools.js), built from the helpers it
// is handed, since they are closures of tools(ctx).

import {answered, feedback} from "../signals.js";
import {STEPS} from "./steps.js";

// `rec` is the play's progress record (state, guesses); `h` the helpers:
// el, caption, line and pick(), a row of the story's guests as tiles.
export function ask(rec, h) {
  const {el, caption, line, pick} = h;
  const box = el("div", {class: "herpanel ask"});
  if (answered()) return box;
  let difficulty = null;
  const hearts = new Set();
  const steps = el("div", {class: "steps"});
  STEPS.forEach((label, i) => {
    const b = el("button", {class: "mk"}, label);
    b.onclick = () => {
      difficulty = difficulty === i + 1 ? null : i + 1;
      steps.querySelectorAll(".mk").forEach((x, k) => x.classList.toggle("on", difficulty === k + 1));
    };
    steps.append(b);
  });
  const row = pick();
  for (const b of row.querySelectorAll(".who")) {
    const id = b.dataset.id;
    b.onclick = () => { hearts.has(id) ? hearts.delete(id) : hearts.add(id); b.classList.toggle("on", hearts.has(id)); };
  }
  const text = el("textarea", {class: "page", placeholder: "Anything at all", rows: 3});
  const send = el("button", {class: "sendbtn"}, "Leave it with her");
  const said = el("div", {class: "said"});
  send.onclick = async () => {
    send.disabled = true;
    try {
      await feedback({difficulty, hearts: [...hearts], text: text.value.trim(), state: rec.state, guesses: rec.guesses.length});
      box.replaceChildren(caption(line("Noted. Back to work.")));
    } catch {
      said.replaceChildren(caption(line("That did not reach me. Try once more.")));
      send.disabled = false;
    }
  };
  box.append(
    caption(line("Before you go, a word for the record."), line("How did this one fit you?")), steps,
    caption(line("Any of them you would see again?")), row,
    caption(line("Anything else?")), text,
    send, said);
  return box;
}
