// The house as a grid: every room in a cell, every door joining two rooms
// side by side, so each door is a short straight hallway. Every house in the
// library is a tree of rooms with at most four doors to a room, so a search
// over where each room stands beside the one it was reached from finds such
// a grid. It keeps the grid of fewest rows within MAX_COLS columns, then of
// fewest columns, so a map's width and height stay within a known bound.
// Rooms that stand side by side without a door between them are allowed.

export const MAX_COLS = 5;

export function grid(story) {
  const rooms = story.house.rooms.filter(r => !r.within);
  const next = Object.fromEntries(rooms.map(r => [r.id, []]));
  for (const [a, b] of story.house.doors) if (a in next && b in next) { next[a].push(b); next[b].push(a); }
  const hub = rooms.reduce((a, b) => next[b.id].length > next[a.id].length ? b : a).id;
  // Rooms in the order they are reached from the hub, each with the room it
  // was reached from.
  const order = [hub], from = {[hub]: null};
  for (let k = 0; k < order.length; k++)
    for (const n of next[order[k]]) if (!(n in from)) { from[n] = order[k]; order.push(n); }
  for (const r of rooms) if (!(r.id in from)) { from[r.id] = null; order.push(r.id); }   // a room without doors

  const at = {}, taken = new Set(), key = (x, y) => `${x},${y}`;
  let best = null;
  const score = (w, h) => (w > MAX_COLS ? 1000 * w : 0) + 10 * h + w;
  function box() {
    const xs = Object.values(at).map(p => p[0]), ys = Object.values(at).map(p => p[1]);
    return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  }
  function place(k) {
    const [x0, x1, y0, y1] = box(), s = score(x1 - x0 + 1, y1 - y0 + 1);
    if (best && s >= best.s) return;
    if (k === order.length) { best = {s, at: structuredClone(at), x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1}; return; }
    const id = order[k], p = from[id];
    // A room without doors goes anywhere free, beside the rest.
    const spots = p === null
      ? [...Array(x1 - x0 + 3).keys()].flatMap(i => [...Array(y1 - y0 + 3).keys()].map(j => [x0 - 1 + i, y0 - 1 + j]))
      : [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([dx, dy]) => [at[p][0] + dx, at[p][1] + dy]);
    for (const [x, y] of spots) {
      if (taken.has(key(x, y))) continue;
      at[id] = [x, y]; taken.add(key(x, y));
      place(k + 1);
      delete at[id]; taken.delete(key(x, y));
    }
  }
  at[hub] = [0, 0]; taken.add(key(0, 0));
  place(1);
  const placeOf = Object.fromEntries(Object.entries(best.at).map(([id, [x, y]]) => [id, [x - best.x0, y - best.y0]]));
  return {rooms, place: placeOf, cols: best.w, rows: best.h};
}
