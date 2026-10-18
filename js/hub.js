// Camp / hub screens: Camp (dungeons + idle rewards), Party, Skills (4 slots), Gear (6 colours).
import { CLASSES, SKILLS, RARITIES, SLOTS, SLOT_INFO, STAT_LABEL, TIERS, heroStats, heroPower, itemStat, itemScore, upCost, salvageValue, skillUsable, skillAllowed,
  partyHeroes, avgPartyLevel, idlePreview, claimIdle, XP_NEED, IDLE_CAP_MIN, ARMOR_TYPES, canWear, setInfo, itemScoreFor, autoEquip,
  STAT_KEYS, STAT_POINT_LABEL, statNote, statApplies, EMPTY_PTS, pointsUnspent, pointsSpent, resetCost } from './data.js';

import { showCreate } from './create.js';

const $ = (s) => document.querySelector(s);
const hub = $('#hub');
const ui = { tab: 'camp', hero: null, slot: 0, item: null, msg: '', inGame: false };
let SAVE = null;
const fmtStat = (k, v) => (k === 'crit' || k === 'haste') ? (Math.round(v * 10) / 10) + '%' : Math.round(v);
const portrait = (hs) => `art/hero_${hs.cls}_${hs.gender}_1.png`;
const hero = () => SAVE.heroes.find((h) => h.id === ui.hero) || SAVE.heroes[0];
const save = () => window.HOL.persist();
const fmtTime = (m) => { m = Math.floor(m); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };

