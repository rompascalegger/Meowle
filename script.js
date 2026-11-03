'use strict';

/* Meowle: pick a cat, let the years pass, follow its DNA down the family tree.
 *
 * Genetics model (simplified but real in shape):
 *  - A cat has 18 pairs of autosomes (named like real cat chromosomes A1..F2) plus X/X or X/Y.
 *  - Every chromosome is 12 blocks; each block is either origin DNA ("1") or not ("0").
 *  - A parent makes an egg/sperm by recombining each pair (0-2 crossovers) and passing one copy.
 *  - Mothers pass a recombined X to every kitten and their mitochondria to every kitten.
 *    Fathers pass their single X untouched to daughters and their Y untouched to sons.
 *  - Coat genes ride on the chromosomes: Agouti (tabby) on A3, White spotting on B1,
 *    Dilute on C1, Orange on X. Orange on X is why calicos and torties are almost always female.
 */

const SAVE_KEY = 'meowle-cats-v1';
const MUTE_KEY = 'meowle-mute';
const BLOCKS = 12;
const Y_BLOCKS = 4;
const AUTO = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'D1', 'D2', 'D3', 'D4', 'E1', 'E2', 'E3', 'F1', 'F2'];
const GENE = {
  agouti: { chr: 2, pos: 5 },
  white: { chr: 3, pos: 3 },
  dilute: { chr: 7, pos: 8 },
  orange: { pos: 6 }
};
const CAP = 28; // the yard only feeds so many cats
const EYES = ['#78e05a', '#e8c23a', '#e88a2a', '#b8dc48', '#5aa8f0'];

const NAMES = ('Mochi Biscuit Pumpkin Luna Milo Nala Simba Oreo Pepper Ginger Smokey Shadow Tiger Cleo Kiki Mittens Socks Whiskers ' +
  'Felix Tom Bella Lily Chloe Lucy Zoe Coco Daisy Willow Hazel Olive Maple Clover Pixel Byte Nibbles Toast Waffles Pickles ' +
  'Noodle Dumpling Bao Sushi Tofu Miso Ramen Udon Taro Yuzu Kumo Sora Hana Momo Kiwi Mango Peach Plum Fig Juniper Sage ' +
  'Rosemary Basil Thyme Pesto Nutmeg Cinnamon Clove Saffron Paprika Chili Tabasco Ziggy Bowie Elvis Prince Freddie Ringo ' +
  'Lennon Jagger Dusty Rusty Copper Bronze Amber Jet Onyx Ember Ash Cinder Soot Frost Snow Misty Storm Thunder Rain Drizzle ' +
  'Puddle Pebble Boulder Rocky Gizmo Gadget Sprocket Widget Bolt Turbo Rocket Comet Nova Orbit Cosmo Astro Apollo Zeus Hera ' +
  'Athena Loki Thor Odin Freya Sushi Banjo Fiddle Pippin Merry Frodo Bilbo Tinker Bramble Thistle Moss Fern Acorn Chestnut ' +
  'Hickory Truffle Fudge Toffee Caramel Butter Honey Bean Peanut Cashew Pistachio Marble Domino Patch Button Zipper Velvet').split(' ');
const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

/* ---------- Small helpers ---------- */

const $ = (id) => document.getElementById(id);
const rnd = Math.random;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, reduced() ? Math.min(ms, 60) : ms));
const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v) => (v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v > 0 ? v.toFixed(2) : '0') + '%';
const sexIcon = (s) => (s === 'F' ? '♀' : '♂');

let S = null; // the saved game
let busy = false;
let muted = false;
let lastBorn = new Set();

/* ---------- Genome ---------- */

function chrom(origin, len, genes) {
  return { s: (origin ? '1' : '0').repeat(len), g: genes || {} };
}

function randomAllele(gene) {
  switch (gene) {
    case 'agouti': return chance(0.55) ? 'A' : 'a';
    case 'white': return chance(0.3) ? 'S' : 's';
    case 'dilute': return chance(0.72) ? 'D' : 'd';
    case 'orange': return chance(0.3) ? 'O' : 'o';
  }
}

function makeCat({ sex, origin = false, stray = false, eye }) {
  const auto = AUTO.map((_, i) => [0, 1].map(() => {
    const g = {};
    for (const [name, at] of Object.entries(GENE)) if (at.chr === i) g[at.pos] = randomAllele(name);
    return chrom(origin, BLOCKS, g);
  }));
  const x = () => chrom(origin, BLOCKS, { [GENE.orange.pos]: randomAllele('orange') });
  const sexc = sex === 'F' ? [x(), x()] : [x(), chrom(origin, Y_BLOCKS)];
  return {
    id: S.nextId++,
    name: newName(),
    sex,
    stray,
    born: S ? S.year : 0,
    age: 0,
    alive: true,
    gen: 0,
    auto,
    sexc,
    mt: origin ? 1 : 0,
    eye: eye || (chance(0.08) ? EYES[4] : pick(EYES.slice(0, 4))),
    kids: []
  };
}

