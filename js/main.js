// Hollowmere 3D gameplay test: free-roam action RPG, angled top-down camera, one hero.
// Stand-in art: KayKit Adventurers / Skeletons / Dungeon Remastered (CC0, Kay Lousberg).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CLASSES, SKILLS, HEAL_SKILLS, SELF_SKILLS, RARITIES, TIERS, rollRarity, XP_NEED, heroStats, heroEffects, skillCost, loadSave, newSave, writeSave, partyHeroes, makeItem, avgPartyLevel, salvageValue, rnd, pick, clamp, newHero, newStorySave } from './data.js';
import { trailMap, townMap } from './maps.js';
import { buildSnowWorld, makeSnowfall } from './snow.js';
import { dialogFor, NPC_INFO, questLine, MEAT_NEED, recruitInfo, markerFor, huntWanted, storyKill, availableRecruits, fixStory } from './story.js';

const $ = (s) => document.querySelector(s);
const Q = new URLSearchParams(location.search);
const SPEED = Number(Q.get('speed')) || 1;

const ENEMY = {
  minion: { model: 'Skeleton_Minion', weapon: 'Skeleton_Blade', name: 'Skeleton', hp: 70, atk: 9, speed: 3.4, range: 1.9, cd: 1.6, xp: 14, scale: 1, attack: '1H_Melee_Attack_Chop' },
  rogue: { model: 'Skeleton_Rogue', weapon: 'Skeleton_Blade', name: 'Skeleton Cutthroat', hp: 50, atk: 7, speed: 4.8, range: 1.8, cd: 1.0, xp: 14, scale: 0.95, attack: '1H_Melee_Attack_Stab' },
  mage: { model: 'Skeleton_Mage', weapon: 'Skeleton_Staff', name: 'Bone Caster', hp: 55, atk: 11, speed: 3.0, range: 9, cd: 2.4, xp: 18, scale: 1, ranged: true, attack: 'Spellcast_Shoot' },
  warrior: { model: 'Skeleton_Warrior', weapon: 'Skeleton_Axe', name: 'Skeleton Brute', hp: 170, atk: 14, speed: 2.8, range: 2.3, cd: 2.2, xp: 30, scale: 1.12, heavy: 0.5, attack: '2H_Melee_Attack_Chop' },
  wolf: { wolf: true, living: true, name: 'Winter Wolf', hp: 60, atk: 9, speed: 5.4, range: 1.8, cd: 1.3, xp: 12, scale: 1, attack: 'Bite', drops: 'meat' },
  bandit: { model: 'Rogue_Hooded', show: ['Knife'], tint: 0xb8a58c, living: true, name: 'Trail Raider', hp: 100, atk: 12, speed: 4.6, range: 1.8, cd: 1.5, xp: 20, scale: 1.0, attack: '1H_Melee_Attack_Stab' },
  boss: { model: 'Skeleton_Warrior', weapon: 'Skeleton_Axe', name: 'The Bone Warden', hp: 1500, atk: 22, speed: 3.0, range: 3.4, cd: 2.0, xp: 250, scale: 1.5, heavy: 0.6, boss: true, attack: '2H_Melee_Attack_Chop' },
};
// ---------------- the crypt map (cells) ----------------
// rooms and corridors are carved into a grid; every floor cell is TILE x TILE world units
let GW = 24, GH = 26;
const grid = Array.from({ length: GH }, () => Array(GW).fill(0)); // 0 = solid, 1 = floor, 2 = floor but blocked (pillar/prop)
const ROOMS = {
  A: [1, 1, 5, 5], B: [9, 1, 19, 8], C: [11, 13, 21, 19], D: [1, 14, 8, 24],
};
function carve(x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y][x] = 1; }
for (const k in ROOMS) carve(...ROOMS[k]);
carve(6, 3, 8, 4);     // A -> B
carve(15, 9, 16, 12);  // B -> C
carve(9, 16, 10, 17);  // C -> D
const PILLARS = [[12, 3], [16, 3], [12, 6], [16, 6], [3, 17], [6, 17], [3, 21], [6, 21], [14, 15], [18, 17]];
for (const [x, y] of PILLARS) grid[y][x] = 2;

// ---------------- three.js setup ----------------
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// phones: lighter graphics from the start (the auto-fallback below lowers things further if it is still slow)
const MOBILE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 500;
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.25 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06050a);
scene.fog = new THREE.FogExp2(0x07060a, 0.024);
const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 200);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.32, 0.4, 0.95);
composer.addPass(bloom); if (MOBILE) bloom.enabled = false;
composer.addPass(new OutputPass());

const hemi = new THREE.HemisphereLight(0x7a88c0, 0x1e160e, 0.5); scene.add(hemi);
const moon = new THREE.DirectionalLight(0xa4b4ff, 0.85);
moon.castShadow = true; moon.shadow.mapSize.set(MOBILE ? 1024 : 1536, MOBILE ? 1024 : 1536);
Object.assign(moon.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.03;
scene.add(moon, moon.target);
const heroLight = new THREE.PointLight(0xffc89a, 14, 16, 1.3);
scene.add(heroLight);
// The number of lights must NEVER change while playing: every change makes three.js recompile all shaders (that was the freezing).
const TORCH_LIGHTS = Array.from({ length: 6 }, () => { const l = new THREE.PointLight(0xff8a3a, 0, 15, 1.6); scene.add(l); return l; });
const FX_LIGHTS = Array.from({ length: 3 }, () => { const l = new THREE.PointLight(0xffffff, 0, 9, 2); scene.add(l); return l; });
let fxLightI = 0;

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h;
  camera.fov = w / h < 1.2 ? 50 : 38; // a bit wider when the phone is held upright
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ---------------- asset loading ----------------
const loader = new GLTFLoader();
const GL = {};
async function loadAll(names) {
  let done = 0;
  await Promise.all(names.map(async (n) => {
    GL[n] = await loader.loadAsync(n.includes('/') ? n : `assets/chars/${n}.glb`);
    done++; const lm = $('#loadMsg'); if (lm) lm.textContent = `Loading the crypt... ${Math.round(done / names.length * 100)}%`;
  }));
}
const D = (n) => `assets/dungeon/${n}.glb`;
const PH = (n) => `assets/ph/models/${n}/${n}.gltf`;
// realistic CC0 props from Poly Haven (sizes are real-world metres; scaled to the hero below)
const PH_MODELS = ['Barrel_01', 'wooden_barrels_01', 'wooden_crate_01', 'treasure_chest', 'wooden_candlestick', 'kite_shield', 'gothic_statue', 'brass_candleholders', 'wooden_bucket_01', 'WoodenTable_01'];
const PROPS = ['coin_stack_small'];
const TILE = 4, WALL_H = 5.2, WALL_T = 0.9;
let M2U = 1.5; // world units per real metre (set from the hero model's height)

function cloneStatic(n) {
  const o = GL[D(n)].scene.clone(true);
  o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return o;
}
function clonePH(n, extra = 1) {
  const o = GL[PH(n)].scene.clone(true);
  o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  o.scale.setScalar(M2U * extra);
  return o;
}
const W2 = (cx, cy) => new THREE.Vector3(cx * TILE, 0, cy * TILE);
const cellOf = (x, z) => [Math.round(x / TILE), Math.round(z / TILE)];
const isFloor = (cx, cy) => cy >= 0 && cy < GH && cx >= 0 && cx < GW && grid[cy][cx] === 1;
function walkable(x, z, r = 0.55) {
  for (const [dx, dz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) { const [cx, cy] = cellOf(x + dx, z + dz); if (!isFloor(cx, cy)) return false; }
  return true;
}

// physically based stone materials (colour, bumps, roughness, ambient occlusion)
const texLoader = new THREE.TextureLoader();
function pbr(name, rx, ry, opts = {}) {
  const t = (k, srgb) => {
    const tx = texLoader.load(`assets/ph/tex/${name}_${k}.jpg`);
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(rx, ry); tx.anisotropy = 8;
    if (srgb) tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  };
  return new THREE.MeshStandardMaterial({ map: t('diff', true), normalMap: t('nor'), roughnessMap: t('rough'), aoMap: t('ao'), aoMapIntensity: 1,
    normalScale: new THREE.Vector2(1.4, 1.4), roughness: 1, metalness: 0, color: opts.tint || 0xffffff, envMapIntensity: 0.35 });
}
function flameTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 80, 2, 64, 70, 60);
  g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.25, 'rgba(255,190,90,0.95)'); g.addColorStop(0.55, 'rgba(255,100,30,0.5)'); g.addColorStop(1, 'rgba(120,20,0,0)');
  x.fillStyle = g; x.beginPath(); x.ellipse(64, 72, 38, 56, 0, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowTexture = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
})();

let cryptWorld = null;
const fadeWalls = [];
const torches = [];
function buildCrypt() {
  // scale real-world props to the hero (a person is about 1.75 m)
  const hb = new THREE.Box3().setFromObject(GL.Knight.scene); M2U = (hb.max.y - hb.min.y) / 1.6;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.22;
  const world = cryptWorld = new THREE.Group(); scene.add(world);
  const floorMat = pbr('floor', 1.3, 1.3, { tint: 0xb0a89e }), floorMat2 = pbr('floor2', 1.6, 1.6, { tint: 0xd8d0c8 });
  const wallMat = pbr('wall', 1.2, 1.6, { tint: 0xb4aca2 }), capMat = new THREE.MeshStandardMaterial({ color: 0x15110f, roughness: 1 });
  const pillarMat = pbr('pillar', 1, 2.4, { tint: 0xd0c6ba });
  const floorGeo = new THREE.PlaneGeometry(TILE, TILE); floorGeo.rotateX(-Math.PI / 2);
  const wallGeo = new THREE.BoxGeometry(TILE + WALL_T, WALL_H, WALL_T);
  // the floor of every room is one instanced mesh per stone type (fast on phones)
  const cells = [], cells2 = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (grid[y][x]) cells.push([x, y]);
  for (const [list, mat] of [[cells, floorMat], [cells2, floorMat2]]) {
    const im = new THREE.InstancedMesh(floorGeo, mat, list.length); im.receiveShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    list.forEach(([x, y], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((x + y * 3) % 4) * Math.PI / 2); m4.compose(W2(x, y), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m4); });
    world.add(im);
  }
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (!grid[y][x]) continue;
    if (grid[y][x] === 2 && PILLARS.some(([px, py]) => px === x && py === y)) addPillar(world, W2(x, y), pillarMat);
    const sides = [[0, -1, 0, 'N'], [0, 1, 0, 'S'], [-1, 0, Math.PI / 2, 'W'], [1, 0, Math.PI / 2, 'E']];
    for (const [dx, dy, rot, side] of sides) {
      if (grid[y + dy] && grid[y + dy][x + dx]) continue;
      const fade = side !== 'N';
      const mats = [wallMat, wallMat, capMat, wallMat, wallMat, wallMat].map((m) => fade ? m.clone() : m);
      if (fade) mats.forEach((m) => { m.transparent = true; });
      const w = new THREE.Mesh(wallGeo, mats); w.castShadow = true; w.receiveShadow = true;
      w.position.set((x + dx * 0.5) * TILE + dx * WALL_T * 0.5, WALL_H / 2, (y + dy * 0.5) * TILE + dy * WALL_T * 0.5); w.rotation.y = rot;
      world.add(w);
      if (fade) fadeWalls.push({ obj: w, side, x: w.position.x, z: w.position.z, a: 1 });
      if (side === 'N' && (x + y) % 3 === 0) addTorch(world, x * TILE, (y - 0.5) * TILE + 0.15);
      if (side === 'N' && (x * 5 + y) % 7 === 0) { const s = clonePH('kite_shield', 1.3); s.position.set(x * TILE + 1.3, 0.72 * M2U * 1.3, (y - 0.5) * TILE + 0.3); s.rotation.set(-0.25, 0, 0.1); world.add(s); }
    }
  }
  // set dressing (decor only, never on paths)
  const deco = [[1, 1, 'Barrel_01'], [5, 1, 'wooden_crate_01'], [1, 5, 'wooden_barrels_01'], [19, 1, 'wooden_barrels_01'], [9, 8, 'wooden_bucket_01'], [19, 8, 'WoodenTable_01'],
    [21, 13, 'Barrel_01'], [11, 19, 'wooden_crate_01'], [21, 19, 'wooden_barrels_01'], [1, 24, 'brass_candleholders'], [8, 24, 'brass_candleholders'], [4, 24, 'gothic_statue'], [8, 14, 'treasure_chest']];
  for (const [x, y, n] of deco) {
    const o = clonePH(n, n === 'gothic_statue' ? 1.8 : n === 'brass_candleholders' ? 1.6 : 1.25);
    o.position.copy(W2(x, y)).add(new THREE.Vector3(rnd(-0.6, 0.6), 0, rnd(-0.6, 0.6)));
    if (n === 'gothic_statue') { o.position.set(x * TILE, 1.21 * M2U * 1.8, (y + 0.2) * TILE); o.rotation.y = Math.PI; }
    else o.rotation.y = rnd(0, 6);
    world.add(o); grid[y][x] = 2;
    if (n === 'brass_candleholders') addCandleGlow(world, o.position.clone().setY(0.85 * M2U * 1.6));
  }
  // drifting dust in the torchlight
  const N = 500, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = rnd(0, GW * TILE); pos[i * 3 + 1] = rnd(0.3, 6); pos[i * 3 + 2] = rnd(0, GH * TILE); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.09, map: glowTexture, color: 0xffd9a0, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  world.add(dust);
}
let dust = null;
function addPillar(world, p, mat) {
  const g = new THREE.Group(); g.position.copy(p);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, WALL_H + 1, 14), mat); shaft.position.y = (WALL_H + 1) / 2;
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.7, 2.3), mat); base.position.y = 0.35;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.5, 2.1), mat); cap.position.y = WALL_H + 0.8;
  for (const m of [shaft, base, cap]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  world.add(g);
}
const FLAME = flameTexture();
function addTorch(world, x, z) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.9 }), iron = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.8 });
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 1.1, 8), wood); stick.position.set(x, 3.0, z + 0.42); stick.rotation.x = 0.45; stick.castShadow = true;
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.5), iron); bracket.position.set(x, 2.75, z + 0.2);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.1, 0.25, 10), iron); cup.position.set(x, 3.5, z + 0.66);
  world.add(stick, bracket, cup);
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: FLAME, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  fl.position.set(x, 3.95, z + 0.68); fl.scale.set(0.7, 1.05, 1); world.add(fl);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xff7a2a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.copy(fl.position); halo.scale.set(3.2, 3.2, 1); world.add(halo);
  torches.push({ pos: new THREE.Vector3(x, 3.9, z + 1.3), fl, halo, ph: rnd(0, 10), base: 26, color: 0xff8a3a, dist: 15 });
}
function addCandleGlow(world, p) {
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xffa040, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.copy(p); halo.scale.set(1.6, 1.6, 1); world.add(halo);
  torches.push({ pos: p.clone().add(new THREE.Vector3(0, 0.5, 0)), fl: halo, halo: null, ph: rnd(0, 10), base: 10, small: true, color: 0xffb060, dist: 8 });
}

