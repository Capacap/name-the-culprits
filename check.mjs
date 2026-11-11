#!/usr/bin/env node
// Check a story library against FORMAT.md: node check.mjs <folder>
// Prints one line per fault and exits 1 if there is any.
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const FORMAT = 4;
const KINDS = ["house", "narration", "examination", "charge", "account", "defence", "closing"];
const ROOM_KINDS = ["room", "graveyard", "feature"];
const faults = [];

function fault(where, msg) {
  faults.push(`${where}: ${msg}`);
}

function load(path) {
  let v;
  try {
    v = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    fault(path, `cannot read: ${e.message}`);
    return null;
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    fault(path, "must hold a JSON object");
    return null;
  }
  return v;
}

const isStr = (v) => typeof v === "string" && v.length > 0;
const isStrList = (v) => Array.isArray(v) && v.every(isStr);

export function checkHash(id, team) {
  return createHash("sha256").update(`${id}\n${[...team].sort().join(",")}`).digest("hex");
}

function checkLines(where, lines, account, slots) {
  if (!Array.isArray(lines) || lines.length === 0) {
    fault(where, "lines must be a non-empty list");
    return;
  }
  lines.forEach((line, k) => {
    if (!line || !isStr(line.text)) fault(`${where} line ${k}`, "text missing");
    // An account's opener, its first line alone, tells no slot.
    if (account && !(k === 0 && line && !("slots" in line) && lines.length > 1)) {
      const s = line && line.slots;
      if (!Array.isArray(s) || s.length !== 2 || !s.every(Number.isInteger) || !(0 <= s[0] && s[0] <= s[1] && s[1] < slots)) {
        fault(`${where} line ${k}`, "slots must be [first, last] within the day");
      }
    }
    if (line && "asides" in line) fault(`${where} line ${k}`, "asides is format 2's");
  });
}

// A wrong team's sealed verdict, opened with the team's ids (FORMAT.md,
// "Verdicts"): the list of lines, or null when it does not open.
export function openVerdict(id, team, sealed) {
  if (typeof sealed !== "string") return null;
  const seed = `${id}\n${[...team].sort().join(",")}`;
  const bytes = Buffer.from(sealed, "base64");
  for (let k = 0; k * 32 < bytes.length; k++) {
    const pad = createHash("sha256").update(`${seed}\nverdict\n${k}`).digest();
    for (let j = 0; j < 32 && k * 32 + j < bytes.length; j++) bytes[k * 32 + j] ^= pad[j];
  }
  try {
    const v = JSON.parse(bytes.toString("utf8"));
    return isStrList(v) && v.length ? v : null;
  } catch {
    return null;
  }
}

// Every team an accusation may name: one to `largest` guests.
function teams(guests, largest) {
  const out = [];
  const grow = (start, team) => {
    if (team.length) out.push(team);
    if (team.length === largest) return;
    for (let k = start; k < guests.length; k++) grow(k + 1, [...team, guests[k]]);
  };
  grow(0, []);
  return out;
}