// Crossing over: walk along the pair, switching strand at 0-2 random points.
function recombine(a, b) {
  const len = a.s.length;
  const r = rnd();
  const n = r < 0.25 ? 0 : r < 0.85 ? 1 : 2;
  const cuts = new Set();
  for (let i = 0; i < n; i++) cuts.add(1 + Math.floor(rnd() * (len - 1)));
  let from = chance(0.5) ? a : b;
  let s = '';
  const g = {};
  for (let i = 0; i < len; i++) {
    if (cuts.has(i)) from = from === a ? b : a;
    s += from.s[i];
    if (from.g[i] !== undefined) g[i] = from.g[i];
  }
  return { s, g };
}

function gamete(cat, forSon) {
  const auto = cat.auto.map((p) => recombine(p[0], p[1]));
  let sex;
  if (cat.sex === 'F') sex = recombine(cat.sexc[0], cat.sexc[1]);
  else sex = forSon ? cat.sexc[1] : cat.sexc[0]; // dads: Y to sons, their one X to daughters, whole
  return { auto, sex };
}

function breed(mom, dad) {
  const sex = chance(0.5) ? 'F' : 'M';
  const kit = {
    id: S.nextId++,
    name: newName(),
    sex,
    stray: false,
    born: S.year,
    age: 0,
    alive: true,
    gen: Math.max(mom.stray ? -1 : mom.gen, dad.stray ? -1 : dad.gen) + 1,
    mom: mom.id,
    dad: dad.id,
    mt: mom.mt,
    eye: chance(0.06) ? pick(EYES) : pick([mom.eye, dad.eye]),
    kids: []
  };
  const e = gamete(mom, false);
  const s = gamete(dad, sex === 'M');
  kit.auto = e.auto.map((c, i) => [c, s.auto[i]]);
  kit.sexc = [e.sex, s.sex];
  kit.origin = originPct(kit);
  mom.kids.push(kit.id);
  dad.kids.push(kit.id);
  S.cats[kit.id] = kit;
  return kit;
}

function originPct(cat) {
  let on = 0;
  let all = 0;
  const add = (c) => { for (const ch of c.s) { all++; if (ch === '1') on++; } };
  cat.auto.forEach((p) => { add(p[0]); add(p[1]); });
  cat.sexc.forEach(add);
  return (on / all) * 100;
}

function hasOriginY(cat) { return cat.sex === 'M' && cat.sexc[1].s.includes('1'); }

/* ---------- Coat (phenotype) ---------- */

function genes(cat) {
  const a = cat.auto;
  const pair = (name) => a[GENE[name].chr].map((c) => c.g[GENE[name].pos]);
  const os = cat.sexc.map((c) => c.g[GENE.orange.pos]).filter(Boolean);
  return { agouti: pair('agouti'), white: pair('white'), dilute: pair('dilute'), orange: os };
}

function phenotype(cat) {
  const g = genes(cat);
  const tabby = g.agouti.includes('A');
  const white = g.white.filter((x) => x === 'S').length; // 0 none, 1 tuxedo, 2 lots
  const dilute = !g.dilute.includes('D');
  const oCount = g.orange.filter((x) => x === 'O').length;
  const tortie = cat.sex === 'F' && oCount === 1;
  const orange = !tortie && oCount > 0;

  const dark = dilute ? '#7c8496' : '#2c2630';
  const ora = dilute ? '#efc98e' : '#e2883a';
  const base = orange ? ora : dark;

  let name;
  if (tortie) name = white ? (dilute ? 'Dilute calico' : 'Calico') : (dilute ? 'Blue tortie' : 'Tortoiseshell');
  else {
    name = orange ? (dilute ? 'Cream' : 'Ginger') : (dilute ? 'Blue' : 'Black');
    if (tabby || orange) name += ' tabby';
    if (white === 1) name += ' & white';
    if (white === 2) name = (orange || tabby ? name + ' van' : (dilute ? 'Blue' : 'Black') + ' & white');
    if (!orange && !tabby && white === 1) name = (dilute ? 'Blue' : 'Black') + ' tuxedo';
  }
  return { base, dark, ora, tabby: tabby || orange, white, dilute, tortie, name };
}

/* ---------- Pixel sprite ---------- */

// o outline, b body, e eye, n nose, i inner ear, w muzzle/chest, p paw, t tail
const CAT_MAP = [
  '................',
  '..o......o......',
  '.obo....obo.....',
  '.obiooooibo.....',
  'obbbbbbbbbbo....',
  'obbebbbbebbo....',
  'obbebbbbebbo....',
  'obbbwnnwbbbo....',
  'obbwwwwwwbbo....',
  '.obbwwwwbbo.....',
  'obbbbwwbbbbo..o.',
  'obbbbwwbbbbo.oto',
  'obbbbbbbbbbo.oto',
  'obbbbbbbbbbo.oto',
  'obppbbbbppbbttto',
  '.oooooooooooooo.'
];

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => clamp(Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)), 0, 255);
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('');
}

function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function stageOf(age) {
  if (age < 1) return 'kitten';
  if (age < 3) return 'young';
  if (age < 11) return 'adult';
  if (age < 16) return 'senior';
  return 'elder';
}

const spriteCache = new Map();
let spriteCanvas = null;

