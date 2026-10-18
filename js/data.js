// Chronicles of Hollowmere (working title) - shared game data: classes, skills, gear, save, idle rewards.
// Design: GAME4-DESIGN.md. 6 classes, 4 skill slots per hero (slots 1-2 own class, 3-4 any), 6 gear colours.

export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- classes ----------
// model/show/tint choose the free stand-in 3D model; base/grow are hero stats per level.
export const CLASSES = {
  knight: { name: 'Knight', armor: 'heavy', role: 'Defender', color: '#f0c75e', model: 'Knight', real: 'knight_female', show: ['1H_Sword', 'Badge_Shield'], weapon: 'sword', speed: 7.8,
    range: 2.4, arc: 110, attacks: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Chop'], attackSpeed: 1,
    base: { hp: 280, atk: 17, def: 16, crit: 5, haste: 0 }, grow: { hp: 40, atk: 2.6, def: 2.2 }, own: ['bash', 'guard', 'judgment'],
    blurb: 'Heavy armor and a holy shield. Hard to kill; holds the line for the party.' },
  mage: { name: 'Mage', armor: 'light', role: 'Spellcaster', color: '#6fb6ff', model: 'Mage', show: ['2H_Staff'], weapon: 'staff', speed: 7.6, ranged: true, bolt: 0x8fd0ff,
    range: 14, attacks: ['Spellcast_Shoot'], attackSpeed: 1,
    base: { hp: 190, atk: 23, def: 7, crit: 8, haste: 0 }, grow: { hp: 26, atk: 3.7, def: 1.1 }, own: ['fireball', 'nova', 'meteor'],
    blurb: 'Fragile but burns whole rooms down with fire and frost.' },
  healer: { name: 'Healer', armor: 'light', role: 'Support', color: '#ffe39a', model: 'Mage', show: ['1H_Wand', 'Spellbook'], weapon: 'staff', tint: 0xfff0c0, speed: 7.6, ranged: true, bolt: 0xffe9a8,
    range: 12, attacks: ['Spellcast_Shoot'], attackSpeed: 0.9,
    base: { hp: 220, atk: 16, def: 10, crit: 5, haste: 0 }, grow: { hp: 31, atk: 2.7, def: 1.7 }, own: ['smite', 'renew', 'divine'],
    blurb: 'Keeps the whole party on its feet and smites the dead.' },
  ranger: { name: 'Ranger', armor: 'medium', role: 'Marksman', color: '#8fd36b', model: 'Rogue_Hooded', show: ['2H_Crossbow'], weapon: 'bow', tint: 0xb6e8a0, speed: 8.4, ranged: true, bolt: 0xe6d7a8,
    range: 13, attacks: ['2H_Ranged_Shoot'], attackSpeed: 1.2,
    base: { hp: 205, atk: 20, def: 8, crit: 12, haste: 10 }, grow: { hp: 28, atk: 3.2, def: 1.4 }, own: ['power', 'volley', 'mark'],
    blurb: 'Fast bolts from a safe distance and deadly marked shots.' },
  warrior: { name: 'Warrior', armor: 'heavy', role: 'Berserker', color: '#ff7a5a', model: 'Barbarian', show: ['2H_Axe'], weapon: 'axe', speed: 7.8,
    range: 2.8, arc: 140, attacks: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice'], attackSpeed: 0.95,
    base: { hp: 255, atk: 22, def: 11, crit: 7, haste: 0 }, grow: { hp: 34, atk: 3.3, def: 1.7 }, own: ['spin', 'cry', 'rage'],
    blurb: 'A huge axe that cleaves through crowds and drinks their blood.' },
  rogue: { name: 'Rogue', armor: 'medium', role: 'Assassin', color: '#c48bff', model: 'Rogue_Hooded', show: ['Knife', 'Knife_Offhand'], weapon: 'daggers', speed: 9.0,
    range: 2.2, arc: 100, attacks: ['Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab', 'Dualwield_Melee_Attack_Chop'], attackSpeed: 1.25,
    base: { hp: 210, atk: 18, def: 8, crit: 18, haste: 15 }, grow: { hp: 27, atk: 3.1, def: 1.4 }, own: ['dash', 'smoke', 'blossom'],
    blurb: 'Quick daggers, huge critical hits, and tricks to avoid harm.' },
};
export const DEFAULT_NAMES = {
  knight: ['Aldric', 'Brienne'], mage: ['Corvin', 'Isolde'], healer: ['Bran', 'Mirela'], ranger: ['Garrick', 'Sylva'], warrior: ['Thorgal', 'Hilde'], rogue: ['Vex', 'Nyra'],
};