// ---------------- characters ----------------
class Anim {
  constructor(root, clips, alias = null) { this.mixer = new THREE.AnimationMixer(root); this.clips = clips; this.alias = alias; this.actions = {}; this.cur = null; this.name = ''; }
  get(n) {
    if (this.alias && this.alias[n]) n = this.alias[n];
    if (this.actions[n] !== undefined) return this.actions[n];
    const c = THREE.AnimationClip.findByName(this.clips, n);
    return (this.actions[n] = c ? this.mixer.clipAction(c) : null);
  }
  dur(n) { const a = this.get(n); return a ? a.getClip().duration : 0.6; }
  play(n, { fade = 0.14, once = false, speed = 1 } = {}) {
    const a = this.get(n); if (!a) return null;
    if (this.cur === a && !once) { a.timeScale = speed; return a; }
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once; a.timeScale = speed; a.enabled = true;
    a.setEffectiveWeight(1); a.play();
    if (this.cur && this.cur !== a) this.cur.crossFadeTo(a, fade, false);
    this.cur = a; this.name = n; return a;
  }
  update(dt) { this.mixer.update(dt); }
}
function makeModel(modelName, show, scale = 1, tint = 0, real = null) {
  if (real && REAL[real]) return makeRealModel(real);
  const src = GL[modelName];
  const root = SkeletonUtils.clone(src.scene);
  const mats = [];
  root.traverse((m) => {
    if (m.isMesh || m.isSkinnedMesh) {
      m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false;
      m.material = m.material.clone(); mats.push(m.material);
      if (show && !show.includes(m.name) && /Sword|Shield|Axe|Staff|Wand|Spellbook|Crossbow|Knife|Throwable|Mug|Arrow|Quiver/i.test(m.name)) m.visible = false;
    }
  });
  if (tint) for (const mt of mats) if (mt.color) mt.color.multiply(new THREE.Color(tint));
  for (const mt of mats) { if (mt.map) { mt.metalness = 0.18; mt.roughness = 0.62; mt.color.multiply(new THREE.Color(0xd9d2ca)); } mt.envMapIntensity = 0.7; }
  root.traverse((o) => { if (o.isBone && o.name === 'head') o.scale.multiplyScalar(0.8); }); // KayKit heads are oversized: shrink for more natural proportions
  root.scale.set(scale * 0.96, scale * 1.1, scale * 0.96);
  const g = new THREE.Group(); g.add(root);
  return { g, root, mats, anim: new Anim(root, src.animations) };
}
// ---------- realistic characters (TRELLIS 3D model + Mixamo skeleton/animations) ----------
const REAL = {};
const REAL_ALIAS = {
  Idle: 'idle', '2H_Melee_Idle': 'idle', Idle_Combat: 'idle', Running_A: 'run', Walking_A: 'walk', Walking_Backwards: 'walk', Cheer: 'cheer', Hit_A: 'hit', Death_A: 'death', Death_B: 'death',
  '1H_Melee_Attack_Slice_Diagonal': 'attack1', '1H_Melee_Attack_Slice_Horizontal': 'attack2', '1H_Melee_Attack_Chop': 'attack3',
  Block_Attack: 'attack1', Block: 'idle', '2H_Melee_Attack_Spin': 'attack3', '2H_Melee_Attack_Spinning': 'attack3', '2H_Melee_Attack_Stab': 'attack2', Dodge_Forward: 'run', Throw: 'attack2',
  Spellcast_Long: 'attack2', Spellcast_Raise: 'attack3', Spellcast_Shoot: 'attack1', Spellcast_Summon: 'attack3', '2H_Ranged_Shoot': 'attack1', '2H_Ranged_Aiming': 'attack2',
  Dualwield_Melee_Attack_Slice: 'attack1', Dualwield_Melee_Attack_Stab: 'attack2', Dualwield_Melee_Attack_Chop: 'attack3',
  '2H_Melee_Attack_Chop': 'attack1', '2H_Melee_Attack_Slice': 'attack2', Taunt: 'cheer',
};
// weapons attached to the hero's hand bones (taken from the stand-in pack); rot/pos/scale tuned by eye
const REAL_CFG = {
  knight_female: { weapons: [{ src: 'Knight', name: '1H_Sword', bone: 'mixamorigRightHand', rot: [-1.25, 0, 0.15], pos: [0, 0.05, 0.02], sc: 0.62 }, { src: 'Knight', name: 'Badge_Shield', bone: 'mixamorigLeftForeArm', rot: [0, Math.PI / 2, 0], pos: [0, 0.12, 0.08], sc: 0.7 }] },
  // "world" = how the weapon should point in the world at rest (x tilts forward, z tilts sideways); the code works out the hand rotation
  mage_female: { weapons: [{ src: 'Mage', name: '2H_Staff', bone: 'mixamorigRightHand', world: [0.12, 0, -0.08], pos: [0, 0, 0], sc: 0.9 }] },
  healer_female: { weapons: [{ src: 'Mage', name: '1H_Wand', bone: 'mixamorigRightHand', world: [0.5, 0, -0.1], pos: [0, 0, 0], sc: 1.0 }, { src: 'Mage', name: 'Spellbook', bone: 'mixamorigLeftHand', world: [0.9, 0, 0], pos: [0, 0.04, 0.04], sc: 0.9 }] },
  ranger_male: { weapons: [{ src: 'Rogue_Hooded', name: '2H_Crossbow', bone: 'mixamorigRightHand', world: [1.45, 0, 0], pos: [0, 0.05, 0], sc: 0.85 }] },
  warrior_male: { weapons: [{ src: 'Barbarian', name: '2H_Axe', bone: 'mixamorigRightHand', world: [0.2, 0, -0.15], pos: [0, 0, 0], sc: 0.9 }] },
  rogue_female: { weapons: [{ src: 'Rogue_Hooded', name: 'Knife', bone: 'mixamorigRightHand', world: [1.5, 0, 0.2], pos: [0, 0.03, 0], sc: 1.0 }, { src: 'Rogue_Hooded', name: 'Knife_Offhand', bone: 'mixamorigLeftHand', world: [1.5, 0, -0.2], pos: [0, 0.03, 0], sc: 1.0 }] },
};
// Mixamo animations work on every Mixamo-rigged hero (same bone names), so they live in models3d/shared and each hero only needs its own body file.
const REAL_COMMON = { run: 'run', walk: 'walk', hit: 'hit', death: 'death', cheer: 'cheer' };
const REAL_ATTACKS = {
  knight_female: ['sword1', 'sword2', 'sword3'], mage_female: ['cast_2h', 'cast_1h', 'cast_area'], healer_female: ['cast_1h', 'cast_2h', 'cast_area'],
  ranger_male: ['bow_overdraw', 'bow_draw', 'bow_overdraw'], warrior_male: ['melee_h', 'melee_d', 'melee_360'], rogue_female: ['melee_d', 'melee_h', 'melee_360'],
};
const SHARED_CLIPS = {}; // file -> clip (loaded once)
async function sharedClip(file, L) {
  if (!SHARED_CLIPS[file]) {
    const src = await L.loadAsync(`models3d/shared/${file}.fbx`), c = src.animations[0].clone();
    // keep the character in place: remove sideways/forward drift from the hips (stay with the vertical bob)
    for (const t of c.tracks) if (/Hips\.position$/.test(t.name)) { const v = t.values, x0 = v[0], z0 = v[2]; for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; } }
    // the run clip was captured turned ~30 degrees: take out its average hip yaw so she runs the way she faces
    if (/run/i.test(file)) for (const t of c.tracks) if (/Hips\.quaternion$/.test(t.name)) {
      const v = t.values; let sy = 0, n = 0;
      for (let i = 0; i < v.length; i += 4) { sy += Math.atan2(2 * (v[i + 3] * v[i + 1] + v[i] * v[i + 2]), 1 - 2 * (v[i + 1] * v[i + 1] + v[i] * v[i])); n++; }
      const m = sy / n, sn = Math.sin(-m / 2), cs = Math.cos(-m / 2);
      for (let i = 0; i < v.length; i += 4) { const a = v[i], b = v[i + 1], cc = v[i + 2], d = v[i + 3];
        v[i] = cs * a + sn * cc; v[i + 1] = cs * b + sn * d; v[i + 2] = cs * cc - sn * a; v[i + 3] = cs * d - sn * b; }
    }
    SHARED_CLIPS[file] = c;
  }
  return SHARED_CLIPS[file];
}
async function loadReal(key) {
  const dir = `models3d/${key}`, L = new FBXLoader();
  const base = await L.loadAsync(`${dir}/idle.fbx`), clips = [];
  const idle = base.animations[0].clone(); idle.name = 'idle'; for (const t of idle.tracks) if (/Hips\.position$/.test(t.name)) { const v = t.values, x0 = v[0], z0 = v[2]; for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; } }
  clips.push(idle);
  const want = { ...REAL_COMMON }; (REAL_ATTACKS[key] || REAL_ATTACKS.knight_female).forEach((f, i) => { want['attack' + (i + 1)] = f; });
  for (const [name, file] of Object.entries(want)) { try { const c = (await sharedClip(file, L)).clone(); c.name = name; clips.push(c); } catch (e) { console.warn('clip missing', file); } }
  const tx = await new THREE.TextureLoader().loadAsync(`${dir}/tex.png`); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  REAL[key] = { scene: base, clips, tx };
}
function makeRealModel(key) {
  const R = REAL[key], root = SkeletonUtils.clone(R.scene), mats = [];
  root.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false; if (!m.geometry.userData.nrm) { m.geometry.computeVertexNormals(); m.geometry.userData.nrm = 1; }
      m.material = new THREE.MeshStandardMaterial({ map: R.tx, roughness: 0.55, metalness: 0.3, envMapIntensity: 0.8 }); mats.push(m.material);
    }
  });
  // same height as the stand-in knight so the camera and hit boxes still fit
  const hb = new THREE.Box3().setFromObject(GL.Knight.scene); const want = (hb.max.y - hb.min.y) * 1.08;
  const bb = new THREE.Box3().setFromObject(root), k = want / (bb.max.y - bb.min.y); root.scale.multiplyScalar(k);
  root.updateMatrixWorld(true);
  const held = [];
  for (const w of (REAL_CFG[key] ? REAL_CFG[key].weapons : [])) {
    const bone = root.getObjectByName(w.bone); let obj = null;
    if (GL[w.src]) GL[w.src].scene.traverse((m) => { if (m.name === w.name) obj = m; });
    if (!bone || !obj) continue;
    obj = obj.clone(true); const ws = new THREE.Vector3(); bone.getWorldScale(ws);
    obj.visible = true; obj.scale.setScalar(w.sc / ws.x); obj.position.set(w.pos[0] / ws.x, w.pos[1] / ws.x, w.pos[2] / ws.x);
    if (w.world) { bone.updateWorldMatrix(true, false); const qb = bone.getWorldQuaternion(new THREE.Quaternion()), qw = new THREE.Quaternion().setFromEuler(new THREE.Euler(...w.world)); obj.quaternion.copy(qb.invert().multiply(qw)); }
    else obj.rotation.set(...w.rot);
    bone.add(obj);
    obj.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.material = m.material.clone(); mats.push(m.material); m.visible = true; } });
    held.push(obj);
  }
  const g = new THREE.Group(); g.add(root);
  return { g, root, mats, anim: new Anim(root, R.clips, REAL_ALIAS), held, sword: held[0], shield: held[1] };
}
function attachWeapon(model, wname) {
  let slot = null; model.root.traverse((o) => { if (o.name === 'handslot.r') slot = o; });
  if (!slot || !GL[`assets/skelweap/${wname}.gltf`]) return;
  const w = GL[`assets/skelweap/${wname}.gltf`].scene.clone(true);
  w.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.material = m.material.clone(); model.mats.push(m.material); } });
  slot.add(w);
}
function flash(ent, color = 0xffd8b0, t = 0.1) {
  ent.flashT = t;
  for (const m of ent.mats) if (m.emissive) { m.emissive.setHex(color); m.emissiveIntensity = 0.35; }
}
function unflash(ent) { for (const m of ent.mats) if (m.emissive) { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; } }

// ---------------- game state ----------------

// ---------------- maps: the crypt, the frozen trail, the village ----------------
const CRYPT = { grid: null }, MAPS = {};
let MAPNAME = 'crypt', snowfall = null, SPAWN = [3, 3];
const TREE_ASSETS = []; // real spruce models, loaded at boot if the files exist
function setGrid(g) { grid.length = 0; for (const r of g) grid.push(r.slice()); GW = g[0].length; GH = g.length; }
function ensureMap(name) {
  if (MAPS[name]) return MAPS[name];
  const spec = name === 'trail' ? trailMap() : townMap();
  const world = buildSnowWorld(spec, TILE, TREE_ASSETS);
  if (name === 'town') { // village dressing (real-world scale props)
    const P = [['Barrel_01', 17.4, 13.6, 1.5], ['Barrel_01', 22.9, 13.8, 1.5], ['wooden_crate_01', 23.3, 15.0, 1.4], ['wooden_barrels_01', 17.2, 10.2, 1.5], ['wooden_crate_01', 22.8, 10.4, 1.4], ['wooden_bucket_01', 11.6, 13.4, 1.6],
      ['WoodenTable_01', 14.5, 17.5, 1.5], ['wooden_barrels_01', 3.0, 9.6, 1.5], ['wooden_crate_01', 7.2, 8.0, 1.4], ['Barrel_01', 19.1, 7.6, 1.5], ['wooden_crate_01', 8.3, 16.4, 1.4], ['brass_candleholders', 9.0, 8.0, 1.6], ['brass_candleholders', 18.0, 8.0, 1.6]];
    for (const [n, cx, cy, sc] of P) { const o = clonePH(n, sc); o.position.set(cx * TILE, 0, cy * TILE); o.rotation.y = rnd(0, 6); world.add(o); }
  }
  scene.add(world); return (MAPS[name] = { spec, world });
}
function setEnv(snow) {
  scene.background.set(snow ? 0xb9c8d6 : 0x06050a); scene.fog.color.set(snow ? 0xb9c8d6 : 0x07060a); scene.fog.density = snow ? 0.011 : 0.024;
  hemi.color.set(snow ? 0xcfe0f2 : 0x7a88c0); hemi.groundColor.set(snow ? 0xdfe8f0 : 0x1e160e); hemi.intensity = snow ? 0.85 : 0.5;
  moon.color.set(snow ? 0xfff4e6 : 0xa4b4ff); moon.intensity = snow ? 1.25 : 0.85; heroLight.intensity = snow ? 3 : 14;
  renderer.toneMappingExposure = snow ? 0.8 : 1.15; scene.environmentIntensity = snow ? 0.5 : 0.22;
}
function loadMap(name) {
  MAPNAME = name; const snow = name !== 'crypt';
  if (cryptWorld) cryptWorld.visible = !snow;
  for (const k in MAPS) MAPS[k].world.visible = k === name;
  if (snow) { setGrid(ensureMap(name).spec.grid); MAPS[name].world.visible = true; } else if (CRYPT.grid) setGrid(CRYPT.grid);
  if (snowfall) snowfall.visible = snow;
  setEnv(snow);
  document.body.classList.toggle('cold', name === 'trail');
}