function sprite(cat) {
  const old = cat.age >= 11;
  const key = cat.id + (old ? 'o' : '');
  if (spriteCache.has(key)) return spriteCache.get(key);
  if (!spriteCanvas) { spriteCanvas = document.createElement('canvas'); spriteCanvas.width = spriteCanvas.height = 16; }
  const ctx = spriteCanvas.getContext('2d');
  ctx.clearRect(0, 0, 16, 16);
  const ph = phenotype(cat);
  const outline = '#140c1c';
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const c = CAT_MAP[y][x];
      if (c === '.') continue;
      let col;
      let body = ph.base;
      if (ph.tortie) body = hash(x >> 1, y >> 1, cat.id) < 0.5 ? ph.ora : ph.dark;
      const stripe = ph.tabby && ((c === 'b' && (y === 10 || y === 12 || (y === 4 && x >= 4 && x <= 7 && x % 2 === 0))) || (c === 't' && y % 2 === 0));
      if (stripe) body = shade(body, -0.32);
      switch (c) {
        case 'o': col = outline; break;
        case 'e': col = y === 5 ? shade(cat.eye, 0.35) : cat.eye; break;
        case 'n': col = '#ff9fb5'; break;
        case 'i': col = '#e88aa0'; break;
        case 'w':
          col = ph.white ? '#f4efe6' : shade(body, 0.14);
          break;
        case 'p':
          col = ph.white ? '#f4efe6' : body;
          break;
        case 'b':
          col = body;
          if (ph.white === 2 && (y >= 10 || (y >= 4 && x >= 5 && x <= 6))) col = '#f4efe6';
          break;
        default: col = body;
      }
      if (old && (c === 'w' || (c === 'b' && y >= 4 && y <= 8)) && hash(x, y, cat.id + 7) < 0.45) col = shade(col, 0.45);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const url = spriteCanvas.toDataURL();
  spriteCache.set(key, url);
  return url;
}

/* ---------- Life: aging, dying, breeding ---------- */

function mortality(age) {
  if (age < 1) return 0.12;
  if (age <= 6) return 0.03;
  if (age <= 9) return 0.06;
  if (age <= 12) return 0.11;
  if (age <= 15) return 0.2;
  if (age <= 18) return 0.35;
  if (age <= 21) return 0.55;
  return 0.8;
}

function femaleFertility(age) {
  if (age < 1) return 0;
  if (age === 1) return 0.5;
  if (age <= 7) return 0.8;
  if (age <= 10) return 0.45;
  if (age <= 12) return 0.15;
  return 0;
}

function maleFertility(age) {
  if (age < 1) return 0;
  if (age === 1) return 0.3;
  if (age <= 10) return 0.55;
  if (age <= 14) return 0.3;
  if (age <= 16) return 0.08;
  return 0;
}

function litterSize(age) {
  const mean = age <= 1 ? 3 : age <= 7 ? 4.2 : age <= 10 ? 3 : 2;
  return clamp(Math.round(mean + (rnd() + rnd() + rnd() - 1.5) * 1.6), 1, 7);
}

function closeKin(a, b) {
  if (a.mom === b.id || a.dad === b.id || b.mom === a.id || b.dad === a.id) return true;
  if (a.mom != null && (a.mom === b.mom || a.dad === b.dad)) return true;
  return false;
}

function newName() {
  const used = S ? S.nameCount : {};
  const base = pick(NAMES);
  const n = used[base] || 0;
  used[base] = n + 1;
  return base + (ROMAN[n] !== undefined ? ROMAN[n] : ' ' + (n + 1));
}

function family() { return Object.values(S.cats).filter((c) => !c.stray); }
function living() { return family().filter((c) => c.alive); }

function stray(sex) {
  const s = makeCat({ sex, stray: true });
  s.age = 1 + Math.floor(rnd() * 6);
  S.cats[s.id] = s;
  return s;
}

// Drop a stray's genome once it has been used; the tree only needs its name and coat.
function shrinkStray(s) {
  s.coat = phenotype(s).name;
  delete s.auto;
  delete s.sexc;
}

function litter(mom, dad, ev, guaranteed) {
  const n = litterSize(mom.age) + (guaranteed ? 1 : 0);
  const kits = [];
  for (let i = 0; i < n; i++) kits.push(breed(mom, dad));
  kits.forEach((k) => ev.born.push(k.id));
  const who = (c) => (c.stray ? 'stray ' + c.name : c.name);
  ev.lines.push({ t: 'birth', s: `${who(mom)} had ${n} kitten${n > 1 ? 's' : ''} with ${who(dad)}: ${kits.map((k) => k.name).join(', ')}` });
}

