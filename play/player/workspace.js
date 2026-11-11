// The player's workspace, which the game view mounts over its strip:
//   Veronique tells the rules in play (rules-play.js): her opening, her
//     house and her own lines carry underlined words, each bringing a
//     caption of hers that says more; the Rules card is rules-play's.
//   The dock holds the workspace's tools: Rules and House (the plain map)
//     open in the one card, and Notes (the player's page) in a pane of its
//     own beside it; N, R and H open the three, Esc closes the card, then
//     the notes. The dock's height is the root's --dock.
//   A guest's name in the log, said in a line or standing over an account,
//     opens their dossier in the card, and so does their head in the table
//     of marks.
//   A line of an account takes the colour of its speaker's mark for that
//     day, or of their culprit mark where the day has none. The marks are
//     set beside each account (story.js), and stand as a table over her
//     challenge.
//   Before the challenge she closes the rules, and the accusation follows
//     it in the log, the cast in two rows; continue moves up to follow the
//     last turn, and its press brings the challenge into view.
// The view supplies a context (context.js) with beats, next, settle and
// tools set, and its log holding #pop for the map. Opening or closing a
// card emits "card" (the key open, or null).

import {houseOnDemand} from "../reader.js";
import {rulesInPlay} from "./rules-play.js";
import {mark} from "../progress.js";
import {keep} from "./save.js";
import {start as signals} from "../signals.js";