// ---------------- the wolf (a TRELLIS 3D model animated by hand, or a plain stand-in if the file is missing) ----------------
class FakeAnim {
  constructor(root, body, legs) { this.root = root; this.body = body; this.legs = legs || []; this.name = ''; this.t = 0; this.tt = 0; this.dead = false; this.speed = 1; }
  dur(n) { return n === 'Bite' ? 0.7 : n === 'Death_A' || n === 'Death_B' ? 0.8 : 0.5; }
  play(n, o = {}) { if (this.dead) return null; if (this.name === n && !o.once) return null; this.name = n; this.t = 0; this.speed = o.speed || 1; if (/Death/.test(n)) this.dead = true; return {}; }
  update(dt) {
    this.t += dt * this.speed; this.tt += dt; const n = this.name, b = this.body, run = n === 'Running_A' || n === 'Walking_A';
    let y = 0, pitch = 0, roll = 0, z = 0, sy = 1;
    if (run) { const f = 13 * (n === 'Walking_A' ? 0.5 : 1); y = Math.abs(Math.sin(this.tt * f)) * 0.22; pitch = Math.sin(this.tt * f) * 0.07; }
    else if (n === 'Bite') { const k = Math.min(1, this.t / 0.7); z = Math.sin(k * Math.PI) * 0.9; pitch = -Math.sin(k * Math.PI) * 0.35; if (k >= 1) this.name = 'Idle_Combat'; }
    else if (n === 'Hit_A') { const k = Math.min(1, this.t / 0.35); z = -Math.sin(k * Math.PI) * 0.4; if (k >= 1) this.name = 'Idle_Combat'; }
    else if (/Death/.test(n)) { const k = Math.min(1, this.t / 0.7); roll = k * 1.45; y = -k * 0.25; }
    else { sy = 1 + Math.sin(this.tt * 2.4) * 0.02; pitch = Math.sin(this.tt * 1.3) * 0.02; }
    b.position.set(0, y, z); b.rotation.set(pitch, 0, roll); b.scale.y = sy;
    this.legs.forEach((L, i) => { L.rotation.x = run ? Math.sin(this.tt * 13 + (i % 2 ? Math.PI : 0) + (i > 1 ? 1.2 : 0)) * 0.7 : 0; });
  }
}
let WOLF_YAW = Math.PI / 2;
function makeWolf(E) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); const mats = [];
  const G3 = GL['assets/wolf/wolf.glb'];
  if (G3) {
    const root = G3.scene.clone(true); root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; m.material = m.material.clone(); m.material.envMapIntensity = 0.5; mats.push(m.material); } });
    root.rotation.y = WOLF_YAW; root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(root), len = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z), k = (1.55 * M2U * E.scale) / len; root.scale.setScalar(k);
    bb.setFromObject(root); const c = bb.getCenter(new THREE.Vector3()); root.position.set(-c.x, -bb.min.y, -c.z); body.add(root);
    return { g, root: body, mats, anim: new FakeAnim(g, body) };
  }
  const fur = new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 1 }), dark = new THREE.MeshStandardMaterial({ color: 0x4a4c52, roughness: 1 }); mats.push(fur, dark);
  const mk = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };
  const torso = mk(new THREE.SphereGeometry(0.55, 14, 10), fur, 0, 1.05, 0, 0.8, 0.75, 1.7), head = mk(new THREE.SphereGeometry(0.34, 12, 10), fur, 0, 1.3, 1.05, 1, 0.9, 1.1);
  const snout = mk(new THREE.ConeGeometry(0.2, 0.55, 8), dark, 0, 1.2, 1.5); snout.rotation.x = Math.PI / 2;
  const tail = mk(new THREE.ConeGeometry(0.17, 0.9, 8), dark, 0, 1.05, -1.2); tail.rotation.x = -2.1;
  const ears = [-0.2, 0.2].map((x) => mk(new THREE.ConeGeometry(0.1, 0.28, 6), dark, x, 1.65, 0.95));
  body.add(torso, head, snout, tail, ...ears);
  const legs = [[-0.3, 0.8], [0.3, 0.8], [-0.3, -0.7], [0.3, -0.7]].map(([x, z]) => { const l = new THREE.Group(); l.position.set(x, 0.85, z); l.add(mk(new THREE.CylinderGeometry(0.1, 0.07, 0.85, 6), dark, 0, -0.42, 0)); body.add(l); return l; });
  g.scale.setScalar(E.scale * 0.9);
  return { g, root: body, mats, anim: new FakeAnim(g, body, legs) };
}
const buildEnemy = (E) => { const m = E.wolf ? makeWolf(E) : makeModel(E.model, E.show || null, E.scale, E.tint || 0); if (E.weapon) attachWeapon(m, E.weapon); return m; };

let G = null;
let ACT = null; // the unit whose action is being resolved, so delayed hits credit the right hero
let SAVE = loadSave() || newSave();
let TIER = 0;
const PARTY_HP_MULT = Number(Q.get('hp')) || 5.0, PARTY_ATK_MULT = Number(Q.get('atk')) || 2.0; // skeletons are tougher because four heroes fight at once

function persist() { writeSave(SAVE); }
const alive = () => G.party.filter((u) => u.state !== 'dead');
function makeUnit(hs, i) {
  const C = CLASSES[hs.cls], st = heroStats(hs);
  const m = makeModel(C.model, C.show, 1, C.tint, C.real);
  const off = [[0, 0], [-1.8, 1.4], [1.8, 1.4], [0, 2.8]][i];
  m.g.position.copy(W2(SPAWN[0], SPAWN[1])).add(new THREE.Vector3(off[0], 0, off[1])); scene.add(m.g);
  m.anim.play('Idle');
  return Object.assign(m, { hs, C, name: hs.name, hp: st.hp, maxHp: st.hp, atk: st.atk, def: st.def, crit: st.crit, haste: st.haste, level: hs.level, xp: hs.xp,
    skills: hs.skills.slice(), mana: st.mana, maxMana: st.mana, manaRegen: st.manaRegen, cds: [0, 0, 0, 0], state: 'idle', stateT: 0, combo: 0, dodgeCd: 0, iframes: 0, buffs: {}, target: null, path: null, flashT: 0, hitDone: false,
    isHero: true, radius: 0.6, slot: i, hot: null, ...heroEffects(hs) });
}
function fixHeal(u, st) { u.healPct = heroEffects(u.hs).healPct + st.healPct / 100;
}
const CLASS_GENDER = { knight: 'female', mage: 'female', healer: 'female', ranger: 'male', warrior: 'male', rogue: 'female' };
// crypt difficulty by party size: two heroes get a much gentler crypt, a full group of four gets a slightly tougher one
const SIZE_HP = [0, 0.22, 0.3, 0.55, 0.85], SIZE_ATK = [0, 0.5, 0.5, 0.7, 0.92];
const STORY_HP = Number(Q.get('shp')) || 1.3, STORY_ATK = Number(Q.get('satk')) || 1.0; // a lone hero fights wolves, not skeleton hordes
function newGame(tier, opts = {}) {
  TIER = tier; const map = opts.map || 'crypt'; loadMap(map);
  SPAWN = opts.spawn || (map === 'trail' ? MAPS.trail.spec.start : map === 'town' ? MAPS.town.spec.start : [3, 3]);
  const units = partyHeroes(SAVE).slice(0, 4).map((hs, i) => { const u = makeUnit(hs, i); fixHeal(u, heroStats(hs)); return u; });
  const n = units.length, story = !!opts.map;
  G = { party: units, hero: units[0], enemies: [], fx: [], loot: [], drops: [], gold: 0, auto: false, shake: 0, hitstop: 0, over: false, boss: null, bossSpawnedAdds: false, t: 0, kills: 0, potions: 3, potionCd: 0, tier, zoom: 1,
    map, story, hunt: !!opts.hunt, npcs: [], talking: false, hinted: {}, leaving: false, exitCd: 0,
    mulHp: story ? STORY_HP : PARTY_HP_MULT * SIZE_HP[Math.min(n, 4)], mulAtk: story ? STORY_ATK : PARTY_ATK_MULT * SIZE_ATK[Math.min(n, 4)] };
  if (map === 'crypt') spawnRooms(); else if (map === 'trail') spawnTrail(!!opts.hunt); else spawnTown();
  buildPartyBar(); setLead(units[0], true);
  $('#btnAuto').classList.remove('on'); $('#bossbar').classList.remove('on'); syncAutoSk();
  $('#hud3').classList.remove('hidden'); $('#hud3').classList.toggle('story', story); document.body.classList.toggle('story', story);
  $('#talk').classList.remove('on'); $('#dlg').classList.remove('on');
}
function setLead(u, first) {
  if (!first && u === G.hero) return;
  G.hero = u;
  $('#bPortrait').src = `art/hero_${u.hs.cls}_${u.hs.gender}_1.png`; $('#bName').textContent = u.name;
  document.querySelectorAll('#pad [data-i]').forEach((b) => {
    const id = u.skills[+b.dataset.i], S = id && SKILLS[id];
    b.style.setProperty('--c', u.C.color); b.classList.toggle('empty', !S);
    b.querySelector('img').src = S ? `art/skill_${S.icon}.jpg` : 'art/skill_dodge.jpg'; b.title = S ? `${S.name} (${skillCost(id)} mana): ${S.desc}` : 'Empty slot';
    b.querySelector('.lock').textContent = S ? 'Lv ' + S.lv : '';
  });
  document.querySelectorAll('.pcard').forEach((c) => c.classList.toggle('lead', +c.dataset.i === u.slot));
}
function buildPartyBar() {
  $('#partybar').innerHTML = G.party.map((u, i) => `<button class="pcard" data-i="${i}" style="--c:${u.C.color}"><img src="art/hero_${u.hs.cls}_${u.hs.gender}_1.png" alt=""><i class="php"><b></b></i><span>${u.C.name}</span></button>`).join('');
  document.querySelectorAll('.pcard').forEach((c) => c.onpointerdown = (e) => { e.preventDefault(); const u = G.party[+c.dataset.i]; if (u.state !== 'dead') setLead(u); });
}

function spawnRooms() {
  const S = (type, cx, cy, dormant = true) => spawnEnemy(type, W2(cx, cy).add(new THREE.Vector3(rnd(-1, 1), 0, rnd(-1, 1))), dormant);
  // Room B: upper hall
  S('minion', 11, 2); S('minion', 14, 5); S('minion', 18, 2); S('mage', 18, 7); S('minion', 10, 7);
  // corridor ambush
  S('rogue', 15, 11, false);
  // Room C: lower hall
  S('warrior', 17, 16); S('minion', 13, 14); S('minion', 20, 14); S('mage', 20, 19); S('rogue', 12, 18); S('minion', 16, 19);
  // Room D: the throne
  const b = S('boss', 4.5, 21, false); b.state = 'throne'; b.anim.play('Idle'); G.boss = b;
  S('minion', 2, 15); S('minion', 7, 15);
}
function spawnEnemy(type, pos, dormant) {
  const E = ENEMY[type], T = TIERS[TIER], L = T.lvl - 1;
  const hpMul = (1 + 0.24 * L) * (1 + 0.12 * TIER) * G.mulHp, atkMul = (1 + 0.2 * L) * (1 + 0.08 * TIER);
  const m = buildEnemy(E);
  m.g.position.copy(pos); m.g.rotation.y = rnd(0, Math.PI * 2); scene.add(m.g);
  const hp = Math.round(E.hp * hpMul);
  const e = Object.assign(m, { E, type, lvl: T.lvl, hp, maxHp: hp, atkPow: E.atk * atkMul * G.mulAtk, state: dormant ? 'dormant' : 'idle', stateT: 0, atkCd: rnd(0.5, 1.5), flashT: 0, dead: false, radius: 0.55 * E.scale,
    stun: 0, slow: 0, mark: 0, wind: null, bar: null, hitDone: false, alert: !dormant });
  if (dormant) m.anim.play(E.living ? 'Idle_Combat' : 'Skeletons_Inactive_Floor_Pose'); else m.anim.play(E.boss ? 'Idle' : 'Idle_Combat');
  const bar = document.createElement('div'); bar.className = 'ebar'; bar.innerHTML = '<i></i>'; bar.style.display = 'none'; $('#labels').appendChild(bar); e.bar = bar;
  G.enemies.push(e);
  return e;
}


// ---------------- story mode: trail, village, quests ----------------
function hint(msg, ms = 6000) { const el = $('#hint'); el.innerHTML = msg; el.classList.add('on'); clearTimeout(hint.t); hint.t = setTimeout(() => el.classList.remove('on'), ms); }
function say(text, ms = 2400) { const el = $('#sub'); el.textContent = text; el.classList.add('on'); clearTimeout(say.t); say.t = setTimeout(() => el.classList.remove('on'), ms); }
function voice(name) { try { const a = new Audio(`audio/${name}_${G.hero.hs.gender === 'male' ? 'm' : 'f'}.mp3`); a.volume = 0.95; a.play().catch(() => { }); } catch (e) { } }
function fadeOut(fn) { const f = $('#fade'); f.classList.add('on'); setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 300); }, 700); }