function yearStep() {
  const ev = { died: [], born: [], grew: [], lines: [] };
  const firstYear = S.year === 0;
  S.year++;

  for (const c of living()) {
    const before = stageOf(c.age);
    c.age++;
    if (stageOf(c.age) !== before) ev.grew.push(c.id);
    const safe = firstYear && c.id === S.founderId;
    if (!safe && chance(mortality(c.age - 1))) {
      c.alive = false;
      c.diedAt = S.year;
      ev.died.push(c.id);
      ev.lines.push({ t: 'death', s: `${c.name} died at ${c.age} (${pct(c.origin)} origin DNA)` });
    }
  }

  const alive = living();
  // Crowding: the fuller the yard (kittens born this year included), the fewer new litters.
  const room = () => clamp(1 - (alive.length + ev.born.length) / CAP, 0.02, 1) ** 1.5;
  const founder = S.cats[S.founderId];

  // Mothers in the family: one litter, sometimes two, by a family tom or a stray.
  for (const mom of alive.filter((c) => c.sex === 'F').sort(() => rnd() - 0.5)) {
    const guaranteed = firstYear && mom === founder;
    let n = guaranteed || chance(femaleFertility(mom.age) * room()) ? 1 : 0;
    if (n && mom.age <= 7 && chance(0.3 * room())) n = 2;
    for (let i = 0; i < n; i++) {
      const toms = alive.filter((c) => c.sex === 'M' && c.age >= 1 && c.age <= 14 && !closeKin(c, mom));
      const dad = toms.length && chance(0.2) ? pick(toms) : stray('M');
      litter(mom, dad, ev, guaranteed);
      if (dad.stray) shrinkStray(dad);
    }
  }
  // Toms roam: a stray queen may bring his kittens to the yard.
  for (const dad of alive.filter((c) => c.sex === 'M').sort(() => rnd() - 0.5)) {
    const guaranteed = firstYear && dad === founder;
    if (guaranteed || chance(maleFertility(dad.age) * room() * 0.6)) {
      const mom = stray('F');
      litter(mom, dad, ev, guaranteed);
      shrinkStray(mom);
    }
  }

  const peak = living().reduce((s, c) => s + c.origin, 0) / 100;
  S.peak = Math.max(S.peak || 0, peak);
  S.log.push({ year: S.year, lines: ev.lines });
  checkOver(ev);
  return ev;
}

function checkOver(ev) {
  const alive = living();
  if (!alive.length) {
    S.over = { year: S.year, why: 'The last cat of the family is gone.' };
  } else if (!alive.some((c) => c.origin > 0)) {
    S.over = { year: S.year, why: `Not one living cat carries any of ${S.cats[S.founderId].name}'s DNA anymore.` };
  }
  if (S.over) ev.lines.push({ t: 'info', s: S.over.why });
}

/* ---------- Saving ---------- */

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

/* ---------- Sound ---------- */

let actx = null;
function audio() {
  if (muted) return null;
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  } catch (e) { return null; }
}

function tone(freq, dur, type = 'square', vol = 0.05, slideTo) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur);
}

// A little synthesized meow: a sawtooth through a moving band-pass, pitch up then down.
function meow(pitch = 1) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(380 * pitch, t);
  o.frequency.linearRampToValueAtTime(620 * pitch, t + 0.12);
  o.frequency.linearRampToValueAtTime(420 * pitch, t + 0.42);
  f.type = 'bandpass';
  f.Q.value = 3;
  f.frequency.setValueAtTime(700, t);
  f.frequency.linearRampToValueAtTime(1600, t + 0.14);
  f.frequency.linearRampToValueAtTime(800, t + 0.42);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(f).connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + 0.5);
}

const sfx = {
  tick: () => tone(880, 0.05, 'square', 0.03),
  year: () => { tone(523, 0.1); setTimeout(() => tone(659, 0.1), 90); setTimeout(() => tone(784, 0.18), 180); },
  death: () => tone(330, 0.6, 'triangle', 0.07, 110),
  birth: () => meow(1.5 + rnd() * 0.4)
};

/* ---------- Rendering ---------- */

function stats() {
  const alive = living();
  const fam = family();
  const founder = S.cats[S.founderId];
  const genomes = alive.reduce((s, c) => s + c.origin, 0) / 100;
  const carriers = alive.filter((c) => c.origin > 0).length;
  const maxGen = fam.reduce((m, c) => Math.max(m, c.gen), 0);
  const line = founder.sex === 'F'
    ? ['Mito line', alive.some((c) => c.mt === 1)]
    : ['Y line', alive.some(hasOriginY)];
  $('stats').innerHTML = `
    <div class="stat lead"><span>year</span><b>${S.year}</b></div>
    <div class="stat"><span>alive</span><b>${alive.length}</b></div>
    <div class="stat"><span>ever born</span><b>${fam.length}</b></div>
    <div class="stat"><span>generations</span><b>${maxGen + 1}</b></div>
    <div class="stat"><span>carriers</span><b class="gold">${carriers}/${alive.length}</b></div>
    <div class="stat" title="Total origin DNA among living cats, counted in whole ${esc(founder.name)}s"><span>${esc(founder.name)} DNA alive</span><b class="gold">${genomes.toFixed(2)}&times;</b></div>
    <div class="stat" title="${founder.sex === 'F' ? 'Mitochondria pass only from mothers to kittens' : 'The Y chromosome passes only from fathers to sons'}"><span>${line[0]}</span><b class="${line[1] ? 'ok' : 'gone'}">${line[1] ? 'ALIVE' : 'LOST'}</b></div>`;
}

function card(c) {
  const ph = phenotype(c);
  const st = stageOf(c.age);
  const founder = c.id === S.founderId;
  const badges = [];
  if (c.mt === 1) badges.push('<b title="carries the founder\'s mitochondria">&#9678; mito</b>');
  if (hasOriginY(c)) badges.push('<b title="carries the founder\'s Y chromosome">&#9794; Y</b>');
  const div = document.createElement('div');
  div.className = `cat-card${founder ? ' founder' : ''}${c.origin > 0 ? '' : ' none'}`;
  div.dataset.id = c.id;
  div.innerHTML = `
    ${founder ? '<span class="crown" title="founder">&#128081;</span>' : ''}
    <div class="cc-sprite"><img class="st-${st}" src="${sprite(c)}" alt=""></div>
    <div class="cc-name"><span class="sex-${c.sex}">${sexIcon(c.sex)}</span> ${esc(c.name)}</div>
    <div class="cc-meta"><span class="cc-age">${c.age}</span> y &middot; <span class="cc-stage">${st}</span> &middot; gen ${c.gen}<br>${ph.name}</div>
    <div class="dna-bar" title="origin DNA"><i style="width:${c.origin}%"></i><span>${pct(c.origin)}</span></div>
    <div class="badges">${badges.join(' ') || '&nbsp;'}</div>`;
  div.addEventListener('click', () => openCat(c.id));
  return div;
}

