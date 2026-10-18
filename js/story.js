// Chapter 1 story: quest state, quest tracker text and the village dialogue.
export const MEAT_NEED = 5;
export const NPC_INFO = { vendor: { name: 'Bram', title: 'Cook' }, healer: { name: 'Elowen', title: 'Villager' } };

export function newStory(playerCls) {
  const knightInstead = playerCls === 'healer';
  return { stage: 'trail', meat: 0, q: { meat: 'none', father: 'none' }, recruit: knightInstead ? { cls: 'knight', name: 'Edda' } : { cls: 'healer', name: 'Elowen' } };
}

export function questLine(S, where) {
  if (!S) return '';
  const q = S.q;
  if (q.meat === 'none') return where === 'town' ? 'Talk to the cook' : 'Find shelter: reach the village of Frostmoor';
  if (q.meat === 'active') return S.meat >= MEAT_NEED ? 'Bring the wolf meat to Bram the cook' : `Hunt wolves for Bram: wolf meat ${S.meat}/${MEAT_NEED}`;
  if (q.father === 'none') return 'Talk to the woman by the well';
  if (q.father === 'active') return `Take the north road to Hollowmere Crypt and find ${S.recruit.name}'s father`;
  return '';
}

export function dialogFor(npc, S, hero) {
  const q = S.q, close = { label: 'Close', act: 'close' };
  if (npc === 'vendor') {
    if (q.meat === 'none') return { lines: ['Hello, stranger! You look half-frozen, and hungry too, if that grumble was yours.', 'I have a pot on the fire, but the wolves raided my meat store. I need meat. Can you help me?'],
      buttons: [{ label: "I'll bring you meat", act: 'acceptMeat' }, { label: 'Not right now', act: 'close' }] };
    if (q.meat === 'active' && S.meat < MEAT_NEED) return { lines: [`Back already? I need ${MEAT_NEED} pieces of wolf meat, and you have ${S.meat}. The wolves are thick on the trail south of here.`],
      buttons: [{ label: 'Head back to the trail', act: 'goHunt' }, close] };
    if (q.meat === 'active') return { lines: [`Wolf meat, and plenty of it! Well done, ${hero.name}. Sit down, the stew is on the house.`], buttons: [{ label: 'Hand over the meat', act: 'turnMeat' }] };
    return { lines: ["Warm at last? Good. The woman by the well, ${R}, has been asking after someone with a strong arm. Go and talk to her.".replace('${R}', S.recruit.name)], buttons: [close] };
  }
  const R = S.recruit, job = R.cls === 'healer' ? "I'm a healer. I can't fight alone, but I can keep you on your feet." : "I'm a knight. I can hold the line while you work.";
  if (q.meat !== 'done') return { lines: ["Please, not now... I'm sorry. You look half-dead on your feet. Get something hot from the cook first. Then I have a favor to ask."], buttons: [close] };
  if (q.father === 'none') return { lines: [`Stranger... can you help me find my father? He went down into the old crypt beneath Hollowmere three days ago and has not come back.`, `${job} Let me come with you.`],
    buttons: [{ label: 'I will help you find him', act: 'acceptFather' }, { label: 'Not yet', act: 'close' }] };
  return { lines: ['The crypt is on the north road, past the village gate. Please, hurry.'], buttons: [close] };
}