function spawnTrail(hunt) {
  const St = MAPS.trail.spec.stages;
  const SETS = [[['wolf'], ['wolf']], [['wolf', 'wolf'], ['bandit']], [['wolf', 'wolf'], ['bandit', 'wolf']], [['wolf', 'wolf', 'wolf'], ['bandit', 'bandit']], [['wolf', 'wolf', 'bandit'], ['wolf', 'wolf', 'wolf']]];
  const HUNT = [['wolf', 'wolf'], ['wolf', 'wolf', 'bandit'], ['wolf', 'bandit', 'wolf'], ['wolf', 'wolf', 'bandit', 'bandit'], ['wolf', 'wolf', 'wolf']];
  (hunt ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4]).forEach((i) => {
    const [cx, cy] = St[i], set = hunt ? HUNT[4 - i] : pick(SETS[i]);
    set.forEach((t, k) => { const a = rnd(0, 6.28) + k * 2.1; spawnEnemy(t, W2(cx, cy).add(new THREE.Vector3(Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4 - 3)), true); });
  });
}
const markerMats = {};
function markerMat(ch) {
  if (markerMats[ch]) return markerMats[ch];
  const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
  x.fillStyle = '#1b1410'; x.beginPath(); x.arc(48, 48, 40, 0, 7); x.fill(); x.strokeStyle = '#f0c75e'; x.lineWidth = 6; x.stroke();
  x.fillStyle = '#ffd86a'; x.font = '900 62px Cinzel, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 48, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (markerMats[ch] = new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
}
function spawnTown() {
  const sp = MAPS.town.spec, S = SAVE.story, pcls = G.hero.hs.cls;
  const mk = (id, cls, [cx, cy], face, info) => {
    const C = CLASSES[cls], m = makeModel(C.model, C.show, 1, C.tint, C.real);
    (m.held || []).forEach((o) => { o.visible = false; });
    m.g.position.set(cx * TILE, 0, cy * TILE); m.g.rotation.y = face; scene.add(m.g); m.anim.play('Idle');
    const spr = new THREE.Sprite(markerMat('!')); spr.scale.set(1.7, 1.7, 1); spr.position.set(0, 4.7, 0); spr.renderOrder = 10; m.g.add(spr);
    grid[Math.round(cy)][Math.round(cx)] = 2;
    G.npcs.push(Object.assign(m, { id, cls, spr, name: info.name, title: info.title, cell: [Math.round(cx), Math.round(cy)] }));
  };
  G.mkNpc = mk;
  mk('vendor', pcls === 'warrior' ? 'ranger' : 'warrior', sp.npcs.vendor, 0, { name: NPC_INFO.vendor.name, title: NPC_INFO.vendor.title });
  for (const i of availableRecruits(S)) { const c = S.order[i]; mk(c, c, sp.slots[i], 0.4 + i * 0.5, recruitInfo(c, i === 0)); }
}
function npcMarker(n) { return markerFor(n.id, SAVE.story); }
function openDialog(n) {
  if (!n || G.talking) return;
  G.talking = true; G.hero.path = null; G.hero.target = null; G.hero.anim.play('Idle'); G.hero.state = 'idle'; $('#talk').classList.remove('on');
  faceTo(G.hero, angleTo(G.hero.g.position, n.g.position), 0); faceTo(n, angleTo(n.g.position, G.hero.g.position), 0);
  const d = dialogFor(n.id, SAVE.story, G.hero.hs); let i = 0; n.dlg = d;
  $('#dlg').classList.add('on'); $('#dname').textContent = n.name; $('#dnpc').textContent = n.title;
  const show = () => { $('#dtext').textContent = d.lines[i]; const last = i >= d.lines.length - 1;
    $('#dbtns').innerHTML = last ? d.buttons.map((b, k) => `<button class="btn ${k ? 'btn-steel' : 'btn-gold'}" data-k="${k}"><span>${b.label}</span></button>`).join('') : '<button class="btn btn-gold" data-next="1"><span>Next</span></button>'; };
  $('#dbtns').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.next) { i++; show(); } else dialogAct(d.buttons[+b.dataset.k].act, n); };
  show();
}
function closeDialog() { $('#dlg').classList.remove('on'); if (G) G.talking = false; }
function joinParty(cls, name, gender, at) {
  const lead = G.hero.hs, hs = newHero(SAVE, cls, gender, name); hs.level = lead.level; SAVE.heroes.push(hs);
  if (SAVE.party.length < 4) {
    SAVE.party.push(hs.id); const u = makeUnit(hs, G.party.length); fixHeal(u, heroStats(hs)); if (at) u.g.position.copy(at); G.party.push(u); buildPartyBar(); setLead(G.hero, true);
  } else toast(`${name} waits at camp. Add them in the Party tab.`, '#ffd84a');
  persist(); toast(`<b>${name}</b> joins your party!`, '#ffd84a'); sfx('level');
}
function dialogAct(actFull, n) {
  const [act, arg] = actFull.split(':'); const S = SAVE.story; closeDialog();
  if (act === 'acceptMeat') {
    S.q.meat = 'active'; persist();
    hint(S.meat >= MEAT_NEED ? 'You already have enough wolf meat. Talk to Bram again!' : `Quest: bring Bram ${MEAT_NEED} wolf meat. Leave by the south gate to hunt wolves on the trail.`, 7500);
  } else if (act === 'goHunt') { startLeave(() => startStory('trail', { hunt: true, spawn: [12, 6] })); }
  else if (act === 'turnMeat') {
    S.meat = Math.max(0, S.meat - MEAT_NEED); S.q.meat = 'done'; SAVE.gold += 40;
    const h = G.hero.hs, it = makeItem(SAVE, 1, 0, 0, 'armor', null, CLASSES[h.cls].armor, 1); SAVE.bag.push(it);
    for (const u of alive()) { healUnit(u, u.maxHp); u.xp += 40; u.hs.xp = u.xp; while (u.xp >= XP_NEED(u.level)) levelUp(u); }
    persist(); toast(`Hot stew! +40 gold and <span style="color:${RARITIES[it.rar].color}">${it.name}</span> (check your bag)`, '#ffd84a'); sfx('level');
    hint(`Bram fed you well. Now go and talk to ${S.recruit.name} by the well.`, 7500);
  } else if (act === 'acceptFather') {
    const R = S.recruit; S.q.father = 'active'; const info = recruitInfo(R.cls, true);
    joinParty(R.cls, info.name, info.gender, n.g.position);
    scene.remove(n.g); G.npcs = G.npcs.filter((x) => x !== n); grid[n.cell[1]][n.cell[0]] = 1;
    hint('Quest: find her father. Take the north road out of the village to Hollowmere Crypt.', 8000);
  } else if (act === 'rqAccept') {
    S.rq[arg].st = 'active'; persist(); hint(questLine(S, 'town'), 7500);
  } else if (act === 'rqJoin') {
    const info = recruitInfo(arg, false); S.rq[arg].st = 'done'; joinParty(arg, info.name, info.gender, n.g.position);
    scene.remove(n.g); G.npcs = G.npcs.filter((x) => x !== n); grid[n.cell[1]][n.cell[0]] = 1; persist();
    for (const i of availableRecruits(S)) { const c = S.order[i]; if (!G.npcs.some((x) => x.id === c)) G.mkNpc(c, c, MAPS.town.spec.slots[i], 0.4 + i * 0.5, recruitInfo(c, false)); }
    hint(questLine(S, 'town'), 7500);
  }
}
function refreshParty() {
  for (const u of G.party) {
    const st = heroStats(u.hs), r = u.hp / u.maxHp;
    Object.assign(u, { maxHp: st.hp, hp: Math.min(st.hp, Math.max(1, Math.round(st.hp * r))), atk: st.atk, def: st.def, crit: st.crit, haste: st.haste, maxMana: st.mana, manaRegen: st.manaRegen, skills: u.hs.skills.slice(), ...heroEffects(u.hs) });
    fixHeal(u, st); u.mana = Math.min(u.mana, u.maxMana);
  }
  setLead(G.hero, true);
}
function startLeave(fn) { if (G.leaving) return; G.leaving = true; fadeOut(() => { saveStoryRun(); cleanupRun(); fn(); }); }
function saveStoryRun() { finishRun(false); }
function startStory(where, opts = {}) {
  fixStory(SAVE.story, SAVE.party[0]);
  $('#hub').classList.add('hidden'); $('#modal').classList.remove('on');
  newGame(0, { map: where, ...opts }); updateCamera(0, true);
  const g0 = G, ok = () => G === g0 && !G.over;
  if (where === 'trail' && !opts.hunt) {
    SAVE.story.stage = 'trail'; persist();
    setTimeout(() => { if (ok()) { voice('cold'); say("It's so cold...", 2300); } }, 1800);
    setTimeout(() => { if (ok()) { voice('starving'); say("I'm starving...", 2300); } }, 5600);
    setTimeout(() => { if (ok()) hint('Drag on the screen (or use WASD) to walk. Follow the trail north to find shelter.', 8000); }, 8600);
  } else if (where === 'trail') hint(`Hunt the wolves for Bram. Wolf meat drops when they fall (${SAVE.story.meat}/${MEAT_NEED}).`, 6500);
  else { SAVE.story.stage = 'town'; persist(); setTimeout(() => { if (ok()) { say('A village... and the smell of food.', 2600); hint('Walk up to someone and tap TALK.', 6000); } }, 1500); }
}
function storyStep(dt) {
  const hp = G.hero.g.position, [cx, cy] = cellOf(hp.x, hp.z), S = SAVE.story;
  G.exitCd = Math.max(0, G.exitCd - dt);
  // teach the controls as they become useful
  const H = G.hinted, near = liveEnemies().find((e) => flat(e.g.position, hp) < 13);
  if (G.map === 'trail' && !G.hunt) {
    if (near && !H.fight) { H.fight = 1; hint('Something is coming! Tap it, or press ATTACK, to fight.', 6000); }
    else if (G.kills >= 1 && !H.skill) { H.skill = 1; hint('Skill buttons cost mana. Tap one when it glows.', 6000); }
    else if (G.hero.hp < G.hero.maxHp * 0.55 && !H.dodge) { H.dodge = 1; hint('Hurt? DODGE rolls away from hits and the POTION button heals.', 7000); }
  }
  if (G.map === 'trail') {
    if (G.hunt && S.meat >= MEAT_NEED && !H.enough) { H.enough = 1; hint('Enough wolf meat! Head north back to the village.', 6500); }
    if (cy <= MAPS.trail.spec.gate[1] && !G.leaving) {
      if (liveEnemies().some((e) => flat(e.g.position, hp) < 14)) { if (G.exitCd <= 0) { G.exitCd = 4; toast('Deal with the enemies first!', '#ff8a6a'); } }
      else startLeave(() => startStory('town'));
    }
  } else if (G.map === 'town') {
    let best = null, bd = 99; for (const n of G.npcs) { const d = flat(n.g.position, hp); if (d < (n.id === 'vendor' ? 11 : 6.5) && d < bd) { bd = d; best = n; } }
    G.nearNpc = best; const tk = $('#talk'); tk.classList.toggle('on', !!best && !G.talking); if (best) tk.firstChild.textContent = 'TALK to ' + best.name;
    for (const n of G.npcs) { const m = npcMarker(n); n.spr.visible = !!m; if (m) { n.spr.material = markerMat(m); n.spr.position.y = 4.7 + Math.sin(G.t * 3) * 0.18; } }
    const bump = () => { G.hero.path = null; };
    if (cy >= GH - 2 && !G.leaving && G.exitCd <= 0) {
      if (huntWanted(S)) startLeave(() => startStory('trail', { hunt: true, spawn: [12, 6] }));
      else { G.exitCd = 4; hp.z -= TILE * 1.5; bump(); toast(S.q.meat === 'none' ? 'The trail behind you is empty. Talk to the cook first.' : 'Nothing to hunt on the trail right now. Take on a quest first.', '#ffd84a'); }
    }
    if (cy <= 3 && cx >= 9 && cx <= 10 && !G.leaving && G.exitCd <= 0) {
      if (S.q.father !== 'none') startLeave(() => { S.stage = 'camp'; persist(); window.HOL.showHub(); });
      else { G.exitCd = 4; hp.z += TILE * 1.5; bump(); toast('The old road to Hollowmere Crypt. You have no reason to go there yet.', '#ffd84a'); }
    }
  }
}
function showStoryDefeat() {
  finishRun(false); const hunt = G.hunt, map = G.map;
  $('#modal').innerHTML = `<div class="result lose"><div class="burst"></div><h1>You collapse in the snow</h1><div class="rsub">The cold and the fight were too much... but you can still get back up.</div><div class="row"><button class="btn btn-gold btn-xl" id="rAgain"><span>Get back up</span></button></div></div>`;
  $('#modal').classList.add('on');
  $('#rAgain').onclick = () => { cleanupRun(); startStory(map, hunt ? { hunt: true, spawn: [12, 6] } : {}); };
}
function dropMeat(pos) {
  const g = new THREE.Group(); g.position.copy(pos).add(new THREE.Vector3(rnd(-0.8, 0.8), 0, rnd(-0.8, 0.8)));
  const m = new THREE.Group();
  const steak = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), new THREE.MeshStandardMaterial({ color: 0xc23f45, roughness: 0.55, emissive: 0x401015, emissiveIntensity: 0.6 })); steak.scale.set(1.25, 0.8, 0.95);
  const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.7 })); bone.rotation.z = Math.PI / 2; bone.position.x = 0.55;
  m.add(steak, bone); m.position.y = 0.6;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 2.6, 10, 1, true), glowMat(0xff7a7a, 0.5)); beam.position.y = 1.3;
  g.add(m, beam); scene.add(g);
  G.drops.push({ kind: 'meat', o: g, gem: m, t: 0 }); sfx('loot');
}

// ---------------- input ----------------
const keys = {};
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (!G || G.over) return;
  if (e.code === 'Space') { e.preventDefault(); doDodge(); }
  if (e.code === 'Digit1') useSkill(0); if (e.code === 'Digit2') useSkill(1); if (e.code === 'Digit3') useSkill(2); if (e.code === 'Digit4') useSkill(3);
  if (e.code === 'KeyQ') drinkPotion();
  if (e.code === 'KeyE' && G.story && G.map === 'town' && G.nearNpc) openDialog(G.nearNpc);
  if (e.code === 'Tab') { e.preventDefault(); swapHero(); }
  if (e.code === 'KeyR') { const a = alive(), i = a.indexOf(G.hero); setLead(a[(i + 1) % a.length]); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

// pointer on the 3D view: drag = joystick (anchored where you pressed), quick tap = walk there / attack what you tapped
const joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0, active: false, start: 0 };
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
canvas.addEventListener('pointerdown', (e) => {
  if (!G || G.over) return;
  if (joy.id !== null) return;
  joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.dx = joy.dy = 0; joy.active = false; joy.start = performance.now();
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!G || e.pointerId !== joy.id) return;
  const dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
  if (!joy.active && Math.hypot(dx, dy) > 9) { joy.active = true; const j = $('#joy'); j.style.left = joy.ox + 'px'; j.style.top = joy.oy + 'px'; j.classList.add('on'); G.hero.path = null; G.hero.target = null; }
  if (joy.active) {
    const L = Math.hypot(dx, dy), m = Math.min(L, 40);
    joy.dx = L ? dx / L * m / 40 : 0; joy.dy = L ? dy / L * m / 40 : 0;
    $('#joy i').style.transform = `translate(${joy.dx * 50}px, ${joy.dy * 50}px)`;
  }
});
function endJoy(e) {
  if (e.pointerId !== joy.id) return;
  if (!joy.active && performance.now() - joy.start < 400) tapAt(e.clientX, e.clientY);
  joy.id = null; joy.active = false; joy.dx = joy.dy = 0; $('#joy').classList.remove('on'); $('#joy i').style.transform = '';
}
canvas.addEventListener('pointerup', endJoy);
canvas.addEventListener('pointercancel', endJoy);
function tapAt(px, py) {
  const r = canvas.getBoundingClientRect();
  ndc.set((px - r.left) / r.width * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  // enemy under the tap? (check screen distance to each enemy's chest)
  let best = null, bd = 60;
  for (const en of G.enemies) {
    if (en.dead || en.state === 'dormant') continue;
    const p = en.g.position.clone().add(new THREE.Vector3(0, 1.2 * en.E.scale, 0)).project(camera);
    const sx = (p.x + 1) / 2 * r.width + r.left, sy = (1 - p.y) / 2 * r.height + r.top, d = Math.hypot(sx - px, sy - py);
    if (d < bd * en.E.scale) { bd = d; best = en; }
  }
  if (best) { G.hero.target = best; G.hero.path = null; ping(best.g.position, '#ffe08a'); return; }
  const hit = new THREE.Vector3();
  if (ray.ray.intersectPlane(groundPlane, hit)) {
    const [cx, cy] = cellOf(hit.x, hit.z);
    if (isFloor(cx, cy)) { G.hero.target = null; G.hero.path = findPath(G.hero.g.position, hit); ping(hit, '#9fd8ff'); }
  }
}
// grid A* (8 directions, no corner cutting)
function findPath(from, to) {
  const [sx, sy] = cellOf(from.x, from.z), [tx, ty] = cellOf(to.x, to.z);
  const key = (x, y) => y * GW + x, open = [[sx, sy]], came = {}, g = { [key(sx, sy)]: 0 };
  const f = { [key(sx, sy)]: Math.hypot(tx - sx, ty - sy) };
  let guard = 0;
  while (open.length && guard++ < 2000) {
    open.sort((a, b) => f[key(...a)] - f[key(...b)]);
    const [x, y] = open.shift();
    if (x === tx && y === ty) {
      const pts = [to.clone()]; let k = key(x, y);
      while (came[k] !== undefined) { k = came[k]; const px = k % GW, py = Math.floor(k / GW); pts.unshift(W2(px, py)); }
      pts.shift(); return pts;
    }
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (!isFloor(nx, ny) || (dx && dy && (!isFloor(x + dx, y) || !isFloor(x, y + dy)))) continue;
      const ng = g[key(x, y)] + (dx && dy ? 1.414 : 1), nk = key(nx, ny);
      if (g[nk] === undefined || ng < g[nk]) { g[nk] = ng; f[nk] = ng + Math.hypot(tx - nx, ty - ny); came[nk] = key(x, y); if (!open.some((o) => o[0] === nx && o[1] === ny)) open.push([nx, ny]); }
    }
  }
  return [to.clone()];
}

let attackHeld = false;
const ab = $('#btnAttack');
ab.addEventListener('pointerdown', (e) => { e.preventDefault(); attackHeld = true; });
addEventListener('pointerup', () => { attackHeld = false; });
document.querySelectorAll('#pad [data-i]').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); useSkill(+b.dataset.i); }));
$('#talk').addEventListener('pointerdown', (e) => { e.preventDefault(); if (G && G.nearNpc) openDialog(G.nearNpc); });
$('#btnMenu').addEventListener('pointerdown', (e) => { e.preventDefault(); window.HOL.openMenu(); });
const syncAutoSk = () => { const b = $('#btnAutoSk'); b.textContent = SAVE.autoSkills === false ? 'SKILLS: MANUAL' : 'SKILLS: AUTO'; b.classList.toggle('on', SAVE.autoSkills !== false); };
$('#btnAutoSk').addEventListener('pointerdown', (e) => { e.preventDefault(); SAVE.autoSkills = SAVE.autoSkills === false; persist(); syncAutoSk(); });
const swapHero = () => { if (!G || G.over) return; const a = alive(); if (a.length > 1) setLead(a[(a.indexOf(G.hero) + 1) % a.length]); };
$('#btnSwap').addEventListener('pointerdown', (e) => { e.preventDefault(); swapHero(); });
$('#btnDodge').addEventListener('pointerdown', (e) => { e.preventDefault(); doDodge(); });
$('#btnPotion').addEventListener('pointerdown', (e) => { e.preventDefault(); drinkPotion(); });
$('#btnAuto').addEventListener('click', () => { if (!G) return; G.auto = !G.auto; $('#btnAuto').classList.toggle('on', G.auto); });