function sortCats(list) {
  const by = $('sort').value;
  const f = {
    dna: (a, b) => b.origin - a.origin || b.age - a.age,
    age: (a, b) => b.age - a.age || b.origin - a.origin,
    gen: (a, b) => a.gen - b.gen || b.origin - a.origin
  }[by];
  return list.sort(f);
}

function render(born = new Set()) {
  stats();
  const box = $('colony');
  box.innerHTML = '';
  let i = 0;
  for (const c of sortCats(living())) {
    const el = card(c);
    if (born.has(c.id)) {
      el.classList.add('born');
      el.style.animationDelay = (i++ * 70) + 'ms';
    }
    box.appendChild(el);
  }
  const last = S.log[S.log.length - 1];
  $('yearlog-title').textContent = last ? `YEAR ${last.year}` : 'YEAR 0';
  $('yearlog').innerHTML = last && last.lines.length
    ? last.lines.map((l) => `<li class="ev-${l.t}">${esc(l.s)}</li>`).join('')
    : `<li class="ev-info">${esc(S.cats[S.founderId].name)} is ${S.cats[S.founderId].age} and ready to start a family. Press the button below.</li>`;
}

function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 2700);
}

/* ---------- The year button and its animation ---------- */

async function ageUp() {
  if (busy || S.over) return;
  busy = true;
  $('age-btn').disabled = true;

  const before = new Map(living().map((c) => [c.id, stageOf(c.age)]));
  const ev = yearStep();
  save();

  // 1. the year flips over, months tick by
  const fx = $('yearfx');
  $('yf-old').textContent = S.year - 1;
  $('yf-new').textContent = S.year;
  $('months').innerHTML = Array.from({ length: 12 }, (_, i) => `<i style="animation-delay:${i * 70}ms"></i>`).join('');
  fx.hidden = false;
  fx.style.animation = 'none';
  void fx.offsetWidth;
  fx.style.animation = '';
  for (let i = 0; i < 12; i++) setTimeout(sfx.tick, i * 70);
  setTimeout(sfx.year, 840);

  // 2. every cat on screen hops and gets a year older
  document.querySelectorAll('.cat-card').forEach((el, i) => {
    const c = S.cats[el.dataset.id];
    setTimeout(() => {
      el.classList.remove('aging');
      void el.offsetWidth;
      el.classList.add('aging');
      el.querySelector('.cc-age').textContent = c.age;
      const st = stageOf(c.age);
      const img = el.querySelector('img');
      img.className = 'st-' + st;
      img.src = sprite(c);
      el.querySelector('.cc-stage').textContent = st;
      const p = document.createElement('div');
      p.className = 'plus1' + (before.get(c.id) !== st ? ' grow' : '');
      p.textContent = before.get(c.id) !== st ? st.toUpperCase() + '!' : '+1';
      el.appendChild(p);
      setTimeout(() => p.remove(), 1200);
    }, 300 + Math.min(i * 25, 600));
  });
  await sleep(1500);
  fx.hidden = true;

  // 3. those who did not make it float away
  if (ev.died.length) {
    sfx.death();
    for (const id of ev.died) {
      const el = document.querySelector(`.cat-card[data-id="${id}"]`);
      if (!el) continue;
      el.classList.add('dying');
      const g = document.createElement('img');
      g.className = 'ghost';
      g.src = sprite(S.cats[id]);
      el.querySelector('.cc-sprite').appendChild(g);
      toast(`✝ ${S.cats[id].name}, ${S.cats[id].age} years`);
      await sleep(180);
    }
    await sleep(1400);
  }

  // 4. new kittens pop in
  lastBorn = new Set(ev.born);
  render(lastBorn);
  ev.born.slice(0, 6).forEach((_, i) => setTimeout(sfx.birth, 200 + i * 160));
  if (ev.born.length) hearts();

  busy = false;
  $('age-btn').disabled = !!S.over;
  if (S.over) setTimeout(showEnd, 1300);
}

function hearts() {
  document.querySelectorAll('.cat-card.born').forEach((el, i) => {
    if (i > 20) return;
    const h = document.createElement('span');
    h.className = 'heart';
    h.textContent = '♥';
    h.style.left = 20 + rnd() * 60 + '%';
    h.style.top = '20px';
    h.style.animationDelay = (i * 70 + 300) + 'ms';
    el.appendChild(h);
    setTimeout(() => h.remove(), 2200 + i * 70);
  });
}

/* ---------- Modals ---------- */

function openModal(html) {
  $('modal-body').innerHTML = html;
  $('modal').hidden = false;
  $('modal-body').querySelectorAll('[data-cat]').forEach((el) => el.addEventListener('click', () => openCat(+el.dataset.cat)));
}
function closeModal() { $('modal').hidden = true; }

