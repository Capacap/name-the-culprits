#!/usr/bin/env node
// How the alpha's stories are played and what players said of them, from
// the D1 database the Worker fills (worker/schema.sql):
//   node deploy/report.mjs            the site's database
//   node deploy/report.mjs --local    the dev database of `wrangler dev`
// Per story, in the library's order and then the unlisted: plays (a play
// that opened the story fresh), replays, finished (solved, or the truth
// opened), the accusations before the right team, where the unfinished
// readings stopped, the minutes spent, the difficulty votes, the hearts
// and the free text. Reads every row; the alpha is small.
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {STEPS} from "../play/player/steps.js";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const local = process.argv.includes("--local");
if (!local && /"database_id":\s*"set-when-created"/.test(readFileSync(join(ROOT, "wrangler.jsonc"), "utf8")))
  { console.error("wrangler.jsonc has no database id yet; pass --local for the dev database"); process.exit(1); }

function query(sql) {
  const out = execFileSync("npx", ["--yes", "wrangler", "d1", "execute", "DB", local ? "--local" : "--remote", "--json", "--command", sql],
    {cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"]});
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
}
const events = query("SELECT story, generator, play, kind, data, at FROM event ORDER BY id").map(e => ({...e, data: JSON.parse(e.data)}));
const feedback = query("SELECT story, play, state, guesses, difficulty, hearts, text, at FROM feedback ORDER BY id").map(f => ({...f, hearts: JSON.parse(f.hearts)}));
const library = JSON.parse(readFileSync(join(ROOT, "stories", "index.json"), "utf8")).stories.map(s => s.id);
const names = id => { try { return Object.fromEntries(JSON.parse(readFileSync(join(ROOT, "stories", `${id}.json`), "utf8")).cast.map(c => [c.id, c.name])); } catch { return {}; } };

const seen = new Set([...events.map(e => e.story), ...feedback.map(f => f.story)]);
const stories = [...library.filter(id => seen.has(id)), ...[...seen].filter(id => !library.includes(id)).sort()];
const median = xs => xs.length ? xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null;

console.log(`${events.length} signals, ${feedback.length} answers, ${stories.length} stories\n`);
for (const id of stories) {
  const ev = events.filter(e => e.story === id), fb = feedback.filter(f => f.story === id), who = names(id);
  const plays = new Map();
  for (const e of ev) {
    const p = plays.get(e.play) || {fresh: null, resumed: false, seals: [], read: null, seconds: 0, end: null};
    if (e.kind === "opened") { p.fresh = e.data.state === null || e.data.state === "played"; p.resumed = e.data.resumed; }
    if (e.kind === "sealed") p.seals.push(e.data);
    if (e.kind === "read") { p.read = e.data; p.seconds = Math.max(p.seconds, e.data.seconds); }
    if (e.kind === "revealed") p.end = "revealed";
    if (e.kind === "sealed" && e.data.right) p.end = "solved";
    plays.set(e.play, p);
  }
  const all = [...plays.values()], fresh = all.filter(p => p.fresh), replays = all.filter(p => p.fresh === false);
  const solved = fresh.filter(p => p.end === "solved"), revealed = fresh.filter(p => p.end === "revealed");
  const open = fresh.filter(p => !p.end);
  const nth = solved.map(p => p.seals.find(s => s.right)?.nth).filter(Boolean);
  const count = xs => { const c = {}; for (const x of xs) c[x] = (c[x] || 0) + 1; return Object.entries(c).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${v}×${k}`).join(" "); };
  // The reader counts a day from its title, so 0 is before the first.
  const stopped = open.filter(p => p.read).map(p => `${p.read.day ? `day ${p.read.day}` : "before day 1"} of ${p.read.days} at ${Math.round(100 * p.read.at / p.read.of)}%`);
  const minutes = fresh.map(p => p.seconds / 60).filter(m => m > 0);
  console.log(`${id}${library.includes(id) ? "" : " (unlisted)"}`);
  console.log(`  plays ${fresh.length} (${fresh.filter(p => p.resumed).length} resumed a kept reading), replays ${replays.length}, solved ${solved.length}, truth opened ${revealed.length}, unfinished ${open.length}`);
  if (nth.length) console.log(`  solved at accusation ${count(nth)}`);
  if (stopped.length) console.log(`  stopped: ${stopped.join(", ")}`);
  if (minutes.length) console.log(`  minutes in view: median ${median(minutes).toFixed(1)} of ${minutes.length} plays`);
  const votes = fb.filter(f => f.difficulty).map(f => STEPS[f.difficulty - 1].toLowerCase());
  if (votes.length) console.log(`  difficulty: ${count(votes)}`);
  const hearts = fb.flatMap(f => f.hearts).map(h => who[h] || h);
  if (hearts.length) console.log(`  hearts: ${count(hearts)}`);
  for (const f of fb) if (f.text) console.log(`  "${f.text.replace(/\s+/g, " ")}" (${f.state || "?"}${f.guesses == null ? "" : `, ${f.guesses} sealed`}, ${f.at.slice(0, 10)})`);
  console.log();
}