// ---------- skills ----------
// icon = art/skill_<icon>.jpg; lv = hero level needed to use it.
export const SKILLS = {
  bash: { name: 'Shield Bash', icon: 'bash', cd: 6, lv: 1, cls: 'knight', desc: 'Stun and hit the enemies in front for 170%.' },
  guard: { name: 'Holy Guard', icon: 'guard', cd: 14, lv: 3, cls: 'knight', desc: 'Take 55% less damage for 5s and heal 10%.' },
  judgment: { name: 'Judgment', icon: 'judgment', cd: 20, lv: 6, cls: 'knight', desc: 'Holy light strikes every nearby enemy for 300%.' },
  fireball: { name: 'Fireball', icon: 'fireball', cd: 3.5, lv: 1, cls: 'mage', desc: 'Hurl fire that explodes for 240% in an area.' },
  nova: { name: 'Frost Nova', icon: 'nova', cd: 10, lv: 3, cls: 'mage', desc: 'Freeze and slow every enemy around you, 120%.' },
  meteor: { name: 'Meteor', icon: 'meteor', cd: 18, lv: 6, cls: 'mage', desc: 'A meteor crushes a wide area for 400% after a short delay.' },
  smite: { name: 'Smite', icon: 'smite', cd: 4, lv: 1, cls: 'healer', desc: 'Holy bolt for 170% that heals the weakest ally.' },
  renew: { name: 'Renew', icon: 'renew', cd: 12, lv: 3, cls: 'healer', desc: 'Heals the whole party over 6 seconds.' },
  divine: { name: 'Divine Light', icon: 'divine', cd: 20, lv: 6, cls: 'healer', desc: 'Light burst hits enemies for 220% and heals the party 25%.' },
  power: { name: 'Power Shot', icon: 'power', cd: 4.5, lv: 1, cls: 'ranger', desc: 'A heavy bolt for 260% with extra crit chance.' },
  volley: { name: 'Volley', icon: 'volley', cd: 9, lv: 3, cls: 'ranger', desc: 'Three rains of bolts on nearby enemies (80% each).' },
  mark: { name: "Hunter's Mark", icon: 'mark', cd: 16, lv: 6, cls: 'ranger', desc: 'Target takes 50% more damage; you shoot 40% faster for 8s.' },
  spin: { name: 'Whirlwind', icon: 'cleave', cd: 7, lv: 1, cls: 'warrior', desc: 'Two spins hitting everything around you for 150% and 100%.' },
  cry: { name: 'Battle Cry', icon: 'cry', cd: 14, lv: 3, cls: 'warrior', desc: '+50% damage for 7s and heal 12%.' },
  rage: { name: 'Bloodrage', icon: 'rage', cd: 16, lv: 6, cls: 'warrior', desc: 'Massive hit for 320% that heals half the damage dealt.' },
  dash: { name: 'Shadow Strike', icon: 'backstab', cd: 5, lv: 1, cls: 'rogue', desc: 'Dash to the target and stab for 260% with +60% crit.' },
  smoke: { name: 'Smoke Bomb', icon: 'smoke', cd: 12, lv: 3, cls: 'rogue', desc: 'Avoid every attack for 3 seconds.' },
  blossom: { name: 'Death Blossom', icon: 'blossom', cd: 16, lv: 6, cls: 'rogue', desc: 'Six blade whirls around you, 75% each.' },
};
export const HEAL_SKILLS = new Set(['renew']); // AI only casts these when someone is hurt
export const SELF_SKILLS = new Set(['guard', 'smoke', 'cry']);