// ---------------- combat helpers ----------------
const tmpV = new THREE.Vector3();
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angleTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
function faceTo(ent, ang, dt, rate = 14) {
  let d = ang - ent.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
  ent.g.rotation.y += dt ? clamp(d, -rate * dt, rate * dt) : d;
}
function withAct(u, fn) { const p = ACT; ACT = u; try { return fn(); } finally { ACT = p; } }
function later(t, fn) { const c = ACT; G.fx.push({ type: 'later', t, fn: () => withAct(c, fn) }); }
function liveEnemies() { return G.enemies.filter((e) => !e.dead && e.state !== 'dormant' && e.state !== 'throne'); }
function nearestEnemy(u, maxD = 999) {
  let best = null, bd = maxD;
  for (const e of liveEnemies()) { const d = flat(e.g.position, u.g.position); if (d < bd) { bd = d; best = e; } }
  return best;
}
function nearestParty(pos) {
  let best = null, bd = 1e9;
  for (const u of alive()) { const d = flat(u.g.position, pos); if (d < bd) { bd = d; best = u; } }
  return best;
}
function weakestAlly() { return alive().reduce((a, b) => (!a || b.hp / b.maxHp < a.hp / a.maxHp ? b : a), null); }
function hitEnemy(e, mult, opts = {}) {
  if (!e || e.dead) return 0;
  const c = ACT || G.hero;
  const crit = Math.random() < c.crit / 100 + (opts.crit || 0);
  const d = Math.round(c.atk * mult * rnd(0.9, 1.1) * (crit ? 1.9 : 1) * (c.buffs.cry > 0 ? 1.5 : 1) * (e.mark > 0 ? 1.5 : 1));
  e.hp -= d; flash(e); e.alert = true;
  if (e.state === 'dormant') wake(e);
  floatText(e.g.position, d, crit ? 'crit' : '', 2.2 * e.E.scale);
  sparks(e.g.position.clone().add(new THREE.Vector3(0, 1.2 * e.E.scale, 0)), crit ? 0xffd84a : 0xfff0d0, crit ? 18 : 9);
  if (c === G.hero && crit) G.hitstop = Math.max(G.hitstop, 0.03); // only the hero you steer gets a tiny crit pause (it used to freeze everything on every party hit)
  G.shake = Math.max(G.shake, c === G.hero ? (crit ? 0.3 : 0.1) : 0.03);
  if (opts.knock && !e.E.boss) { tmpV.set(e.g.position.x - c.g.position.x, 0, e.g.position.z - c.g.position.z).normalize().multiplyScalar(opts.knock); tryMove(e, tmpV.x, tmpV.z); }
  if (opts.stun) e.stun = Math.max(e.stun, opts.stun);
  if (opts.slow) e.slow = Math.max(e.slow, opts.slow);
  if (opts.leech) healUnit(c, d * opts.leech, true);
  if (c.lifesteal) healUnit(c, d * c.lifesteal, true);
  sfx(crit ? 'crit' : 'hit');
  if (e.hp <= 0) killEnemy(e);
  else if (!e.wind && !e.E.boss && e.state !== 'attack' && Math.random() < 0.4) { e.anim.play('Hit_A', { once: true, speed: 1.4 }); e.state = 'hit'; e.stateT = 0; }
  return d;
}
function meleeSweep(range, arcDeg, mult, opts) {
  const h = ACT || G.hero, f = h.g.rotation.y; let n = 0;
  for (const e of G.enemies) {
    if (e.dead || e.state === 'throne') continue;
    const d = flat(e.g.position, h.g.position);
    if (d > range + e.radius) continue;
    let da = angleTo(h.g.position, e.g.position) - f; da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
    if (da <= arcDeg * Math.PI / 360 || d < 1.0) { hitEnemy(e, mult, opts); n++; }
  }
  return n;
}
function aoe(center, radius, mult, opts) { let n = 0; for (const e of G.enemies) { if (e.dead || e.state === 'throne') continue; if (flat(e.g.position, center) <= radius + e.radius) { hitEnemy(e, mult, opts); n++; } } return n; }
function hurtUnit(u, amount, from, heavy) {
  if (G.over || u.state === 'dead') return;
  if (u.iframes > 0 || u.buffs.smoke > 0) { floatText(u.g.position, 'DODGED', 'info', 2.6); return; }
  const mit = 80 / (80 + u.def);
  const d = Math.max(1, Math.round(amount * rnd(0.9, 1.1) * mit * (u.buffs.guard > 0 ? 0.45 : 1) * (1 - (u.dmgTaken || 0))));
  u.hp -= d; flash(u, 0xff2a12, 0.14);
  floatText(u.g.position, '-' + d, 'hurt', 2.6);
  if (u === G.hero) { G.shake = Math.max(G.shake, heavy ? 0.7 : 0.2); sfx('hurt'); }
  if (u.hp <= 0) { u.hp = 0; unitDies(u); }
}
function healUnit(u, a, quiet) {
  if (!u || u.state === 'dead') return;
  const hp = ACT && ACT.healPct && !quiet ? 1 + ACT.healPct : 1; // Sanctified Cloth: stronger heals from the healer
  const v = Math.round(Math.min(u.maxHp - u.hp, a * hp)); if (v <= 0) return;
  u.hp += v; if (!quiet) floatText(u.g.position, '+' + v, 'heal', 2.6);
}
function wake(e) {
  if (e.state !== 'dormant') return;
  if (e.E.living) { e.state = 'idle'; e.stateT = 0; return; }
  e.state = 'waking'; e.stateT = 0; e.anim.play('Skeletons_Awaken_Floor', { once: true, speed: 1.3 });
  e.wakeDur = e.anim.dur('Skeletons_Awaken_Floor') / 1.3;
}
function killEnemy(e) {
  e.dead = true; e.state = 'dead'; e.stateT = 0; e.bar.style.display = 'none';
  e.anim.play(Math.random() < 0.5 ? 'Death_A' : 'Death_B', { once: true });
  G.kills++;
  const xp = Math.round(e.E.xp * (1 + 0.5 * (e.lvl - 1)));
  floatText(e.g.position, `+${xp} XP`, 'info', 3.0);
  for (const u of alive()) { u.xp += xp * 0.6; u.hs.xp = u.xp; while (u.xp >= XP_NEED(u.level)) levelUp(u); }
  const gold = Math.round(rnd(3, 9) * (1 + 0.5 * (e.lvl - 1)) * (e.E.boss ? 12 : 1));
  dropGold(e.g.position, gold);
  if (SAVE.story) { const m = storyKill(SAVE.story, e.type); if (m) { toast(m, '#ffd84a'); persist(); } }
  if (e.E.drops === 'meat' && G.story && Math.random() < (G.hunt ? 1 : 0.65)) dropMeat(e.g.position);
  const src = e.E.boss ? 'boss' : e.E.heavy ? 'elite' : 'mob';
  const n = src === 'boss' ? 3 : src === 'elite' ? (Math.random() < 0.7 ? 1 : 0) : Math.random() < 0.35 ? 1 : 0;
  for (let i = 0; i < n; i++) dropItem(e.g.position.clone().add(new THREE.Vector3(rnd(-1.6, 1.6), 0, rnd(-1.6, 1.6))), src);
  if (e.E.boss) { setTimeout(victory, 2600); G.shake = 1; }
  sfx('kill');
}
function levelUp(u) {
  u.xp -= XP_NEED(u.level); u.level++; u.hs.level = u.level; u.hs.xp = u.xp;
  const ratio = u.hp / u.maxHp, st = heroStats(u.hs);
  Object.assign(u, { maxHp: st.hp, atk: st.atk, def: st.def, crit: st.crit, haste: st.haste, maxMana: st.mana, manaRegen: st.manaRegen }); u.mana = Math.min(u.maxMana, u.mana + 6); fixHeal(u, st);
  u.hp = Math.max(u.hp, Math.round(st.hp * Math.max(ratio, 0.6)));
  floatText(u.g.position, 'LEVEL UP!', 'crit', 3.4); ring(u.g.position, 0xffd84a, 3.5); sfx('level');
  if (!G.lvlToast || G.t - G.lvlToast > 3) { G.lvlToast = G.t; toast('Level up! You have <b>stat points</b> to spend in Camp → Stats', '#c9b0ff'); }
  const s = Object.entries(SKILLS).find(([, k]) => k.cls === u.hs.cls && k.lv === u.level);
  if (s) toast(`${u.name}: new skill <b>${s[1].name}</b>`, '#ffd84a');
}

// ---------------- unit actions ----------------
function startAttack(h) {
  if (h.state === 'attack' || h.state === 'skill' || h.state === 'dodge' || h.state === 'dead') return;
  const tgt = (h === G.hero && h.target && !h.target.dead) ? h.target : (h.aiTarget && !h.aiTarget.dead ? h.aiTarget : nearestEnemy(h, h.C.ranged ? 16 : 6));
  if (tgt) faceTo(h, angleTo(h.g.position, tgt.g.position));
  const name = h.C.attacks[h.combo % h.C.attacks.length]; h.combo++;
  const sp = (h.C.attackSpeed || 1) * 1.55 * (1 + h.haste / 100) * (h.buffs.haste > 0 ? 1.4 : 1);
  h.anim.play(name, { once: true, speed: sp, fade: 0.08 });
  h.state = 'attack'; h.stateT = 0; h.stateDur = h.anim.dur(name) / sp * 0.82; h.hitAt = h.stateDur * 0.42; h.hitDone = false; h.atkTarget = tgt;
}
function resolveAttack(h) {
  if (h.C.ranged) {
    const t = h.atkTarget && !h.atkTarget.dead ? h.atkTarget : nearestEnemy(h, 16);
    bolt(h.g.position.clone().add(new THREE.Vector3(0, 1.5, 0)), t, h.g.rotation.y, h.C.bolt, (e) => hitEnemy(e, 1));
    sfx('spell');
  } else {
    const n = meleeSweep(h.C.range, h.C.arc, h.combo % h.C.attacks.length === 0 ? 1.4 : 1, { knock: 0.6 });
    slashFx(h, new THREE.Color(h.C.color).lerp(new THREE.Color(0xffffff), 0.6).getHex());
    if (!n) sfx('swing');
  }
}
const NO_TARGET_SKILLS = new Set(['guard', 'renew', 'smoke', 'cry']);
function castSkill(h, i) {
  const id = h.skills[i], S = id && SKILLS[id];
  if (!G || G.over || !S || h.state === 'dead' || h.state === 'dodge' || h.state === 'skill' || h.cds[i] > 0 || h.level < S.lv) return false;
  const tgt = h.target && !h.target.dead ? h.target : (h.aiTarget && !h.aiTarget.dead ? h.aiTarget : nearestEnemy(h, h.C.ranged ? 16 : 9));
  if (!tgt && !NO_TARGET_SKILLS.has(id)) return false;
  const cost = skillCost(id);
  if (h.mana < cost) { if (h === G.hero && (!G.manaToast || G.t - G.manaToast > 1.5)) { G.manaToast = G.t; floatText(h.g.position, 'No mana', 'info', 3.0); } return false; }
  h.mana -= cost;
  h.cds[i] = S.cd * (1 - (h.cdr || 0));
  withAct(h, () => doSkill(h, id, tgt));
  return true;
}
function doSkill(h, id, tgt) {
  if (tgt) faceTo(h, angleTo(h.g.position, tgt.g.position));
  const P = h.g.position, from = () => P.clone().add(new THREE.Vector3(0, 1.5, 0));
  const A = (n, sp = 1.3) => { h.anim.play(n, { once: true, speed: sp, fade: 0.06 }); h.state = 'skill'; h.stateT = 0; h.stateDur = h.anim.dur(n) / sp * 0.55; };
  switch (id) {
    case 'bash': A('Block_Attack', 1.5); later(0.18, () => { meleeSweep(2.8, 120, 1.7, { stun: 1.8, knock: 2 }); ring(P, 0xffe28a, 2.6); }); break;
    case 'guard': A('Block', 1.4); h.buffs.guard = 5; healUnit(h, h.maxHp * 0.1); ring(P, 0xffe28a, 2.2); sfx('heal'); break;
    case 'judgment': A('2H_Melee_Attack_Spin', 1.2); for (const e of liveEnemies().filter((e) => flat(e.g.position, P) < 12)) later(rnd(0.1, 0.5), () => { pillar(e.g.position, 0xffe9a0); hitEnemy(e, 3.0); }); if (h === G.hero) G.shake = 0.6; break;
    case 'fireball': A('Spellcast_Long', 1.6); later(0.25, () => bolt(from(), tgt, h.g.rotation.y, 0xff7a2a, (e) => { aoe(e.g.position, 2.4, 2.4); burst(e.g.position, 0xff8a2a); }, 0.42)); sfx('spell'); break;
    case 'nova': A('Spellcast_Raise', 1.5); later(0.15, () => { nova(P, 0x9fe0ff, 6); aoe(P, 6, 1.2, { slow: 4, knock: 1.5 }); }); sfx('spell'); break;
    case 'meteor': { A('Spellcast_Long', 1.3); const at = tgt.g.position.clone(); telegraph(at, 3.2, 0.9, 0xff7a2a); later(0.9, () => { burst(at, 0xff7a2a, 40); aoe(at, 3.4, 4.0); G.shake = Math.max(G.shake, 0.8); sfx('boom'); }); break; }
    case 'smite': A('Spellcast_Shoot', 1.6); later(0.2, () => bolt(from(), tgt, h.g.rotation.y, 0xfff2b0, (e) => { pillar(e.g.position, 0xfff2b0); hitEnemy(e, 1.7); const w = weakestAlly(); healUnit(w, w.maxHp * 0.12 + h.atk); })); sfx('spell'); break;
    case 'renew': A('Spellcast_Raise', 1.5); for (const u of alive()) { u.hot = { left: 6, tick: 0, per: u.maxHp * 0.3 * (1 + (h.healPct || 0)) / 6 }; ring(u.g.position, 0x9dffb0, 1.6); } sfx('heal'); break;
    case 'divine': A('Spellcast_Raise', 1.3); later(0.2, () => { nova(P, 0xfff2b0, 7); aoe(P, 7, 2.2); for (const u of alive()) healUnit(u, u.maxHp * 0.25); }); sfx('heal'); break;
    case 'power': A('2H_Ranged_Shoot', 1.6); later(0.2, () => bolt(from(), tgt, h.g.rotation.y, 0xfff0c0, (e) => hitEnemy(e, 2.6, { crit: 0.4 }), 0.3)); sfx('spell'); break;
    case 'volley': A('2H_Ranged_Shoot', 1.2); for (let w = 0; w < 3; w++) later(0.15 + w * 0.35, () => { for (const e of liveEnemies().filter((e) => flat(e.g.position, P) < 12)) { burst(e.g.position, 0xe6d7a8, 6); hitEnemy(e, 0.8); } }); break;
    case 'mark': A('2H_Ranged_Aiming', 1.5); tgt.mark = 8; h.buffs.haste = 8; ring(tgt.g.position, 0xff5a5a, 1.8); floatText(tgt.g.position, 'MARKED', 'info', 3.0); sfx('spell'); break;
    case 'spin': A('2H_Melee_Attack_Spin', 1.4); later(0.2, () => { aoe(P, 3.4, 1.5, { knock: 1.5 }); slashFx(h, 0xffa070, true); }); later(0.45, () => { aoe(P, 3.4, 1.0); slashFx(h, 0xffa070, true); }); break;
    case 'cry': A('Cheer', 1.5); h.buffs.cry = 7; healUnit(h, h.maxHp * 0.12); ring(P, 0xff7a5a, 4); if (h === G.hero) G.shake = 0.5; sfx('boom'); break;
    case 'rage': A('2H_Melee_Attack_Stab', 1.3); later(0.25, () => { let tot = 0; for (const e of G.enemies) if (!e.dead && flat(e.g.position, P) < 3.2) tot += hitEnemy(e, 3.2); healUnit(h, tot * 0.5); slashFx(h, 0xff2a2a); }); break;
    case 'dash': {
      A('Dodge_Forward', 1.6); h.iframes = 0.35;
      const ang = angleTo(P, tgt.g.position); h.dashV = { x: Math.sin(ang) * 22, z: Math.cos(ang) * 22, t: Math.min(0.32, flat(P, tgt.g.position) / 22) };
      later(0.3, () => { h.anim.play('Dualwield_Melee_Attack_Stab', { once: true, speed: 1.8 }); meleeSweep(2.6, 160, 2.6, { crit: 0.6 }); });
      break;
    }
    case 'smoke': A('Throw', 1.6); h.buffs.smoke = 3; smoke(P); break;
    case 'blossom': A('2H_Melee_Attack_Spinning', 1.4); for (let k = 0; k < 6; k++) later(0.1 + k * 0.13, () => { aoe(P, 3.2, 0.75); slashFx(h, 0xc48bff, true); }); break;
  }
}
const useSkill = (i) => G && G.hero && castSkill(G.hero, i);
function doDodge() {
  const h = G.hero; if (!G || G.over || h.dodgeCd > 0 || h.state === 'dead') return;
  h.dodgeCd = 2.6; h.iframes = 0.5;
  const mv = moveInput();
  const ang = mv ? Math.atan2(mv.x, mv.z) : h.g.rotation.y;
  h.g.rotation.y = ang;
  h.dashV = { x: Math.sin(ang) * 15, z: Math.cos(ang) * 15, t: 0.32 };
  h.anim.play('Dodge_Forward', { once: true, speed: 1.6, fade: 0.05 }); h.state = 'dodge'; h.stateT = 0; h.stateDur = 0.45;
  sfx('dodge');
}
function drinkPotion() {
  if (!G || G.potions <= 0 || G.potionCd > 0) return;
  const hurt = alive().filter((u) => u.hp < u.maxHp); if (!hurt.length) return;
  G.potions--; G.potionCd = 1;
  for (const u of alive()) { healUnit(u, u.maxHp * 0.35); ring(u.g.position, 0x7dff8a, 2); } sfx('heal');
}
function unitDies(u) {
  u.state = 'dead'; u.anim.play('Death_A', { once: true }); u.hot = null; sfx('kill');
  floatText(u.g.position, 'FALLEN', 'hurt', 3);
  const rest = alive();
  if (!rest.length) { G.over = true; setTimeout(() => showResult(false), 1800); return; }
  if (u === G.hero) { setLead(rest[0]); toast(`${rest[0].name} takes the lead`, '#ffd84a'); }
}

