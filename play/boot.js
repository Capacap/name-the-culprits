// The page's view: the game where the address names a story (?story=<id>),
// else the library. index.html has already dropped the other view's
// stylesheets and markup.
if (new URLSearchParams(location.search).get("story")) await import("./story/story.js");
else await import("./play.js");