function catLink(id) {
  const c = S.cats[id];
  if (!c) return '?';
  if (c.stray) return `<span class="dim">stray ${esc(c.name)} (${esc(c.coat || '')})</span>`;
  return `<span class="link" data-cat="${c.id}">${sexIcon(c.sex)} ${esc(c.name)}</span>`;
}

function chrRow(c, cls = '') {
  return `<div class="chr-row ${cls}">${[...c.s].map((b) => `<i class="${b === '1' ? 'o' : ''}"></i>`).join('')}</div>`;
}

function openCat(id) {
  const c = S.cats[id];
  if (!c || c.stray) return;
  const ph = phenotype(c);
  const g = genes(c);
  const founder = c.id === S.founderId;
  const mom = S.cats[c.mom];
  const dad = S.cats[c.dad];
  const expected = founder ? 100 : ((mom && !mom.stray ? mom.origin : 0) + (dad && !dad.stray ? dad.origin : 0)) / 2;
  const status = c.alive
    ? `${c.age} years old &middot; ${stageOf(c.age)}`
    : `died in year ${c.diedAt}, aged ${c.age}`;
  const sexChr = c.sex === 'F'
    ? `<div class="chr">X &middot; from mom${chrRow(c.sexc[0])}X &middot; from dad${chrRow(c.sexc[1])}</div>`
    : `<div class="chr">X &middot; from mom${chrRow(c.sexc[0])}Y &middot; from dad${chrRow(c.sexc[1], 'y')}</div>`;
  const kids = c.kids.map((k) => catLink(k)).join('');
  openModal(`
    <div class="detail-head${c.alive ? '' : ' dead'}">
      <img src="${sprite(c)}" alt="">
      <div>
        <div class="detail-name"><span class="sex-${c.sex}">${sexIcon(c.sex)}</span> ${esc(c.name)} ${founder ? '&#128081;' : ''}</div>
        <div class="detail-sub">${status}<br>${ph.name} &middot; generation ${c.gen} &middot; born year ${c.born}</div>
      </div>
    </div>
    <div class="detail-dna">
      <div class="dna-bar"><i style="width:${c.origin}%"></i><span>${pct(c.origin)} origin DNA</span></div>
      <div class="karyo-key">${founder ? 'The founder: all of this DNA is the origin.' : `Expected from the parents: ${pct(expected)}. Real inheritance is a coin flip per chunk, so it rarely matches.`}</div>
    </div>
    <div class="detail-grid">
      <div><span>mother</span>${c.mom != null ? catLink(c.mom) : '&mdash;'}</div>
      <div><span>father</span>${c.dad != null ? catLink(c.dad) : '&mdash;'}</div>
      <div><span>mitochondria (from mothers only)</span>${c.mt ? '<b class="gold">founder line &#9678;</b>' : 'other line'}</div>
      <div><span>${c.sex === 'M' ? 'Y chromosome (fathers to sons only)' : 'coat genes'}</span>${c.sex === 'M' ? (hasOriginY(c) ? '<b class="gold">founder Y &#9794;</b>' : 'other Y') : `${g.orange.join('/')} &middot; ${g.agouti.join('')} ${g.white.join('')} ${g.dilute.join('')}`}</div>
      <div style="grid-column:1/-1"><span>kittens (${c.kids.length})</span><div class="kids">${kids || '&mdash;'}</div></div>
    </div>
    <h2 style="margin-top:16px">CHROMOSOMES</h2>
    <div class="karyo">
      ${c.auto.map((p, i) => `<div class="chr">${AUTO[i]}${chrRow(p[0])}${chrRow(p[1])}</div>`).join('')}
      ${sexChr}
    </div>
    <div class="karyo-key"><span class="gold">&#9632;</span> origin DNA &nbsp; top bar from mom, bottom from dad. Genes: Orange on X (O/o), tabby on A3 (A/a), white on B1 (S/s), dilute on C1 (D/d).</div>`);
}

function openHelp() {
  openModal(`<div class="help">
    <h2>HOW TO PLAY</h2>
    <p>You chose one cat. It is the <b class="gold">founder</b>, and all of its DNA counts as <b class="gold">origin DNA</b>. Press <b>AGE EVERYONE +1 YEAR</b> and watch the family grow, age and pass on.</p>
    <h3>DNA, LIKE THE REAL THING</h3>
    <ul>
      <li>Every cat has 18 chromosome pairs plus XX (&#9792;) or XY (&#9794;). One copy of each pair comes from mom, one from dad.</li>
      <li>Parents shuffle each pair before passing it on (crossing over), so a kitten of a 50% cat can get 40% or 60%. After a few generations, some cats get none at all.</li>
      <li><span class="pink">&#9792; Mothers</span> pass a mixed X and their <b>mitochondria</b> to every kitten, but have at most two litters a year.</li>
      <li><span class="blue">&#9794; Fathers</span> pass their X whole to daughters and their <b>Y</b> whole to sons only, but toms roam and can sire litters every year well into old age.</li>
      <li>Coat colors are genes on the chromosomes. Orange sits on the X, so calicos and torties are (almost always) girls.</li>
    </ul>
    <h3>LIFE</h3>
    <ul>
      <li>Kittens can breed from age 1. Queens slow down after 7 and stop around 12; toms keep going to about 16.</li>
      <li>The risk of dying each year rises with age: low for adults, high past 15. Few cats see 20.</li>
      <li>Most mates are strays from outside the family, which dilutes the origin DNA. Close relatives never pair.</li>
      <li>The yard only feeds about ${CAP} cats, so a crowded colony has fewer kittens.</li>
    </ul>
    <h3>THE END</h3>
    <p>The game ends when no living cat carries any origin DNA, or when you press END &amp; TREE. Then look at the family tree of every cat that ever lived.</p>
    <div class="end-actions"><button id="restart-btn" class="px-btn" type="button">NEW FAMILY</button></div>
  </div>`);
  $('restart-btn').addEventListener('click', () => {
    if (confirm('Start over with a new cat? This family will be lost.')) newGame();
  });
}

