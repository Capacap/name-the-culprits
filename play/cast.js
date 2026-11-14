// Every character's pictures (art/drawn, which this repository does not
// keep; README.md). A guest has one
// portrait in art/drawn/hand, shown for every mood they have neither a set
// nor a picture of and as the headshot of an accused or dead guest, and a
// head cut from it for the icons. A guest in MOODS has pictures of those
// moods too. Veronique (narrator) has hers, at work with her eyes on her
// sewing, and the same picture in two moods (HER): looking up at the player
// on the story's last day and smiling at a team seen through. The twelve
// placeholder guests the stories named before 6 November 2026 (OWN) keep
// their own framed figures and cut-out closeups. A mood a character lacks falls back to their first.
// A guest in SETS speaks in a place of their own instead: the place (a plate)
// and the guest cut out over it (a figure), one pair per mood, in art/drawn/set.

import {ART, STORY} from "./shared.js";

const GUESTS = ["alice", "bram", "cora", "dana", "emil", "fay", "gale", "hana", "iver", "juno", "kirk", "lena"];
const OWN = new Set(GUESTS);
// The moods a guest has pictures of, and how many of each, drawn as
// art/drawn/hand/<who>@<mood>-<n> (n from 1). "accused" is the guest as
// someone charges them: the whole figure cut out, with no background, of
// which a charge shows the head (ACCUSED). A mood a guest's set shows (SETS)
// is not listed, so every picture listed is one the game shows.
// deploy/build.py reads this object as JSON, so it stays JSON.
export const MOODS = {"ada": {"accused": 1}, "anselme": {"accused": 1}, "clementine": {"accused": 1}, "henrietta": {"accused": 1}, "ilya": {"accused": 1}, "lucian": {"accused": 1}, "ottilie": {"accused": 1}, "philippa": {"accused": 1}, "robin": {"accused": 1}, "sterling": {"accused": 1}, "terry": {"accused": 1}, "valentin": {"accused": 1}, "winnie": {"accused": 1}};
// Where each guest's head is in their 1024x1536 portrait, set by eye: the
// centre and side of a square around it, which cuts the dock icon
// and the headshot of an accused or dead guest, and the
// face's size as measured from a fitted face mesh (100 a
// face at the cast's middle distance; Ada's, Clementine's, Henrietta's and
// Ottilie's are set by eye against the others, since the mesh finds no
// face in their portraits),
// which sets the zoom that brings every guest's face to one size
// (FACE_REF). The edits that make a
// guest's mood pictures keep the portrait's framing, so one box serves them
// all. A portrait redrawn needs its line looked at again, and a new guest
// one of their own. The tool that cuts the icons reads this object as JSON,
// so it stays JSON.
export const HEADS = {"ada": [512, 315, 440, 100], "anselme": [520, 400, 560, 114], "clementine": [512, 330, 680, 140], "henrietta": [490, 270, 700, 90], "ilya": [520, 370, 420, 79], "lucian": [450, 310, 420, 78], "ottilie": [480, 300, 520, 85], "philippa": [500, 330, 500, 95], "robin": [360, 360, 420, 80], "sterling": [500, 240, 420, 78], "terry": [430, 410, 560, 99], "valentin": [523, 440, 500, 97], "winnie": [480, 290, 460, 84], "narrator": [512, 330, 440, 111]};
// Where each guest's head is in their accused picture, as in HEADS: the
// centre and side of the square a charge shows. A picture redrawn needs
// its line looked at again.
export const ACCUSED = {"ada": [519, 240, 440], "anselme": [489, 225, 440], "clementine": [468, 255, 460], "henrietta": [470, 230, 620], "ilya": [493, 275, 440], "lucian": [520, 200, 440], "ottilie": [491, 215, 460], "philippa": [538, 240, 440], "robin": [494, 245, 440], "sterling": [525, 215, 440], "terry": [455, 220, 500], "valentin": [441, 240, 440], "winnie": [448, 250, 460]};
const FACE_REF = 100;
// The placeholder guests' closeups (OWN) all have the head in one place.
const OWN_HEAD = [512, 360, 680, 100];
// The style of a figure: its zoom, so the heads of the cast come out one size.
export const zoom = who => `--zoom: ${(FACE_REF / (HEADS[who] || OWN_HEAD)[3]).toFixed(3)}`;
// The style of a headshot cut from a picture framed like the portrait
// (story.css .head), the square kept inside the picture as the icon
// cutter keeps it, so the icon and the headshot show one crop.
export function head(who, mood) {
  let [cx, cy, side] = mood === "accused" && ACCUSED[who] || HEADS[who] || OWN_HEAD;
  cx = Math.min(Math.max(cx, side / 2), 1024 - side / 2);
  cy = Math.min(Math.max(cy, side / 2), 1536 - side / 2);
  return `--hx: ${cx}; --hy: ${cy}; --hside: ${side}`;
}
// A guest's set: per mood ("neutral" for an account, "accusing", "grave"),
// where the face's middle is across the figure's 3:2 canvas in percent, the
// face's height and the row of the hair's top on its 1024 rows, and, where
// an account's figure stands elsewhere on a wide panel than on its plate,
// that place in percent. A figure is art/drawn/set/<who>@<mood> and its
// plate, the same canvas, <who>@<mood>-plate. A figure redrawn needs its
// line measured again. deploy/build.py reads this object as JSON, so it
// stays JSON.
export const SETS = {"ada": {"neutral": [30, 175, 5], "accusing": [75, 182, 8], "grave": [74, 221, 24]}, "anselme": {"neutral": [26, 164, 33], "accusing": [70, 199, 40], "grave": [70, 183, 21]}, "clementine": {"neutral": [21, 197, 15], "accusing": [76, 201, 1], "grave": [76, 189, 10]}, "henrietta": {"neutral": [28, 179, 18], "accusing": [68, 175, 18], "grave": [71, 172, 22]}, "ilya": {"neutral": [24, 180, 25], "accusing": [71, 183, 44], "grave": [70, 158, 28]}, "lucian": {"neutral": [27, 163, 13], "accusing": [72, 169, 44], "grave": [70, 163, 39]}, "ottilie": {"neutral": [29, 160, 23, 35], "accusing": [74, 181, 28], "grave": [75, 196, 40]}, "philippa": {"neutral": [27, 173, 18], "accusing": [68, 188, 37], "grave": [68, 173, 32]}, "robin": {"neutral": [25, 183, 23], "accusing": [70, 204, 19], "grave": [68, 173, 39]}, "sterling": {"neutral": [27, 164, 50], "accusing": [72, 186, 34], "grave": [72, 163, 26]}, "terry": {"neutral": [26, 172, 19], "accusing": [70, 182, 8], "grave": [67, 168, 16]}, "valentin": {"neutral": [25, 194, 19], "accusing": [69, 209, 43], "grave": [70, 183, 65]}, "winnie": {"neutral": [22, 186, 18], "accusing": [69, 172, 72], "grave": [72, 198, 62]}};
// Every figure of a set is scaled so its face is this many rows of the
// plate's 1024 tall, and its hair's top stands this many percent of the
// panel's height under the panel's top (story.css .place).
const SET_FACE = 200, SET_HEADROOM = 6;
// On a narrow panel the face stands this far across: an account's figure
// at the left, a charge's and an examination's at the right.
const SET_NARROW = {neutral: 38, accusing: 64, grave: 64};
// A guest's set for a mood, or nothing: the plate, the figure and the
// style that places each (story.css .place).
export function set(who, mood) {
  const s = SETS[who]?.[mood];
  if (!s) return null;
  const [face, tall, hair, wide = face] = s;
  return {
    plate: `${ART}/set/${who}@${mood}-plate.png`, at: `background-position: ${face}% 0`,
    figure: `${ART}/set/${who}@${mood}.png`,
    style: `--face: ${face / 100}; --wide: ${wide}; --narrow: ${SET_NARROW[mood]}; --s: ${(SET_FACE / tall).toFixed(3)}; --hair: ${(hair / 1024).toFixed(4)}; --head: ${SET_HEADROOM}`,
  };
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
      for (const m of Object.keys(SETS[who] || {})) { const s = set(who, m); new Image().src = s.plate; new Image().src = s.figure; }
    } else {
      new Image().src = cutout(who);
      for (const m of FRAMED) new Image().src = framed(who, m);
    }
  }
}
