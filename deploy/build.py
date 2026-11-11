"""Build the site's assets into dist/: the one page (play/), which is the
library or the game, with only the files it loads, comments stripped and
the portraits as WebP.

    uv run --with pillow python deploy/build.py [--jobs N] [--site URL]

Then `npx wrangler deploy` ships dist/ with the Worker (README.md). JS and
CSS are minified one file at a time by esbuild (npx), which keeps each
module and its imports as they are. The stories come from stories/ and the
art from art/drawn, neither of which this repository keeps (README.md), so
the build runs on the machine that holds them.

With --site, the stories the live site holds that this library no longer
lists, the ones it lists and the ones it kept unlisted before
(stories/kept.json), are fetched and shipped unlisted, so a link or a
half-read story still opens after a re-export; only stories of the format
check.mjs reads are kept, and their guests' art ships too.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from concurrent.futures import ProcessPoolExecutor

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
PAGES = ["play/index.html"]
ART = "art/drawn"
# The art the game loads, for the guests the library's stories name (see
# art_ship): each guest's portrait, their mood pictures (cast.js MOODS) and
# dock head, and Veronique's portrait, her two moods (cast.js HER) and her head. The placeholder guests' framed
# figures and faces (cast.js OWN) are not shipped, since no story in the
# library names them.
# The portraits' longest side on the site; the source is 1536.
ART_SIDE = 1024
ART_QUALITY = 80


def local(ref):
    return not re.match(r"^(https?:|data:|#|/)", ref)


def refs(path, text):
    """The local files a page, module or stylesheet loads, as paths from
    ROOT."""
    if path.endswith(".html"):
        found = re.findall(r'(?:href|src)="([^"]+)"', text)
    elif path.endswith(".js"):
        found = re.findall(r'(?:from|import)\s*\(?"([^"]+)"', text)
    else:
        found = re.findall(r'url\(["\']?([^"\')]+)', text)
    base = os.path.dirname(path)
    return [os.path.normpath(os.path.join(base, r.split("?")[0]))
            for r in found if local(r)]


def walk():
    """Every file the pages reach, from ROOT."""
    seen, todo = set(), PAGES + ["play/progress.js"]
    while todo:
        p = todo.pop()
        if p in seen:
            continue
        seen.add(p)
        with open(os.path.join(ROOT, p)) as fh:
            text = fh.read()
        todo += [r for r in refs(p, text) if r not in seen]
    return sorted(seen)


def to_webp(job):
    src, dst = job
    im = Image.open(src)
    im.thumbnail((ART_SIDE, ART_SIDE))
    im.save(dst, "WEBP", quality=ART_QUALITY, method=6)
    return os.path.getsize(src), os.path.getsize(dst)


def stage(files, tmp):
    """The shipped sources, edited for the site, into `tmp`."""
    for p in files:
        with open(os.path.join(ROOT, p)) as fh:
            text = fh.read()
        if p.endswith(".js"):
            # The portraits ship as WebP.
            text = text.replace('.png`', '.webp`')
        if p.endswith(".html"):
            text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
            text = re.sub(r"<title>.*?</title>", "<title>The Loose Threads</title>", text)
        out = os.path.join(tmp, p)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "w") as fh:
            fh.write(text)


def kept_stories(site):
    """The stories to ship unlisted from the live `site`: each its index
    lists or its stories/kept.json names whose id this library does not, as
    {id: (story, answer)} with the two files' bytes, where the story's
    format is the one check.mjs reads. The build writes the kept ids to
    dist/stories/kept.json, so a story outlives every later deploy until
    the format moves on."""
    with open(os.path.join(ROOT, "check.mjs")) as fh:
        fmt = int(re.search(r"^const FORMAT = (\d+);", fh.read(), re.M).group(1))
    with open(os.path.join(ROOT, "stories", "index.json")) as fh:
        ours = {s["id"] for s in json.load(fh)["stories"]}
    # Cloudflare refuses urllib's own user agent (403, 9 November 2026).
    get = lambda path: urllib.request.urlopen(urllib.request.Request(
        site.rstrip("/") + "/stories/" + path,
        headers={"User-Agent": "loose-threads-build"}), timeout=30).read()
    listed = json.loads(get("index.json"))["stories"]
    try:
        before = json.loads(get("kept.json"))
    except urllib.error.HTTPError:
        before = []
    kept = {}
    for s in listed + [{"id": i, "story": i + ".json", "answer": i + ".answer.json"} for i in before]:
        if s["id"] in ours or s["id"] in kept:
            continue
        story = get(s["story"])
        has = json.loads(story).get("format")
        if has != fmt:
            print("not kept: %s is format %s" % (s["id"], has))
            continue
        kept[s["id"]] = (story, get(s["answer"]))
    return kept


def art_ship(kept):
    """The art to ship, a folder to its file names: what the comment above
    ART lists for every guest of every story in stories/ and of the stories
    kept from the live site, so a guest without a portrait or a head stops
    the build."""
    guests = set()
    for f in os.listdir(os.path.join(ROOT, "stories")):
        if f.endswith(".json") and not f.endswith(".answer.json") and f != "index.json":
            with open(os.path.join(ROOT, "stories", f)) as fh:
                guests |= {c["id"] for c in json.load(fh)["cast"]}
    for story, _ in kept.values():
        guests |= {c["id"] for c in json.loads(story)["cast"]}
    guests = sorted(guests)
    with open(os.path.join(ROOT, "play", "cast.js")) as fh:
        cast_js = fh.read()
    const = lambda name: json.loads(re.search(r"^export const %s = (.*?);$" % name, cast_js, re.M | re.S).group(1))
    moods, heads, her = const("MOODS"), const("HEADS"), const("HER")
    # A guest the view would show at the placeholder's crop and zoom (cast.js
    # OWN_HEAD) never ships: every guest a story names has a HEADS line.
    unplaced = [g for g in guests if g not in heads]
    if unplaced:
        sys.exit("no HEADS line in play/cast.js for %s" % ", ".join(unplaced))
    pictures = ["%s@%s-%d" % (g, m, i) for g in guests for m, n in sorted(moods.get(g, {}).items()) for i in range(1, n + 1)]
    return {"hand": guests + pictures + ["narrator"] + ["narrator@%s" % m for m in her], "icon": guests + ["narrator"]}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--jobs", type=int, default=os.cpu_count(),
                    help="workers for the image conversion")
    ap.add_argument("--site", help="the live site, whose unlisted stories are kept")
    args = ap.parse_args()
    kept = kept_stories(args.site) if args.site else {}
    files = walk()
    if "play/story/story.js" not in files:
        sys.exit("the game's module was not reached from the page")
    # A library check.mjs faults (an older format, a broken verdict) never ships.
    if subprocess.run(["node", "check.mjs", "stories"], cwd=ROOT).returncode:
        sys.exit("check.mjs faults the library; nothing was built")
    # Every picture the site needs exists before dist/ is emptied, so a
    # missing one leaves the last good build in place rather than a dist/
    # with code and stories and no art.
    ship = art_ship(kept)
    for d, names in ship.items():
        for n in names:
            if not os.path.exists(os.path.join(ROOT, ART, d, n + ".png")):
                sys.exit("art %s/%s.png is missing; nothing was built" % (d, n))
    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    with tempfile.TemporaryDirectory(dir=os.path.expanduser("~/.cache")) as tmp:
        stage(files, tmp)
        code = [p for p in files if p.endswith((".js", ".css"))]
        for p in code:
            with open(os.path.join(tmp, p)) as fh:
                if ".png" in fh.read():
                    sys.exit("%s still names a .png, which the site ships as WebP" % p)
        subprocess.run(["npx", "--yes", "esbuild", *code, "--minify",
                        "--legal-comments=none", "--log-level=warning",
                        "--outbase=.", "--outdir=" + DIST],
                       cwd=tmp, check=True)
        for p in files:
            if p.endswith(".html"):
                os.makedirs(os.path.dirname(os.path.join(DIST, p)), exist_ok=True)
                shutil.copy(os.path.join(tmp, p), os.path.join(DIST, p))
    os.makedirs(os.path.join(DIST, "stories"))
    for f in os.listdir(os.path.join(ROOT, "stories")):
        if f.endswith(".json"):
            shutil.copy(os.path.join(ROOT, "stories", f), os.path.join(DIST, "stories", f))
    for sid, (story, answer) in kept.items():
        with open(os.path.join(DIST, "stories", sid + ".json"), "wb") as fh:
            fh.write(story)
        with open(os.path.join(DIST, "stories", sid + ".answer.json"), "wb") as fh:
            fh.write(answer)
    with open(os.path.join(DIST, "stories", "kept.json"), "w") as fh:
        json.dump(sorted(kept), fh)
    jobs = []
    for d, names in ship.items():
        src = os.path.join(ROOT, ART, d)
        os.makedirs(os.path.join(DIST, ART, d))
        for n in names:
            jobs.append((os.path.join(src, n + ".png"), os.path.join(DIST, ART, d, n + ".webp")))
    with ProcessPoolExecutor(max(1, args.jobs)) as pool:
        sizes = list(pool.map(to_webp, jobs))
    with open(os.path.join(DIST, "_redirects"), "w") as fh:
        fh.write("/ /play/ 302\n")
    listed = len([f for f in os.listdir(os.path.join(ROOT, "stories")) if f.endswith(".json") and not f.endswith(".answer.json")]) - 1
    print("%d code files, %d stories (%d kept unlisted), %d images (%.0f MB as PNG, %.0f MB as WebP)" % (
        len(files), listed + len(kept), len(kept), len(jobs),
        sum(a for a, _ in sizes) / 1e6, sum(b for _, b in sizes) / 1e6))


if __name__ == "__main__":
    main()