function frame(inner, cls = '') { return `<div class="frame ${cls}">${inner}<i class="cn tl"></i><i class="cn tr"></i><i class="cn bl"></i><i class="cn br"></i></div>`; }
function tabs() {
  const open = SAVE.heroes.reduce((a, h) => a + pointsUnspent(h), 0);
  const T = [...(ui.inGame ? [] : [['camp', 'Camp']]), ['party', 'Party'], ['stats', 'Stats' + (open ? ` <i class="ptbadge">${open}</i>` : '')], ['skills', 'Skills'], ['gear', 'Gear']];
  return `<div class="hub-top"><div class="hub-title goldtext">Hollowmere</div><div class="hub-tabs">${T.map(([k, n]) => `<button class="htab ${ui.tab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>
    <div class="hub-gold">${ui.inGame ? '<button class="btn btn-gold btn-sm" data-back="1"><span>Back to game</span></button>' : ''}<span class="goldpill"><img src="art/icon_gold.png" alt="">${SAVE.gold.toLocaleString()}</span></div></div>`;
}
function heroPicker() {
  return `<div class="hpick">${SAVE.heroes.map((h) => `<button class="hp-btn ${h.id === hero().id ? 'on' : ''}" data-hero="${h.id}" style="--c:${CLASSES[h.cls].color}"><img src="${portrait(h)}" alt=""><span>${CLASSES[h.cls].name}</span><em>Lv ${h.level}</em>${pointsUnspent(h) ? `<i class="ptbadge pb">${pointsUnspent(h)}</i>` : ''}</button>`).join('')}</div>`;
}

// ---------- STATS ----------
function statsView() {
  const h = hero(), C = CLASSES[h.cls], st = heroStats(h), un = pointsUnspent(h);
  const tile = (l, v) => `<div class="stat"><small>${l}</small><b>${v}</b></div>`;
  const rows = STAT_KEYS.map((k) => { const ok = statApplies(h.cls, k);
    return `<div class="strow ${ok ? '' : 'off'}"><div class="stname"><b>${STAT_POINT_LABEL[k]}</b><small>${statNote(h.cls, k)}</small></div>
    <div class="stpts"><small>Points</small><b>${(h.pts && h.pts[k]) || 0}</b></div>
    <div class="stbtns"><button class="mini big" data-pt="${k}" ${un > 0 && ok ? '' : 'disabled'}>+1</button><button class="mini big" data-pt5="${k}" ${un > 0 && ok ? '' : 'disabled'}>+5</button></div></div>`; }).join('');
  const spent = pointsSpent(h);
  return `<div class="stack">${heroPicker()}${frame(`<h2 class="ftitle">${h.name} <small>Lv ${h.level} ${C.name}</small></h2>
    <div class="ptbig"><span>Stat points to spend</span><b>${un}</b></div><p class="hint">You earn 3 points every level and choose where they go. Some stats only help certain classes.</p>
    <div class="statrow six">${tile('Health', fmtStat('hp', st.hp))}${tile('Attack', fmtStat('atk', st.atk))}${tile('Defense', fmtStat('def', st.def))}${tile('Crit %', fmtStat('crit', st.crit))}${tile('Mana', st.mana)}${tile('Healing', '+' + Math.round(st.healPct) + '%')}</div>${rows}
    <div class="row"><button class="btn btn-steel" data-resetpts="1" ${spent > 0 && SAVE.gold >= resetCost(h) ? '' : 'disabled'}><span>Reset points · ${resetCost(h)}g</span></button></div>`)}</div>`;
}

// ---------- CAMP ----------
function campView() {
  const party = partyHeroes(SAVE), idle = idlePreview(SAVE);
  const lvl = avgPartyLevel(SAVE);
  const cards = party.map((h, i) => { const C = CLASSES[h.cls]; return `<div class="pc" style="--c:${C.color}"><img src="${portrait(h)}" alt=""><div class="pc-l"><b>${h.name}</b><small>${C.name}${i === 0 ? ' · Lead' : ''}</small><em>Lv ${h.level} · Power ${heroPower(h)}</em>${pointsUnspent(h) ? `<em class="ptnote">${pointsUnspent(h)} stat points to spend</em>` : ''}</div></div>`; }).join('');
  const tiers = TIERS.map((t, i) => {
    const lock = lvl < t.req || i > SAVE.maxTier;
    return `<button class="tier ${lock ? 'lock' : ''}" ${lock ? 'disabled' : ''} data-run="${i}" style="--tc:${['#e9d9b0', '#7fc8ff', '#c78bff', '#ff6a4a'][i]};--bg:url(../art/bg_crypt3.jpg)">
      <b>${t.name}</b><small>${lock ? (i > SAVE.maxTier ? 'Clear the previous tier first' : 'Party level ' + t.req + ' needed') : 'Enemy level ' + t.lvl + (SAVE.cleared.includes(i) ? ' · Cleared' : '')}</small><span class="skulls">${'☠'.repeat(i + 1)}</span></button>`;
  }).join('');
  const full = idle.mins >= IDLE_CAP_MIN;
  return `<div class="camp-grid">
    ${frame(`<h2 class="ftitle">Your party <small>average level ${lvl}</small></h2><div class="pcs">${cards}</div>
      <div class="row">${SAVE.story ? '<button class="btn btn-gold" data-village="1"><span>Visit Frostmoor</span></button>' : ''}<button class="btn btn-steel" data-tab="party"><span>Change party</span></button><button class="btn btn-steel" data-tab="skills"><span>Skills</span></button><button class="btn btn-steel" data-tab="gear"><span>Gear</span></button></div>`, 'camp-party')}
    <div class="camp-right">
      ${frame(`<h2 class="ftitle">Idle rewards</h2><p>Your party keeps hunting while you are away (up to 12 hours).</p>
        <div class="idle-row"><div class="rstat"><small>Away</small><b>${fmtTime(idle.mins)}</b></div><div class="rstat"><small>Gold</small><b>${idle.gold.toLocaleString()}</b></div><div class="rstat"><small>Gear</small><b>${idle.gear}</b></div></div>
        <div class="row"><button class="btn btn-gold grow" data-claim="1" ${idle.gold + idle.gear > 0 ? '' : 'disabled'}><span>${full ? 'Bag is full - collect' : 'Collect rewards'}</span></button></div>`)}
      ${frame(`<h2 class="ftitle">Hollowmere Crypt</h2><p>The Bone Warden waits below. Run it as often as you like for gear.</p><div class="tiers">${tiers}</div>`)}
    </div></div>`;
}

// ---------- PARTY ----------
function partyView() {
  const inParty = SAVE.party;
  const slots = [0, 1, 2, 3].map((i) => { const h = SAVE.heroes.find((x) => x.id === inParty[i]); const C = h && CLASSES[h.cls];
    return h ? `<div class="pslot" style="--c:${C.color}"><img src="${portrait(h)}" alt=""><b>${h.name}</b><small>${C.name} · Lv ${h.level}${i === 0 ? ' · LEAD' : ''}</small><div class="row2">${i > 0 ? `<button class="mini" data-lead="${h.id}">Make lead</button>` : ''}<button class="mini" data-bench="${h.id}">Remove</button></div></div>`
      : `<div class="pslot empty-p"><span>Empty slot</span></div>`; }).join('');
  const bench = SAVE.heroes.filter((h) => !inParty.includes(h.id)).map((h) => { const C = CLASSES[h.cls];
    return `<div class="bcard" style="--c:${C.color}"><img src="${portrait(h)}" alt=""><b>${h.name}</b><small>${C.name} · ${C.role}</small><em>${ARMOR_TYPES[C.armor].label} armor · Lv ${h.level} · Power ${heroPower(h)}</em><p>${C.blurb}</p><button class="btn btn-steel btn-sm" data-join="${h.id}" ${inParty.length >= 4 ? 'disabled' : ''}><span>Add to party</span></button></div>`; }).join('') || '<p class="empty">Everyone is in the party.</p>';
  return `<div class="stack">${frame(`<h2 class="ftitle">Party <small>up to 4 heroes fight together</small></h2><div class="pslots">${slots}</div>`)}
    ${frame(`<h2 class="ftitle">Roster <small>recruited heroes (in the full game you recruit them in towns through the story)</small></h2><div class="bench">${bench}</div>`)}</div>`;
}

// ---------- SKILLS ----------
function skillsView() {
  const h = hero(), C = CLASSES[h.cls];
  const slots = [0, 1, 2, 3].map((i) => { const id = h.skills[i], S = id && SKILLS[id], usable = S && skillUsable(h, id);
    return `<button class="sslot ${ui.slot === i ? 'on' : ''} ${S && !usable ? 'locked' : ''}" data-slot="${i}" style="--c:${C.color}">
      <span class="sicon" ${S ? `style="background-image:url(art/skill_${S.icon}.jpg)"` : ''}>${S ? '' : '+'}</span><b>${S ? S.name : 'Empty'}</b><small>${i < 2 ? 'Class slot' : 'Any skill'}${S && !usable ? ' · locked' : ''}</small></button>`; }).join('');
  const sel = ui.slot, hint = sel < 2 ? `Slot ${sel + 1} takes a <b>${C.name}</b> skill.` : `Slot ${sel + 1} takes <b>any</b> skill you have unlocked.`;
  const grid = Object.entries(SKILLS).map(([id, S]) => {
    const own = S.cls === h.cls, ok = skillAllowed(h, sel, id), usable = skillUsable(h, id), used = h.skills.includes(id);
    return `<button class="sk-card ${ok && usable ? '' : 'dis'} ${used ? 'used' : ''}" data-assign="${id}" style="--c:${CLASSES[S.cls].color}"><span class="sicon sm" style="background-image:url(art/skill_${S.icon}.jpg)"></span>
      <div><b>${S.name}</b><small>${CLASSES[S.cls].name} · Lv ${S.lv} · ${S.cd}s</small><p>${S.desc}</p></div>${used ? '<em>In use</em>' : ''}${!usable ? '<em class="lk">Needs Lv ' + S.lv + '</em>' : (!ok ? '<em class="lk">Class slot only</em>' : '')}</button>`;
  }).join('');
  return `<div class="stack">${heroPicker()}${frame(`<h2 class="ftitle">${h.name} <small>Lv ${h.level} ${C.name}</small></h2><div class="sslots">${slots}</div><p class="hint">${hint} Tap a skill below to put it in slot ${sel + 1}.</p>`)}
    ${frame(`<h2 class="ftitle">Skills</h2><div class="skgrid">${grid}</div>`)}</div>`;
}

// ---------- GEAR ----------
const BADGE = { heavy: 'H', medium: 'M', light: 'L' };
const slotBtn = (it, label, sel) => it ? `<button class="slot r${it.rar} ${sel ? 'sel' : ''} ${!canWear(hero(), it) ? 'nowear' : ''}" data-item="${it.id}" style="--r:${RARITIES[it.rar].color}"><img src="art/icon_${it.kind}.png" alt="">${it.up ? `<em>+${it.up}</em>` : ''}${it.armor ? `<b class="atype">${BADGE[it.armor]}</b>` : ''}</button>` : `<button class="slot empty-slot"><span>${label}</span></button>`;
function gearView() {
  const h = hero(), st = heroStats(h), C = CLASSES[h.cls];
  const bag = SAVE.bag.slice().sort((a, b) => b.rar - a.rar || b.ilvl - a.ilvl);
  const selId = ui.item;
  const left = ['helm', 'armor', 'boots'].map((s) => slotBtn(h.gear[s], SLOT_INFO[s].label, selId === (h.gear[s] && h.gear[s].id))).join('');
  const right = ['weapon', 'ring', 'amulet'].map((s) => slotBtn(h.gear[s], SLOT_INFO[s].label, selId === (h.gear[s] && h.gear[s].id))).join('');
  const bagHtml = bag.map((it) => { const better = canWear(h, it) && itemScoreFor(h.cls, it) > itemScoreFor(h.cls, h.gear[it.slot]); return slotBtn(it, '', selId === it.id).replace('</button>', better ? '<i class="up">▲</i></button>' : '</button>'); }).join('') || '<p class="empty">Your bag is empty. Gear drops in the crypt.</p>';
  const AT = ARMOR_TYPES[C.armor];
  return `<div class="gear-grid2">${frame(`<h2 class="ftitle">${h.name} <small>Lv ${h.level} ${C.name}</small></h2><div class="armornote"><b>${AT.label} armor · ${AT.name}</b> <span>${AT.blurb}</span></div>${setPanel(h)}
      <div class="doll2"><div class="dcol">${left}</div><div class="dhero"><img src="${portrait(h)}" alt=""></div><div class="dcol">${right}</div></div>
      <div class="statrow">${['hp', 'atk', 'def', 'crit', 'haste'].map((k) => `<div class="stat"><small>${STAT_LABEL[k]}</small><b>${fmtStat(k, st[k])}</b></div>`).join('')}</div>`)}
    ${frame(`<div class="baghead"><h2 class="ftitle">Bag <small>${SAVE.bag.length} / 60</small></h2><div class="bagbtns"><button class="btn btn-gold btn-sm" data-autoequip="1"><span>Auto equip ${h.name}</span></button><button class="btn btn-gold btn-sm" data-autoequipall="1"><span>Auto equip party</span></button><button class="btn btn-steel btn-sm" data-sellrar="0"><span>Sell all white</span></button><button class="btn btn-steel btn-sm" data-sellrar="1"><span>Sell all green</span></button><button class="btn btn-steel btn-sm" data-sellrar="2"><span>Sell all blue</span></button></div></div><div class="bag2">${bagHtml}</div>`, 'bagframe')}
    <div class="side2">${heroPickerMini()}${frame(itemDetail(h))}</div></div>`;
}
function setPanel(h) {
  const si = setInfo(h);
  return `<div class="setbox"><div class="setname">${si.set.name} <em>${si.pieces} / 3 pieces</em></div>
    <div class="setrow ${si.pieces >= 2 ? 'on' : ''}"><b>2 pieces</b> ${si.twoText}</div><div class="setrow ${si.pieces >= 3 ? 'on' : ''}"><b>3 pieces</b> ${si.threeText}</div></div>`;
}
function heroPickerMini() { return `<div class="hpick mini">${SAVE.heroes.map((h) => `<button class="hp-btn ${h.id === hero().id ? 'on' : ''}" data-hero="${h.id}" style="--c:${CLASSES[h.cls].color}"><img src="${portrait(h)}" alt=""></button>`).join('')}</div>`; }
function findItem(id) {
  for (const hs of SAVE.heroes) for (const s of SLOTS) if (hs.gear[s] && hs.gear[s].id === id) return { it: hs.gear[s], owner: hs };
  const it = SAVE.bag.find((x) => x.id === id); return it ? { it, owner: null } : null;
}
function itemDetail(h) {
  const f = ui.item && findItem(ui.item);
  if (!f) return '<h2 class="ftitle">Item</h2><p class="empty">Tap any item to inspect it. Green arrows mark upgrades for this hero.</p>';
  const it = f.it, R = RARITIES[it.rar], cur = h.gear[it.slot], eq = f.owner === h, cmp = !eq && cur;
  const keys = new Set(Object.keys(it.stats).concat(cmp ? Object.keys(cur.stats) : []));
  const rows = [...keys].map((k) => { const v = it.stats[k] ? itemStat(it, k) : 0, cv = cmp && cur.stats[k] ? itemStat(cur, k) : 0, d = v - cv;
    return `<div class="srow"><span>${STAT_LABEL[k]}</span><b>${v ? fmtStat(k, v) : '-'}</b>${cmp && Math.abs(d) >= 0.05 ? `<em class="${d > 0 ? 'pos' : 'neg'}">${d > 0 ? '+' : ''}${fmtStat(k, d)}</em>` : '<em></em>'}</div>`; }).join('');
  const where = f.owner ? (eq ? 'Worn by ' + h.name : 'Worn by ' + f.owner.name) : 'In bag';
  const wear = canWear(h, it), AT = it.armor && ARMOR_TYPES[it.armor], WP = it.slot === 'weapon' ? CLASSES[h.cls].weapon : null;
  return `<div class="ibig"><img src="art/icon_${it.kind}.png" alt="" style="filter:drop-shadow(0 0 18px ${R.color}) drop-shadow(0 8px 14px #000)"></div>
    <div class="iname" style="color:${R.color}">${it.name}${it.up ? ' +' + it.up : ''}</div><div class="irar">${R.name} ${AT ? AT.name + ' ' : ''}${SLOT_INFO[it.slot].label} · item level ${it.ilvl} · ${where}</div>${AT ? `<div class="wearnote ${wear ? 'ok' : 'no'}">${AT.label} armor · worn by ${AT.who}${wear ? '' : ' (not ' + h.name + ')'}</div>` : ''}${WP ? `<div class="wearnote ${wear ? 'ok' : 'no'}">${it.kind} · ${wear ? 'usable by ' + h.name : h.name + ' uses ' + WP + 's'}</div>` : ''}${rows}
    <div class="row">${eq ? `<button class="btn btn-steel grow" data-unequip="${it.id}"><span>Unequip</span></button>` : `<button class="btn btn-gold grow" data-equip="${it.id}" ${wear ? '' : 'disabled'}><span>${wear ? 'Equip on ' + h.name : 'Wrong armor type'}</span></button>`}
      <button class="btn btn-steel grow" data-upgrade="${it.id}" ${SAVE.gold < upCost(it) || (it.up || 0) >= 15 ? 'disabled' : ''}><span>Upgrade +${(it.up || 0) + 1} · ${upCost(it)}g</span></button>
      ${f.owner ? '' : `<button class="btn btn-steel" data-salvage="${it.id}"><span>Sell for ${salvageValue(it)}g</span></button>`}</div>`;
}

// ---------- actions ----------
function takeFrom(f) { if (f.owner) { for (const s of SLOTS) if (f.owner.gear[s] && f.owner.gear[s].id === f.it.id) delete f.owner.gear[s]; } else { const i = SAVE.bag.findIndex((x) => x.id === f.it.id); if (i >= 0) SAVE.bag.splice(i, 1); } }
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab],[data-hero],[data-slot],[data-assign],[data-item],[data-equip],[data-unequip],[data-upgrade],[data-salvage],[data-sellrar],[data-back],[data-village],[data-join],[data-bench],[data-lead],[data-run],[data-claim],[data-closeidle],[data-pt],[data-pt5],[data-resetpts],[data-autoequip],[data-autoequipall]');
  if (!t || hub.classList.contains('hidden') || !hub.contains(t)) return;
  const d = t.dataset;
  if (d.tab) { ui.tab = d.tab; ui.item = null; }
  else if (d.hero) { ui.hero = d.hero; ui.item = null; }
  else if (d.slot !== undefined) ui.slot = +d.slot;
  else if (d.assign) {
    const h = hero(), id = d.assign;
    if (!skillUsable(h, id) || !skillAllowed(h, ui.slot, id)) return;
    const prev = h.skills.indexOf(id); if (prev >= 0) h.skills[prev] = h.skills[ui.slot]; // swap if already used
    h.skills[ui.slot] = id; save();
  } else if (d.item) ui.item = +d.item;
  else if (d.equip) { const f = findItem(+d.equip), h = hero(); if (f && canWear(h, f.it)) { const old = h.gear[f.it.slot]; takeFrom(f); h.gear[f.it.slot] = f.it; if (old) SAVE.bag.push(old); save(); } }
  else if (d.unequip) { const f = findItem(+d.unequip); if (f && SAVE.bag.length < 60) { takeFrom(f); SAVE.bag.push(f.it); ui.item = f.it.id; save(); } }
  else if (d.upgrade) { const f = findItem(+d.upgrade); if (f && SAVE.gold >= upCost(f.it) && (f.it.up || 0) < 15) { SAVE.gold -= upCost(f.it); f.it.up = (f.it.up || 0) + 1; save(); } }
  else if (d.salvage) { const i = SAVE.bag.findIndex((x) => x.id === +d.salvage); if (i >= 0) { SAVE.gold += salvageValue(SAVE.bag[i]); SAVE.bag.splice(i, 1); ui.item = null; save(); } }
  else if (d.village) { hub.classList.add('hidden'); window.HOL.startStory('town'); return; }
  else if (d.back) { ui.inGame = false; hub.classList.add('hidden'); window.HOL.closeMenu(); return; }
  else if (d.sellrar != null) {
    const r = +d.sellrar; let g = 0, n = 0, kept = 0;
    SAVE.bag = SAVE.bag.filter((it) => {
      if (it.rar !== r) return true;
      // keep anything that would be a real upgrade for a hero who can wear it
      if (SAVE.heroes.some((x) => canWear(x, it) && itemScoreFor(x.cls, it) > itemScoreFor(x.cls, x.gear[it.slot]))) { kept++; return true; }
      g += salvageValue(it); n++; return false;
    });
    SAVE.gold += g; ui.item = null; save();
    ui.msg = n ? `Sold ${n} ${RARITIES[r].name.toLowerCase()} item${n === 1 ? '' : 's'} for ${g} gold.${kept ? ` Kept ${kept} that would upgrade a hero.` : ''}` : kept ? `Kept ${kept} ${RARITIES[r].name.toLowerCase()} item${kept === 1 ? '' : 's'} that would upgrade a hero.` : `No ${RARITIES[r].name.toLowerCase()} gear to sell.`;
  }
  else if (d.salvageweak) { const h = hero(); let g = 0; SAVE.bag = SAVE.bag.filter((it) => { const users = SAVE.heroes.filter((x) => canWear(x, it)); if (it.rar <= 1 && users.every((x) => itemScore(it) <= itemScore(x.gear[it.slot]))) { g += salvageValue(it); return false; } return true; }); SAVE.gold += g; ui.item = null; save(); }
  else if (d.join) { if (SAVE.party.length < 4) { SAVE.party.push(d.join); save(); } }
  else if (d.bench) { if (SAVE.party.length > 1) { SAVE.party = SAVE.party.filter((x) => x !== d.bench); save(); } }
  else if (d.lead) { SAVE.party = [d.lead, ...SAVE.party.filter((x) => x !== d.lead)]; save(); }
  else if (d.pt || d.pt5) { const h = hero(), k = d.pt || d.pt5, n = Math.min(d.pt ? 1 : 5, pointsUnspent(h)); if (n > 0 && statApplies(h.cls, k)) { h.pts[k] = (h.pts[k] || 0) + n; save(); } }
  else if (d.resetpts) { const h = hero(); if (SAVE.gold >= resetCost(h) && pointsSpent(h) > 0) { SAVE.gold -= resetCost(h); h.pts = EMPTY_PTS(); save(); } }
  else if (d.autoequip) { const n = autoEquip(SAVE, hero()); save(); ui.msg = n ? `Equipped ${n} better item${n === 1 ? '' : 's'} on ${hero().name}.` : `${hero().name} already has the best gear from your bag.`; }
  else if (d.autoequipall) { let n = 0; for (const x of partyHeroes(SAVE)) n += autoEquip(SAVE, x); save(); ui.msg = n ? `Equipped ${n} better item${n === 1 ? '' : 's'} across the party.` : 'Your party already has the best gear from your bag.'; }
  else if (d.claim) { const r = claimIdle(SAVE); save(); ui.msg = `Collected ${r.gold.toLocaleString()} gold and ${r.items.length} gear piece${r.items.length === 1 ? '' : 's'}.`; }
  else if (d.run !== undefined) { SAVE.lastSeen = Date.now(); save(); window.HOL.startRun(+d.run); return; }
  render();
});

function render() {
  SAVE = window.HOL.getSave();
  if (!ui.hero) ui.hero = SAVE.party[0];
  const body = ui.tab === 'camp' ? campView() : ui.tab === 'party' ? partyView() : ui.tab === 'stats' ? statsView() : ui.tab === 'skills' ? skillsView() : gearView();
  hub.innerHTML = `<img class="bgimg blur" src="art/bg_crypt3.jpg" alt=""><div class="shade-deep"></div>${tabs()}<div class="hub-body">${body}</div>${ui.msg ? `<div class="hub-msg">${ui.msg}</div>` : ''}`;
  if (ui.msg) { const m = ui.msg; setTimeout(() => { if (ui.msg === m) { ui.msg = ''; const el = hub.querySelector('.hub-msg'); if (el) el.remove(); } }, 3500); }
}
function showHub() { hub.classList.remove('hidden'); ui.inGame = false; ui.tab = 'camp'; render(); }
function showMenu() { hub.classList.remove('hidden'); ui.inGame = true; ui.tab = 'stats'; ui.hero = null; render(); }
window.HOL = window.HOL || {};
function boot() {
  window.HOL.showHub = showHub; window.HOL.showMenu = showMenu;
  const q = new URLSearchParams(location.search); if (q.get('go') || q.get('story')) return;
  SAVE = window.HOL.getSave(); const st = SAVE.story;
  if (!st) { showCreate(hub, (c) => window.HOL.beginStory(c)); return; }
  if (st.stage === 'trail' || st.stage === 'town') { hub.classList.add('hidden'); window.HOL.startStory(st.stage); return; }
  showHub();
}
if (window.HOL && window.HOL.ready) boot(); else { hub.innerHTML = '<div class="hub-loading"><h1 class="goldtext big">Hollowmere</h1><p id="loadMsg">Loading the crypt...</p></div>'; window.addEventListener('hol-ready', boot); }
window.HOL.showHub = showHub; window.HOL.showMenu = showMenu;