export function mount(ctx) {
  const {el, log, names, story, tools: t} = ctx;
  // The site is told of the play (signals.js), with what this browser had
  // done with the story before; then the library marks it played, and the
  // accusation records the rest.
  signals(ctx);
  mark(story.id);
  document.body.classList.add("workspace", "marking");
  const next = ctx.next;

  // At the end, the press after the last turn brings her challenge into
  // view: the step that tells the last turn stops at its panel's top.
  let landing = null;
  function land() {
    const top = landing.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop;
    log.scrollTo({top: top - innerHeight * 0.12, behavior: ctx.restoring ? "instant" : "smooth"});
    landing = null;
    next.disabled = true;
    ctx.emit("landed");
  }
  const take = e => {
    if (!landing) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    land();
  };
  next.addEventListener("click", take, true);
  addEventListener("keydown", e => {
    if ([" ", "Enter", "ArrowRight"].includes(e.key) && !e.target.closest?.("textarea, input, select")) take(e);
  }, true);
  // The lines of an account carry the speaker's mark for the account's
  // day, or "culprit" where they are marked so and the day has no mark
  // (data-auto).
  function lines(entry) {
    if (!entry.classList.contains("account")) return;
    entry.querySelectorAll(".line").forEach(line => {
      const draw = () => { const who = entry.dataset.speaker; line.dataset.auto = t.markOf(+entry.dataset.day, who) || (t.culprit(who) ? "culprit" : ""); };
      t.watchers.push(draw);
      draw();
    });
  }
  ctx.on("entry", lines);

  // The dock: Notes, Rules and House are the tools.
  // On a narrow screen the card is a modal over a scrim that closes it.
  const dock = el("nav", {class: "dock"}), card = el("aside", {class: "dossier"}), scrim = el("div", {class: "scrim"});
  scrim.onclick = () => show(open);
  const ends = el("div", {class: "ends"});
  dock.append(ends);
  let open = null;
  const pop = document.getElementById("pop"), home = pop.parentElement;
  function show(key, build) {
    if (card.contains(pop)) home.append(pop);
    open = open === key ? null : key;
    document.body.classList.toggle("carded", !!open);
    dock.querySelectorAll("[data-key]").forEach(b => b.classList.toggle("on", b.dataset.key === open));
    ctx.emit("card", open);
    if (!open) return;
    const close = el("button", {class: "close", title: "Close (Esc)"}, "×");
    close.onclick = () => show(open);
    card.replaceChildren(close, build());
  }
  addEventListener("keydown", e => {
    if (e.key === "Escape") { if (open) show(open); else if (noting) toggleNotes(); }
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.("textarea, input, select")) return;
    const k = e.key.toLowerCase();
    if (k === "n") { e.preventDefault(); toggleNotes(); }
    if (k === "r") show("rules", rulesCard);
  });
  const tool = (key, label, build) => {
    const b = el("button", {class: "end", "data-key": key}, label);
    b.onclick = () => show(key, build);
    ends.append(b);
    return b;
  };
  const notesBtn = el("button", {class: "end"}, "Notes");
  notesBtn.onclick = () => toggleNotes();
  ends.append(notesBtn);
  const teacher = rulesInPlay(ctx);
  const rulesCard = () => el("div", {}, el("h3", {}, "The rules"), ...teacher.card());
  tool("rules", "Rules", rulesCard);
  // The button under a caption of a rule opens the card (rules-play.js).
  ctx.on("rules", () => { if (open !== "rules") show("rules", rulesCard); });
  // The house is the plain map, moved into the card while it is open; it
  // lights no route, since every account carries its own map (story.js).
  // A guest's name in the log, or their head in the table of marks, opens
  // their dossier, by tap or click alike.
  const houseCard = () => el("div", {class: "housecard"}, el("h3", {}, "The house"), pop);
  const houseBtn = tool("house", "House", houseCard);
  houseOnDemand(houseBtn, () => show("house", houseCard));
  log.addEventListener("click", e => {
    const id = e.target.closest(".guest-name, .speaker, .marktable .mh")?.dataset.id;
    if (t.guests.includes(id) && open !== id) show(id, () => dossier(id));
  });
  // Back to the library, to pick another story.
  const back = el("button", {class: "end"}, "Library");
  back.onclick = () => { location.href = "./"; };
  ends.append(back);
  document.body.append(card);
  document.body.append(scrim, dock);
  ctx.foot = () => dock.offsetHeight + (noting && !SIDE.matches ? pane.offsetHeight : 0);
  new ResizeObserver(() => document.documentElement.style.setProperty("--dock", `${dock.offsetHeight}px`)).observe(dock);

  // An open dossier is rebuilt after each step, where it was scrolled to.
  ctx.on("step", () => {
    if (!open || !t.guests.includes(open)) return;
    const at = card.scrollTop;
    card.replaceChildren(card.firstChild, dossier(open));
    card.scrollTop = at;
  });

  // A guest's dossier: their head, name, pronouns and state on one line,
  // then what they have said.
  function dossier(id) {
    const d = t.examined(id), pron = story.cast.find(c => c.id === id).pronouns;
    const top = el("div", {class: "top"}, t.head(id),
      el("h3", {}, names[id], el("small", {}, ` ${pron}`)),
      el("span", {class: `status ${d ? "examined" : "alive"}`}, d ? `Examined on day ${d}` : "Alive"));
    return el("div", {class: "file"}, top, ...told(id));
  }
  // What they have said and the charges they made or met, a day at a
  // time in the order the story told them, each leading back to its place.
  function told(id) {
    const days = [];
    for (const b of ctx.beats) {
      const by = b.turn.speaker, charge = b.turn.kind === "charge";
      if (by !== id && !(charge && b.turn.against.includes(id))) continue;
      const go = () => t.scrollTo(b.anchor || b.entry);
      if (charge) {
        const cite = by === id ? `charged ${b.turn.against.map(a => names[a]).join(" and ")}` : `charged by ${names[by]}`;
        add(b.day, el("div", {class: `charge ${by === id ? "made" : "against"}`}, el("span", {class: "by"}, cite),
          el("p", {class: "shout"}, b.turn.lines.map(l => l.text).join(" "))), go);
      }
      if (by === id) for (const p of b.parts.filter(p => p.classList.contains("account") || p.classList.contains("defence"))) add(b.day, p.querySelector(".text").cloneNode(true), go);
    }
    function add(day, node, go) {
      if (days.at(-1)?.day !== day) days.push({day, q: el("blockquote", {class: "said"}, el("cite", {}, `Day ${day}`))});
      node.onclick = go;
      days.at(-1).q.append(node);
    }
    return days.length ? days.map(d => d.q) : [el("h4", {}, "They have given no account yet")];
  }
  // Notes: a pane of its own, open beside any card (the user, 6 November
  // 2026: notes and the other cards "mutually exclusive" was friction). At
  // 1100px wide or more it is a column at the right edge and the view keeps
  // its story and card left of it (--notes-w); narrower, a strip over the
  // dock with the card above it (--notes-h), and below 800px a card is a
  // modal over both. The pane's inner edge drags its size, kept across
  // stories. It holds the player's page.
  const SIDE = matchMedia("(min-width: 1100px)"), SIZE = "berndle-notes-size";
  let size = {};
  try { size = JSON.parse(localStorage.getItem(SIZE) || "{}"); } catch { /* storage blocked: the default size */ }
  const clamp = (v, lo, hi) => Math.round(Math.min(Math.max(v, lo), hi));
  function fit() {
    const root = document.documentElement.style;
    root.setProperty("--notes-w", `${clamp(size.w || 340, 240, innerWidth * 0.5)}px`);
    root.setProperty("--notes-h", `${clamp(size.h || 240, 110, innerHeight * 0.6)}px`);
    document.body.classList.toggle("notes-side", SIDE.matches);
  }
  addEventListener("resize", fit);
  fit();
  const grip = el("div", {class: "grip", title: "Drag to resize"});
  grip.onpointerdown = e => {
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    grip.onpointermove = m => {
      if (SIDE.matches) size.w = clamp(innerWidth - m.clientX, 240, innerWidth * 0.5);
      else size.h = clamp(innerHeight - dock.offsetHeight - m.clientY, 110, innerHeight * 0.6);
      fit();
    };
    grip.onpointerup = grip.onpointercancel = () => {
      grip.onpointermove = grip.onpointerup = grip.onpointercancel = null;
      try { localStorage.setItem(SIZE, JSON.stringify(size)); } catch { /* storage blocked */ }
    };
  };
  const closeNotes = el("button", {class: "close", title: "Close (Esc)"}, "×");
  closeNotes.onclick = () => toggleNotes();
  const page = t.page();
  const pane = el("aside", {class: "notes-pane"}, grip, el("div", {class: "bar"}, el("span", {}, "Notes"), closeNotes), page);
  document.body.append(pane);
  let noting = false;
  function toggleNotes() {
    noting = !noting;
    document.body.classList.toggle("noting", noting);
    notesBtn.classList.toggle("on", noting);
    if (noting) page.focus();
    else if (pane.contains(document.activeElement)) document.activeElement.blur();
  }
  // Her reminder, then the accusation after her challenge, in two rows.
  ctx.on("end", entry => {
    const remind = el("div", {class: "entry narrator"}, el("div", {class: "who"}, "Veronique"),
      el("div", {class: "text"}));
    entry.before(remind, t.markTable());
    teacher.closing(remind);
    // Continue follows the last turn, above her bow's picture where a view
    // draws one (the beat's anchor).
    (ctx.beats.at(-1).anchor || remind).before(next);
    landing = entry;
    // The reader disables continue after this event; it stays for the press,
    // brought into view once it is back.
    setTimeout(() => { if (landing) { next.disabled = false; next.scrollIntoView({block: "center", behavior: "smooth"}); } });
    entry.after(el("section", {class: "finale"}, t.accusation()));
  });

  // The reading is kept and, on a reload, played back to where it was.
  keep(ctx, () => { if (landing) land(); });
}
