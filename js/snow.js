// Builds the snowy outdoor worlds (trail + village) and the falling snow.
import * as THREE from 'three';

const rnd = (a, b) => a + Math.random() * (b - a);
// small deterministic random so the same map always looks the same
const seeded = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

function canvasTex(w, h, draw, repeat = null, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  t.anisotropy = 4; return t;
}
const snowTex = (rep) => canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#c9d6e4'; x.fillRect(0, 0, w, h);
  const r = seeded(7);
  for (let i = 0; i < 2600; i++) { const v = 200 + r() * 55; x.fillStyle = `rgba(${v - 14},${v - 4},${v + 4},${0.10 + r() * 0.16})`; x.beginPath(); x.arc(r() * w, r() * h, 1 + r() * 4, 0, 7); x.fill(); }
  for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.3})`; x.beginPath(); x.arc(r() * w, r() * h, 1 + r() * 3, 0, 7); x.fill(); }
}, rep);
const packedTex = () => canvasTex(256, 256, (x, w, h) => {
  const g = x.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(150,158,170,0.95)'); g.addColorStop(0.55, 'rgba(160,166,176,0.7)'); g.addColorStop(1, 'rgba(170,176,186,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const r = seeded(3); for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(${90 + r() * 40},${90 + r() * 40},${100 + r() * 40},${0.08 + r() * 0.12})`; x.beginPath(); x.arc(w * 0.2 + r() * w * 0.6, h * 0.2 + r() * h * 0.6, 2 + r() * 6, 0, 7); x.fill(); }
});
const woodTex = () => canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#6b4a32'; x.fillRect(0, 0, w, h); const r = seeded(11);
  for (let i = 0; i < 12; i++) { const v = 70 + r() * 40; x.fillStyle = `rgb(${v + 40},${v + 12},${v - 16})`; x.fillRect(i * (w / 12) + 1, 0, w / 12 - 2, h); x.fillStyle = 'rgba(20,10,0,0.35)'; x.fillRect(i * (w / 12), 0, 2, h); }
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(30,14,4,${0.05 + r() * 0.12})`; x.fillRect(r() * w, r() * h, 1 + r() * 2, 8 + r() * 30); }
}, [1, 1]);

export function buildSnowWorld(spec, TILE) {
  const GW = spec.grid[0].length, GH = spec.grid.length, grid = spec.grid;
  const world = new THREE.Group(), R = seeded(spec.id === 'trail' ? 21 : 5);
  const wx = (cx) => cx * TILE, wz = (cy) => cy * TILE;
  // ground
  const gm = new THREE.MeshStandardMaterial({ map: snowTex([(GW * TILE + 160) / 24, (GH * TILE + 160) / 24]), roughness: 0.95, metalness: 0, envMapIntensity: 0.3 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GW * TILE + 160, GH * TILE + 160), gm); ground.rotation.x = -Math.PI / 2; ground.position.set(GW * TILE / 2, -0.02, GH * TILE / 2); ground.receiveShadow = true; world.add(ground);
  // trodden path / plaza
  const floor = []; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (grid[y][x] === 1) floor.push([x, y]);
  const pm = new THREE.MeshStandardMaterial({ map: packedTex(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const pg = new THREE.PlaneGeometry(TILE * 2.1, TILE * 2.1); pg.rotateX(-Math.PI / 2);
  const pim = new THREE.InstancedMesh(pg, pm, floor.length); pim.receiveShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  floor.forEach(([x, y], i) => { q.setFromAxisAngle(up, R() * 6.28); m4.compose(new THREE.Vector3(wx(x), 0.03, wz(y)), q, new THREE.Vector3(1, 1, 1)); pim.setMatrixAt(i, m4); }); world.add(pim);

  // forest: every solid cell near the walkable area gets one or two spruce trees
  const near = (x, y, d) => { for (let j = -d; j <= d; j++) for (let i = -d; i <= d; i++) if (grid[y + j] && grid[y + j][x + i] === 1) return true; return false; };
  const trees = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (grid[y][x] !== 0) continue;
    if (spec.id === 'town' && x > 1 && x < GW - 2 && y > 1 && y < GH - 2) continue;
    if (!near(x, y, 4)) { if (R() > 0.18) continue; }
    const n = near(x, y, 1) ? 1 : (R() < 0.7 ? 2 : 1);
    for (let k = 0; k < n; k++) trees.push([wx(x) + (R() - 0.5) * TILE * 0.9, wz(y) + (R() - 0.5) * TILE * 0.9, 1.0 + R() * 0.8]);
  }
  if (spec.id === 'town') { // a ring of trees around the village
    for (let x = -3; x < GW + 3; x++) for (const y of [-2, -1, GH, GH + 1, GH + 2]) trees.push([wx(x) + (R() - 0.5) * 3, wz(y) + (R() - 0.5) * 3, 1.1 + R() * 0.7]);
    for (let y = -2; y < GH + 2; y++) for (const x of [-2, -1, 0, GW, GW + 1]) if (!(y < 5 && x === 0)) trees.push([wx(x) + (R() - 0.5) * 3, wz(y) + (R() - 0.5) * 3, 1.1 + R() * 0.7]);
  }
  const mkI = (geo, mat, cast) => { const im = new THREE.InstancedMesh(geo, mat, trees.length); im.castShadow = cast; im.receiveShadow = false; return im; };
  const trunkG = new THREE.CylinderGeometry(0.16, 0.26, 1.4, 6); trunkG.translate(0, 0.7, 0);
  // spruce: 6 drooping tiers with ragged edges (cone rim pushed in and out like branch tips)
  const tier = (r, h, y, seed) => { const c = new THREE.ConeGeometry(r, h, 16, 1, true), p = c.attributes.position, rr = seeded(seed);
    for (let i = 0; i < p.count; i++) { if (p.getY(i) < 0) { const k = 0.78 + rr() * 0.5, a = Math.atan2(p.getZ(i), p.getX(i)); p.setX(i, Math.cos(a) * r * k); p.setZ(i, Math.sin(a) * r * k); p.setY(i, p.getY(i) - rr() * 0.18); } }
    c.translate(0, y + h / 2, 0); c.computeVertexNormals(); return c; };
  const TIERS = [[1.55, 1.5, 1.0], [1.3, 1.45, 1.8], [1.08, 1.4, 2.6], [0.86, 1.3, 3.4], [0.62, 1.2, 4.2], [0.36, 1.1, 5.0]];
  const cones = TIERS.map(([r, h, y], i) => tier(r, h, y, 100 + i));
  const caps = TIERS.map(([r, h, y], i) => { const c = tier(r * 0.72, h * 0.55, y + h * 0.5, 200 + i); return c; });
  const mTrunk = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 1 }), mLeaf = new THREE.MeshStandardMaterial({ color: 0x24402f, roughness: 1, side: THREE.DoubleSide }), mCap = new THREE.MeshStandardMaterial({ color: 0xe8f0f8, roughness: 1, side: THREE.DoubleSide });
  const parts = [mkI(trunkG, mTrunk, true), ...cones.map((c) => mkI(c, mLeaf, true)), ...caps.map((c) => mkI(c, mCap, false))];
  const NC = cones.length;
  const col = new THREE.Color();
  trees.forEach(([x, z, s], i) => { q.setFromAxisAngle(up, R() * 6.28); m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s * 0.8, s * (0.9 + R() * 0.3), s * 0.8)); const v = 0.65 + R() * 0.55; col.setRGB(v, v * (0.95 + R() * 0.1), v); parts.forEach((p, k) => { p.setMatrixAt(i, m4); if (k >= 1 && k <= NC) p.setColorAt(i, col); }); });
  parts.forEach((p) => world.add(p));

  // rocks and snow drifts
  const rockG = new THREE.IcosahedronGeometry(1, 1), rockM = new THREE.MeshStandardMaterial({ color: 0x7c8087, roughness: 1, flatShading: true });
  for (const [x, y] of (spec.rocks || [])) { const r = new THREE.Mesh(rockG, rockM); r.scale.set(1.3 + R(), 0.9 + R() * 0.5, 1.2 + R()); r.position.set(wx(x), 0.3, wz(y)); r.castShadow = true; world.add(r);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, 6.3, 0, 1.2), mCap); cap.scale.copy(r.scale).multiplyScalar(1.02); cap.position.copy(r.position).add(new THREE.Vector3(0, 0.25, 0)); world.add(cap); }

  // ---- village buildings ----
  const wood = new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.9 }), roofSnow = new THREE.MeshStandardMaterial({ color: 0xf1f6fc, roughness: 1 }), roofDark = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 1 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffc070 }), doorM = new THREE.MeshStandardMaterial({ color: 0x2e1d12, roughness: 1 });
  for (const b of (spec.buildings || [])) {
    const w = (b.x1 - b.x0 + 1) * TILE, d = (b.y1 - b.y0 + 1) * TILE, h = b.kind === 'hall' ? 7 : 5.2, cx = wx((b.x0 + b.x1) / 2), cz = wz((b.y0 + b.y1) / 2);
    const g = new THREE.Group(); g.position.set(cx, 0, cz);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w - 1.2, h, d - 1.2), wood); body.position.y = h / 2; body.castShadow = body.receiveShadow = true; g.add(body);
    const roofH = b.kind === 'hall' ? 5 : 3.6, roof = new THREE.Mesh(new THREE.ConeGeometry(1, roofH, 4), roofSnow); roof.rotation.y = Math.PI / 4; roof.scale.set((w + 1.6) / 1.414, 1, (d + 1.6) / 1.414); roof.position.y = h + roofH / 2 - 0.05; roof.castShadow = true; g.add(roof);
    const under = new THREE.Mesh(new THREE.ConeGeometry(1, roofH + 0.2, 4), roofDark); under.rotation.y = Math.PI / 4; under.scale.set((w + 2.2) / 1.414, 1, (d + 2.2) / 1.414); under.position.y = h + roofH / 2 - 0.35; g.add(under);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3), doorM); door.position.set(0, 1.5, (d - 1.2) / 2 + 0.03); g.add(door);
    for (const sx of [-1, 1]) { const wn = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), glow); wn.position.set(sx * Math.min(w * 0.28, 4), 2.9, (d - 1.2) / 2 + 0.03); g.add(wn); }
    const chim = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 1), new THREE.MeshStandardMaterial({ color: 0x59595f, roughness: 1 })); chim.position.set(w * 0.25, h + roofH * 0.55, -d * 0.2); chim.castShadow = true; g.add(chim);
    world.add(g);
  }
  if (spec.well) { const [x0, y0, x1, y1] = spec.well; const g = new THREE.Group(); g.position.set(wx((x0 + x1) / 2), 0, wz((y0 + y1) / 2));
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 1.6, 14), new THREE.MeshStandardMaterial({ color: 0x80848c, roughness: 1, flatShading: true })); ring.position.y = 0.8; ring.castShadow = true; g.add(ring);
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.1, 14), new THREE.MeshStandardMaterial({ color: 0x1a2c3a, roughness: 0.2 })); water.rotation.x = -Math.PI / 2; water.position.y = 1.5; g.add(water);
    const snow = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.35, 6, 14), mCap); snow.rotation.x = Math.PI / 2; snow.position.y = 1.65; g.add(snow);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 0.4), wood); p.position.set(s * 2.5, 2.6, 0); g.add(p); }
    const rf = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.4, 2), roofSnow); rf.position.y = 4.7; g.add(rf);
    world.add(g); }
  if (spec.stall) { const [x0, y0, x1, y1] = spec.stall; const g = new THREE.Group(); g.position.set(wx((x0 + x1) / 2), 0, wz((y0 + y1) / 2));
    const w = (x1 - x0 + 1) * TILE - 1;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, 2.4), wood); counter.position.set(0, 1.1, 0.6); counter.castShadow = true; g.add(counter);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.25, 2.8), new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.8 })); top.position.set(0, 2.3, 0.6); g.add(top);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6.2, 0.35), wood); p.position.set(s * (w / 2 - 0.2), 3.1, -2.4); p.castShadow = true; g.add(p); }
    const aw = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.25, 5.2), new THREE.MeshStandardMaterial({ color: 0x8c2f2a, roughness: 1 })); aw.position.set(0, 6.3, -0.4); aw.rotation.x = 0.16; aw.castShadow = true; g.add(aw);
    const awS = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.3, 5.2), roofSnow); awS.position.set(0, 6.5, -0.4); awS.rotation.x = 0.16; g.add(awS);
    // a pot of stew on the counter and hanging sausages
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 1, 12), new THREE.MeshStandardMaterial({ color: 0x232326, metalness: 0.6, roughness: 0.5 })); pot.position.set(-w * 0.28, 2.95, 0.6); g.add(pot);
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 4, 8), new THREE.MeshStandardMaterial({ color: 0x8e3b2a, roughness: 0.7 })); s.position.set(-w * 0.1 + i * 0.9, 5.3, -2.0); s.rotation.z = Math.PI / 2 * 0; g.add(s); }
    world.add(g); }
  return world;
}

// falling snow that follows the hero
export function makeSnowfall(count = 1400) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { pos[i * 3] = rnd(-26, 26); pos[i * 3 + 1] = rnd(0, 18); pos[i * 3 + 2] = rnd(-22, 22); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const tex = canvasTex(32, 32, (x, w, h) => { const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); }, null, false);
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.26, map: tex, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true }));
  pts.frustumCulled = false;
  pts.userData.update = (dt, hero) => {
    const a = g.attributes.position.array;
    for (let i = 0; i < count; i++) {
      a[i * 3 + 1] -= (2.2 + (i % 7) * 0.35) * dt; a[i * 3] += (0.9 + Math.sin(i) * 0.4) * dt;
      if (a[i * 3 + 1] < 0) a[i * 3 + 1] += 18;
      if (a[i * 3] > 26) a[i * 3] -= 52; if (a[i * 3 + 2] > 22) a[i * 3 + 2] -= 44; if (a[i * 3 + 2] < -22) a[i * 3 + 2] += 44; if (a[i * 3] < -26) a[i * 3] += 52;
    }
    g.attributes.position.needsUpdate = true; pts.position.set(hero.x, 0, hero.z);
  };
  return pts;
}
