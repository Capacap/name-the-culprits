// The library: every story in stories/index.json, numbered in its order
// and labelled with its days and guests, each marked from this browser's progress (played, solved and in how many
// accusations, or the truth opened), a count of the finished stories and
// the accusations made, and a button that opens one not yet played at
// random.
import {progress} from "./progress.js";

const GAME = "story/?story=";
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const label = r => r.state === "solved" ? (r.guesses.length === 1 ? "Solved first time" : r.guesses.length ? `Solved in ${r.guesses.length}` : "Solved")
  : r.state === "revealed" ? "Truth opened" : r.guesses.length ? plural(r.guesses.length, "accusation") : "Played";

// Back to this page from a story shows the progress it made.
addEventListener("pageshow", e => { if (e.persisted) location.reload(); });

const {stories} = await (await fetch("../stories/index.json")).json();
const done = progress();
const list = document.getElementById("stories");
stories.forEach((s, i) => {
  const a = document.createElement("a");
  a.href = GAME + s.id;
  a.className = done[s.id]?.state || "";
  a.innerHTML = `<b>${i + 1}</b><span>${plural(s.days, "day")}<br>${s.cast} guests</span>`;
  if (done[s.id]) a.insertAdjacentHTML("beforeend", `<em>${label(done[s.id])}</em>`);
  const li = document.createElement("li");
  li.append(a);
  list.append(li);
});

const fresh = stories.filter(s => !done[s.id]);
const button = document.getElementById("random");
document.getElementById("left").textContent = fresh.length === stories.length ? ""
  : fresh.length ? `${fresh.length} of ${stories.length} not yet played` : "You have played every story.";
const ours = stories.map(s => done[s.id]).filter(Boolean);
const solved = ours.filter(r => r.state === "solved"), opened = ours.filter(r => r.state === "revealed");
const first = solved.filter(r => r.guesses.length === 1).length;
const made = ours.reduce((n, r) => n + r.guesses.length, 0);
document.getElementById("tally").textContent = !made && !solved.length && !opened.length ? "" : [
  `Solved ${solved.length} of ${stories.length}${first ? `, ${first} at the first accusation` : ""}.`,
  opened.length ? `The truth opened in ${opened.length} ${opened.length === 1 ? "story" : "stories"}.` : "",
  made ? `${plural(made, "accusation")} made.` : ""].filter(Boolean).join(" ");
const pool = fresh.length ? fresh : stories;
button.onclick = () => { location.href = GAME + pool[Math.floor(Math.random() * pool.length)].id; };
