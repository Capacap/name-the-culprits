-- The alpha's play signals and feedback, one database beside the Worker
-- (worker/index.js writes, deploy/report.mjs reads). Apply with
--   npx wrangler d1 execute DB --local --file worker/schema.sql   (the dev database)
--   npx wrangler d1 execute DB --remote --file worker/schema.sql  (the site's)
-- Nothing here names a person: a row carries the story, the wording that
-- wrote it (`generator`), a random id per play of a story and the time the
-- Worker received it. A story is named by its `id` and `generator` as the
-- story file carries them (FORMAT.md).

-- One row per signal from a play: kind "opened" (data: the progress this
-- browser already had for the story, so a replay is told from a first
-- play), "read" (how far the reading went and the seconds spent, a running
-- total per play), "sealed" (a team accused, in the order picked, whether it
-- was right and which accusation it was) and "revealed" (the truth opened).
-- data is the JSON the Worker validated (worker/index.js, SHAPES).
CREATE TABLE IF NOT EXISTS event (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  story TEXT NOT NULL,
  generator TEXT NOT NULL,
  play TEXT NOT NULL,
  kind TEXT NOT NULL,
  data TEXT NOT NULL
);
-- The Worker counts a play's rows before each insert (PLAYS_CAP).
CREATE INDEX IF NOT EXISTS event_play ON event (play);
-- A play opens once and reveals the truth once, whatever a client sends.
CREATE UNIQUE INDEX IF NOT EXISTS event_once ON event (play, kind) WHERE kind IN ('opened', 'revealed');
-- A play's nth accusation is one row.
CREATE UNIQUE INDEX IF NOT EXISTS event_seal ON event (play, json_extract(data, '$.nth')) WHERE kind = 'sealed';
-- A reading position sent twice (two pages closing together) is one row.
CREATE UNIQUE INDEX IF NOT EXISTS event_read ON event (play, data) WHERE kind = 'read';

-- One row per play: the answers to Veronique's ask after the truth, every
-- one optional. difficulty is 1 too easy, 2 just right, 3 too challenging
-- (play/player/steps.js); hearts is a JSON list of the guests hearted, by
-- id; state and guesses are the browser's own word on how the play ended
-- (solved or revealed, and how many teams were sealed), kept beside the
-- event rows since a lost beacon leaves those short.
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  story TEXT NOT NULL,
  generator TEXT NOT NULL,
  play TEXT NOT NULL UNIQUE,
  state TEXT,
  guesses INTEGER,
  difficulty INTEGER CHECK (difficulty IS NULL OR difficulty BETWEEN 1 AND 3),
  hearts TEXT NOT NULL,
  text TEXT NOT NULL
);