function checkStory(where, s, entry) {
  if (s.format !== FORMAT) fault(where, `format must be ${FORMAT}`);
  if (!/^[0-9a-f]{12}(-dirty)?$/.test(s.generator || "")) fault(where, "generator must be twelve hex digits of a commit");
  if (s.game !== "berndle") fault(where, 'game must be "berndle"');
  if (s.id !== entry.id) fault(where, `id ${s.id} is not the index's ${entry.id}`);
  const guests = new Set();
  for (const c of s.cast || []) {
    if (!isStr(c.id) || !isStr(c.name) || !isStr(c.pronouns)) fault(where, "a guest needs id, name and pronouns");
    if (guests.has(c.id)) fault(where, `guest ${c.id} twice`);
    guests.add(c.id);
  }
  if (guests.size !== entry.cast) fault(where, `cast of ${guests.size}, the index says ${entry.cast}`);
  const h = s.house || {};
  const rooms = new Set();
  for (const r of h.rooms || []) {
    if (!isStr(r.id) || !isStr(r.name) || !ROOM_KINDS.includes(r.kind) || !isStrList(r.rules)) {
      fault(where, `room ${r.id} needs id, name, a kind of ${ROOM_KINDS} and rules`);
    }
    if (rooms.has(r.id)) fault(where, `room ${r.id} twice`);
    rooms.add(r.id);
  }
  for (const r of h.rooms || []) {
    if (r.within !== undefined && !rooms.has(r.within)) fault(where, `room ${r.id} is within unknown ${r.within}`);
  }
  if ((h.rooms || []).filter((r) => r.kind === "graveyard").length !== 1) fault(where, "one graveyard");
  const inside = new Set((h.rooms || []).filter((r) => r.within !== undefined).map((r) => r.id));
  for (const d of h.doors || []) {
    if (!Array.isArray(d) || d.length !== 2 || !d.every((x) => rooms.has(x)) || d[0] === d[1]) {
      fault(where, `bad door ${JSON.stringify(d)}`);
    } else if (d.some((x) => inside.has(x))) {
      fault(where, `door ${JSON.stringify(d)} to a room within another`);
    }
  }
  // The rooms with doors form a tree, one door fewer than rooms and every
  // room reached, since a view walks the one path between two rooms.
  const outer = [...rooms].filter((r) => !inside.has(r)), next = {};
  for (const d of h.doors || []) if (Array.isArray(d)) for (const [x, y] of [d, [...d].reverse()]) (next[x] ||= []).push(y);
  const reached = new Set(outer.slice(0, 1));
  for (const r of reached) for (const n of next[r] || []) reached.add(n);
  if ((h.doors || []).length !== outer.length - 1 || outer.some((r) => !reached.has(r))) {
    fault(where, "the doors must join the rooms (those within another aside) as a tree");
  }
  if (h.tunnel !== null && !(Array.isArray(h.tunnel) && h.tunnel.length === 2 && h.tunnel.every((x) => rooms.has(x)))) {
    fault(where, "tunnel must be null or a pair of rooms");
  }
  if (!isStrList(s.slots) || s.slots.length === 0) fault(where, "slots must name the slots");
  const nslots = (s.slots || []).length;
  if (!Array.isArray(s.rules) || !s.rules.every((r) => isStr(r.title) && isStrList(r.lines))) {
    fault(where, "rules must be titled sections of lines");
  }
  if (!isStrList(s.objective)) fault(where, "objective must be lines");
  if (!isStr(s.challenge)) fault(where, "challenge missing");
  if (!Number.isInteger(s.largest_team) || s.largest_team < 1) fault(where, "largest_team must be a positive integer");
  if (!Array.isArray(s.days) || s.days.length !== entry.days) fault(where, `the index says ${entry.days} days`);
  (s.days || []).forEach((day, i) => {
    const w = `${where} day ${i + 1}`;
    if (!isStr(day.title)) fault(w, "title missing");
    // A day the alarm ended tells its slots up to `ends` and no further.
    if (!Number.isInteger(day.ends) || day.ends < 0 || day.ends >= nslots) fault(w, "ends must be a slot index");
    const dslots = Number.isInteger(day.ends) ? day.ends + 1 : nslots;
    // The first alarm, as her dawn tells it, sets `ends`; every account
    // but its raiser's ends on a line of the alarm in that slot.
    const told = (day.turns || []).filter((t) => t.speaker === "narrator").flatMap((t) => (t.lines || []).map((l) => l.text)).join(" ");
    const alarm = told.match(/At (\w+) (.+?) raised the alarm from/);
    const first = alarm ? (s.slots || []).findIndex((x) => x.toLowerCase() === alarm[1].toLowerCase()) : nslots - 1;
    if (day.ends !== first) fault(w, `ends is ${day.ends}, the day's first alarm ${alarm ? "is at " + alarm[1] : "is none"}`);
    if (alarm) {
      const raiser = (s.cast || []).find((c) => c.name === alarm[2])?.id;
      for (const t of day.turns || []) {
        if (t.kind !== "account" || t.speaker === raiser) continue;
        const last = (t.lines || []).at(-1);
        if (!last?.slots || last.slots[0] !== day.ends || last.slots[1] !== day.ends || !/raised? the alarm/.test(last.text)) fault(w, `${t.speaker}'s account does not end on the alarm`);
      }
    }
    if (!Array.isArray(day.turns) || day.turns.length === 0) {
      fault(w, "turns missing");
      return;
    }
    if (i === 0 && day.turns.length < 2) fault(w, "the first day's dawn follows the house");
    // One exchange a day: the defence and the answers to it, one after
    // another, which a view may rely on to tell the answers apart.
    const defences = day.turns.flatMap((t, k) => t.kind === "defence" ? [k] : []);
    if (defences.some((k, j) => j && k !== defences[j - 1] + 1)) fault(w, "a day's defence turns follow one another, one exchange a day");
    if (defences.slice(1).some((k) => day.turns[k].continues)) fault(w, "only a day's first defence turn continues an account");
    day.turns.forEach((t, k) => {
      const wt = `${w} turn ${k}`;
      if (t.speaker !== "narrator" && !guests.has(t.speaker)) fault(wt, `unknown speaker ${t.speaker}`);
      if (!KINDS.includes(t.kind)) fault(wt, `kind ${t.kind} is not one of ${KINDS}`);
      const narrator = t.kind === "house" || t.kind === "narration" || t.kind === "closing";
      if (narrator !== (t.speaker === "narrator")) fault(wt, `${t.kind} spoken by ${t.speaker}`);
      if (typeof t.continues !== "boolean") fault(wt, "continues must be true or false");
      if (t.continues && (k === 0 || day.turns[k - 1].speaker !== t.speaker)) {
        fault(wt, "continues a turn by another speaker");
      }
      const house = i === 0 && k === 0;
      if (house !== (t.kind === "house")) fault(wt, "the first day opens with the house, and only it");
      if (k === (i === 0 ? 1 : 0) && t.kind !== "narration") fault(wt, "a day's dawn opens with narration");
      if (i === 0 && k === 1 && t.continues) fault(wt, "the dawn is not part of the house speech");
      if (t.kind === "house") {
        const said = (t.lines || []).map((l) => l.text).join(" ");
        for (const r of s.house?.rooms || []) {
          if (r.rules?.length && !said.includes(r.name)) fault(wt, `the house turn does not name ${r.name}, which has a rule`);
        }
      }
      if (t.kind === "house" && ["places", "against", "bodies", "disputed"].some((f) => f in t || (t.lines || []).some((l) => "slots" in l))) {
        fault(wt, "the house turn holds lines only");
      }
      if (t.kind === "defence" && t.continues && (k === 0 || day.turns[k - 1].kind !== "account")) {
        fault(wt, "a defence continues only its speaker's account");
      }
      if (t.kind === "defence" && (["places", "against", "bodies", "disputed"].some((f) => f in t) || (t.lines || []).some((l) => l && "slots" in l))) {
        fault(wt, "a defence holds lines only");
      }
      if (t.kind === "charge") {
        const next = day.turns[k + 1];
        if (!next || next.kind !== "account" || next.speaker !== t.speaker || next.continues !== true) {
          fault(wt, "a charge is followed by the same speaker's account, continuing");
        }
      }
      checkLines(wt, t.lines, t.kind === "account", dslots);
      if (t.kind === "charge" && !(isStrList(t.against) && t.against.length && t.against.every((g) => guests.has(g)))) {
        fault(wt, "a charge names guests in against");
      }
      if (t.kind === "examination" && !(isStrList(t.bodies) && t.bodies.length && t.bodies.every((g) => guests.has(g)))) {
        fault(wt, "an examination names guests in bodies");
      }
      if (t.kind === "account") {
        if (!Array.isArray(t.places) || t.places.length !== dslots || !t.places.every((p) => Array.isArray(p) && p.every((r) => rooms.has(r)))) {
          fault(wt, "places must hold a list of known rooms per slot of the day");
        }
        for (const f of ["doors", "trip"]) if (f in t) fault(wt, `${f} is format 2's`);
      }
      if ("claim" in t) fault(wt, "claim is format 1's");
    });
  });
  if (!/^[0-9a-f]{64}$/.test(s.check || "")) fault(where, "check must be a SHA-256 in lowercase hex");
  if (!s.verdicts || typeof s.verdicts !== "object" || Array.isArray(s.verdicts)) fault(where, "verdicts missing");
  return { guests, rooms };
}

