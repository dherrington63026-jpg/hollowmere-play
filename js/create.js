// Character creation: pick a class, male or female, and a name. Shown when a new story starts.
import { CLASSES } from './data.js';

// the 3D bodies made so far (one per class); the other gender of each class is still to be built
const BODY = { knight: 'female', mage: 'female', healer: 'female', ranger: 'male', warrior: 'male', rogue: 'female' };
const NAMES = { female: ['Isolde', 'Mira', 'Brienne', 'Sera', 'Wynne', 'Lyra', 'Astrid', 'Tamsin'], male: ['Garrick', 'Torin', 'Aldric', 'Bram', 'Kael', 'Roderic', 'Hale', 'Edric'] };
const BLURB = {
  knight: 'Heavy plate, a sword and shield. Hard to knock down.', mage: 'Cloth robes and a staff. Fire and frost from range.', healer: 'Light cloth and a wand. Keeps the party alive.',
  ranger: 'Leather armor and a crossbow. Fast, accurate, deadly at range.', warrior: 'Heavy armor and a two-handed axe. Huge damage up close.', rogue: 'Leather armor and twin daggers. Quick, with big critical hits.',
};

export function showCreate(hub, onBegin) {
  const st = { cls: 'knight', gender: 'female', name: '' };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  st.name = pick(NAMES[st.gender]);
  hub.classList.remove('hidden');
  const render = () => {
    const C = CLASSES[st.cls], avail = BODY[st.cls];
    hub.innerHTML = `<img class="bgimg blur" src="art/bg_crypt3.jpg" alt=""><div class="shade-deep"></div>
    <div class="create"><h1 class="goldtext">Create your hero</h1>
      <div class="cgrid">${Object.keys(CLASSES).map((k) => `<button class="ccard ${k === st.cls ? 'on' : ''}" data-cls="${k}" style="--c:${CLASSES[k].color}"><img src="art/hero_${k}_${BODY[k]}_1.png" alt=""><b>${CLASSES[k].name}</b><small>${CLASSES[k].role}</small></button>`).join('')}</div>
      <div class="cpanel">
        <div class="cinfo"><h2 style="color:${C.color}">${C.name}</h2><p>${BLURB[st.cls]}</p><small>${C.armor === 'heavy' ? 'Heavy' : C.armor === 'medium' ? 'Medium' : 'Light'} armor</small></div>
        <div class="cform">
          <label>Body</label>
          <div class="seg">${['female', 'male'].map((g) => `<button data-g="${g}" class="${st.gender === g ? 'on' : ''}" ${g === avail ? '' : 'disabled'}>${g === 'female' ? 'Female' : 'Male'}</button>`).join('')}</div>
          <small class="cnote">The ${avail === 'female' ? 'male' : 'female'} ${C.name} 3D model is still being made, so only the ${avail} version can be chosen for now.</small>
          <label>Name</label>
          <div class="nrow"><input id="cname" maxlength="14" value="${st.name}" autocomplete="off"><button class="btn btn-steel btn-sm" data-dice="1"><span>Random</span></button></div>
          <button class="btn btn-gold btn-xl" data-begin="1"><span>Begin the journey</span></button>
        </div></div></div>`;
    const inp = hub.querySelector('#cname'); inp.oninput = () => { st.name = inp.value; };
  };
  hub.onclick = (e) => {
    const b = e.target.closest('[data-cls],[data-g],[data-dice],[data-begin]'); if (!b || !hub.querySelector('.create')) return;
    if (b.dataset.cls) { st.cls = b.dataset.cls; st.gender = BODY[st.cls]; st.name = pick(NAMES[st.gender]); render(); }
    else if (b.dataset.g) { st.gender = b.dataset.g; render(); }
    else if (b.dataset.dice) { st.name = pick(NAMES[st.gender]); render(); }
    else if (b.dataset.begin) { const name = (st.name || '').trim() || pick(NAMES[st.gender]); hub.onclick = null; hub.classList.add('hidden'); hub.innerHTML = ''; onBegin({ cls: st.cls, gender: BODY[st.cls], name }); }
  };
  render();
}
