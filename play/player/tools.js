// The game's tools, which the workspace (workspace.js) presents: each
// guest's standing, the player's notes, and the accusation. Built from the
// story file alone, the accusation checked by `check`. A wrong team's verdict, Veronique's reason it cannot be the team,
// is in the story file under the same hash as `check`, sealed with that
// team's own ids (`verdictOf`), so a wrong guess never fetches the answer.
// The answer file is fetched once the team is named or the truth opened:
// her word on the teams that came closest, then the truth itself.

import {cutout, icon, framed, zoom} from "../cast.js";
import {STORY} from "../shared.js";
import {record, guess, reveal, finished} from "../progress.js";
import {forget} from "./save.js";
import {sealed, revealed, forgetPlay} from "../signals.js";
import {ask} from "./feedback.js";

export function tools(ctx) {
  const {story, names, el, mark} = ctx;
  const guests = story.cast.map(c => c.id);

  // A guest's standing in what has been read: the day their body was
  // examined, or 0.
  function examined(id) {
    const b = ctx.beats.find(b => b.turn.kind === "examination" && (b.turn.bodies || []).includes(id));
    return b ? b.day : 0;
  }
  // The player's notes, kept per story: for each day a mark per guest
  // (`day`, suspect or cleared), the guests marked culprit for the whole
  // story (`culprit`), and a page of their own. Notes kept by earlier
  // versions also hold one mark per guest for the whole story (`guest`), a
  // memo per guest and marks on lines, which nothing reads now and are
  // written back as found.
  const KEY = `berndle-notes-${STORY}`;
  let kept = {};
  try { kept = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { /* storage blocked: notes last the visit */ }
  const notes = {day: {}, culprit: [], page: "", ...kept};
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch { /* storage blocked */ } };
  const watchers = [];
  // A watcher returning false is gone (its card was rebuilt) and is dropped.
  function save() {
    keep();
    for (const f of [...watchers]) if (f() === false) watchers.splice(watchers.indexOf(f), 1);
  }
  const MARKS = ["cleared", "suspect"];
  // A guest's mark on a day ("" for none), and whether the player marked
  // them a culprit, which holds on every day.
  const markOf = (day, id) => notes.day[day]?.[id] || "";
  const culprit = id => notes.culprit.includes(id);

  // A guest's marks beside an account of theirs: cleared and suspect for
  // that day, and culprit, set apart, for the whole story.
  function markChips(day, id) {
    const box = el("span", {class: "marks"});
    for (const m of MARKS) {
      const b = el("button", {class: `mk ${m}`, "data-mark": m}, m);
      b.onclick = e => { e.stopPropagation(); (notes.day[day] ||= {})[id] = markOf(day, id) === m ? undefined : m; save(); };
      box.append(b);
    }
    const c = el("button", {class: "mk culprit", title: "For the whole story"}, "culprit");
    c.onclick = e => { e.stopPropagation(); notes.culprit = culprit(id) ? notes.culprit.filter(x => x !== id) : [...notes.culprit, id]; save(); };
    box.append(c);
    const draw = () => {
      box.querySelectorAll("[data-mark]").forEach(b => b.classList.toggle("on", markOf(day, id) === b.dataset.mark));
      c.classList.toggle("on", culprit(id));
    };
    watchers.push(draw);
    draw();
    return box;
  }
  // The player's marks to read before the accusation: a column for each
  // guest under their head, a row for each day, an examined guest's head
  // greyed. It shows nothing while no mark is set. A head opens the
  // guest's card (workspace.js).
  function markTable() {
    const days = story.days.length;
    const grid = el("div", {class: "grid"});
    grid.style.gridTemplateColumns = `auto repeat(${guests.length}, 1fr)`;
    grid.append(el("span", {}), ...guests.map(id => el("button", {class: "mh", "data-id": id}, head(id), el("span", {}, names[id]))));
    const cells = [];
    for (let d = 1; d <= days; d++) {
      grid.append(el("b", {class: "md"}, `Day ${d}`));
      for (const id of guests) { const c = el("i", {class: "cell"}); cells.push([c, d, id]); grid.append(c); }
    }
    const box = el("section", {class: "marktable"}, el("p", {}, "Your marks, day by day."), grid);
    const draw = () => {
      for (const [c, d, id] of cells) { const m = markOf(d, id); c.dataset.mark = m; c.dataset.short = m ? m[0].toUpperCase() : ""; c.textContent = m || "\u2013"; }
      for (const h of grid.querySelectorAll(".mh")) { h.classList.toggle("culprit", culprit(h.dataset.id)); h.classList.toggle("dead", !!examined(h.dataset.id)); }
      box.hidden = !notes.culprit.length && !cells.some(([c]) => c.dataset.mark);
    };
    watchers.push(draw);
    draw();
    return box;
  }
  function page() {
    const t = el("textarea", {class: "page", placeholder: "Your notes"});
    t.value = notes.page;
    t.oninput = () => { notes.page = t.value; keep(); };
    return t;
  }
  const head = id => el("img", {class: "head", src: icon(id), alt: ""});
  const scrollTo = node => node.scrollIntoView({behavior: "smooth", block: "center"});
  // A row of the guests as tiles to pick from, their figures and names in
  // two lines of equal length, for the accusation and her ask.
  const tile = id => el("button", {class: "who", "data-id": id}, el("img", {class: "head", src: cutout(id), alt: ""}), el("span", {}, names[id]));
  function pick(ids) {
    const row = el("div", {class: "pick"});
    row.style.gridTemplateColumns = `repeat(${Math.ceil(ids.length / 2)}, 1fr)`;
    row.append(...ids.map(tile));
    return row;
  }

  // The accusation: pick up to largest_team guests, seal it, and the story's
  // check says whether it is the team. Every guest may be picked, the
  // examined too, since a culprit may play dead. Each sealed team is kept
  // (play/progress.js) and answered by Veronique in a panel of her own, the
  // panels in the order sealed (`panels`); a team already named cannot be
  // sealed again. Once a team is sealed the truth may be opened; the
  // accusation closes when the team is named or the truth is opened, and on
  // a reload it is drawn as it was left.
  function accusation() {
    const box = el("div", {class: "accuse"});
    const picked = new Set();
    const row = pick(guests);
    const seal = el("button", {class: "sealbtn", disabled: ""}, "Seal the accusation");
    const say = el("div", {class: "verdict"}), past = el("div", {class: "sealed"}), after = el("div", {class: "after"});
    const n = story.largest_team;
    let rec = record(story.id);
    const same = (a, b) => a.length === b.length && a.every((x, k) => x === b[k]);
    box.append(row, seal, say, past, after);
    for (const b of row.querySelectorAll(".who")) {
      const id = b.dataset.id;
      b.onclick = () => {
        if (finished(rec)) return;
        if (picked.has(id)) picked.delete(id);
        else { if (picked.size >= n) picked.delete([...picked][0]); picked.add(id); }
        row.querySelectorAll(".who").forEach(x => x.classList.toggle("on", picked.has(x.dataset.id)));
        say.replaceChildren(...(sealable() === "again" ? [el("p", {class: "again"}, "You have named this team already.")] : []));
      };
    }
    const draw = () => row.querySelectorAll(".who").forEach(x => { x.classList.toggle("dead", !!examined(x.dataset.id)); x.classList.toggle("culprit", culprit(x.dataset.id)); });
    watchers.push(draw);
    ctx.on("step", draw);
    draw();
    // Whether the picks may be sealed: false while none are picked or a
    // seal is being checked, "again" for a team already sealed. Sets the
    // seal button.
    let sealing = false;
    function sealable() {
      const again = rec.guesses.some(g => same(g, [...picked].sort()));
      const ok = picked.size && !sealing && !again && !finished(rec);
      seal.disabled = !ok;
      return again ? "again" : !!ok;
    }
    // Her panels for the guesses not yet answered, then, once the truth is
    // opened, the truth's and her ask (feedback.js). A story solved before
    // guesses were counted has the right panel alone.
    let shown = 0, opened = false;
    function panels() {
      const g = rec.guesses;
      for (; shown < g.length; shown++) {
        const right = rec.state === "solved" && shown === g.length - 1;
        past.append(panel(g[shown], right ? "right" : "wrong"));
      }
      if (opened) return;
      if (rec.state === "revealed") { opened = true; past.append(panel(null, "revealed")); }
      else if (rec.state === "solved" && !g.length) { opened = true; past.append(panel(null, "right")); }
      if (finished(rec)) { opened = true; past.append(ask(rec, {el, caption, line, pick: () => pick(guests)})); }
    }
    // The accusation's state: closed once finished; before that, after a
    // guess, the truth may be opened.
    function drawn() {
      const closed = finished(rec);
      box.classList.toggle("closed", closed);
      seal.hidden = closed;
      if (closed) row.querySelectorAll(".who").forEach(x => x.classList.toggle("on", rec.state === "solved" && !!rec.guesses.at(-1)?.includes(x.dataset.id)));
      panels();
      const again = el("a", {href: "#"}, "Read it again from the start");
      // The reading and the play go together; the next load is a new play.
      again.onclick = e => { e.preventDefault(); forget(story.id); forgetPlay(story.id); location.reload(); };
      const onward = el("p", {class: "onward"}, el("a", {href: "../"}, "Play another story"), " \u00b7 ", again);
      if (closed) return after.replaceChildren(onward);
      if (!rec.guesses.length) return after.replaceChildren();
      const open = el("button", {class: "opentruth"}, "Open the truth");
      open.onclick = () => { if (!finished(rec)) { rec = reveal(story.id); revealed(rec.guesses.length); drawn(); } };
      after.replaceChildren(open, onward);
    }
    seal.onclick = async () => {
      if (sealable() !== true) return;
      const order = [...picked], team = [...order].sort();
      sealing = true;
      sealable();
      const right = await check(team);
      sealing = false;
      // The truth opened while the check ran closes the accusation first.
      if (finished(rec)) { sealable(); return; }
      rec = guess(story.id, team, right);
      sealed(team, order, right, rec.guesses.length);
      say.replaceChildren();
      sealable();
      drawn();
      past.lastElementChild?.scrollIntoView({block: "nearest", behavior: "smooth"});
    };
    drawn();
    return box;
  }

  // Her caption, as her lines are in the log, and one line of it.
  const caption = (...lines) => el("div", {class: "entry narrator answer"},
    el("div", {class: "who"}, "Veronique"), el("div", {class: "text"}, ...lines));
  const line = (...parts) => el("span", {class: "line"}, ...parts.map(p => typeof p === "string" ? mark(p, story) : p));
  // Her word that, pressed once, puts `more()`'s captions at the end of
  // its panel.
  function press(word, more) {
    const b = el("button", {class: "press"}, word);
    b.onclick = e => {
      e.stopPropagation();
      if (b.classList.contains("asked")) return;
      b.classList.add("asked");
      const added = more();
      b.closest(".herpanel").append(...added);
      added[0]?.scrollIntoView({block: "nearest", behavior: "smooth"});
    };
    return b;
  }
  const POSSESSIVE = {she: "her", he: "his", they: "their"};
  // A line of a guest's account, quoted; quotes in a row read as one.
  const quote = t => { const q = line(`\u201c${t}\u201d`); q.classList.add("quote"); return q; };

  // Her panel on a sealed team ("wrong", "right") or on the truth opened
  // without it ("revealed", team null). A wrong team's panel says why it
  // fails; the truth's names the culprits, with their lies and the wrong
  // teams that came closest behind pressed words, then tells each day. Its
  // lines come as they load; a failed load says so.
  function panel(team, how) {
    const box = el("div", {class: `herpanel ${how}`});
    // She smiles at a team seen through, framed as the story's panels frame
    // her (story.css .panel.bow: the top of the figure, faded at the sides).
    if (how === "right") {
      const her = el("img", {class: "fig", src: framed("narrator", "smile"), alt: ""});
      her.style.cssText = zoom("narrator");
      box.append(el("figure", {class: "panel bow"}, her));
    }
    const title = team ? el("span", {class: "line call"}, how === "right" ? "You saw through it!"
      : `${listOf(team)} ${team.length > 1 ? "are" : "is"} not the team.`) : null;
    const first = caption(...(title ? [title] : []));
    box.append(first);
    // A failed fetch, or a file this view cannot read, says so.
    const failed = () => first.querySelector(".text").append(line("The rest did not load. Reload the page to try once more."));
    if (how === "wrong") {
      verdictOf(team).then(lines => first.querySelector(".text").append(...(lines || []).map(t => line(t)))).catch(failed);
      return box;
    }
    answer().then(a => {
      const {team: culprits, told: {days, lies}, rivals} = a;
      const who = listOf(culprits), two = culprits.length > 1;
      const pron = story.cast.find(c => c.id === culprits[0]).pronouns.split("/")[0];
      const poss = two ? "their" : POSSESSIVE[pron] || "their";
      const liesWord = () => press(lies.length > 1 ? "lies" : "lie", () => lies.map(l => caption(
        line(`On the ${ORDINAL[l.day - 1]} day ${names[l.speaker]} told you:`),
        ...l.said.map(quote),
        line("What was true:"),
        ...l.truth.map(quote))));
      const others = () => rivals.length ? press("other set of culprits", () => rivals.map(r => caption(...r.lines.map(t => line(t)))))
        : "other set of culprits";
      const named = `${who} ${two ? "were the culprits" : "was the culprit"}`;
      const text = first.querySelector(".text");
      if (how === "right") text.append(lies.length
        ? line(`${named}, ${poss} `, liesWord(), ` did not escape you. No `, others(), " fit.")
        : line(`${named}. No `, others(), " fit."));
      else text.append(line(`${named}.`), lies.length
        ? line(`You may see ${poss} `, liesWord(), ", and why no ", others(), " fit.")
        : line("You may see why no ", others(), " fit."));
      for (const d of days) text.append(line(el("span", {class: "daytitle"}, d.title), ...d.lines.map(t => ` ${t}`)));
    }).catch(failed);
    return box;
  }
  // Names in alphabetical order, as her lines give a team.
  const listOf = team => team.map(id => names[id]).sort((a, b) => a < b ? -1 : a > b).join(" and ");

  // A failed fetch is forgotten, so the next call tries again.
  let answered = null;
  const answer = () => answered ||= fetch(`../../stories/${STORY}.answer.json`)
    .then(r => { if (!r.ok) throw new Error(`answer ${r.status}`); return r.json(); })
    .catch(e => { answered = null; throw e; });

  // A team's seed: the story id and its sorted ids, which the check hash and
  // every seal are built from (FORMAT.md).
  const seedOf = team => `${story.id}\n${[...team].sort().join(",")}`;
  const sha = async s => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const hex = b => [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  // A wrong team's verdict: the story's `verdicts` entry under the team's
  // hash, its bytes XORed with SHA-256 blocks of the seed and a counter
  // (FORMAT.md, "Verdicts"). Null for the team, which has none.
  async function verdictOf(team) {
    const seed = seedOf(team);
    const sealed = story.verdicts?.[hex(await sha(seed))];
    if (typeof sealed !== "string") return null;
    const bytes = Uint8Array.from(atob(sealed), c => c.charCodeAt(0));
    for (let k = 0; k * 32 < bytes.length; k++) {
      const pad = await sha(`${seed}\nverdict\n${k}`);
      for (let j = 0; j < 32 && k * 32 + j < bytes.length; j++) bytes[k * 32 + j] ^= pad[j];
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  const ORDINAL = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh"];
  const check = async team => hex(await sha(seedOf(team))) === story.check;

  return {guests, examined, notes, save, watchers, markOf, culprit, markChips, markTable, page, head, scrollTo, accusation};
}