function checkAnswer(where, a, s, known) {
  if (a.format !== FORMAT) fault(where, `format must be ${FORMAT}`);
  if (a.id !== s.id) fault(where, `id ${a.id} is not the story's ${s.id}`);
  const team = a.team || [];
  if (!isStrList(team) || team.length < 1 || team.length > s.largest_team || !team.every((g) => known.guests.has(g))) {
    fault(where, "team must name one to largest_team guests");
  }
  if (checkHash(s.id, team) !== s.check) fault(where, "the team does not hash to the story's check");
  if ("text" in a) fault(where, "text is format 1's");
  // Every wrong team, and only they, has a verdict that opens with its ids.
  const v = s.verdicts || {}, keys = new Set(Object.keys(v));
  for (const t of teams([...known.guests], s.largest_team)) {
    const h = checkHash(s.id, t);
    if (h === s.check) {
      if (keys.has(h)) fault(where, "the team has a verdict");
      continue;
    }
    if (!keys.has(h)) fault(where, `no verdict for ${t}`);
    else if (!openVerdict(s.id, t, v[h])) fault(where, `the verdict for ${t} does not open to lines`);
    keys.delete(h);
  }
  if (keys.size) fault(where, `${keys.size} verdicts for no team`);
  const lines = (x) => Array.isArray(x) && x.length > 0 && x.every(isStr);
  if (!Array.isArray(a.rivals)) fault(where, "rivals missing");
  if ((a.rivals || []).length > 2) fault(where, "more than two rivals");
  for (const r of a.rivals || []) {
    if (!isStrList(r.team) || !r.team.length || checkHash(s.id, r.team) === s.check || !lines(r.lines)) fault(where, `bad rival ${JSON.stringify(r.team)}`);
    else if (JSON.stringify(openVerdict(s.id, r.team, v[checkHash(s.id, r.team)])) !== JSON.stringify(r.lines)) fault(where, `rival ${r.team} differs from its verdict`);
  }
  {
    const t = a.told;
    if (!Array.isArray(t?.days) || t.days.length !== s.days.length
        || !t.days.every((d) => d && isStr(d.title) && lines(d.lines) && d.lines.length)) {
      fault(where, "told.days must hold a titled list of lines for each of the story's days");
    }
    if (!Array.isArray(t?.lies) || !t.lies.every((l) => l && known.guests.has(l.speaker)
        && Number.isInteger(l.day) && 1 <= l.day && l.day <= s.days.length && lines(l.said) && lines(l.truth))) {
      fault(where, "told.lies must hold a guest, a day and the lines said and true");
    }
  }
}