// ---------- gear (6 colours) ----------
export const RARITIES = [
  { id: 'white', name: 'White', color: '#d8d8d8', affixes: 0, mult: 1.0 },
  { id: 'green', name: 'Green', color: '#55d873', affixes: 1, mult: 1.15 },
  { id: 'blue', name: 'Blue', color: '#4aa6ff', affixes: 2, mult: 1.32 },
  { id: 'purple', name: 'Purple', color: '#b86dff', affixes: 3, mult: 1.52 },
  { id: 'gold', name: 'Gold', color: '#ffc93a', affixes: 4, mult: 1.8 },
  { id: 'red', name: 'Red', color: '#ff4a3a', affixes: 5, mult: 2.2 },
];
// drop weights per dungeon tier: white..red
export const RARITY_WEIGHTS = [[60, 28, 9, 2.5, 0.45, 0.05], [48, 30, 14, 6, 1.7, 0.3], [38, 31, 18, 9, 3.4, 0.6], [28, 30, 22, 12, 6, 2]];
export const SLOTS = ['weapon', 'helm', 'armor', 'boots', 'ring', 'amulet'];
export const SLOT_INFO = {
  weapon: { label: 'Weapon', main: { atk: 1.6 } }, helm: { label: 'Helm', main: { hp: 6, def: 0.5 } }, armor: { label: 'Armor', main: { hp: 10, def: 0.8 } },
  boots: { label: 'Boots', main: { def: 0.4, haste: 0.3 } }, ring: { label: 'Ring', main: { atk: 0.6, crit: 0.25 } }, amulet: { label: 'Amulet', main: { hp: 7, crit: 0.2 } },
};
export const AFFIXES = [
  { stat: 'hp', per: 4, word: 'of Vigor' }, { stat: 'atk', per: 0.6, word: 'of Might' }, { stat: 'def', per: 0.35, word: 'of Warding' },
  { stat: 'crit', per: 0.2, word: 'of Precision' }, { stat: 'haste', per: 0.25, word: 'of Swiftness' },
];
const BASE_NAMES = {
  sword: ['Longsword', 'Broadsword', 'Bastard Sword'], staff: ['Staff', 'Rod', 'Spire'], bow: ['Crossbow', 'Warbow', 'Recurve'], axe: ['Greataxe', 'Cleaver', 'War Axe'], daggers: ['Daggers', 'Fangs', 'Stilettos'],
  helm: ['Helm', 'Hood', 'Crown'], armor: ['Hauberk', 'Breastplate', 'Brigandine'], boots: ['Boots', 'Greaves', 'Treads'], ring: ['Ring', 'Band', 'Signet'], amulet: ['Amulet', 'Pendant', 'Talisman'],
};
const PREFIXES = [['Rusted', 'Worn', 'Plain'], ['Iron', 'Sturdy', 'Fine'], ['Runed', 'Tempered', 'Gleaming'], ['Dread', 'Shadow', 'Grave-forged'], ['Ancient', "Warden's", 'Kingslayer'], ['Hollow', 'Bonekeeper', 'Crypt-lord']];
// ---------- armor types (David 10-18): heavy plate / medium leather / light cloth ----------
export const ARMOR_TYPES = {
  heavy: { name: 'Plate', label: 'Heavy', icon: 'plate', who: 'Knight, Warrior', blurb: 'Plate armor: huge health and defense.' },
  medium: { name: 'Leather', label: 'Medium', icon: 'leather', who: 'Ranger, Rogue', blurb: 'Leather armor: balanced, with crit and speed.' },
  light: { name: 'Cloth', label: 'Light', icon: 'cloth', who: 'Mage, Healer', blurb: 'Cloth robes: little defense, but extra attack and crit.' },
};
export const ARMOR_SLOTS = ['helm', 'armor', 'boots'];
const ARMOR_MAIN = {
  heavy: { helm: { hp: 7, def: 0.7 }, armor: { hp: 12, def: 1.2 }, boots: { hp: 5, def: 0.6 } },
  medium: { helm: { hp: 5, def: 0.4, crit: 0.2 }, armor: { hp: 8, def: 0.6, haste: 0.25 }, boots: { def: 0.3, haste: 0.45 } },
  light: { helm: { hp: 3, atk: 0.5, crit: 0.2 }, armor: { hp: 5, def: 0.2, atk: 0.9 }, boots: { atk: 0.3, haste: 0.35 } },
};
const ARMOR_BASE_NAMES = {
  heavy: { helm: ['Greathelm', 'Plate Helm', 'Visored Helm'], armor: ['Plate Cuirass', 'Platemail', 'Plate Hauberk'], boots: ['Plate Greaves', 'Sabatons', 'Plate Boots'] },
  medium: { helm: ['Leather Hood', 'Studded Cap', 'Hide Cowl'], armor: ['Leather Jerkin', 'Studded Vest', 'Hide Armor'], boots: ['Leather Boots', 'Hide Treads', 'Ranger Boots'] },
  light: { helm: ['Cloth Cowl', 'Silk Hood', 'Circlet'], armor: ['Silk Robe', 'Cloth Vestments', 'Mage Robe'], boots: ['Cloth Slippers', 'Silk Sandals', 'Soft Shoes'] },
};
// Armor sets (David 10-18): wearing 2 or 3 pieces (helm, armor, boots) of your class's armor type gives stat boosts that help that class.
// keys: hpPct defPct atkPct (percent of total), crit haste (flat points), dmgTaken (less damage taken), lifesteal, cdr (shorter cooldowns), healPct (stronger heals)
export const ARMOR_SETS = {
  knight: { name: 'Bulwark Plate', two: { hpPct: 12 }, three: { defPct: 20, dmgTaken: 10 } },
  warrior: { name: 'Warlord Plate', two: { hpPct: 10 }, three: { atkPct: 12, lifesteal: 8 } },
  ranger: { name: 'Wildstalker Leather', two: { crit: 6 }, three: { haste: 15, atkPct: 10 } },
  rogue: { name: 'Shadowbound Leather', two: { crit: 8 }, three: { haste: 20, atkPct: 8 } },
  mage: { name: 'Arcane Cloth', two: { atkPct: 12 }, three: { atkPct: 10, cdr: 15 } },
  healer: { name: 'Sanctified Cloth', two: { hpPct: 10, atkPct: 8 }, three: { healPct: 25, cdr: 10 } },
};
const BONUS_TEXT = { hpPct: (v) => `+${v}% health`, defPct: (v) => `+${v}% defense`, atkPct: (v) => `+${v}% attack`, crit: (v) => `+${v}% crit`, haste: (v) => `+${v}% speed`,
  dmgTaken: (v) => `${v}% less damage taken`, lifesteal: (v) => `heal ${v}% of damage dealt`, cdr: (v) => `skills ${v}% faster`, healPct: (v) => `+${v}% healing power` };
