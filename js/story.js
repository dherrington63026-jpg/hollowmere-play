// Chapter 1 story: quest state, quest tracker text and the village dialogue.
export const MEAT_NEED = 5;

// who can be recruited, and what they ask for. Only the first recruit asks about her father; the others want something done first.
const POOL = {
  healer: { name: 'Elowen', gender: 'female', title: 'Villager', job: "I'm a healer. I can't fight alone, but I can keep you on your feet." },
  knight: { name: 'Brienne', gender: 'female', title: 'Gate Guard', job: "I'm a knight. I can hold the line while you work.",
    ask: ["I swore to guard Frostmoor's gate. But the brutes that crawl out of the crypt keep the road unsafe, and I will not leave my post while they walk.", "Strike down three Skeleton Brutes in the crypt, and I will gladly follow you."],
    obj: { type: 'kill', what: 'warrior', need: 3, label: 'Skeleton Brutes', where: 'crypt' }, active: 'Three Skeleton Brutes. They are the big ones with the axes. Hollowmere Crypt, north road.', done: 'The brutes are down? Then my oath is kept. My shield is yours.' },
  ranger: { name: 'Garrick', gender: 'male', title: 'Hunter', job: 'I never miss what I aim at.',
    ask: ["Easy there, stranger. Name's Garrick. I track game for the village, but the winter wolves have grown bold. A whole pack hunts the trail now.", 'Help me thin them out. Bring down eight wolves and I will fight at your side.'],
    obj: { type: 'kill', what: 'wolf', need: 8, label: 'wolves', where: 'trail' }, active: 'The pack still hunts. Leave by the south gate and fell eight wolves.', done: "Eight wolves! You hunt as well as anyone I've met. My crossbow is yours." },
  warrior: { name: 'Torin', gender: 'male', title: 'Drifter', job: 'My axe does the talking.',
    ask: ['You there! Do you fight? Raiders on the trail took my axe and my pride, and I am too ill-armed to take them back.', 'Cut down five of those raiders and I will swear my axe to you.'],
    obj: { type: 'kill', what: 'bandit', need: 5, label: 'Trail Raiders', where: 'trail' }, active: 'The raiders are out on the trail. Take the south gate and put five of them down.', done: 'Five raiders, and my axe back in my hands! I am with you, friend.' },
  rogue: { name: 'Sera', gender: 'female', title: 'Stranger', job: 'Quick hands, quicker knives.',
    ask: ["Don't look at me like that. I used to run with a crew... and now the cutthroats in the crypt below wear our old cloaks.", 'Take down four of those Skeleton Cutthroats and I will consider walking beside you.'],
    obj: { type: 'kill', what: 'rogue', need: 4, label: 'Skeleton Cutthroats', where: 'crypt' }, active: 'Four Skeleton Cutthroats, down in Hollowmere Crypt. Watch the corridors.', done: 'Four cutthroats. Maybe you are not so slow after all. Count me in.' },
  mage: { name: 'Maren', gender: 'female', title: 'Scholar', job: 'Fire and frost answer to me.',
    ask: ['The bone casters in the crypt hold shards of old ember-magic in their staves. I have been studying them for months and have never dared go near.', 'Defeat four Bone Casters and bring me what is left. In return, my magic is yours.'],
    obj: { type: 'kill', what: 'mage', need: 4, label: 'Bone Casters', where: 'crypt' }, active: 'Four Bone Casters. They keep their distance and throw green bolts, so close in fast.', done: 'Four casters, and their shards are humming. Wonderful! Let us go.' },
};
export const recruitOrder = (pcls) => (pcls === 'healer' ? ['knight', 'ranger', 'warrior', 'rogue', 'mage'] : ['healer', 'ranger', 'warrior', 'rogue', 'mage', 'knight'].filter((c) => c !== pcls));
export const firstName = (cls) => (cls === 'knight' ? 'Edda' : POOL[cls].name);
export const recruitInfo = (cls, first) => ({ name: first ? firstName(cls) : POOL[cls].name, gender: POOL[cls].gender, title: POOL[cls].title });
export const NPC_INFO = { vendor: { name: 'Bram', title: 'Cook' } };

export function newStory(playerCls) {
  const order = recruitOrder(playerCls);
  const rq = {}; for (const c of order.slice(1)) rq[c] = { st: 'none', n: 0 };
  return { stage: 'trail', meat: 0, q: { meat: 'none', father: 'none' }, order, rq, recruit: { cls: order[0], name: firstName(order[0]) } };
}
// older test saves: fill in the newer fields
export function fixStory(S, pcls) { if (!S.order) { const n = newStory(pcls); S.order = n.order; S.rq = n.rq; S.recruit = S.recruit || n.recruit; } return S; }

const joined = (S, i) => (i === 0 ? S.q.father !== 'none' : S.rq[S.order[i]].st === 'done');
export function availableRecruits(S) { // which recruits stand in the village right now (index in S.order)
  const out = [];
  S.order.forEach((c, i) => {
    if (joined(S, i)) return;
    if (i === 0 ? S.q.meat === 'done' : (S.q.father === 'done' && joined(S, i - 1))) out.push(i);
  });
  return out;
}
export function huntWanted(S) { // is there a reason to go back out on the trail?
  if (S.q.meat === 'active' && S.meat < MEAT_NEED) return true;
  return S.order.some((c, i) => i > 0 && S.rq[c].st === 'active' && POOL[c].obj.where === 'trail');
}
// called when something dies: advance any kill quests; returns a message when one becomes ready
export function storyKill(S, type) {
  let msg = null;
  S.order.forEach((c, i) => { if (i === 0) return; const q = S.rq[c], o = POOL[c].obj; if (q.st === 'active' && o.what === type) { q.n++; if (q.n >= o.need) { q.st = 'ready'; msg = `${POOL[c].name}'s quest is done! Return to Frostmoor.`; } else msg = `${POOL[c].name}'s quest: ${q.n}/${o.need} ${o.label}`; } });
  return msg;
}

