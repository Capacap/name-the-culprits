// The library: every story in stories/index.json, numbered in its order
// and labelled with its days, guests and difficulty, each marked from this
// browser's progress (played, solved and in how many accusations, or the
// truth opened), a count of the finished stories and the accusations made,
// two rows of filters (length and difficulty, kept across visits) and a
// button that opens one of the shown stories not yet played at random.
import {progress} from "./progress.js";

const GAME = "story/?story=";
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const label = r => r.state === "solved" ? (r.guesses.length === 1 ? "Solved first time" : r.guesses.length ? `Solved in ${r.guesses.length}` : "Solved")
  : r.state === "revealed" ? "Truth opened" : r.guesses.length ? plural(r.guesses.length, "accusation") : "Played";

// Back to this page from a story shows the progress it made.
addEventListener("pageshow", e => { if (e.persisted) location.reload(); });

const {stories} = await (await fetch("../stories/index.json")).json();
const done = progress();

// A short story tells one or two days.
const length = s => s.days <= 2 ? "short" : "long";
const FILTERS = [
  {key: "length", of: length, options: ["short", "long"]},
  {key: "difficulty", of: s => s.difficulty, options: ["easy", "medium", "hard"]},
];
const KEPT = "loose-threads-library-filters";
let chosen = {};
try { chosen = JSON.parse(localStorage.getItem(KEPT)) || {}; } catch { /* a first visit, or storage refused */ }
for (const f of FILTERS) if (!f.options.includes(chosen[f.key])) delete chosen[f.key];
const shown = s => FILTERS.every(f => !chosen[f.key] || f.of(s) === chosen[f.key]);

const list = document.getElementById("stories");
const tiles = stories.map((s, i) => {
  const a = document.createElement("a");
  a.href = GAME + s.id;
  a.className = done[s.id]?.state || "";
  a.innerHTML = `<b>${i + 1}</b><span>${plural(s.days, "day")}<br>${s.cast} guests</span>`;
  if (s.difficulty) a.insertAdjacentHTML("beforeend", `<i class="${s.difficulty}">${s.difficulty}</i>`);
  if (done[s.id]) a.insertAdjacentHTML("beforeend", `<em>${label(done[s.id])}</em>`);
  const li = document.createElement("li");
  li.append(a);
  list.append(li);
  return li;
});

const button = document.getElementById("random");
const left = document.getElementById("left");
let pool = stories;
function show() {
  const here = stories.filter(shown);
  stories.forEach((s, i) => { tiles[i].hidden = !shown(s); });
  const fresh = here.filter(s => !done[s.id]);
  const all = here.length === stories.length;
  left.textContent = !here.length ? "No story fits both choices."
    : !fresh.length ? (all ? "You have played every story." : "You have played every story shown.")
    : all && fresh.length === stories.length ? ""
    : `${fresh.length} of ${here.length} not yet played`;
  pool = fresh.length ? fresh : here;
  button.disabled = !pool.length;
}
const bar = document.getElementById("filters");
for (const f of FILTERS) {
  const row = document.createElement("div");
  for (const option of [null, ...f.options]) {
    const b = document.createElement("button");
    b.textContent = option || "all";
    if (!option) b.setAttribute("aria-label", `any ${f.key}`);
    b.setAttribute("aria-pressed", String((chosen[f.key] || null) === option));
    b.onclick = () => {
      if (option) chosen[f.key] = option; else delete chosen[f.key];
      try { localStorage.setItem(KEPT, JSON.stringify(chosen)); } catch { /* the choice lasts this visit */ }
      for (const other of row.children) other.setAttribute("aria-pressed", String(other === b));
      show();
    };
    row.append(b);
  }
  bar.append(row);
}
show();

const ours = stories.map(s => done[s.id]).filter(Boolean);
const solved = ours.filter(r => r.state === "solved"), opened = ours.filter(r => r.state === "revealed");
const first = solved.filter(r => r.guesses.length === 1).length;
const made = ours.reduce((n, r) => n + r.guesses.length, 0);
document.getElementById("tally").textContent = !made && !solved.length && !opened.length ? "" : [
  `Solved ${solved.length} of ${stories.length}${first ? `, ${first} at the first accusation` : ""}.`,
  opened.length ? `The truth opened in ${opened.length} ${opened.length === 1 ? "story" : "stories"}.` : "",
  made ? `${plural(made, "accusation")} made.` : ""].filter(Boolean).join(" ");
button.onclick = () => { location.href = GAME + pool[Math.floor(Math.random() * pool.length)].id; };
