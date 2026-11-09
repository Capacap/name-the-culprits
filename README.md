# The Loose Threads frontend

The Loose Threads is a murder mystery puzzle: a few days of accounts from the guests of a house, a narrator who tells only truths, and a culprit or two to name. It is in alpha and can be played at https://nametheculprits.com.

This repository is the game's frontend: the game view, the library page that opens it, the format of a story file, a checker for that format, and the site's Worker and build. The code name is berndle, which the story format's `game` field and the browser's storage keys keep.

## A clone does not run the game

This repository is published to show the code. It leaves out two things the game needs, so a clone cannot serve it, build the site or deploy it:

- **The stories.** A generator that is kept private writes them. The game reads them from `stories/`, which is not in the repository.
- **The pictures.** The characters' portraits are read from `art/drawn/`, which is not in the repository either.

Without them the library page lists no stories and `deploy/build.py` stops before it builds anything. The commands below are for the machine that holds both folders. To play the game, use the site linked above.

## Stories

The frontend plays stories it is given and generates none. It reads a library from `stories/`, a folder git ignores: an index and two JSON files per story, described in [FORMAT.md](FORMAT.md). The pictures are read from `art/drawn/`, ignored likewise. On the machine that builds the site both are links to folders the generator keeps.

Check a library before using it:

```
node check.mjs stories
```

The checker needs Node 18 or later and nothing else. It prints one line per fault and exits with 1 if there is any.

## Playing and publishing

`play/` is the library: every story in `stories/`, numbered, with a button that opens one this browser has not played yet. Each story opens in the game view, `play/story/?story=<id>`, whose Library button and the link under a sealed accusation lead back. The browser keeps, per story, how far it was read (`play/player/save.js`, played back on a reload) and every team sealed (`play/progress.js`); the library shows which stories were solved and in how many accusations, and which had the truth opened. With `stories/` and `art/drawn/` in place, serve the repository's top folder and open `/play/`.

## The site

The site is one Cloudflare Worker, `loose-threads` (`wrangler.jsonc`): it serves the built frontend from `dist/` and receives the alpha's feedback and play signals into a D1 database (`worker/index.js`, `worker/schema.sql`). Before the first deploy the database is made once, its id goes into `wrangler.jsonc`, and the schema is applied:

```
npx wrangler d1 create loose-threads
npx wrangler d1 execute DB --remote --file worker/schema.sql
```

Then, for every deploy, build the assets and ship them with the Worker:

```
uv run --with pillow python deploy/build.py [--site https://the.live.site]
npx wrangler deploy
```

The build copies only what the library and the game load, minifies the code without its comments, and converts the portraits to WebP. It needs `stories/` and `art/drawn/`, so it runs on the machine that holds them. With `--site`, the stories the live site holds that the library no longer lists are shipped unlisted, so an old link or a half-read story still opens; a story whose format the game no longer reads is dropped then.

To run the site on this machine, build `dist/`, make the local database and start the dev server, which serves `dist/` and the Worker together:

```
npx wrangler d1 execute DB --local --file worker/schema.sql
npx wrangler dev
```

The local database is keyed by the `database_id` in `wrangler.jsonc`, so after that id changes the schema is applied again. `node deploy/report.mjs` (Node 22 or later) prints how each story was played and what players said of it, from the site's database, or from the local one with `--local`. Stop the dev server before running it: the report calls `npx wrangler`, which may replace the copy the server runs from.

### What the site collects

A player is never identified. When a story is opened the game makes a random id for that play and keeps it in the browser with the reading; "Read it again from the start" drops both. With that id the game sends the story and its wording version, that the story was opened and what this browser had already done with it, how far it was read and the seconds it was in view (whenever the page is hidden), each team accused and whether it was right, and that the truth was opened. After the truth, Veronique asks how the story fitted, which guests the player would see again and anything else; each part is optional and the answers are sent once per play. Each row carries the time it arrived. The Worker stores none of the request's headers, address or browser, and keeps no request log. The player's notes stay in the browser.

## The game view

`play/story/` is the game: the story as one strip read downward, every account a wide panel of its speaker with the words under it, and the player's workspace over it (`play/player/`): a dock of the guests' heads and the Rules, House, Notes and Library buttons. Veronique tells the rules in play (`play/player/rules-play.js`). It loads the shared reader and helpers in `play/` and the art in `art/drawn/`. `?story=<id>` picks the story.