function openLog() {
  const years = S.log.slice().reverse().map((y) => `<li><b class="gold">Year ${y.year}</b><ul>${y.lines.map((l) => `<li class="ev-${l.t}">${esc(l.s)}</li>`).join('') || '<li class="dim">a quiet year</li>'}</ul></li>`).join('');
  openModal(`<div class="chron"><h2>CHRONICLE</h2><ul>${years || '<li class="dim">Nothing yet.</li>'}</ul></div>`);
}

function showEnd() {
  const fam = family();
  const founder = S.cats[S.founderId];
  const oldest = fam.reduce((a, b) => (b.age > a.age ? b : a));
  const maxGen = fam.reduce((m, c) => Math.max(m, c.gen), 0);
  const deepest = fam.filter((c) => c.origin > 0).reduce((a, b) => (b.gen > a.gen ? b : a));
  openModal(`<div class="end">
    <h1 class="big">THE END</h1>
    <p>${esc(S.over ? S.over.why : 'You closed the book on this family.')}</p>
    <div class="end-stats">
      <div class="stat"><span>years</span><b>${S.year}</b></div>
      <div class="stat"><span>cats in the family</span><b>${fam.length}</b></div>
      <div class="stat"><span>generations</span><b>${maxGen + 1}</b></div>
      <div class="stat"><span>peak ${esc(founder.name)} DNA</span><b class="gold">${(S.peak || 1).toFixed(2)}&times;</b></div>
      <div class="stat"><span>oldest</span><b>${esc(oldest.name)}, ${oldest.age}</b></div>
      <div class="stat"><span>furthest carrier</span><b>gen ${deepest.gen}</b></div>
    </div>
    <div class="end-actions">
      <button id="end-tree" class="px-btn" type="button">&#127795; FAMILY TREE</button>
      <button id="end-new" class="px-btn" type="button">NEW FAMILY</button>
    </div>
  </div>`);
  $('end-tree').addEventListener('click', () => { closeModal(); openTree(); });
  $('end-new').addEventListener('click', newGame);
}

/* ---------- Family tree ---------- */

let zoom = 1;
const NODE_W = 80;
const ROW_H = 110;

function openTree() {
  const fam = family();
  const byGen = [];
  for (const c of fam) (byGen[c.gen] = byGen[c.gen] || []).push(c);
  const x = {};
  // Lay out generation by generation; litters sit together under their family parent(s).
  byGen.forEach((row, g) => {
    if (!row) return;
    const want = (c) => {
      const ps = [c.mom, c.dad].filter((p) => x[p] !== undefined);
      return ps.length ? ps.reduce((s, p) => s + x[p], 0) / ps.length : 0;
    };
    const groups = new Map();
    for (const c of row) {
      const k = want(c).toFixed(3) + ':' + c.mom + ':' + c.dad;
      if (!groups.has(k)) groups.set(k, { at: want(c), kids: [] });
      groups.get(k).kids.push(c);
    }
    let next = -Infinity;
    [...groups.values()].sort((a, b) => a.at - b.at).forEach((gr) => {
      const start = gr.at - (gr.kids.length - 1) / 2;
      gr.kids.sort((a, b) => a.id - b.id).forEach((c, i) => {
        x[c.id] = Math.max(next, start + i);
        next = x[c.id] + 1;
      });
    });
  });
  const minX = Math.min(...Object.values(x));
  const maxX = Math.max(...Object.values(x));
  const W = (maxX - minX + 1) * NODE_W + 80;
  const H = byGen.length * ROW_H + 30;
  const px = (c) => (x[c.id] - minX) * NODE_W + 60;
  const py = (c) => c.gen * ROW_H + 20;

  let lines = '';
  let nodes = '';
  for (const c of fam) {
    for (const pid of [c.mom, c.dad]) {
      const p = S.cats[pid];
      if (!p || p.stray) continue;
      const x1 = px(p) + 36, y1 = py(p) + 50, x2 = px(c) + 36, y2 = py(c);
      const my = (y1 + y2) / 2;
      const col = c.origin > 0 ? '#ffcf4a' : '#4a3a6a';
      const op = c.origin > 0 ? 0.35 + c.origin / 160 : 0.6;
      lines += `<path d="M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}" stroke="${col}" stroke-opacity="${op.toFixed(2)}" stroke-width="2" fill="none"${c.origin > 0 ? '' : ' stroke-dasharray="4 3"'}/>`;
    }
    const cls = ['tnode', c.alive ? '' : 'dead', c.origin > 0 ? 'carrier' : '', c.id === S.founderId ? 'founder' : ''].join(' ');
    nodes += `<div class="${cls}" data-cat="${c.id}" style="left:${px(c)}px;top:${py(c)}px" title="${esc(c.name)}, ${esc(phenotype(c).name)}">
      <img src="${sprite(c)}" alt=""><b><span class="sex-${c.sex}">${sexIcon(c.sex)}</span>${c.alive ? '' : '&#10013;'}${esc(c.name)}</b><small>${pct(c.origin)}</small></div>`;
  }
  const labels = byGen.map((_, g) => `<div class="gen-label" style="top:${g * ROW_H + 4}px">G${g}</div>`).join('');
  const inner = $('tree-inner');
  inner.dataset.w = W;
  inner.dataset.h = H;
  inner.innerHTML = `<svg width="${W}" height="${H}">${lines}</svg>${labels}${nodes}`;
  inner.querySelectorAll('[data-cat]').forEach((el) => el.addEventListener('click', () => openCat(+el.dataset.cat)));
  const carriers = fam.filter((c) => c.origin > 0).length;
  $('tree-sum').textContent = `${fam.length} cats, ${byGen.length} generations, ${carriers} carried origin DNA`;
  $('tree').hidden = false;
  applyZoom();
  const founderX = px(S.cats[S.founderId]);
  const sc = $('tree-scroll');
  sc.scrollLeft = founderX * zoom - sc.clientWidth / 2;
  sc.scrollTop = 0;
}

