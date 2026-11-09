// The site's Worker: it serves the built frontend (dist/, the ASSETS
// binding) and receives the alpha's play signals and feedback into D1 (the
// DB binding, worker/schema.sql). Every request with no asset behind it
// comes here; only the two POST routes below answer, anything else is 404.
//
// What is kept is anonymous: the story, its wording (`generator`), a
// random id per play, the kind and data of the signal and the time it
// arrived. No header, address or agent is read into a row, and nothing is
// logged (wrangler.jsonc turns invocation logs off).
//
// A request is refused, and no row written, unless it is a POST from this
// origin with a JSON body of declared length under BODY bytes naming a story the site serves,
// a wording of the exporter's form, a play id of UUID form and data of the
// kind's SHAPE (or, for feedback, FEEDBACK). A play may send at most PLAYS_CAP signals, and feedback once.

const BODY = 4096;        // bytes, the largest body read
const TEXT = 2000;        // characters of free text kept
const PLAYS_CAP = 200;    // signals a play may send; a reading sends a few dozen
const GUESSES = 50;       // the most accusations a play is believed to have made
const STORY = /^[0-9a-z]{1,40}$/;               // the format's id rule (check.mjs), bounded for the path
const GENERATOR = /^[0-9a-f]{12}(-dirty)?$/;    // as check.mjs checks the field
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const refuse = (status, why) => new Response(why, {status, headers: {"content-type": "text/plain"}});
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const ids = (v, cast, max) => Array.isArray(v) && v.length <= max && v.every(x => cast.includes(x)) && new Set(v).size === v.length;

// What each kind's data must hold, given the story file it is about.
// A field not listed is dropped, so a row holds only what is read here.
const SHAPES = {
  opened: (d, s) => ({
    state: [null, "played", "solved", "revealed"].includes(d.state) ? d.state : undefined,
    guesses: int(d.guesses, 0, GUESSES) ? d.guesses : undefined,
    resumed: typeof d.resumed === "boolean" ? d.resumed : undefined,
  }),
  read: (d, s) => ({
    at: int(d.at, 0, 5000) ? d.at : undefined,
    of: int(d.of, 1, 5000) ? d.of : undefined,
    day: int(d.day, 0, s.days.length) ? d.day : undefined,
    days: d.days === s.days.length ? d.days : undefined,
    seconds: int(d.seconds, 0, 86400) ? d.seconds : undefined,
  }),
  sealed: (d, s) => ({
    team: ids(d.team, s.cast, s.largest_team) ? [...d.team].sort() : undefined,
    order: ids(d.order, s.cast, s.largest_team) && [...d.order].sort().join() === [...(d.team || [])].sort().join() ? d.order : undefined,
    right: typeof d.right === "boolean" ? d.right : undefined,
    nth: int(d.nth, 1, GUESSES) ? d.nth : undefined,
  }),
  revealed: (d, s) => ({
    guesses: int(d.guesses, 0, GUESSES) ? d.guesses : undefined,
  }),
};
// The answers to her ask, every one optional (null or empty), in the same
// form; `state` and `guesses` are the browser's word on how the play ended.
const FEEDBACK = (d, s) => ({
  difficulty: d.difficulty == null ? null : int(d.difficulty, 1, 3) ? d.difficulty : undefined,
  hearts: ids(d.hearts ?? [], s.cast, s.cast.length) ? d.hearts ?? [] : undefined,
  // Control characters go, since SQLite's text functions stop at a NUL.
  text: typeof (d.text ?? "") === "string" ? (d.text ?? "").replace(/[\0-\x08\x0b\x0c\x0e-\x1f]/g, "").slice(0, TEXT) : undefined,
  state: [null, "solved", "revealed"].includes(d.state ?? null) ? d.state ?? null : undefined,
  guesses: d.guesses == null ? null : int(d.guesses, 0, GUESSES) ? d.guesses : undefined,
});
// A shape is complete when every field came through.
const whole = o => Object.values(o).every(v => v !== undefined);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/signal" && url.pathname !== "/api/feedback") return env.ASSETS.fetch(request);
    // A fault (the database missing or over quota) answers 500 and raises
    // nothing, so no entry with the request's metadata reaches the logs.
    try { return await receive(request, env, url); } catch { return refuse(500, "not kept"); }
  },
};

async function receive(request, env, url) {
  if (request.method !== "POST") return refuse(405, "post only");
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return refuse(403, "not from this site");
  // The length is declared (sendBeacon and fetch with a Blob declare it),
  // so no body is read before its size is known.
  const length = request.headers.get("content-length");
  if (length === null) return refuse(411, "length required");
  if (+length > BODY) return refuse(413, "too large");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > BODY) return refuse(413, "too large");
  let body;
  try { body = JSON.parse(text); } catch { return refuse(400, "not json"); }
  if (!body || typeof body !== "object") return refuse(400, "not an object");
  const {story, generator, play} = body;
  if (!STORY.test(story || "")) return refuse(400, "story id");
  if (!GENERATOR.test(generator || "")) return refuse(400, "generator");
  if (!UUID.test(play || "")) return refuse(400, "play id");
  // The story must be one this site serves; its file bounds the data.
  const file = await env.ASSETS.fetch(new Request(`${url.origin}/stories/${story}.json`));
  if (!file.ok) return refuse(400, "no such story");
  const s = await file.json();
  // Another file under /stories/, such as the index, is no story.
  if (!Array.isArray(s.cast) || !Array.isArray(s.days)) return refuse(400, "no such story");
  const bounds = {...s, cast: s.cast.map(c => c.id)};

  if (url.pathname === "/api/feedback") {
    const f = FEEDBACK(body, bounds);
    if (!whole(f)) return refuse(400, "feedback shape");
    const r = await env.DB.prepare(
      "INSERT OR IGNORE INTO feedback (story, generator, play, state, guesses, difficulty, hearts, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(story, generator, play, f.state, f.guesses, f.difficulty, JSON.stringify(f.hearts), f.text).run();
    return r.meta.changes ? new Response(null, {status: 204}) : refuse(409, "already given");
  }

  const shape = SHAPES[body.kind];
  if (!shape) return refuse(400, "kind");
  const data = shape(body.data && typeof body.data === "object" ? body.data : {}, bounds);
  if (!whole(data)) return refuse(400, "data shape");
  const {n} = await env.DB.prepare("SELECT count(*) AS n FROM event WHERE play = ?").bind(play).first();
  if (n >= PLAYS_CAP) return refuse(429, "enough from this play");
  await env.DB.prepare("INSERT OR IGNORE INTO event (story, generator, play, kind, data) VALUES (?, ?, ?, ?, ?)")
    .bind(story, generator, play, body.kind, JSON.stringify(data)).run();
  return new Response(null, {status: 204});
}
