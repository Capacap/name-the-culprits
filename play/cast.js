// Every character's pictures (art/drawn, which this repository does not
// keep; README.md). A guest has one
// portrait in art/drawn/hand, shown for every mood they have neither a set
// nor a picture of and as the headshot of an accused or dead guest, and a
// head cut from it for the icons. A guest in MOODS has pictures of those
// moods too. The twelve
// placeholder guests the stories named before 6 November 2026 (OWN) keep
// their own framed figures and cut-out closeups. A mood a character lacks falls back to their first.
// A guest in SETS speaks in a place of their own instead: the place (a plate)
// and the guest cut out over it (a figure), one pair per mood, in art/drawn/set.
// Veronique (narrator) has a set and no other picture: three stages of her
// work with a thread, by the days a story has left (stage), and her smile at
// a team seen through, all over one plate (PLATE).

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
export const HEADS = {"ada": [512, 300, 380, 76], "anselme": [535, 395, 570, 114], "clementine": [512, 300, 520, 104], "henrietta": [490, 290, 560, 95], "ilya": [524, 375, 395, 79], "lucian": [461, 312, 390, 78], "ottilie": [500, 290, 470, 94], "philippa": [525, 315, 475, 95], "robin": [365, 361, 400, 80], "sterling": [523, 230, 390, 78], "terry": [430, 430, 540, 99], "valentin": [523, 445, 485, 97], "winnie": [491, 290, 440, 84], "narrator": [512, 330, 440, 111]};
// Where each guest's head is in their accused picture, as in HEADS: the
// centre and side of the square a charge shows. A picture redrawn needs
// its line looked at again.
export const ACCUSED = {"ada": [519, 244, 415], "anselme": [489, 230, 420], "clementine": [468, 258, 440], "henrietta": [470, 250, 500], "ilya": [481, 300, 435], "lucian": [530, 205, 430], "ottilie": [491, 211, 435], "philippa": [538, 244, 430], "robin": [494, 250, 450], "sterling": [525, 214, 435], "terry": [455, 235, 470], "valentin": [441, 250, 430], "winnie": [448, 252, 450]};
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
export const SETS = {"ada": {"neutral": [25, 150, 28], "accusing": [76, 165, 13], "grave": [75, 168, 44]}, "anselme": {"neutral": [27, 193, 19], "accusing": [67, 206, 20], "grave": [67, 205, 12]}, "clementine": {"neutral": [21, 174, 11], "accusing": [77, 172, 11], "grave": [79, 163, 23]}, "henrietta": {"neutral": [31, 183, 25], "accusing": [68, 203, 18], "grave": [71, 193, 10]}, "ilya": {"neutral": [24, 200, 13], "accusing": [69, 201, 21], "grave": [70, 165, 21]}, "lucian": {"neutral": [28, 195, 20], "accusing": [68, 178, 29], "grave": [70, 166, 40]}, "ottilie": {"neutral": [29, 220, 13, 35], "accusing": [71, 179, 28], "grave": [70, 177, 59]}, "philippa": {"neutral": [32, 204, 10], "accusing": [67, 214, 39], "grave": [68, 177, 16]}, "robin": {"neutral": [25, 179, 32], "accusing": [68, 200, 60], "grave": [66, 184, 19]}, "sterling": {"neutral": [29, 194, 23], "accusing": [70, 200, 34], "grave": [67, 175, 43]}, "terry": {"neutral": [28, 193, 16], "accusing": [64, 205, 40], "grave": [65, 165, 35]}, "valentin": {"neutral": [27, 209, 9], "accusing": [64, 211, 26], "grave": [64, 191, 21]}, "winnie": {"neutral": [29, 210, 27], "accusing": [69, 204, 39], "grave": [68, 174, 32]}, "narrator": {"taut": [50, 200, 24], "lowered": [50, 200, 23], "look": [50, 200, 20], "smile": [50, 200, 21]}};
// Every figure of a set is scaled so its face is this many rows of the
// plate's 1024 tall, and its hair's top stands this many percent of the
// panel's height under the panel's top (story.css .place).
const SET_FACE = 200, SET_HEADROOM = 6;
// On a narrow panel the face stands this far across: an account's figure
// at the left, a charge's and an examination's at the right.
const SET_NARROW = {neutral: 38, accusing: 64, grave: 64};
// A character whose every mood stands over one plate, and the mood it is
// filed under. deploy/build.py reads this object as JSON, so it stays JSON.
export const PLATE = {"narrator": "taut"};
// Veronique's mood on a day of a story of so many days: every story ends
// with her eyes on the reader, the day before with her thread lowered, and
// the day before that with it taut.
export const stage = (day, days) => ["look", "lowered", "taut"][Math.min(days - day, 2)];
// A character's set for a mood, or nothing: the plate, the figure and the
// style that places each (story.css .place). at puts the face that many
// percent across the panel at every width, in place of the set's own places.
export function set(who, mood, at) {
  const s = SETS[who]?.[mood];
  if (!s) return null;
  const [face, tall, hair, wide = face] = s;
  return {
    plate: `${ART}/set/${who}@${PLATE[who] || mood}-plate.png`, at: `background-position: ${face}% 0`,
    figure: `${ART}/set/${who}@${mood}.png`,
    style: `--face: ${face / 100}; --wide: ${at ?? wide}; --narrow: ${at ?? SET_NARROW[mood] ?? face}; --s: ${(SET_FACE / tall).toFixed(3)}; --hair: ${(hair / 1024).toFixed(4)}; --head: ${SET_HEADROOM}`,
  };
}
// Stand a character in a panel over their own place, where they have a set
// for the mood (story.css .place); says whether they have.
export function stand(p, who, mood, at) {
  const s = set(who, mood, at);
  if (!s) return false;
  const place = document.createElement("div"), plate = document.createElement("div"), figure = new Image();
  place.className = "place";
  plate.className = "plate";
  plate.style.cssText = `background-image: url("${s.plate}"); ${s.at}`;
  figure.className = "cut";
  figure.alt = "";
  figure.src = s.figure;
  figure.style.cssText = s.style;
  place.append(plate, figure);
  p.classList.add("set");
  p.prepend(place);
  return true;
}
const portrait = who => `${ART}/hand/${who}.png`;
// Which of a mood's n pictures a turn shows, the same on every reading of
// the story: a hash of the story and the turn's key, 1 to n.
function pick(key, n) {
  let h = 2166136261;
  for (const c of `${STORY}:${key}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % n + 1;
}
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
      if (who !== "narrator") new Image().src = portrait(who);
      for (const [m, n] of Object.entries(MOODS[who] || {}))
        for (let i = 1; i <= n; i++) new Image().src = `${ART}/hand/${who}@${m}-${i}.png`;
      for (const m of Object.keys(SETS[who] || {})) { const s = set(who, m); new Image().src = s.plate; new Image().src = s.figure; }
    } else {
      new Image().src = cutout(who);
      for (const m of FRAMED) new Image().src = framed(who, m);
    }
  }
}
