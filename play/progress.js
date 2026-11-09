// What this browser has done with each story, kept in localStorage so the
// library can mark it and pick an unplayed one at random:
//   {state, guesses}, where state is "played" (opened), "solved" (the team
//   named) or "revealed" (the truth opened before the team was named), and
//   guesses every team sealed, in order, each a sorted list of ids.
// A story is finished once solved or revealed; its accusation is then
// closed. An entry kept before guesses were counted is a bare state string.
const KEY = "berndle:progress";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function store(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode: nothing kept */ }
}
const entry = v => typeof v === "string" ? {state: v, guesses: []} : {state: "played", guesses: [], ...v};

// Every story's record, by id.
export function progress() {
  return Object.fromEntries(Object.entries(load()).map(([id, v]) => [id, entry(v)]));
}

// One story's record; an unopened story's has no state.
export function record(id) {
  const v = load()[id];
  return v ? entry(v) : {state: null, guesses: []};
}

function update(id, f) {
  const all = load();
  all[id] = entry(all[id] || {});
  f(all[id]);
  store(all);
  return all[id];
}

export const finished = r => r.state === "solved" || r.state === "revealed";

// The story opened.
export function mark(id) { update(id, () => {}); }

// A team sealed, and whether it is the team.
export function guess(id, team, right) {
  return update(id, r => {
    if (finished(r)) return;
    r.guesses.push([...team].sort());
    if (right) r.state = "solved";
  });
}

// The truth opened; before the team was named, the story is revealed.
export function reveal(id) {
  return update(id, r => { if (!finished(r)) r.state = "revealed"; });
}
