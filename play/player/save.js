// The reading kept per story in this browser, so a reload returns to where
// the player was: how many of the reader's steps were taken, each of her
// underlined words pressed (its place among the log's `button.press` at the
// press, with the step count then), and whether the press that brings her
// challenge into view was made. On load the record is played back with
// transitions off (body.restoring) and the log scrolled at once
// (ctx.restoring, read by a view's settle). A press is kept with its
// button's words, and played back only where the button at that place
// still has them, so an edit to her lines that moves the underlines drops
// the presses and keeps the steps.

const key = id => `berndle:reading:${id}`;

function read(id) {
  try { return JSON.parse(localStorage.getItem(key(id))); } catch { return null; }
}

// Whether a record holds a reading to play back.
const has = r => !!(r?.at || r?.presses?.length);
// Whether a reading of the story is kept.
export const kept = id => has(read(id));

// Forgets a story's reading, for a reading from the start.
export function forget(id) {
  try { localStorage.removeItem(key(id)); } catch { /* storage blocked */ }
}

// Keeps the reading of ctx's story from here on, after playing back what
// was kept. `land()` makes the press that brings her challenge into view,
// at once; "landed" is the event a view's own press of it emits.
export function keep(ctx, land) {
  const {log, reader, story} = ctx;
  const rec = {at: 0, presses: [], landed: false};
  let quiet = false;
  const write = () => {
    if (quiet) return;
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

  const saved = read(story.id);
  if (!has(saved)) return;
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
    // and the blocks shown in the playback appear without fading in.
    for (const n of log.querySelectorAll(".shake")) n.classList.remove("shake");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.body.classList.remove("restoring");
      ctx.restoring = false;
    }));
  }
}
