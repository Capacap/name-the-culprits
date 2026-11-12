// The page's view: the game where the address names a story (?story=<id>),
// else the library. index.html has already dropped the other view's
// stylesheets and markup, and hides the page until `reveal`, its head
// script's, is called: here, once the view is built, or has failed, and the
// fonts its text asks for have arrived.
try {
  if (new URLSearchParams(location.search).get("story")) await import("./story/story.js");
  else await import("./play.js");
} finally {
  document.body.offsetHeight;  // laid out, so every font the view's text needs is asked for
  await document.fonts.ready;
  reveal();
}