export const describeBonus = (b) => Object.entries(b).map(([k, v]) => BONUS_TEXT[k](v)).join(', ');
export function setInfo(hs) {
  const set = ARMOR_SETS[hs.cls], t = CLASSES[hs.cls].armor;
  const pieces = ARMOR_SLOTS.filter((sl) => hs.gear[sl] && hs.gear[sl].armor === t).length;
  const active = {}; if (pieces >= 2) Object.assign(active, set.two); if (pieces >= 3) for (const [k, v] of Object.entries(set.three)) active[k] = (active[k] || 0) + v;
  return { set, pieces, active, twoText: describeBonus(set.two), threeText: describeBonus(set.three) };
}
export function heroEffects(hs) {
  const a = setInfo(hs).active;
  return { dmgTaken: (a.dmgTaken || 0) / 100, lifesteal: (a.lifesteal || 0) / 100, cdr: (a.cdr || 0) / 100, healPct: (a.healPct || 0) / 100 };
}
export const canWear = (hs, it) => !it.armor || it.armor === CLASSES[hs.cls].armor;
export const STAT_LABEL = { hp: 'Health', atk: 'Attack', def: 'Defense', crit: 'Crit %', haste: 'Speed %' };
export const WEAPON_FOR = { sword: 'sword', staff: 'staff', bow: 'bow', axe: 'axe', daggers: 'daggers' };