// camera-space movement: up on the stick = away from the camera
function moveInput() {
  let x = 0, z = 0;
  if (keys.KeyW || keys.ArrowUp) z -= 1; if (keys.KeyS || keys.ArrowDown) z += 1;
  if (keys.KeyA || keys.ArrowLeft) x -= 1; if (keys.KeyD || keys.ArrowRight) x += 1;
  if (joy.active) { x = joy.dx; z = joy.dy; }
  const L = Math.hypot(x, z); if (L < 0.12) return null;
  return { x: x / Math.max(1, L), z: z / Math.max(1, L) };
}
function tryMove(ent, dx, dz) {
  const p = ent.g.position, r = ent.radius || 0.55;
  if (walkable(p.x + dx, p.z, r)) p.x += dx;
  if (walkable(p.x, p.z + dz, r)) p.z += dz;
}
function moveUnit(h, to, dt, mul = 1) {
  const d = flat(to, h.g.position); if (d < 0.01) return;
  const vx = (to.x - h.g.position.x) / d, vz = (to.z - h.g.position.z) / d;
  tryMove(h, vx * h.C.speed * mul * dt, vz * h.C.speed * mul * dt);
  faceTo(h, Math.atan2(vx, vz), dt, 22); h.anim.play('Running_A', { speed: 1.35 }); h.state = 'move';
}
function idlePose(h) { h.anim.play(h.C.ranged ? 'Idle' : (h.C.model === 'Barbarian' ? '2H_Melee_Idle' : 'Idle')); h.state = 'idle'; }

// ---------------- update ----------------
function updateUnit(h, dt) {
  h.anim.update(dt);
  for (const k in h.buffs) h.buffs[k] = Math.max(0, h.buffs[k] - dt);
  h.cds = h.cds.map((c) => Math.max(0, c - dt)); h.dodgeCd = Math.max(0, h.dodgeCd - dt); h.iframes = Math.max(0, h.iframes - dt);
  if (h.state !== 'dead') h.mana = Math.min(h.maxMana, h.mana + h.manaRegen * dt);
  if (h.hot) { h.hot.left -= dt; h.hot.tick += dt; if (h.hot.tick >= 1) { h.hot.tick -= 1; healUnit(h, h.hot.per, true); } if (h.hot.left <= 0) h.hot = null; }
  if (h.flashT > 0) { h.flashT -= dt; if (h.flashT <= 0) unflash(h); }
  if (h.state === 'dead') return;
  h.stateT += dt;
  if (h.dashV && h.dashV.t > 0) { tryMove(h, h.dashV.x * dt, h.dashV.z * dt); h.dashV.t -= dt; }
  const ctrl = h === G.hero && (!G.auto || !!moveInput() || attackHeld || keys.KeyJ || (h.path && h.path.length > 0));
  if (h.state === 'attack') {
    if (!h.hitDone && h.stateT >= h.hitAt) { h.hitDone = true; withAct(h, () => resolveAttack(h)); }
    if (h.stateT >= h.stateDur) h.state = 'idle';
    else { const mv = ctrl && moveInput(); if (mv && h.stateT > h.hitAt) h.state = 'idle'; else return; }
  }
  if (h.state === 'skill' || h.state === 'dodge') { if (h.stateT >= h.stateDur) h.state = 'idle'; else return; }
  if (ctrl && h === G.hero && SAVE.autoSkills !== false && h.state !== 'attack') aiSkills(h, dt, h.target && !h.target.dead ? h.target : nearestEnemy(h, 12));
  if (h.state === 'skill') return;
  if (ctrl) controlLead(h, dt); else aiUnit(h, dt);
}
// the hero you are steering: joystick, tapped path or tapped enemy
function controlLead(h, dt) {
  let mv = moveInput();
  if (mv) { h.target = null; h.path = null; }
  if (!mv && h.path && h.path.length) {
    const p = h.path[0], d = flat(p, h.g.position);
    if (d < 0.5) h.path.shift(); else mv = { x: (p.x - h.g.position.x) / d, z: (p.z - h.g.position.z) / d };
  }
  if (!mv && h.target) {
    if (h.target.dead) h.target = null;
    else {
      const d = flat(h.target.g.position, h.g.position), reach = (h.C.ranged ? 11 : h.C.range * 0.9) + h.target.radius;
      if (d > reach) mv = { x: (h.target.g.position.x - h.g.position.x) / d, z: (h.target.g.position.z - h.g.position.z) / d };
      else { faceTo(h, angleTo(h.g.position, h.target.g.position), dt); startAttack(h); return; }
    }
  }
  if (attackHeld || keys.KeyJ) { startAttack(h); return; }
  if (mv) {
    tryMove(h, mv.x * h.C.speed * dt, mv.z * h.C.speed * dt);
    faceTo(h, Math.atan2(mv.x, mv.z), dt, 22); h.anim.play('Running_A', { speed: 1.35 }); h.state = 'move';
  } else idlePose(h);
}
const FORMATION = [[0, 0], [-2.2, 2.2], [2.2, 2.2], [0, 4.2]];
// everyone else (and the lead when Auto is on) fights by themselves
function aiUnit(h, dt) {
  const lead = G.hero, isLead = h === lead;
  let tgt = !isLead && lead.target && !lead.target.dead ? lead.target : null;
  if (tgt && flat(tgt.g.position, h.g.position) > 18) tgt = null;
  if (!tgt) tgt = nearestEnemy(h, 14);
  h.aiTarget = tgt; if (isLead) h.target = tgt;
  aiSkills(h, dt, tgt);
  if (h.state === 'skill') return;
  if (tgt) {
    const d = flat(tgt.g.position, h.g.position), reach = h.C.ranged ? 9 : h.C.range * 0.9 + tgt.radius;
    if (d > reach + 0.3) moveUnit(h, tgt.g.position, dt);
    else if (h.C.ranged && d < 3.5) { const away = h.g.position.clone().add(h.g.position.clone().sub(tgt.g.position)); moveUnit(h, away, dt, 0.8); }
    else { faceTo(h, angleTo(h.g.position, tgt.g.position), dt); startAttack(h); }
    return;
  }
  if (!isLead) {
    const f = FORMATION[h.slot], want = new THREE.Vector3(lead.g.position.x + f[0], 0, lead.g.position.z + f[1]), d = flat(want, h.g.position);
    if (d > 28) { h.g.position.copy(want); return; }
    if (d > 1.6) moveUnit(h, want, dt, d > 8 ? 1.6 : 1.05); else idlePose(h);
  } else idlePose(h);
}
function aiSkills(h, dt, tgt) {
  if (h.state !== 'idle' && h.state !== 'move') return;
  for (let i = 0; i < 4; i++) {
    const id = h.skills[i], S = id && SKILLS[id];
    if (!S || h.cds[i] > 0 || h.level < S.lv || Math.random() > dt * 2.2) continue;
    if (HEAL_SKILLS.has(id)) { if (!alive().some((u) => u.hp < u.maxHp * 0.7)) continue; }
    else if (id === 'divine' || id === 'smite') { if (!tgt && !alive().some((u) => u.hp < u.maxHp * 0.7)) continue; }
    else if (SELF_SKILLS.has(id)) { if (!tgt || flat(tgt.g.position, h.g.position) > 6) continue; if (id === 'guard' && h.hp > h.maxHp * 0.8 && Math.random() < 0.7) continue; }
    else if (!tgt || flat(tgt.g.position, h.g.position) > (h.C.ranged ? 12 : 5)) continue;
    if (castSkill(h, i)) return;
  }
}

function updateEnemy(e, dt) {
  e.anim.update(dt * (e.slow > 0 ? 0.55 : 1));
  if (e.flashT > 0) { e.flashT -= dt; if (e.flashT <= 0) unflash(e); }
  e.stateT += dt;
  if (e.dead) { if (e.stateT > 4) { e.g.position.y -= dt * 0.4; if (e.stateT > 7) { scene.remove(e.g); e.gone = true; } } return; }
  e.stun = Math.max(0, e.stun - dt); e.slow = Math.max(0, e.slow - dt); e.mark = Math.max(0, e.mark - dt);
  const h = nearestParty(e.g.position);
  if (!h) { e.anim.play('Cheer'); return; }
  const d = flat(e.g.position, h.g.position);
  if (e.state === 'dormant') { if (d < 9) wake(e); return; }
  if (e.state === 'throne') { if (d < 13) { e.state = 'idle'; e.anim.play('Taunt', { once: true }); e.stateT = -1.6; toast('<b>The Bone Warden</b> rises from his throne!', '#ff5a4a'); sfx('boom'); G.shake = 0.8; $('#bossbar').classList.add('on'); } return; }
  if (e.state === 'waking') { if (e.stateT >= e.wakeDur) { e.state = 'idle'; e.stateT = 0; } return; }
  if (e.stun > 0) { e.anim.play('Idle_Combat'); return; }
  if (e.state === 'hit') { if (e.stateT > 0.35) e.state = 'idle'; else return; }
  if (e.stateT < 0) return; // boss taunting
  if (G.over) { e.anim.play('Cheer'); return; }
  e.atkCd -= dt * (e.slow > 0 ? 0.5 : 1);

  if (e.wind) { // telegraphed heavy hit: red circle on the floor, step out of it
    e.wind.t += dt;
    if (e.wind.t >= e.wind.dur) {
      burst(e.wind.at, 0xff4a3a, 22); G.shake = Math.max(G.shake, 0.5); sfx('boom');
      for (const u of alive()) if (flat(e.wind.at, u.g.position) <= e.wind.r + 0.3) hurtUnit(u, e.atkPow * 2.6, e, true);
      e.wind = null; e.state = 'recover'; e.stateT = 0;
    }
    return;
  }
  if (e.state === 'recover') { if (e.stateT > 0.6) e.state = 'idle'; else return; }
  if (e.state === 'attack') {
    if (!e.hitDone && e.stateT > e.hitAt) {
      e.hitDone = true;
      if (e.E.ranged) { const tu = h; bolt(e.g.position.clone().add(new THREE.Vector3(0, 1.4, 0)), tu, e.g.rotation.y, 0x7dff8a, () => hurtUnit(tu, e.atkPow, e), 0.25, true); }
      else if (d < e.E.range + 0.7) hurtUnit(h, e.atkPow, e);
    }
    if (e.stateT > e.atkDur) e.state = 'idle';
    return;
  }
  faceTo(e, angleTo(e.g.position, h.g.position), dt, 7);
  const want = e.E.ranged ? 7 : e.E.range * 0.85;
  if (d > want + 0.4 && d < 30) {
    const sp = e.E.speed * (e.slow > 0 ? 0.5 : 1);
    let sx = 0, sz = 0; // keep a little space between skeletons
    for (const o of G.enemies) { if (o === e || o.dead) continue; const od = flat(o.g.position, e.g.position); if (od < 1.6 && od > 0.01) { sx += (e.g.position.x - o.g.position.x) / od; sz += (e.g.position.z - o.g.position.z) / od; } }
    const vx = (h.g.position.x - e.g.position.x) / d + sx * 0.6, vz = (h.g.position.z - e.g.position.z) / d + sz * 0.6, L = Math.hypot(vx, vz) || 1;
    tryMove(e, vx / L * sp * dt, vz / L * sp * dt);
    e.anim.play(e.E.boss ? 'Walking_A' : 'Running_A', { speed: e.E.boss ? 1.3 : 1 });
  } else if (e.E.ranged && d < 4.5) { // casters back away
    tryMove(e, -(h.g.position.x - e.g.position.x) / d * 2.5 * dt, -(h.g.position.z - e.g.position.z) / d * 2.5 * dt);
    e.anim.play('Walking_Backwards');
  } else {
    e.anim.play(e.E.boss ? '2H_Melee_Idle' : 'Idle_Combat');
    if (e.atkCd <= 0 && d < (e.E.ranged ? 12 : e.E.range + 0.8)) {
      e.atkCd = e.E.cd * rnd(0.85, 1.2);
      if (e.E.heavy && Math.random() < e.E.heavy) {
        const r = e.E.boss ? (Math.random() < 0.4 ? 5.5 : 3.2) : 2.4;
        const at = r > 5 ? e.g.position.clone() : e.g.position.clone().add(new THREE.Vector3(Math.sin(e.g.rotation.y) * r * 0.75, 0, Math.cos(e.g.rotation.y) * r * 0.75));
        const dur = e.E.boss ? 1.05 : 1.2;
        e.wind = { t: 0, dur, at, r }; telegraph(at, r, dur, 0xff3a2a);
        e.anim.play(r > 5 ? '2H_Melee_Attack_Spin' : '2H_Melee_Attack_Chop', { once: true, speed: e.anim.dur(r > 5 ? '2H_Melee_Attack_Spin' : '2H_Melee_Attack_Chop') / (dur + 0.25) });
        sfx('warn');
      } else {
        const sp = 1.3; e.anim.play(e.E.attack, { once: true, speed: sp });
        e.state = 'attack'; e.stateT = 0; e.atkDur = e.anim.dur(e.E.attack) / sp; e.hitAt = e.atkDur * 0.45; e.hitDone = false;
      }
    }
  }
  // boss calls guards at half health
  if (e.E.boss && !G.bossSpawnedAdds && e.hp < e.maxHp * 0.5) {
    G.bossSpawnedAdds = true; toast('The Warden calls his guards!', '#ff5a4a');
    for (const [dx, dz] of [[-4, -2], [4, -2], [0, 4]]) { const a = spawnEnemy('minion', e.g.position.clone().add(new THREE.Vector3(dx, 0, dz)), false); a.anim.play('Spawn_Ground', { once: true }); a.state = 'waking'; a.wakeDur = a.anim.dur('Spawn_Ground'); a.stateT = 0; burst(a.g.position, 0x7dff8a, 16); }
  }
}

