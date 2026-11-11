// The library: a button that offers the next case by days from this
// browser's progress (a one-day case until one is solved, then two days,
// then three and more), and under it every story in stories/index.json,
// numbered in its order, labelled with its days and marked from the
// progress (played, solved and in how many accusations, or the truth
// opened), behind a tab for each day count, kept across visits, with a
// button that opens one of the shown stories at random.
import {progress} from "./progress.js";

const GAME = "story/?story=";
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const label = r => r.state === "solved" ? (r.guesses.length === 1 ? "Solved first time" : r.guesses.length ? `Solved in ${r.guesses.length}` : "Solved")
  : r.state === "revealed" ? "Truth opened" : r.guesses.length ? plural(r.guesses.length, "accusation") : "Played";

// Back to this page from a story shows the progress it made.
addEventListener("pageshow", e => { if (e.persisted) location.reload(); });

const {stories} = await (await fetch("../stories/index.json")).json();
const done = progress();

// A tab for each day count the library holds.
const TABS = [...new Set(stories.map(s => s.days))].sort((a, b) => a - b);
const KEPT = "loose-threads-library-days";
let tab = null;
try { tab = Number(localStorage.getItem(KEPT)) || null; } catch { /* storage refused */ }
if (!TABS.includes(tab)) tab = null;

const open = pool => { location.href = GAME + pool[Math.floor(Math.random() * pool.length)].id; };
// A story of the kind not yet played, or any of the kind once all are.
const draw = kind => {
  const all = stories.filter(kind), fresh = all.filter(s => !done[s.id]);
  return fresh.length ? fresh : all;
};

// The next case: the fewest days the player has not yet solved a story of,
// among one day, two days and three or more.
const STEPS = [
  {kind: s => s.days === 1, first: "Play your first case", again: "Another one-day case", line: "A single day in the house."},
  {kind: s => s.days === 2, first: "Ready for two days?", again: "Another two-day case", line: "The culprits get a second night."},
  {kind: s => s.days >= 3, first: "A full mystery: three days", again: "Another full mystery", line: "Three days or more in the house."},
].filter(step => stories.some(step.kind));
const solved_ = step => stories.some(s => step.kind(s) && done[s.id]?.state === "solved");
const played_ = step => stories.some(s => step.kind(s) && done[s.id]);
const step = STEPS.find(st => !solved_(st)) || STEPS[STEPS.length - 1];
const next = document.getElementById("next");
if (step) {
  next.textContent = played_(step) ? step.again : step.first;
  document.getElementById("nextline").textContent = step.line;
  next.onclick = () => open(draw(step.kind));
}

const list = document.getElementById("stories");
const tiles = stories.map((s, i) => {
  const a = document.createElement("a");
  a.href = GAME + s.id;
  a.className = done[s.id]?.state || "";
  a.innerHTML = `<b>${i + 1}</b><span>${plural(s.days, "day")}</span>`;
  if (done[s.id]) a.insertAdjacentHTML("beforeend", `<em>${label(done[s.id])}</em>`);
  const li = document.createElement("li");
  li.append(a);
  list.append(li);
  return li;
});

const left = document.getElementById("left");
function show() {
  const shown = s => !tab || s.days === tab;
  stories.forEach((s, i) => { tiles[i].hidden = !shown(s); });
  const here = stories.filter(shown), fresh = here.filter(s => !done[s.id]);
  left.textContent = fresh.length === here.length ? `${here.length} ${here.length === 1 ? "story" : "stories"}`
    : fresh.length ? `${fresh.length} of ${here.length} not yet played` : "You have played every one of these.";
}
const bar = document.getElementById("tabs");
for (const option of [null, ...TABS]) {
  const b = document.createElement("button");
  b.textContent = option ? plural(option, "day") : "all";
  b.setAttribute("aria-pressed", String(tab === option));
  b.onclick = () => {
    tab = option;
    try { option ? localStorage.setItem(KEPT, option) : localStorage.removeItem(KEPT); } catch { /* the choice lasts this visit */ }
    for (const other of bar.children) other.setAttribute("aria-pressed", String(other === b));
    show();
  };
  bar.append(b);
}
show();
document.getElementById("random").onclick = () => open(draw(s => !tab || s.days === tab));

const ours = stories.map(s => done[s.id]).filter(Boolean);
const solved = ours.filter(r => r.state === "solved"), opened = ours.filter(r => r.state === "revealed");
const first = solved.filter(r => r.guesses.length === 1).length;
const made = ours.reduce((n, r) => n + r.guesses.length, 0);
document.getElementById("tally").textContent = !made && !solved.length && !opened.length ? "" : [
  `Solved ${solved.length} of ${stories.length}${first ? `, ${first} at the first accusation` : ""}.`,
  opened.length ? `The truth opened in ${opened.length} ${opened.length === 1 ? "story" : "stories"}.` : "",
  made ? `${plural(made, "accusation")} made.` : ""].filter(Boolean).join(" ");