export function makeItem(save, ilvl, tier, minRar = 0, slot = null, weaponKind = null, armorType = null) {
  const w = RARITY_WEIGHTS[Math.min(tier, RARITY_WEIGHTS.length - 1)];
  let r = Math.random() * w.reduce((a, b) => a + b), rar = 0;
  while (rar < w.length - 1 && r > w[rar]) { r -= w[rar]; rar++; }
  rar = Math.max(rar, minRar);
  slot = slot || pick(SLOTS);
  const isArmor = ARMOR_SLOTS.includes(slot), armor = isArmor ? (armorType || pick(['heavy', 'medium', 'light'])) : null;
  const kind = slot === 'weapon' ? (weaponKind || pick(['sword', 'staff', 'bow', 'axe', 'daggers'])) : isArmor ? ARMOR_TYPES[armor].icon + '_' + slot : slot;
  const R = RARITIES[rar], scale = (4 + ilvl * 1.4) * R.mult;
  const stats = {};
  const main = isArmor ? ARMOR_MAIN[armor][slot] : SLOT_INFO[slot].main;
  for (const k in main) stats[k] = main[k] * scale * rnd(0.9, 1.1);
  const pool = AFFIXES.slice().sort(() => Math.random() - 0.5), words = [];
  for (let i = 0; i < R.affixes; i++) { const a = pool[i % pool.length]; stats[a.stat] = (stats[a.stat] || 0) + a.per * scale * rnd(0.6, 1.0); if (i === 0) words.push(a.word); }
  const base = isArmor ? pick(ARMOR_BASE_NAMES[armor][slot]) : pick(BASE_NAMES[kind]);
  const name = pick(PREFIXES[rar]) + ' ' + base + (words[0] ? ' ' + words[0] : '');
  return { id: save.nextId++, slot, kind, armor, rar, ilvl, name, stats, up: 0 };
}
export const itemStat = (it, k) => it.stats[k] * (1 + 0.1 * (it.up || 0));
export const upCost = (it) => Math.round(18 * it.ilvl * Math.pow(1.45, it.up || 0));
export const salvageValue = (it) => Math.round((4 + it.ilvl * 3) * (1 + it.rar * 1.2) * (1 + 0.3 * (it.up || 0)));
export function itemScore(it) {
  if (!it) return 0; let s = 0; const w = { hp: 0.12, atk: 1.6, def: 0.9, crit: 2.2, haste: 2.0 };
  for (const k in it.stats) s += itemStat(it, k) * w[k]; return s;
}

// ---------- heroes ----------
// ---------- stat points (David 10-18): 3 points per level, the player chooses where they go ----------
export const POINTS_PER_LEVEL = 3;
export const STAT_PER_POINT = { hp: 14, atk: 1.6, def: 1.2, crit: 0.5, haste: 0.6 };
export const STAT_POINT_LABEL = { hp: 'Vitality', atk: 'Strength', def: 'Defense', crit: 'Precision', haste: 'Agility' };
export const STAT_POINT_NOTE = { hp: '+14 health', atk: '+1.6 attack', def: '+1.2 defense', crit: '+0.5% crit', haste: '+0.6% speed' };
export const pointsSpent = (hs) => Object.values(hs.pts || {}).reduce((a, b) => a + b, 0);
export const pointsUnspent = (hs) => (hs.level - 1) * POINTS_PER_LEVEL - pointsSpent(hs);
export const resetCost = (hs) => 50 * hs.level;
export const XP_NEED = (lv) => Math.round(80 * Math.pow(lv, 1.5));
export function heroStats(hs) {
  const c = CLASSES[hs.cls], L = hs.level - 1;
  const st = { hp: c.base.hp + c.grow.hp * L, atk: c.base.atk + c.grow.atk * L, def: c.base.def + c.grow.def * L, crit: c.base.crit, haste: c.base.haste };
  const pt = hs.pts || {}; for (const k in STAT_PER_POINT) st[k] += (pt[k] || 0) * STAT_PER_POINT[k];
  for (const slot of SLOTS) { const it = hs.gear[slot]; if (it) for (const k in it.stats) st[k] += itemStat(it, k); }
  const bo = setInfo(hs).active;
  st.hp *= 1 + (bo.hpPct || 0) / 100; st.atk *= 1 + (bo.atkPct || 0) / 100; st.def *= 1 + (bo.defPct || 0) / 100; st.crit += bo.crit || 0; st.haste += bo.haste || 0;
  st.hp = Math.round(st.hp); st.atk = Math.round(st.atk); st.def = Math.round(st.def);
  st.crit = Math.min(75, Math.round(st.crit * 10) / 10); st.haste = Math.min(100, Math.round(st.haste * 10) / 10);
  return st;
}
export const heroPower = (hs) => { const s = heroStats(hs); return Math.round(s.hp * 0.08 + s.atk * 4 + s.def * 2.5 + s.crit * 2 + s.haste * 2); };
export function skillUsable(hs, id) { return hs.level >= SKILLS[id].lv; }
// slots 0-1 must be the hero's own class; slots 2-3 can be any skill
export function skillAllowed(hs, slot, id) { return slot >= 2 || SKILLS[id].cls === hs.cls; }

