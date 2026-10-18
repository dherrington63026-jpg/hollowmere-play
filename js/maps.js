// Story maps: the frozen trail and the first village. Cells: 0 = forest/solid, 1 = walkable snow, 2 = blocked (building, stall, well).
const mk = (w, h) => Array.from({ length: h }, () => Array(w).fill(0));
function disc(g, cx, cy, r) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
    if (g[y] && x >= 1 && x < g[0].length - 1 && y >= 1 && y < g.length - 1 && Math.hypot(x - cx, y - cy) <= r) g[y][x] = 1;
}
function line(g, a, b, r) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
  for (let i = 0; i <= n; i++) { const t = i / n; disc(g, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, r + Math.sin(i * 0.9) * 0.35); }
}
const rect = (g, x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = v; };

// ---- the trail: from the south (start) to the village gate in the north ----
const TRAIL_PTS = [[11, 53], [7, 45], [15, 38], [7, 30], [16, 22], [8, 14], [12, 6], [12, 2]];
export function trailMap() {
  const g = mk(24, 56);
  for (let i = 0; i < TRAIL_PTS.length - 1; i++) line(g, TRAIL_PTS[i], TRAIL_PTS[i + 1], 1.35);
  for (let i = 1; i <= 5; i++) disc(g, TRAIL_PTS[i][0], TRAIL_PTS[i][1], 2.8); // small clearings where the ambushes happen
  disc(g, 11, 52, 2.4);
  return {
    id: 'trail', name: 'The Frozen Trail', grid: g, start: [11, 52], gate: [12, 3],
    stages: TRAIL_PTS.slice(1, 6), // ambush clearings
    rocks: [[10, 49], [5, 41], [18, 34], [4, 27], [19, 19], [6, 11]],
  };
}

// ---- the village of Frostmoor ----
export function townMap() {
  const g = mk(28, 25);
  rect(g, 2, 2, 25, 23, 1);
  const B = [[3, 2, 8, 6, 'cabin'], [11, 2, 16, 5, 'hall'], [19, 2, 25, 6, 'cabin'], [2, 11, 6, 15, 'cabin']];
  for (const [x0, y0, x1, y1] of B) rect(g, x0, y0, x1, y1, 2);
  rect(g, 18, 12, 22, 13, 2); // the cook's stall
  rect(g, 9, 12, 10, 13, 2);  // well
  return {
    id: 'town', name: 'Frostmoor', grid: g, start: [14, 22],
    buildings: B.map(([x0, y0, x1, y1, kind]) => ({ x0, y0, x1, y1, kind })),
    stall: [18, 12, 22, 13], well: [9, 12, 10, 13], exit: [8, 2, 10, 5],
    npcs: { vendor: [20, 11.5] }, slots: [[12.5, 11], [22, 17], [6.5, 18.5], [16, 18.5], [9, 8]],
  };
}