// ---------------- effects ----------------
const fxGroup = new THREE.Group(); scene.add(fxGroup);
function glowMat(color, opacity = 1) { return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }); }
function bolt(from, target, facing, color, onHit0, size = 0.22, enemyShot = false) {
  const caster = ACT, onHit = (e) => withAct(caster, () => onHit0(e));
  const m = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 10), glowMat(color));
  const core = new THREE.Mesh(new THREE.SphereGeometry(size * 0.55, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  m.add(core); m.position.copy(from); fxGroup.add(m);
  const dir = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
  G.fx.push({ type: 'bolt', m, target, dir, speed: enemyShot ? 13 : 24, onHit, life: 1.4, t: 0, color, enemyShot });
}
function slashFx(h, color, full) {
  const geo = new THREE.RingGeometry(1.4, 2.6, 40, 1, full ? 0 : -Math.PI * 0.35, full ? Math.PI * 2 : Math.PI * 0.7);
  const m = new THREE.Mesh(geo, glowMat(color, 0.45)); m.rotation.x = -Math.PI / 2;
  const holder = new THREE.Group(); holder.add(m); holder.position.copy(h.g.position).add(new THREE.Vector3(0, 1.0, 0)); holder.rotation.y = h.g.rotation.y + Math.PI / 2;
  m.rotation.z = Math.PI / 2; fxGroup.add(holder);
  G.fx.push({ type: 'fade', o: holder, mat: m.material, life: 0.22, t: 0, grow: 1.25 });
}
function ring(pos, color, r) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.86, r, 48), glowMat(color, 0.5)); m.rotation.x = -Math.PI / 2; m.position.copy(pos).setY(0.08); fxGroup.add(m);
  G.fx.push({ type: 'fade', o: m, mat: m.material, life: 0.7, t: 0, grow: 1.6 });
}
function nova(pos, color, r) { ring(pos, color, r); sparks(pos.clone().setY(1), color, 30, 9); }
function telegraph(pos, r, dur, color) {
  const g = new THREE.Group(); g.position.copy(pos).setY(0.06);
  const edge = new THREE.Mesh(new THREE.RingGeometry(r * 0.94, r, 56), glowMat(color, 0.9)); edge.rotation.x = -Math.PI / 2;
  const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 56), glowMat(color, 0.2)); fill.rotation.x = -Math.PI / 2; fill.scale.setScalar(0.01);
  g.add(edge, fill); fxGroup.add(g);
  G.fx.push({ type: 'tele', o: g, fill, edge, life: dur, t: 0 });
}
function pillar(pos, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 14, 20, 1, true), glowMat(color, 0.28)); m.position.copy(pos).setY(7); fxGroup.add(m);
  G.fx.push({ type: 'fade', o: m, mat: m.material, life: 0.6, t: 0, grow: 1 });
  sparks(pos.clone().setY(1), color, 14);
}
function burst(pos, color, n = 26) { sparks(pos.clone().setY(1), color, n, 10); const L = FX_LIGHTS[fxLightI++ % FX_LIGHTS.length]; L.color.set(color); L.position.copy(pos).setY(2); L.intensity = 18; G.fx.push({ type: 'light', L, pooled: true, life: 0.35, t: 0, base: 18 }); }
function smoke(pos) { for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(rnd(0.6, 1.2), 10, 8), new THREE.MeshBasicMaterial({ color: 0x8a8a96, transparent: true, opacity: 0.35, depthWrite: false })); m.position.copy(pos).add(new THREE.Vector3(rnd(-1.8, 1.8), rnd(0.3, 2), rnd(-1.8, 1.8))); fxGroup.add(m); G.fx.push({ type: 'fade', o: m, mat: m.material, life: rnd(1.4, 2.6), t: 0, grow: 1.6 }); } }
function ping(pos, color) { ring(pos, new THREE.Color(color).getHex(), 0.7); }
const sparkGeo = new THREE.SphereGeometry(0.06, 6, 4), sparkMats = {};
const sparkMat = (c) => (sparkMats[c] ??= Object.assign(glowMat(c), { userData: { shared: true } }));
function disposeObj(o) { o.traverse((m) => { if (m.isMesh) { if (m.geometry !== sparkGeo) m.geometry.dispose(); if (m.material && !m.material.userData.shared) m.material.dispose(); } }); }
let sparkCount = 0;
function sparks(pos, color, n = 10, sp = 6) {
  for (let i = 0; i < n; i++) {
    if (sparkCount > 160) return;
    sparkCount++;
    const m = new THREE.Mesh(sparkGeo, sparkMat(color)); m.position.copy(pos); fxGroup.add(m);
    const a = rnd(0, Math.PI * 2), up = rnd(0.2, 1);
    G.fx.push({ type: 'spark', o: m, mat: m.material, v: new THREE.Vector3(Math.cos(a) * sp * rnd(0.4, 1), up * sp, Math.sin(a) * sp * rnd(0.4, 1)), life: rnd(0.3, 0.7), t: 0 });
  }
}
function updateFx(dt) {
  for (const f of G.fx) {
    if (f.type === 'later') { f.t -= dt; if (f.t <= 0) { f.dead = true; if (!G.over) f.fn(); } continue; }
    f.t += dt; const k = f.t / f.life;
    if (f.type === 'bolt') {
      let dir = f.dir;
      const tp = f.target && !f.target.dead ? f.target.g.position.clone().setY(f.enemyShot ? 1.3 : 1.2 * (f.target.E ? f.target.E.scale : 1)) : null;
      if (tp) dir = tp.clone().sub(f.m.position).normalize();
      f.m.position.addScaledVector(dir, f.speed * dt);
      if (Math.random() < 0.6) sparks(f.m.position, f.color, 1, 1.5);
      if (tp && f.m.position.distanceTo(tp) < 0.7) { f.dead = true; if (!G.over) f.onHit(f.target); }
      else if (!f.enemyShot && !tp) { for (const e of G.enemies) if (!e.dead && flat(e.g.position, f.m.position) < 0.9) { f.dead = true; f.onHit(e); break; } }
      const [cx, cy] = cellOf(f.m.position.x, f.m.position.z); if (!isFloor(cx, cy) && grid[cy] && grid[cy][cx] !== 2) f.dead = true;
      if (f.dead || k >= 1) { f.dead = true; fxGroup.remove(f.m); disposeObj(f.m); }
      continue;
    }
    if (f.type === 'fade') { f.mat.opacity = (1 - k) * (f.mat.userData.o0 ??= f.mat.opacity); const s = 1 + (f.grow - 1) * k; f.o.scale.setScalar(s); }
    if (f.type === 'spark') { f.o.position.addScaledVector(f.v, dt); f.v.y -= 18 * dt; f.o.scale.setScalar(Math.max(0.01, 1 - k)); }
    if (f.type === 'tele') { f.fill.scale.setScalar(Math.max(0.01, k)); f.edge.material.opacity = 0.6 + 0.4 * Math.sin(f.t * 20); }
    if (f.type === 'light') f.L.intensity = f.base * (1 - k);
    if (k >= 1) { f.dead = true; if (f.type === 'spark') sparkCount--; if (f.o) { fxGroup.remove(f.o); disposeObj(f.o); } if (f.L && f.pooled) f.L.intensity = 0; }
  }
  G.fx = G.fx.filter((f) => !f.dead);
}

// ---------------- loot on the floor ----------------
function dropGold(pos, amount) {
  const o = cloneStatic('coin_stack_small'); o.position.copy(pos).add(new THREE.Vector3(rnd(-0.6, 0.6), 0, rnd(-0.6, 0.6))); scene.add(o);
  G.drops.push({ kind: 'gold', o, amount, t: 0 });
}
function dropItem(pos, src) {
  // most drops are things somebody in the party can actually use
  const ph = partyHeroes(SAVE), usable = Math.random() < 0.8 && ph.length;
  const pick1 = (a) => a[Math.floor(Math.random() * a.length)], slot = pick1(['weapon', 'helm', 'armor', 'boots', 'ring', 'amulet']);
  const who = usable ? pick1(ph) : null;
  const it = makeItem(SAVE, Math.max(TIERS[TIER].lvl, avgPartyLevel(SAVE)), TIER, 0, slot, who && slot === 'weapon' ? CLASSES[who.cls].weapon : null, who && ['helm', 'armor', 'boots'].includes(slot) ? CLASSES[who.cls].armor : null, rollRarity(src, TIER)), R = RARITIES[it.rar], rar = it.rar;
  const g = new THREE.Group(); g.position.copy(pos);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.35, rar >= 2 ? 7 : 3.5, 12, 1, true), glowMat(R.color, 0.55)); beam.position.y = rar >= 2 ? 3.5 : 1.75;
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), new THREE.MeshStandardMaterial({ color: R.color, emissive: R.color, emissiveIntensity: 1.4, roughness: 0.3 })); gem.position.y = 0.6;
  g.add(beam, gem); scene.add(g);
  const lbl = document.createElement('div'); lbl.className = 'lootlbl'; lbl.style.color = R.color; lbl.textContent = it.name; $('#labels').appendChild(lbl);
  G.drops.push({ kind: 'item', o: g, gem, lbl, rar, item: it, color: R.color, t: 0 });
  sfx('loot');
}
function updateDrops(dt) {
  for (const d of G.drops) {
    d.t += dt;
    if (d.gem) { d.gem.rotation.y += dt * 2; d.gem.position.y = 0.6 + Math.sin(d.t * 3) * 0.12; }
    if (d.kind === 'meat') { for (const o of d.o.children) if (o.geometry && o.geometry.type === 'CylinderGeometry' && o.material.transparent) o.rotation.y += dt; }
    const who = d.t > 0.5 ? alive().find((u) => flat(d.o.position, u.g.position) < (d.kind === 'gold' ? 1.8 : 1.6)) : null;
    if (who) {
      d.dead = true; scene.remove(d.o);
      if (d.kind === 'meat') { SAVE.story.meat++; persist(); floatText(who.g.position, `Wolf meat ${SAVE.story.meat}/${MEAT_NEED}`, 'info', 3.2); toast(`Wolf meat (${SAVE.story.meat}/${MEAT_NEED})`, '#ff9a8a'); sfx('loot'); }
      else if (d.kind === 'gold') { G.gold += d.amount; floatText(who.g.position, `+${d.amount} gold`, 'info', 3.2); sfx('coin'); }
      else { G.loot.push(d.item); d.lbl.remove(); toast(`<img src="art/icon_${iconOf(d.item)}.png" alt=""> <span style="color:${d.color}">${d.item.name}</span>`, d.color); sfx('loot'); }
    }
  }
  G.drops = G.drops.filter((d) => !d.dead);
}
const iconOf = (it) => it.kind;

// ---------------- labels: damage numbers, bars ----------------
const floats = [];
function floatText(pos, txt, cls, height = 2.4) {
  const el = document.createElement('div'); el.className = 'dmg ' + (cls || ''); el.textContent = txt; $('#labels').appendChild(el);
  floats.push({ el, pos: pos.clone().add(new THREE.Vector3(rnd(-0.4, 0.4), height, rnd(-0.2, 0.2))), t: 0, life: 1.0 });
}
const projV = new THREE.Vector3();
function toScreen(p) { projV.copy(p).project(camera); return [(projV.x + 1) / 2 * innerWidth, (1 - projV.y) / 2 * innerHeight, projV.z]; }
function updateLabels(dt) {
  for (const f of floats) {
    f.t += dt; const k = f.t / f.life;
    const [x, y] = toScreen(f.pos);
    const s = k < 0.12 ? 1.6 - k * 5 : 1;
    f.el.style.transform = `translate(${x}px, ${y - k * 60}px) translate(-50%, -50%) scale(${s})`;
    f.el.style.opacity = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
    if (k >= 1) { f.el.remove(); f.dead = true; }
  }
  for (let i = floats.length - 1; i >= 0; i--) if (floats[i].dead) floats.splice(i, 1);
  for (const e of G.enemies) {
    if (e.dead || e.E.boss || e.state === 'dormant' || e.gone) { e.bar.style.display = 'none'; continue; }
    const [x, y, z] = toScreen(e.g.position.clone().setY(2.5 * e.E.scale));
    if (z > 1) { e.bar.style.display = 'none'; continue; }
    e.bar.style.display = ''; e.bar.style.transform = `translate(${x}px, ${y}px)`;
    e.bar.firstChild.style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
    e.bar.classList.toggle('tgt', G.hero.target === e);
  }
  for (const d of G.drops) if (d.lbl) { const [x, y] = toScreen(d.o.position.clone().setY(1.5)); d.lbl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; }
}

// ---------------- HUD ----------------
function updateHud() {
  const h = G.hero, p = Math.max(0, h.hp / h.maxHp * 100) + '%';
  $('#bHp').style.width = p; $('#bHpTrail').style.width = p; $('#bHpText').textContent = `${Math.ceil(h.hp)} / ${h.maxHp}`;
  $('#bLevel').textContent = h.level; $('#bXp').style.width = Math.min(100, h.xp / XP_NEED(h.level) * 100) + '%'; $('#bMp').style.width = Math.max(0, h.mana / h.maxMana * 100) + '%';
  $('#bGold').textContent = G.gold; $('#bLoot').textContent = G.loot.length;
  document.querySelectorAll('.pcard').forEach((c) => {
    const u = G.party[+c.dataset.i]; c.classList.toggle('dead', u.state === 'dead');
    c.querySelector('.php b').style.width = Math.max(0, u.hp / u.maxHp * 100) + '%';
  });
  document.querySelectorAll('#pad [data-i]').forEach((b) => {
    const i = +b.dataset.i, id = h.skills[i], S = id && SKILLS[id]; if (!S) { b.classList.add('locked'); return; }
    const locked = h.level < S.lv;
    b.classList.toggle('locked', locked); b.classList.toggle('nomana', !locked && h.mana < skillCost(id)); b.classList.toggle('ready', !locked && h.cds[i] <= 0 && h.mana >= skillCost(id));
    b.style.setProperty('--p', (h.cds[i] / S.cd * 100) + '%'); b.querySelector('.cdn').textContent = !locked && h.cds[i] > 0 ? Math.ceil(h.cds[i]) : '';
  });
  const dc = $('#btnDodge'); dc.style.setProperty('--p', (h.dodgeCd / 2.6 * 100) + '%'); dc.querySelector('.cdn').textContent = h.dodgeCd > 0 ? Math.ceil(h.dodgeCd) : '';
  dc.classList.toggle('urgent', h.dodgeCd <= 0 && G.enemies.some((e) => e.wind && flat(e.wind.at, h.g.position) < e.wind.r + 0.5));
  $('#btnPotion .pn').textContent = G.potions;
  $('#buffs').innerHTML = [['guard', 'Holy Guard'], ['cry', 'Battle Cry'], ['smoke', 'Smoke'], ['haste', 'Haste']].filter(([k]) => h.buffs[k] > 0).map(([k, n]) => `<span>${n} ${Math.ceil(h.buffs[k])}s</span>`).join('') + (h.hot ? '<span>Renew</span>' : '');
  if (G.boss && !G.boss.dead && $('#bossbar').classList.contains('on')) { const bp = Math.max(0, G.boss.hp / G.boss.maxHp * 100) + '%'; $('#bossFill').style.width = bp; $('#bossTrail').style.width = bp; }
  if (G.boss && G.boss.dead) $('#bossbar').classList.remove('on');
  if (G.story) { $('#roomBig').textContent = G.map === 'town' ? 'Frostmoor' : 'The Frozen Trail'; $('#qtrack').textContent = questLine(SAVE.story, G.map); return; }
  const [cx, cy] = cellOf(h.g.position.x, h.g.position.z);
  const room = Object.entries(ROOMS).find(([, r]) => cx >= r[0] && cx <= r[2] && cy >= r[1] && cy <= r[3]);
  $('#roomBig').textContent = room ? { A: 'The Crypt Gate', B: 'Hall of the Restless', C: 'The Ossuary', D: "The Warden's Throne" }[room[0]] : 'Dark Passage';
}