function applyZoom() {
  const inner = $('tree-inner');
  inner.style.zoom = zoom;
  inner.style.width = inner.dataset.w + 'px';
  inner.style.height = inner.dataset.h + 'px';
}

/* ---------- Starting a game ---------- */

let founders = [];

function freshState() {
  return { year: 0, cats: {}, nextId: 1, nameCount: {}, log: [], founderId: null, over: null, peak: 1 };
}

function rollFounders() {
  S = freshState();
  const sexes = ['F', 'M', chance(0.5) ? 'F' : 'M', chance(0.5) ? 'F' : 'M'];
  founders = sexes.map((sex) => {
    const c = makeCat({ sex, origin: true });
    c.age = 2;
    c.origin = 100;
    return c;
  });
  // Make at least one founder a calico or tortie, for the fun of it.
  const f = founders[0];
  f.sexc[0].g[GENE.orange.pos] = 'O';
  f.sexc[1].g[GENE.orange.pos] = 'o';
  $('founders').innerHTML = '';
  founders.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'founder-card';
    const ph = phenotype(c);
    const perk = c.sex === 'F'
      ? 'Passes her mitochondria to every kitten.'
      : 'Passes his Y to every son, and roams far.';
    b.innerHTML = `<img src="${sprite(c)}" alt=""><div class="fname"><span class="sex-${c.sex}">${sexIcon(c.sex)}</span> ${esc(c.name)}</div>
      <div class="fdesc">${ph.name}, 2 years<br>${perk}</div><div class="fpick">PICK ME</div>`;
    b.addEventListener('click', () => chooseFounder(i));
    $('founders').appendChild(b);
  });
}

function chooseFounder(i) {
  const c = founders[i];
  S.cats = { [c.id]: c };
  S.founderId = c.id;
  meow(1.1);
  save();
  start();
}

function newGame() {
  closeModal();
  $('tree').hidden = true;
  $('game').hidden = true;
  $('footer').hidden = true;
  spriteCache.clear();
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  rollFounders();
  $('splash').hidden = false;
}

function start() {
  $('splash').hidden = true;
  $('game').hidden = false;
  $('footer').hidden = false;
  $('age-btn').disabled = !!S.over;
  render();
}

/* ---------- Wiring ---------- */

$('age-btn').addEventListener('click', ageUp);
$('retire-btn').addEventListener('click', () => {
  if (busy) return;
  if (!S.over && !confirm('End this family here and see the whole tree?')) return;
  if (!S.over) { S.over = { year: S.year, why: 'You closed the book on this family.' }; save(); }
  $('age-btn').disabled = true;
  showEnd();
});
$('reroll-btn').addEventListener('click', () => { spriteCache.clear(); rollFounders(); });
$('tree-btn').addEventListener('click', () => { if (S && S.founderId) openTree(); });
$('log-btn').addEventListener('click', () => { if (S && S.founderId) openLog(); });
$('help-btn').addEventListener('click', openHelp);
$('modal-close').addEventListener('click', closeModal);
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });
$('tree-close').addEventListener('click', () => { $('tree').hidden = true; });
$('zoom-in').addEventListener('click', () => { zoom = Math.min(2, zoom * 1.25); applyZoom(); });
$('zoom-out').addEventListener('click', () => { zoom = Math.max(0.25, zoom / 1.25); applyZoom(); });
$('sort').addEventListener('change', () => render());
$('mute-btn').addEventListener('click', () => {
  muted = !muted;
  $('mute-btn').classList.toggle('off', muted);
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* ignore */ }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('modal').hidden) closeModal();
    else if (!$('tree').hidden) $('tree').hidden = true;
  }
});

try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* ignore */ }
$('mute-btn').classList.toggle('off', muted);

S = load();
if (S && S.founderId && S.cats[S.founderId]) start();
else newGame();