function main(folder) {
  const index = load(join(folder, "index.json"));
  if (!index) return;
  if (index.format !== FORMAT) fault("index.json", `format must be ${FORMAT}`);
  const ids = new Set();
  for (const e of index.stories || []) {
    const where = `index.json ${e.id}`;
    if (!/^[0-9a-z]+$/.test(e.id || "")) fault(where, "id must be lowercase letters and digits");
    if (ids.has(e.id)) fault(where, "id twice");
    ids.add(e.id);
    if (!Number.isInteger(e.days) || !Number.isInteger(e.cast)) fault(where, "days and cast are numbers");
    if ("score" in e) fault(where, "score is format 1's");
    if (!("date" in e) || !("difficulty" in e)) fault(where, "date and difficulty must be present");
    if (e.difficulty !== null && !["easy", "medium", "hard"].includes(e.difficulty)) fault(where, "difficulty is easy, medium, hard or null");
    for (const f of [e.story, e.answer]) {
      if (!isStr(f) || !existsSync(join(folder, f))) fault(where, `missing file ${f}`);
    }
    const s = isStr(e.story) && existsSync(join(folder, e.story)) && load(join(folder, e.story));
    if (!s) continue;
    const known = checkStory(e.story, s, e);
    const a = isStr(e.answer) && existsSync(join(folder, e.answer)) && load(join(folder, e.answer));
    if (a) checkAnswer(e.answer, a, s, known);
  }
  if (!ids.size) fault("index.json", "no stories");
  return ids.size;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const folder = process.argv[2];
  if (!folder) {
    console.error("usage: node check.mjs <folder>");
    process.exit(2);
  }
  const n = main(folder);
  for (const f of faults) console.log(f);
  console.log(faults.length ? `${faults.length} fault${faults.length === 1 ? "" : "s"}` : `${n} stories, no faults`);
  process.exit(faults.length ? 1 : 0);
}