// ---------- dungeon tiers ----------
export const TIERS = [{ name: 'Normal', lvl: 1, req: 1 }, { name: 'Veteran', lvl: 5, req: 5 }, { name: 'Heroic', lvl: 10, req: 10 }, { name: 'Nightmare', lvl: 20, req: 20 }];

// ---------- save ----------
const KEY = 'hollowmere_party_v1';
export function newHero(save, cls, gender) {
  const C = CLASSES[cls];
  const hs = { id: cls, cls, gender, name: DEFAULT_NAMES[cls][gender === 'male' ? 0 : 1], level: 1, xp: 0, pts: { hp: 0, atk: 0, def: 0, crit: 0, haste: 0 }, gear: {}, skills: [C.own[0], C.own[1], C.own[2], null] };
  const w = makeItem(save, 1, 0, 0, 'weapon', C.weapon); w.rar = 0; w.name = 'Old ' + BASE_NAMES[C.weapon][0];
  hs.gear.weapon = w; return hs;
}
export function newSave() {
  const s = { v: 1, gold: 0, gems: 0, bag: [], nextId: 1, lastSeen: Date.now(), maxTier: 0, cleared: [], runs: 0, heroes: [], party: ['knight', 'healer', 'mage', 'ranger'] };
  const genders = { knight: 'female', mage: 'female', healer: 'female', ranger: 'male', warrior: 'male', rogue: 'female' };
  for (const c in CLASSES) s.heroes.push(newHero(s, c, genders[c]));
  return s;
}
function fixItem(it) {
  if (ARMOR_SLOTS.includes(it.slot) && !it.armor) { it.armor = pick(['heavy', 'medium', 'light']); it.kind = ARMOR_TYPES[it.armor].icon + '_' + it.slot; }
  return it;
}
export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (!s || s.v !== 1) return null;
    s.bag.forEach(fixItem);
    for (const hs of s.heroes) if (!hs.pts) hs.pts = { hp: 0, atk: 0, def: 0, crit: 0, haste: 0 };
    for (const hs of s.heroes) for (const slot of SLOTS) { const it = hs.gear[slot]; if (!it) continue; fixItem(it); if (!canWear(hs, it)) { delete hs.gear[slot]; s.bag.push(it); } }
    return s;
  } catch (e) { }
  return null;
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { } }
export const partyHeroes = (s) => s.party.map((id) => s.heroes.find((h) => h.id === id)).filter(Boolean);
export const avgPartyLevel = (s) => Math.round(partyHeroes(s).reduce((a, h) => a + h.level, 0) / Math.max(1, s.party.length));

// ---------- idle rewards ----------
export const IDLE_CAP_MIN = 12 * 60;
export function idlePreview(s) {
  const mins = clamp((Date.now() - s.lastSeen) / 60000, 0, IDLE_CAP_MIN);
  const lvl = avgPartyLevel(s), tier = s.maxTier;
  const goldPerMin = (4 + lvl * 1.5) * (1 + tier * 0.7);
  return { mins, gold: Math.floor(mins * goldPerMin), gear: Math.floor(mins / 25) };
}
export function claimIdle(s) {
  const p = idlePreview(s), items = [];
  for (let i = 0; i < Math.min(p.gear, 12); i++) items.push(makeItem(s, Math.max(1, avgPartyLevel(s)), Math.min(s.maxTier, 1), 0));
  s.gold += p.gold; s.lastSeen = Date.now();
  for (const it of items) if (s.bag.length < 60) s.bag.push(it); else s.gold += salvageValue(it);
  return { ...p, items };
}