// ---------------- camera + world ----------------
const camOff = new THREE.Vector3(0, 13, 9.5);
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function updateCamera(dt, snap) {
  const h = G.hero.g.position;
  const bossFight = G.boss && !G.boss.dead && G.boss.state !== 'throne';
  G.zoom = (G.zoom || 1) + ((bossFight ? 1.3 : 1) - (G.zoom || 1)) * Math.min(1, dt * 2);
  const off = camOff.clone().multiplyScalar((innerWidth / innerHeight < 1.2 ? 1.25 : 1) * G.zoom);
  const want = h.clone().add(off);
  if (snap) camPos.copy(want); else camPos.lerp(want, 1 - Math.pow(0.00002, dt));
  camLook.copy(camPos).sub(off).add(new THREE.Vector3(0, 1, 0));
  camera.position.copy(camPos);
  if (G.shake > 0) { camera.position.x += rnd(-1, 1) * G.shake * 0.35; camera.position.y += rnd(-1, 1) * G.shake * 0.35; G.shake = Math.max(0, G.shake - dt * 3); }
  camera.lookAt(camLook);
  moon.position.copy(h).add(new THREE.Vector3(-8, 20, 6)); moon.target.position.copy(h);
  heroLight.position.copy(h).add(new THREE.Vector3(0, 6, 2));
  // walls between the camera and the hero become see-through
  if (MAPNAME !== 'crypt') { TORCH_LIGHTS.forEach((L) => { L.intensity = 0; }); if (snowfall) snowfall.userData.update(dt, h); return; }
  for (const w of fadeWalls) {
    let want = 1;
    if (w.side === 'S' && w.z > h.z && w.z - h.z < 9 && Math.abs(w.x - h.x) < 11) want = 0.18;
    if ((w.side === 'E' || w.side === 'W') && w.z > h.z - 1 && w.z - h.z < 8 && Math.abs(w.x - h.x) < 3) want = 0.3;
    if (Math.abs(w.a - want) > 0.01) { w.a += (want - w.a) * Math.min(1, dt * 8); w.obj.traverse((m) => { if (m.isMesh) { m.material.opacity = w.a; m.material.depthWrite = w.a > 0.9; } }); }
  }
  const now = performance.now() / 1000;
  const lp = G.hero.g.position;
  for (const t of torches) {
    const f = 0.8 + 0.12 * Math.sin(now * 11 + t.ph) + 0.08 * Math.sin(now * 23 + t.ph * 2) + 0.05 * Math.sin(now * 41 + t.ph * 3);
    t.cur = t.base * f; t.d2 = (t.pos.x - lp.x) ** 2 + (t.pos.z - lp.z) ** 2;
    if (t.small) t.fl.scale.set(1.4 * f + 0.3, 1.4 * f + 0.3, 1);
    else { t.fl.scale.set(0.6 + f * 0.15, 0.85 + f * 0.35, 1); t.halo.material.opacity = 0.25 + f * 0.12; }
  }
  const near = torches.slice().sort((p, q) => p.d2 - q.d2);
  TORCH_LIGHTS.forEach((L, i) => { const t = near[i]; if (!t) { L.intensity = 0; return; } L.position.copy(t.pos); L.intensity = t.cur; L.distance = t.dist; L.color.setHex(t.color); });
  if (dust) { dust.position.y = Math.sin(now * 0.3) * 0.3; dust.position.x = Math.sin(now * 0.17) * 0.6; }
}

// ---------------- results ----------------
function victory() { if (!G || G.over) return; G.over = true; for (const u of alive()) u.anim.play('Cheer'); showResult(true); }
function finishRun(won) {
  for (const u of G.party) { u.hs.level = u.level; u.hs.xp = Math.floor(u.xp); }
  SAVE.gold += G.gold; SAVE.runs++;
  for (const it of G.loot) { if (SAVE.bag.length < 60) SAVE.bag.push(it); else SAVE.gold += salvageValue(it); }
  if (won) { if (!SAVE.cleared.includes(TIER)) SAVE.cleared.push(TIER); SAVE.maxTier = Math.max(SAVE.maxTier, Math.min(TIER + 1, TIERS.length - 1)); }
  SAVE.lastSeen = Date.now(); persist();
}
function cleanupRun() {
  for (const u of G.party) scene.remove(u.g);
  for (const n of G.npcs) scene.remove(n.g);
  document.body.classList.remove('story'); document.body.classList.remove('cold');
  $('#dlg').classList.remove('on'); $('#talk').classList.remove('on'); $('#hint').classList.remove('on'); $('#sub').classList.remove('on');
  for (const e of G.enemies) { scene.remove(e.g); e.bar.remove(); }
  for (const d of G.drops) { scene.remove(d.o); if (d.lbl) d.lbl.remove(); }
  for (const f of G.fx) { if (f.o) { fxGroup.remove(f.o); disposeObj(f.o); } if (f.m) { fxGroup.remove(f.m); disposeObj(f.m); } if (f.L && f.pooled) f.L.intensity = 0; }
  sparkCount = 0; FX_LIGHTS.forEach((l) => { l.intensity = 0; });
  for (const f of floats) f.el.remove(); floats.length = 0;
  G = null; $('#hud3').classList.add('hidden'); $('#bossbar').classList.remove('on'); $('#modal').classList.remove('on'); $('#modal').innerHTML = '';
}
function showResult(won) {
  if (G.story) return showStoryDefeat();
  finishRun(won);
  const cards = G.loot.slice().sort((a, b) => b.rar - a.rar).map((it, i) => `<div class="lcard r${it.rar}" style="--r:${RARITIES[it.rar].color};animation-delay:${0.4 + i * 0.15}s"><img src="art/icon_${iconOf(it)}.png" alt=""><b>${it.name}</b><small>${RARITIES[it.rar].name}</small></div>`).join('') || '<p class="empty" style="align-self:center">No gear picked up.</p>';
  const lv = G.party.map((u) => `<div class="rstat"><small>${u.C.name}</small><b>Lv ${u.level}</b></div>`).join('');
  const tier = G.tier;
  let sub = won ? 'The Bone Warden falls. The crypt is quiet... for now.' : 'The dead drag you down. Gear your party up and try again.';
  if (won && SAVE.story && SAVE.story.q.father === 'active') { const R = SAVE.story.recruit; SAVE.story.q.father = 'done'; SAVE.gold += 120; persist(); sub = `Behind the Warden's throne, in a rusted cage, you find ${R.name}'s father, Edric, weak but alive. "Tell my daughter I am proud of her," he whispers. You lead him out of the dark. (+120 gold). Frostmoor has more people who need help...`; }
  $('#modal').innerHTML = `<div class="result ${won ? '' : 'lose'}"><div class="burst"></div><h1 class="${won ? 'goldtext' : ''}">${won ? 'Victory' : 'Defeated'}</h1>
    <div class="rsub">${sub}</div>
    <div class="rstats">${lv}<div class="rstat"><small>Gold</small><b>${G.gold}</b></div><div class="rstat"><small>Gear</small><b>${G.loot.length}</b></div></div>
    <div class="lootcards">${cards}</div>
    <div class="row"><button class="btn btn-gold btn-xl" id="rAgain"><span>Run it again</span></button><button class="btn btn-steel" id="rHub"><span>Back to camp</span></button>${SAVE.story ? '<button class="btn btn-steel" id="rVillage"><span>Visit Frostmoor</span></button>' : ''}</div></div>`;
  $('#modal').classList.add('on');
  $('#rAgain').onclick = () => { cleanupRun(); startRun(tier); };
  $('#rHub').onclick = () => { cleanupRun(); window.HOL.showHub(); };
  if ($('#rVillage')) $('#rVillage').onclick = () => { cleanupRun(); startStory('town'); };
}
function toast(html, color) {
  const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = html; if (color) d.style.setProperty('--tc', color);
  $('#toasts').appendChild(d); setTimeout(() => d.remove(), 3200); while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}

// ---------------- sound (tiny synth) ----------------
let AC = null;
function sfx(kind) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const P = { hit: [160, 60, 0.08, 'sawtooth', 0.1], crit: [240, 70, 0.14, 'square', 0.1], swing: [500, 200, 0.08, 'triangle', 0.03], spell: [500, 900, 0.2, 'sine', 0.08], heal: [520, 780, 0.3, 'triangle', 0.08],
      hurt: [120, 50, 0.12, 'square', 0.1], dodge: [700, 1200, 0.1, 'sine', 0.06], loot: [660, 990, 0.18, 'triangle', 0.08], coin: [900, 1300, 0.07, 'square', 0.04],
      level: [440, 880, 0.6, 'triangle', 0.12], boom: [90, 30, 0.5, 'sawtooth', 0.14], warn: [300, 300, 0.14, 'square', 0.05], kill: [200, 80, 0.25, 'triangle', 0.08] }[kind];
    if (!P) return;
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = P[3]; o.frequency.setValueAtTime(P[0], t); o.frequency.exponentialRampToValueAtTime(P[1], t + P[2]);
    g.gain.setValueAtTime(P[4], t); g.gain.exponentialRampToValueAtTime(0.001, t + P[2]);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + P[2] + 0.02);
  } catch (e) { }
}

// ---------------- main loop ----------------
// If the device is slow for a few seconds, quietly lower the graphics a notch (resolution, then glow, then shadows) instead of stuttering.
let perfAvg = 16, perfLevel = 0, perfSlowT = 0;
function perfGuard(raw) {
  if (!G || raw > 0.5) return; // ignore tab switches and loading hitches
  perfAvg += (raw * 1000 - perfAvg) * 0.05;
  if (perfAvg > 26) perfSlowT += raw; else perfSlowT = Math.max(0, perfSlowT - raw);
  if (perfSlowT > 3 && perfLevel < 3) {
    perfLevel++; perfSlowT = 0; perfAvg = 16;
    if (perfLevel === 1) { renderer.setPixelRatio(1); resize(); }
    if (perfLevel === 2) bloom.enabled = false;
    if (perfLevel === 3) { renderer.shadowMap.enabled = false; scene.traverse((o) => { if (o.material) { for (const m of [].concat(o.material)) m.needsUpdate = true; } }); }
    console.info('graphics lowered to level', perfLevel);
  }
}
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const raw = clock.getDelta();
  let dt = Math.min(0.05, raw) * SPEED;
  perfGuard(raw);
  if (!G) { composer.render(); return; }
  step(dt);
  composer.render();
}
function step(dt) {
  G.t += dt;
  for (const n of G.npcs) n.anim.update(dt);
  if (G.talking) { updateCamera(dt); updateLabels(dt); updateHud(); return; }
  if (G.story) storyStep(dt);
  if (G.hitstop > 0) { G.hitstop -= dt; dt *= 0.08; }
  G.potionCd = Math.max(0, G.potionCd - dt);
  for (const u of G.party) updateUnit(u, dt);
  if (G.auto && alive().some((u) => u.hp < u.maxHp * 0.3)) drinkPotion();
  for (const e of G.enemies) if (!e.gone) updateEnemy(e, dt);
  G.enemies = G.enemies.filter((e) => !e.gone);
  // bodies don't overlap: push skeletons and heroes apart
  for (const u of alive()) for (const e of G.enemies) {
    if (e.dead || e.state === 'dormant' || e.state === 'throne') continue;
    const min = e.radius + u.radius + 0.15, d = flat(e.g.position, u.g.position);
    if (d < min && d > 0.001) {
      const push = (min - d), nx = (e.g.position.x - u.g.position.x) / d, nz = (e.g.position.z - u.g.position.z) / d, share = u === G.hero ? (e.E.boss ? 0.5 : 0.1) : (e.E.boss ? 1 : 0.3);
      tryMove(e, nx * push * (1 - share), nz * push * (1 - share)); tryMove(u, -nx * push * share, -nz * push * share);
    }
  }
  updateFx(dt); updateDrops(dt); updateCamera(dt); updateLabels(dt); updateHud();
}
window.__three = { renderer, scene, camera };
window.__game = { get G() { return G; }, walkable: (x, z, r) => walkable(x, z, r), step, useSkill, castSkill, CLASSES, findPath, get SAVE() { return SAVE; }, startRun: (t) => startRun(t), setLead }; window.__findPath = findPath; // test hooks

// Compile every shader we will ever need while the loading screen is up (materials are kept, so the compiled programs stay cached).
const WARM = [];
function warmup() {
  const tmp = new THREE.Group(); scene.add(tmp);
  for (const c of Object.values(CLASSES)) { const m = makeModel(c.model, c.show, 1, c.tint, c.real); tmp.add(m.g); WARM.push(m); }
  for (const k of Object.keys(ENEMY)) { const m = buildEnemy(ENEMY[k]); tmp.add(m.g); WARM.push(m); }
  const bits = [new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), glowMat(0xffaa44)), new THREE.Mesh(new THREE.RingGeometry(1, 2, 24), glowMat(0xffffff, 0.5)),
    new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4, 8, 1, true), glowMat(0xffffff, 0.3)), new THREE.Mesh(sparkGeo, sparkMat(0xffffff)),
    new THREE.Mesh(new THREE.OctahedronGeometry(0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 })),
    new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0x8a8a96, transparent: true, opacity: 0.3, depthWrite: false }))];
  for (const b of bits) { b.frustumCulled = false; tmp.add(b); WARM.push({ bits: b }); }
  tmp.position.set(GW * TILE / 2, 0, GH * TILE / 2); camera.position.set(tmp.position.x, 14, tmp.position.z + 10); camera.lookAt(tmp.position);
  renderer.compile(scene, camera); composer.render();
  scene.remove(tmp); // the materials stay referenced in WARM, so their programs are not released
}

// ---------------- boot ----------------
function beginStory({ cls, gender, name }) {
  SAVE = newStorySave(cls, gender, name); persist(); startStory('trail');
}
function startRun(tier) { $('#hub').classList.add('hidden'); newGame(tier); updateCamera(0, true); }
window.HOL = { startStory, beginStory, openMenu: () => { if (G) { G.talking = true; window.HOL.showMenu(); } }, closeMenu: () => { if (G) { G.talking = false; refreshParty(); } }, startRun, getSave: () => SAVE, setSave: (s) => { SAVE = s; }, persist, showHub: () => {} };
requestAnimationFrame(frame);
(async () => {
  await loadAll(['Knight', 'Mage', 'Rogue_Hooded', 'Barbarian', 'Skeleton_Minion', 'Skeleton_Warrior', 'Skeleton_Mage', 'Skeleton_Rogue',
    ...['Skeleton_Blade', 'Skeleton_Axe', 'Skeleton_Staff'].map((n) => `assets/skelweap/${n}.gltf`), ...PROPS.map(D), ...PH_MODELS.map(PH)]);
  for (const c of Object.values(CLASSES)) if (c.real && !REAL[c.real]) { try { await loadReal(c.real); } catch (e) { console.warn('real model missing', c.real, e); c.real = null; } }
  for (const n of [1, 2, 3]) { try { const g = await loader.loadAsync(`assets/trees/tree${n}.glb`); let mesh = null; g.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; }); if (mesh) { mesh.updateWorldMatrix(true, false); const geo = mesh.geometry.clone(); geo.applyMatrix4(mesh.matrixWorld); TREE_ASSETS.push({ geometry: geo, map: mesh.material.map }); } } catch (e) { /* no tree model yet */ } }
  try { GL['assets/wolf/wolf.glb'] = await loader.loadAsync('assets/wolf/wolf.glb'); } catch (e) { console.info('no wolf model yet, using the stand-in'); }
  buildCrypt(); CRYPT.grid = grid.map((r) => r.slice());
  ensureMap('trail'); ensureMap('town'); snowfall = makeSnowfall(MOBILE ? 800 : 1400); scene.add(snowfall);
  warmup(); loadMap('crypt');
  window.HOL.ready = true; window.dispatchEvent(new Event('hol-ready'));
  if (Q.get('go')) startRun(Number(Q.get('tier')) || 0);
  if (Q.get('story')) { if (!SAVE.story) SAVE = newStorySave(Q.get('cls') || 'mage', CLASS_GENDER[Q.get('cls') || 'mage'], 'Tester'); startStory(Q.get('story'), Q.get('hunt') ? { hunt: true, spawn: [12, 6] } : {}); }
})();