export function questLine(S, where) {
  if (!S) return '';
  const q = S.q;
  if (q.meat === 'none') return where === 'town' ? 'Talk to the cook' : 'Find shelter: reach the village of Frostmoor';
  if (q.meat === 'active') return S.meat >= MEAT_NEED ? 'Bring the wolf meat to Bram the cook' : `Hunt wolves for Bram: wolf meat ${S.meat}/${MEAT_NEED}`;
  if (q.father === 'none') return `Talk to ${S.recruit.name} in the village`;
  if (q.father === 'active') return `Find ${S.recruit.name}'s father in Hollowmere Crypt (north road)`;
  for (let i = 1; i < S.order.length; i++) {
    const c = S.order[i], r = S.rq[c], P = POOL[c], o = P.obj;
    if (r.st === 'none') return `Talk to ${P.name} in Frostmoor`;
    if (r.st === 'active') return `${P.name}: defeat ${o.need} ${o.label} (${r.n}/${o.need}), ${o.where === 'crypt' ? 'in the crypt' : 'on the trail'}`;
    if (r.st === 'ready') return `Return to ${P.name} in Frostmoor`;
  }
  return 'Chapter 1 complete. Keep delving, and grow your party!';
}
// what the current quest line points at: an npc, a gate ('north' = village gate / crypt road, 'south' = hunting trail)
export function questGoal(S, where) {
  const q = S.q;
  if (q.meat === 'none') return where === 'town' ? { npc: 'vendor' } : { gate: 'north' };
  if (q.meat === 'active') return S.meat >= MEAT_NEED ? { npc: 'vendor' } : { gate: 'south' };
  if (q.father === 'none') return { npc: S.order[0] };
  if (q.father === 'active') return { gate: 'north' };
  for (let i = 1; i < S.order.length; i++) {
    const c = S.order[i], r = S.rq[c];
    if (r.st === 'none' || r.st === 'ready') return { npc: c };
    if (r.st === 'active') return { gate: POOL[c].obj.where === 'crypt' ? 'north' : 'south' };
  }
  return null;
}
export function markerFor(npc, S) { // '!' = new quest, '?' = hand in
  if (npc === 'vendor') return S.q.meat === 'none' ? '!' : (S.q.meat === 'active' && S.meat >= MEAT_NEED) ? '?' : null;
  const i = S.order.indexOf(npc); if (i < 0) return null;
  if (i === 0) return S.q.father === 'none' && S.q.meat === 'done' ? '!' : null;
  const r = S.rq[npc]; return r.st === 'none' ? '!' : r.st === 'ready' ? '?' : null;
}

export function dialogFor(npc, S, hero) {
  const q = S.q, close = { label: 'Close', act: 'close' };
  if (npc === 'vendor') {
    if (q.meat === 'none') return { lines: ['Hello, stranger! You look half-frozen, and hungry too, if that grumble was yours.', 'I have a pot on the fire, but the wolves raided my meat store. I need meat. Can you help me?'],
      buttons: [{ label: "I'll bring you meat", act: 'acceptMeat' }, { label: 'Not right now', act: 'close' }] };
    if (q.meat === 'active' && S.meat < MEAT_NEED) return { lines: [`Back already? I need ${MEAT_NEED} pieces of wolf meat, and you have ${S.meat}. The wolves are thick on the trail south of here.`],
      buttons: [{ label: 'Head back to the trail', act: 'goHunt' }, close] };
    if (q.meat === 'active') return { lines: [`Wolf meat, and plenty of it! Well done, ${hero.name}. Sit down, the stew is on the house.`], buttons: [{ label: 'Hand over the meat', act: 'turnMeat' }] };
    return { lines: [q.father === 'none' ? `Warm at last? Good. ${S.recruit.name} by the well has been asking after someone with a strong arm. Go and talk to ${S.recruit.cls === 'healer' ? 'her' : 'her'}.` : 'Warm and fed? Good. Come by any time. There is always a bowl for a friend.'], buttons: [close] };
  }
  const i = S.order.indexOf(npc), P = POOL[npc];
  if (i === 0) {
    const R = S.recruit;
    if (q.meat !== 'done') return { lines: ["Please, not now... I'm sorry. You look half-dead on your feet. Get something hot from the cook first. Then I have a favor to ask."], buttons: [close] };
    if (q.father === 'none') return { lines: ['Stranger... can you help me find my father? He went down into the old crypt beneath Hollowmere three days ago and has not come back.', `${P.job} Let me come with you.`],
      buttons: [{ label: 'I will help you find him', act: 'acceptFather' }, { label: 'Not yet', act: 'close' }] };
    return { lines: ['The crypt is on the north road, past the village gate. Please, hurry.'], buttons: [close] };
  }
  const r = S.rq[npc], o = P.obj;
  if (r.st === 'none') return { lines: P.ask, buttons: [{ label: 'I will do it', act: 'rqAccept:' + npc }, { label: 'Not yet', act: 'close' }] };
  if (r.st === 'active') return { lines: [`${P.active} (${r.n}/${o.need})`], buttons: [...(o.where === 'trail' ? [{ label: 'Head out to the trail', act: 'goHunt' }] : []), close] };
  return { lines: [P.done, P.job], buttons: [{ label: `Welcome, ${P.name}`, act: 'rqJoin:' + npc }] };
}
