// Every character's pictures (art/drawn, which this repository does not
// keep; README.md). A guest has one
// portrait in art/drawn/hand, shown for an account, for every mood they have
// no picture of and as the headshot of a dead guest, and a head cut from it
// for the icons. A guest in MOODS has pictures of those moods
// too. Veronique (narrator) has hers, at work with her eyes on her
// sewing, and the same picture in two moods (HER): looking up at the player
// on the story's last day and smiling at a team seen through. The twelve
// placeholder guests the stories named before 6 November 2026 (OWN) keep
// their own framed figures and cut-out closeups. A mood a character lacks falls back to their first.

import {ART, STORY} from "./shared.js";

const GUESTS = ["alice", "bram", "cora", "dana", "emil", "fay", "gale", "hana", "iver", "juno", "kirk", "lena"];
const OWN = new Set(GUESTS);
// The moods a guest has pictures of, and how many of each, drawn as
// art/drawn/hand/<who>@<mood>-<n> (n from 1): "accusing" for a charge,
// "grave" for an examination, "accused" for the headshot under a charge. deploy/build.py
// reads this object as JSON, so it stays JSON.
export const MOODS = {"ada": {"accusing": 2, "grave": 2, "accused": 2}, "clementine": {"accusing": 2, "grave": 2, "accused": 2}, "sterling": {"accusing": 1, "grave": 1, "accused": 1}, "ilya": {"accusing": 1, "grave": 1, "accused": 1}, "lucian": {"accusing": 1, "grave": 1, "accused": 1}, "ottilie": {"accusing": 1, "grave": 1, "accused": 1}, "terry": {"accusing": 1, "grave": 1, "accused": 1}, "henrietta": {"accusing": 1, "grave": 1, "accused": 1}, "valentin": {"accusing": 1, "grave": 1, "accused": 1}, "winnie": {"accusing": 1, "grave": 1, "accused": 1}, "anselme": {"accusing": 1, "grave": 1, "accused": 1}, "robin": {"accusing": 1, "grave": 1, "accused": 1}, "philippa": {"accusing": 1, "grave": 1, "accused": 1}};
// Where each guest's head is in their 1024x1536 portrait, set by eye: the
// centre and side of a square around it, which cuts the dock icon
// and the headshot of an accused or dead guest, and the
// face's size as measured from a fitted face mesh (100 a
// face at the cast's middle distance; Henrietta's is set by eye between
// Ottilie's and Ilya's, since her veil hides her face from the mesh),
// which sets the zoom that brings every guest's face to one size
// (FACE_REF). The edits that make a
// guest's mood pictures keep the portrait's framing, so one box serves them
// all. A portrait redrawn needs its line looked at again, and a new guest
// one of their own. The tool that cuts the icons reads this object as JSON,
// so it stays JSON.
export const HEADS = {"ada": [450, 200, 520, 85], "anselme": [630, 240, 520, 127], "clementine": [512, 400, 520, 107], "henrietta": [540, 230, 520, 96], "ilya": [560, 260, 520, 94], "lucian": [500, 260, 520, 91], "ottilie": [600, 260, 520, 96], "philippa": [510, 280, 520, 103], "robin": [380, 380, 520, 101], "sterling": [560, 250, 520, 84], "terry": [520, 320, 540, 117], "valentin": [520, 290, 520, 120], "winnie": [560, 220, 520, 103], "narrator": [512, 330, 440, 111]};
const FACE_REF = 100;
// The placeholder guests' closeups (OWN) all have the head in one place.
const OWN_HEAD = [512, 360, 680, 100];
// The style of a figure: its zoom, so the heads of the cast come out one size.
export const zoom = who => `--zoom: ${(FACE_REF / (HEADS[who] || OWN_HEAD)[3]).toFixed(3)}`;
// The style of a headshot cut from a picture framed like the portrait
// (story.css .head), the square kept inside the picture as the icon
// cutter keeps it, so the dock icon and the headshot show one crop.
export function head(who) {
  let [cx, cy, side] = HEADS[who] || OWN_HEAD;
  cx = Math.min(Math.max(cx, side / 2), 1024 - side / 2);
  cy = Math.min(Math.max(cy, side / 2), 1536 - side / 2);
  return `--hx: ${cx}; --hy: ${cy}; --hside: ${side}`;
}
const portrait = who => `${ART}/hand/${who}.png`;
// Which of a mood's n pictures a turn shows, the same on every reading of
// the story: a hash of the story and the turn's key, 1 to n.
function pick(key, n) {
  let h = 2166136261;
  for (const c of `${STORY}:${key}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % n + 1;
}
export const HER = ["lookup", "smile"];

// The picture a headshot is cut from: a placeholder guest's closeup (the
// head at OWN_HEAD), otherwise the picture given or the portrait.
export const cutout = (who, src) => OWN.has(who) ? `${ART}/closeup-cut/${who}.png` : src || portrait(who);
// The head alone, square and small, cut from the closeup,
// for places that show a face at icon size.
export const icon = who => `${ART}/icon/${who}.png`;
// The placeholder guests' own moods, as their files are named; their
// examiner's picture is named "shocked".
const FRAMED = ["neutral", "accusing", "accused", "shocked"];
// A character in a mood, for the turn named by key.
export function framed(who, mood, key = "") {
  if (who === "narrator" && HER.includes(mood)) return `${ART}/hand/narrator@${mood}.png`;
  if (OWN.has(who)) {
    const own = mood === "grave" ? "shocked" : mood;
    return `${ART}/frame/${who}@${FRAMED.includes(own) ? own : FRAMED[0]}.png`;
  }
  const n = MOODS[who]?.[mood];
  return n ? `${ART}/hand/${who}@${mood}-${pick(key, n)}.png` : portrait(who);
}

// Fetch every picture the game uses once, so a turn shows without a blank,
// for the guests named (the story's ids) and Veronique.
export function preload(guests) {
  for (const who of [...guests, "narrator"]) {
    if (!OWN.has(who)) {
      new Image().src = portrait(who);
      if (who === "narrator") for (const m of HER) new Image().src = framed(who, m);
      for (const [m, n] of Object.entries(MOODS[who] || {}))
        for (let i = 1; i <= n; i++) new Image().src = `${ART}/hand/${who}@${m}-${i}.png`;
    } else {
      new Image().src = cutout(who);
      for (const m of FRAMED) new Image().src = framed(who, m);
    }
  }
}
