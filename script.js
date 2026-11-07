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
 *
 * Core loop: every year litters arrive and each kitten is revealed with the purr meter
 * (a timing skill that builds a run-long combo and pays fish), love letters let you pick
 * mates to breed the coats that orders ask for, orders adopt cats out for fish and legacy,
 * and fish buy permanent upgrades for the next family. Every coat found goes in the Catdex.
 */

const SAVE_KEY = 'meowle-cats-v2';
const META_KEY = 'meowle-meta-v1';
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

const RARITY = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];
const RARITY_FISH = [1, 2, 4, 8, 30];
const GRADES = {
  perfect: { label: 'PERFECT!', mult: 3, shiny: 3 },
  great: { label: 'GREAT!', mult: 2, shiny: 1.5 },
  good: { label: 'GOOD', mult: 1, shiny: 1 },
  miss: { label: 'MISS', mult: 0.3, shiny: 1 },
  auto: { label: '', mult: 0.5, shiny: 1 }
};

const UPGRADES = [
  { id: 'scanner', icon: '&#128300;', name: 'Gene Scanner', desc: 'Shows the coat odds of every match before you pick it.', cost: [30] },
  { id: 'letters', icon: '&#128152;', name: 'Love Letters', desc: '+1 matchmaking letter every year.', cost: [80, 400, 1200] },
  { id: 'yard', icon: '&#127969;', name: 'Bigger Yard', desc: 'Room for 4 more cats.', cost: [40, 150, 350, 700, 1300] },
  { id: 'zone', icon: '&#128062;', name: 'Steady Paws', desc: 'Purr meter sweet spot 15% wider.', cost: [60, 300, 900] },
  { id: 'magnet', icon: '&#128031;', name: 'Fish Magnet', desc: '+25% fish from every kitten.', cost: [50, 200, 500, 1100] },
  { id: 'board', icon: '&#128203;', name: 'Order Board', desc: '+1 order slot and +20% order rewards.', cost: [120, 600] },
  { id: 'vet', icon: '&#129658;', name: 'Vet Visits', desc: '-12% yearly death risk.', cost: [70, 260, 600, 1200] },
  { id: 'charm', icon: '&#128276;', name: 'Lucky Bell', desc: 'Shiny kittens twice as likely.', cost: [100, 500, 1500] }
];

const NAMES = ('Mochi Biscuit Pumpkin Luna Milo Nala Simba Oreo Pepper Ginger Smokey Shadow Tiger Cleo Kiki Mittens Socks Whiskers ' +
  'Felix Tom Bella Lily Chloe Lucy Zoe Coco Daisy Willow Hazel Olive Maple Clover Pixel Byte Nibbles Toast Waffles Pickles ' +
  'Noodle Dumpling Bao Sushi Tofu Miso Ramen Udon Taro Yuzu Kumo Sora Hana Momo Kiwi Mango Peach Plum Fig Juniper Sage ' +
  'Rosemary Basil Thyme Pesto Nutmeg Cinnamon Clove Saffron Paprika Chili Tabasco Ziggy Bowie Elvis Prince Freddie Ringo ' +
  'Lennon Jagger Dusty Rusty Copper Bronze Amber Jet Onyx Ember Ash Cinder Soot Frost Snow Misty Storm Thunder Rain Drizzle ' +
  'Puddle Pebble Boulder Rocky Gizmo Gadget Sprocket Widget Bolt Turbo Rocket Comet Nova Orbit Cosmo Astro Apollo Zeus Hera ' +
  'Athena Loki Thor Odin Freya Banjo Fiddle Pippin Merry Frodo Bilbo Tinker Bramble Thistle Moss Fern Acorn Chestnut ' +
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
const shuffle = (arr) => arr.sort(() => rnd() - 0.5);

let S = null; // the current family (run)
let META = null; // what is kept forever: fish, upgrades, Catdex, best legacy
let busy = false;
let muted = false;

const up = (id) => (META.up[id] || 0);

/* ---------- Genome ---------- */

function chrom(origin, len, genes) {
  return { s: (origin ? '1' : '0').repeat(len), g: genes || {} };
}

function randomAllele(gene) {
  switch (gene) {
    case 'agouti': return chance(0.55) ? 'A' : 'a';
    case 'white': return chance(0.3) ? 'S' : 's';
    case 'dilute': return chance(0.68) ? 'D' : 'd';
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
    born: S.year,
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

function conceive(mom, dad) {
  const sex = chance(0.5) ? 'F' : 'M';
  const e = gamete(mom, false);
  const s = gamete(dad, sex === 'M');
  return { sex, auto: e.auto.map((c, i) => [c, s.auto[i]]), sexc: [e.sex, s.sex] };
}

function breed(mom, dad) {
  const embryo = conceive(mom, dad);
  const kit = {
    id: S.nextId++,
    name: newName(),
    sex: embryo.sex,
    stray: false,
    born: S.year,
    age: 0,
    alive: true,
    gen: Math.max(mom.stray ? -1 : mom.gen, dad.stray ? -1 : dad.gen) + 1,
    mom: mom.id,
    dad: dad.id,
    mt: mom.mt,
    eye: chance(0.06) ? pick(EYES) : pick([mom.eye, dad.eye]),
    kids: [],
    auto: embryo.auto,
    sexc: embryo.sexc
  };
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

/* ---------- Coat (phenotype) and the Catdex ---------- */

function genes(cat) {
  const a = cat.auto;
  const pair = (name) => a[GENE[name].chr].map((c) => c.g[GENE[name].pos]);
  const os = cat.sexc.map((c) => c.g[GENE.orange.pos]).filter(Boolean);
  return { agouti: pair('agouti'), white: pair('white'), dilute: pair('dilute'), orange: os };
}

function phenoFrom({ sex, tabby, white, dilute, oCount }) {
  const tortie = sex === 'F' && oCount === 1;
  const orange = !tortie && oCount > 0;
  const dark = dilute ? '#7c8496' : '#2c2630';
  const ora = dilute ? '#efc98e' : '#e2883a';
  const striped = tabby || orange;
  let name;
  if (tortie) name = white ? (dilute ? 'Dilute calico' : 'Calico') : (dilute ? 'Blue tortie' : 'Tortoiseshell');
  else {
    const color = orange ? (dilute ? 'Cream' : 'Ginger') : (dilute ? 'Blue' : 'Black');
    if (white === 0) name = color + (striped ? ' tabby' : '');
    else if (white === 1) name = striped ? color + ' tabby & white' : color + ' tuxedo';
    else name = striped ? color + ' tabby van' : color + ' & white';
  }
  let rarity = (dilute ? 1 : 0) + (white === 2 ? 1 : 0) + (tortie ? 1 : 0) + (tortie && white ? 1 : 0);
  rarity = Math.min(rarity, 3);
  return { base: orange ? ora : dark, dark, ora, tabby: striped, white, dilute, tortie, name, rarity };
}

const phenoCache = new Map();
function phenotype(cat) {
  if (cat.id != null && phenoCache.has(cat.id)) return phenoCache.get(cat.id);
  const g = genes(cat);
  const ph = phenoFrom({
    sex: cat.sex,
    tabby: g.agouti.includes('A'),
    white: g.white.filter((x) => x === 'S').length,
    dilute: !g.dilute.includes('D'),
    oCount: g.orange.filter((x) => x === 'O').length
  });
  if (cat.id != null) phenoCache.set(cat.id, ph);
  return ph;
}

// Every coat the genes can make, for the Catdex and for orders.
const DEX = (() => {
  const m = new Map();
  for (const sex of ['F', 'M']) for (const tabby of [true, false]) for (const white of [0, 1, 2])
    for (const dilute of [false, true]) for (const oCount of (sex === 'F' ? [0, 1, 2] : [0, 1])) {
      const ph = phenoFrom({ sex, tabby, white, dilute, oCount });
      if (!m.has(ph.name)) m.set(ph.name, { name: ph.name, ph, sexes: new Set() });
      m.get(ph.name).sexes.add(sex);
    }
  return [...m.values()].sort((a, b) => a.ph.rarity - b.ph.rarity || a.name.localeCompare(b.name));
})();
const DEX_BY_NAME = Object.fromEntries(DEX.map((d) => [d.name, d]));

function rarityOf(cat) { return cat.shiny ? 4 : phenotype(cat).rarity; }

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

function drawSprite(key, ph, eye, seed, old, shiny) {
  if (spriteCache.has(key)) return spriteCache.get(key);
  if (!spriteCanvas) { spriteCanvas = document.createElement('canvas'); spriteCanvas.width = spriteCanvas.height = 16; }
  const ctx = spriteCanvas.getContext('2d');
  ctx.clearRect(0, 0, 16, 16);
  const outline = shiny ? '#8a5a00' : '#140c1c';
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const c = CAT_MAP[y][x];
      if (c === '.') continue;
      let col;
      let body = ph.base;
      if (ph.tortie) body = hash(x >> 1, y >> 1, seed) < 0.5 ? ph.ora : ph.dark;
      const stripe = ph.tabby && ((c === 'b' && (y === 10 || y === 12 || (y === 4 && x >= 4 && x <= 7 && x % 2 === 0))) || (c === 't' && y % 2 === 0));
      if (stripe) body = shade(body, -0.32);
      switch (c) {
        case 'o': col = outline; break;
        case 'e': col = y === 5 ? shade(eye, 0.35) : eye; break;
        case 'n': col = '#ff9fb5'; break;
        case 'i': col = '#e88aa0'; break;
        case 'w': col = ph.white ? '#f4efe6' : shade(body, 0.14); break;
        case 'p': col = ph.white ? '#f4efe6' : body; break;
        case 'b':
          col = body;
          if (ph.white === 2 && (y >= 10 || (y >= 4 && x >= 5 && x <= 6))) col = '#f4efe6';
          break;
        default: col = body;
      }
      if (old && (c === 'w' || (c === 'b' && y >= 4 && y <= 8)) && hash(x, y, seed + 7) < 0.45) col = shade(col, 0.45);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  if (shiny) {
    ctx.fillStyle = '#fff6b0';
    [[13, 1], [12, 2], [13, 2], [14, 2], [13, 3], [15, 6], [11, 0]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
  }
  const url = spriteCanvas.toDataURL();
  spriteCache.set(key, url);
  return url;
}

function sprite(cat) {
  const old = cat.age >= 11;
  return drawSprite(cat.id + (old ? 'o' : '') + (cat.shiny ? 's' : ''), phenotype(cat), cat.eye, cat.id, old, cat.shiny);
}

function coatSprite(name) {
  const d = DEX_BY_NAME[name];
  return drawSprite('dex:' + name, d.ph, '#e8c23a', 11, false, false);
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
  const used = S.nameCount;
  const base = pick(NAMES);
  const n = used[base] || 0;
  used[base] = n + 1;
  return base + (ROMAN[n] !== undefined ? ROMAN[n] : ' ' + (n + 1));
}

function family() { return Object.values(S.cats).filter((c) => !c.stray); }
function living() { return family().filter((c) => c.alive); }
function yardSize() { return CAP + 4 * up('yard'); }

function strayCat(sex) {
  const s = makeCat({ sex, stray: true });
  s.age = 1 + Math.floor(rnd() * 6);
  return s;
}

// Drop a stray's genome once it has been used; the tree only needs its name and coat.
function shrinkStray(s) {
  s.coat = phenotype(s).name;
  delete s.auto;
  delete s.sexc;
}

function litter(mom, dad, ev, extra) {
  for (const p of [mom, dad]) if (p.stray) S.cats[p.id] = p;
  const n = litterSize(mom.age) + extra;
  const kits = [];
  for (let i = 0; i < n; i++) kits.push(breed(mom, dad));
  ev.born.push(...kits.map((k) => k.id));
  ev.litters.push({ mom: mom.id, dad: dad.id, kits: kits.map((k) => k.id) });
  const who = (c) => (c.stray ? 'stray ' + c.name : c.name);
  ev.lines.push({ t: 'birth', s: `${who(mom)} had ${n} kitten${n > 1 ? 's' : ''} with ${who(dad)}: ${kits.map((k) => k.name).join(', ')}` });
  for (const p of [mom, dad]) if (p.stray) shrinkStray(p);
}

function canMatch(q) {
  return q.alive && q.sex === 'F' && femaleFertility(q.age + 1) > 0;
}

function lettersLeft() { return 1 + up('letters') - Object.keys(S.matches).length; }

function yearStep() {
  const ev = { died: [], born: [], litters: [], lines: [] };
  const firstYear = S.year === 0;
  S.year++;
  const vet = 1 - 0.12 * up('vet');

  for (const c of living()) {
    c.age++;
    const safe = firstYear && c.id === S.founderId;
    if (!safe && chance(mortality(c.age - 1) * vet)) {
      c.alive = false;
      c.diedAt = S.year;
      ev.died.push(c.id);
      ev.lines.push({ t: 'death', s: `${c.name} died at ${c.age} (${pct(c.origin)} origin DNA)` });
    }
  }

  const alive = living();
  // Crowding: the fuller the yard (kittens born this year included), the fewer new litters.
  const room = () => clamp(1 - (alive.length + ev.born.length) / yardSize(), 0.02, 1) ** 1.5;
  const founder = S.cats[S.founderId];

  // Mothers in the family: a love letter guarantees the litter, otherwise chance picks.
  for (const mom of shuffle(alive.filter((c) => c.sex === 'F'))) {
    const m = S.matches[mom.id];
    if (m) {
      let dad = m.suitor || S.cats[m.tom];
      if (!dad || (!dad.stray && !dad.alive)) dad = strayCat('M');
      litter(mom, dad, ev, 0);
      continue;
    }
    const guaranteed = firstYear && mom === founder;
    let n = guaranteed || chance(femaleFertility(mom.age) * room()) ? 1 : 0;
    if (n && mom.age <= 7 && chance(0.3 * room())) n = 2;
    for (let i = 0; i < n; i++) {
      const toms = alive.filter((c) => c.sex === 'M' && c.age >= 1 && c.age <= 14 && !closeKin(c, mom));
      litter(mom, toms.length && chance(0.2) ? pick(toms) : strayCat('M'), ev, guaranteed ? 1 : 0);
    }
  }
  // Toms roam: a stray queen may bring his kittens to the yard.
  for (const dad of shuffle(alive.filter((c) => c.sex === 'M'))) {
    const guaranteed = firstYear && dad === founder;
    if (guaranteed || chance(maleFertility(dad.age) * room() * 0.6)) litter(strayCat('F'), dad, ev, guaranteed ? 1 : 0);
  }
  for (const id of Object.keys(S.matches)) {
    if (!S.cats[id].alive) ev.lines.push({ t: 'info', s: `${S.cats[id].name} did not live to meet her match.` });
  }
  S.matches = {};
  S.suitors = {};

  const genomes = living().reduce((s, c) => s + c.origin, 0) / 100;
  ev.legacy = Math.round(genomes * 10);
  S.legacy += ev.legacy;
  S.peak = Math.max(S.peak || 0, genomes);

  for (const o of S.orders.filter((o) => o.expires < S.year)) ev.lines.push({ t: 'info', s: `The order for ${orderLabel(o)} expired.` });
  S.orders = S.orders.filter((o) => o.expires >= S.year);
  fillOrders();

  S.log.push({ year: S.year, lines: ev.lines });
  checkOver(ev.lines);
  return ev;
}

function checkOver(lines) {
  if (S.over) return;
  const alive = living();
  if (!alive.length) S.over = { year: S.year, why: 'The last cat of the family is gone.' };
  else if (!alive.some((c) => c.origin > 0)) S.over = { year: S.year, why: `Not one cat in the yard carries any of ${S.cats[S.founderId].name}'s DNA anymore.` };
  if (S.over && lines) lines.push({ t: 'info', s: S.over.why });
}

/* ---------- Orders ---------- */

function orderLabel(o) {
  if (o.kind === 'dna') return `a cat with ${o.min}%+ origin DNA`;
  return o.coat + (o.sex ? ' ' + sexIcon(o.sex) : '');
}

function newOrder() {
  const bonus = 1 + 0.2 * up('board');
  const best = living().reduce((m, c) => Math.max(m, c.origin), 0);
  const o = { id: S.orderSeq++, expires: S.year + 3 + Math.floor(rnd() * 3) };
  const dnaSteps = [5, 10, 20, 30, 45].filter((t) => t <= best * 1.15);
  if (dnaSteps.length && chance(0.25)) {
    o.kind = 'dna';
    o.min = pick(dnaSteps);
    o.reward = Math.round((12 + o.min * 1.4) * bonus);
  } else {
    const weights = [6, 4, 2, 1];
    const pool = DEX.flatMap((d) => Array(weights[d.ph.rarity]).fill(d));
    const d = pick(pool);
    o.kind = 'coat';
    o.coat = d.name;
    o.sex = d.sexes.size > 1 && chance(0.35) ? pick(['F', 'M']) : null;
    o.reward = Math.round(([10, 18, 32, 60][d.ph.rarity] + (o.sex ? 6 : 0)) * bonus);
  }
  return o;
}

function fillOrders() {
  const n = 3 + up('board');
  while (S.orders.length < n) S.orders.push(newOrder());
}

function fits(o, c) {
  if (!c.alive) return false;
  if (o.kind === 'dna') return c.origin >= o.min;
  return phenotype(c).name === o.coat && (!o.sex || c.sex === o.sex);
}

function adopt(catId, orderId) {
  const c = S.cats[catId];
  const o = S.orders.find((x) => x.id === orderId);
  if (!c || !o || !fits(o, c)) return;
  c.alive = false;
  c.adopted = S.year;
  delete S.matches[c.id];
  S.orders = S.orders.filter((x) => x !== o);
  S.legacy += o.reward;
  S.ordersDone = (S.ordersDone || 0) + 1;
  fillOrders();
  S.log[S.log.length - 1]?.lines.push({ t: 'info', s: `${c.name} was adopted for ${orderLabel(o)} (+${o.reward} fish)` });
  checkOver();
  save();
  closeModal();
  render();
  gainFish(o.reward, $('orders'));
  sfx.cash();
  toast(`\u{1F3E0} ${c.name} found a home! +${o.reward} \u{1F41F}`);
  if (S.over) { setAuto(false); setTimeout(showEnd, 900); }
}

/* ---------- Fish, saving ---------- */

function gainFish(n, near) {
  META.fish += n;
  S.fishEarned = (S.fishEarned || 0) + n;
  saveMeta();
  fishBadge(true);
  if (near) floatText(near, `+${n} \u{1F41F}`, 'fish');
}

function fishBadge(bump) {
  $('fish-val').textContent = META.fish;
  if (bump) {
    const b = $('fish');
    b.classList.remove('bump');
    void b.offsetWidth;
    b.classList.add('bump');
  }
}

function floatText(el, text, cls) {
  const r = el.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'float ' + (cls || '');
  f.textContent = text;
  f.style.left = r.left + r.width / 2 + 'px';
  f.style.top = r.top + Math.min(r.height / 2, 60) + 'px';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1300);
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveMeta() {
  try { localStorage.setItem(META_KEY, JSON.stringify(META)); } catch (e) { /* ignore */ }
}

function loadMeta() {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(META_KEY) || 'null'); } catch (e) { /* ignore */ }
  return Object.assign({ fish: 0, up: {}, dex: {}, best: 0, bestCombo: 0, runs: 0 }, m || {});
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

function tone(freq, dur, type = 'square', vol = 0.05, slideTo, delay = 0) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
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

// Pitch climbs with the combo, so a streak literally sounds like it is going up.
const comboPitch = () => Math.pow(2, Math.min(S.combo, 24) / 24);

const sfx = {
  tick: () => tone(880, 0.05, 'square', 0.03),
  year: () => { tone(523, 0.1); tone(659, 0.1, 'square', 0.05, null, 0.09); tone(784, 0.18, 'square', 0.05, null, 0.18); },
  death: () => tone(330, 0.6, 'triangle', 0.07, 110),
  birth: () => meow(1.5 + rnd() * 0.4),
  cash: () => { tone(988, 0.08, 'square', 0.05); tone(1319, 0.25, 'square', 0.05, null, 0.08); },
  grade(g) {
    const p = comboPitch();
    if (g === 'perfect') [0, 4, 7, 12].forEach((n, i) => tone(523 * p * Math.pow(2, n / 12), 0.14, 'square', 0.05, null, i * 0.05));
    else if (g === 'great') [0, 7].forEach((n, i) => tone(523 * p * Math.pow(2, n / 12), 0.14, 'square', 0.05, null, i * 0.06));
    else if (g === 'good') tone(440 * p, 0.12, 'square', 0.04);
    else tone(160, 0.3, 'sawtooth', 0.05, 90);
  },
  rare(r) {
    const notes = [[], [0, 7], [0, 4, 7], [0, 4, 7, 11, 14], [0, 4, 7, 12, 16, 19, 24]][r];
    notes.forEach((n, i) => tone(392 * Math.pow(2, n / 12), 0.22, 'triangle', 0.07, null, 0.1 + i * 0.08));
  }
};

/* ---------- Rendering ---------- */

function stats() {
  const alive = living();
  const founder = S.cats[S.founderId];
  const genomes = alive.reduce((s, c) => s + c.origin, 0) / 100;
  const carriers = alive.filter((c) => c.origin > 0).length;
  const line = founder.sex === 'F'
    ? ['Mito line', alive.some((c) => c.mt === 1)]
    : ['Y line', alive.some(hasOriginY)];
  $('stats').innerHTML = `
    <div class="stat lead"><span>year</span><b>${S.year}</b></div>
    <div class="stat lead"><span>legacy</span><b>${S.legacy}</b></div>
    <div class="stat"><span>best</span><b>${Math.max(META.best, S.legacy)}</b></div>
    <div class="stat"><span>combo</span><b class="${S.combo >= 5 ? 'hot' : ''}">x${S.combo}</b></div>
    <div class="stat"><span>yard</span><b>${alive.length}/${yardSize()}</b></div>
    <div class="stat"><span>carriers</span><b class="gold">${carriers}</b></div>
    <div class="stat" title="Total origin DNA in the yard, counted in whole ${esc(founder.name)}s. Each year it adds to your legacy."><span>${esc(founder.name)} DNA</span><b class="gold">${genomes.toFixed(2)}&times;</b></div>
    <div class="stat" title="${founder.sex === 'F' ? 'Mitochondria pass only from mothers to kittens' : 'The Y chromosome passes only from fathers to sons'}"><span>${line[0]}</span><b class="${line[1] ? 'ok' : 'gone'}">${line[1] ? 'ALIVE' : 'LOST'}</b></div>
    <div class="stat"><span>love letters</span><b class="pink">${'&#128152;'.repeat(Math.max(0, lettersLeft())) || '&mdash;'}</b></div>`;
}

function card(c) {
  const ph = phenotype(c);
  const st = stageOf(c.age);
  const founder = c.id === S.founderId;
  const badges = [];
  if (c.mt === 1) badges.push('<b title="carries the founder\'s mitochondria">&#9678;</b>');
  if (hasOriginY(c)) badges.push('<b title="carries the founder\'s Y chromosome">&#9794;Y</b>');
  const wanted = S.orders.some((o) => fits(o, c));
  const match = S.matches[c.id];
  const div = document.createElement('div');
  div.className = `cat-card r${ph.rarity}${founder ? ' founder' : ''}${c.origin > 0 ? '' : ' none'}${c.shiny ? ' shiny' : ''}${wanted ? ' wanted' : ''}`;
  div.dataset.id = c.id;
  let action = '';
  if (match) action = `<div class="matched">&#128152; ${esc(match.suitor ? match.suitor.name : S.cats[match.tom].name)}</div>`;
  else if (canMatch(c) && lettersLeft() > 0) action = '<button class="px-btn love-btn" type="button">&#128152; MATCH</button>';
  div.innerHTML = `
    ${founder ? '<span class="crown" title="founder">&#128081;</span>' : ''}
    ${wanted ? '<span class="wanted-tag" title="an order wants this cat">&#128203;</span>' : ''}
    <div class="cc-sprite"><img class="st-${st}" src="${sprite(c)}" alt=""></div>
    <div class="cc-name"><span class="sex-${c.sex}">${sexIcon(c.sex)}</span> ${esc(c.name)}</div>
    <div class="cc-meta"><span class="cc-age">${c.age}</span> y &middot; <span class="cc-stage">${st}</span><br><span class="rc${c.shiny ? 4 : ph.rarity}">${c.shiny ? '&#10024;' : ''}${ph.name}</span></div>
    <div class="dna-bar" title="origin DNA"><i style="width:${c.origin}%"></i><span>${pct(c.origin)}</span></div>
    <div class="badges">${badges.join(' ')}</div>
    ${action}`;
  div.addEventListener('click', (e) => {
    if (e.target.closest('.love-btn')) openMatch(c.id);
    else openCat(c.id);
  });
  return div;
}

function sortCats(list) {
  const by = $('sort').value;
  const f = {
    dna: (a, b) => b.origin - a.origin || b.age - a.age,
    age: (a, b) => b.age - a.age || b.origin - a.origin,
    rarity: (a, b) => rarityOf(b) - rarityOf(a) || b.origin - a.origin,
    gen: (a, b) => a.gen - b.gen || b.origin - a.origin
  }[by];
  return list.sort(f);
}

function renderOrders() {
  $('orders').innerHTML = S.orders.map((o) => {
    const ready = living().filter((c) => fits(o, c)).length;
    const pic = o.kind === 'dna'
      ? '<div class="order-dna">&#129516;</div>'
      : `<img src="${coatSprite(o.coat)}" alt="">`;
    const left = o.expires - S.year + 1;
    const r = o.kind === 'dna' ? 2 : DEX_BY_NAME[o.coat].ph.rarity;
    return `<button class="order${ready ? ' ready' : ''}" type="button" data-order="${o.id}">
      ${pic}
      <div class="order-text"><b class="rc${r}">${esc(orderLabel(o))}</b><span>${ready ? `${ready} ready!` : 'none yet'} &middot; ${left}y left</span></div>
      <div class="order-reward">+${o.reward}<br>&#128031;</div>
    </button>`;
  }).join('');
  $('orders').querySelectorAll('[data-order]').forEach((b) => b.addEventListener('click', () => openOrder(+b.dataset.order)));
}

function render(born = new Set()) {
  stats();
  renderOrders();
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
  fishBadge();
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
  $('yf-legacy').textContent = ev.legacy ? `+${ev.legacy} legacy` : '';
  $('months').innerHTML = Array.from({ length: 12 }, (_, i) => `<i style="animation-delay:${i * 50}ms"></i>`).join('');
  fx.hidden = false;
  for (let i = 0; i < 12; i++) setTimeout(sfx.tick, i * 50);
  setTimeout(sfx.year, 640);

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
    }, 250 + Math.min(i * 20, 500));
  });
  await sleep(1150);
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
      await sleep(140);
    }
    await sleep(1100);
  }

  // 4. the new litters are revealed one kitten at a time
  if (ev.born.length) await reveal(ev);
  save();

  render(new Set(ev.born));
  ev.born.slice(0, 4).forEach((_, i) => setTimeout(sfx.birth, 200 + i * 160));
  if (ev.born.length) hearts();

  busy = false;
  $('age-btn').disabled = !!S.over;
  if (S.over) {
    setAuto(false);
    setTimeout(showEnd, 1300);
  } else if (auto) {
    autoTimer = setTimeout(ageUp, 700);
  }
}

let auto = false;
let autoTimer = null;

function setAuto(on) {
  auto = on && !S.over;
  clearTimeout(autoTimer);
  const b = $('auto-btn');
  b.innerHTML = auto ? '&#10074;&#10074; STOP' : '&#9654; AUTO';
  b.setAttribute('aria-pressed', auto);
  b.classList.toggle('on', auto);
  if (auto && !busy) ageUp();
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

/* ---------- Kitten reveal: the purr meter ---------- */

// Scores one kitten: the grade sets the multiplier, the combo, and the shiny roll.
function scoreKitten(kit, grade) {
  const g = GRADES[grade];
  if (grade === 'perfect' || grade === 'great') S.combo++;
  else if (grade === 'miss') S.combo = 0;
  S.bestCombo = Math.max(S.bestCombo || 0, S.combo);
  META.bestCombo = Math.max(META.bestCombo || 0, S.combo);
  kit.shiny = chance((1 / 110) * g.shiny * Math.pow(2, up('charm')));
  kit.grade = grade;
  const ph = phenotype(kit);
  const r = rarityOf(kit);
  const combo = grade === 'auto' ? 1 : 1 + Math.min(S.combo, 20) * 0.1;
  let fish = Math.max(1, Math.round(RARITY_FISH[r] * g.mult * combo * (1 + 0.25 * up('magnet'))));
  const had = META.dex[ph.name] || 0;
  const now = kit.shiny ? 2 : 1;
  const newDex = !had;
  const newShiny = kit.shiny && had < 2;
  if (now > had) META.dex[ph.name] = now;
  if (newDex) fish += 20;
  if (newShiny) fish += 50;
  return { fish, r, ph, newDex, newShiny };
}

function meterZone() {
  const w = 1 + 0.15 * up('zone');
  return { center: 0.2 + rnd() * 0.6, perfect: 0.025 * w, great: 0.07 * w, good: 0.14 * w };
}

function gradeAt(pos, z) {
  const d = Math.abs(pos - z.center);
  return d <= z.perfect ? 'perfect' : d <= z.great ? 'great' : d <= z.good ? 'good' : 'miss';
}

// Runs the meter until the player taps. Speed rises with the combo, so streaks get harder.
function playMeter(z) {
  return new Promise((resolve) => {
    const zone = $('rv-zone');
    zone.style.left = (z.center - z.good) * 100 + '%';
    zone.style.width = z.good * 200 + '%';
    zone.style.setProperty('--great', (z.great / z.good) * 100 + '%');
    zone.style.setProperty('--perfect', (z.perfect / z.good) * 100 + '%');
    const cursor = $('rv-cursor');
    const speed = Math.min(0.55 + S.combo * 0.045, 1.5);
    let phase = rnd() * 2;
    let last = performance.now();
    let pos = 0;
    let raf = 0;
    const frame = (now) => {
      phase += ((now - last) / 1000) * speed * 2;
      last = now;
      pos = Math.abs((phase % 2) - 1);
      cursor.style.left = pos * 100 + '%';
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const done = (grade) => {
      cancelAnimationFrame(raf);
      $('reveal').removeEventListener('pointerdown', onTap);
      document.removeEventListener('keydown', onKey);
      $('rv-skip').removeEventListener('click', onSkip);
      resolve(grade);
    };
    const onTap = (e) => {
      if (e.target.closest('#rv-skip')) return;
      e.preventDefault();
      done(gradeAt(pos, z));
    };
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); done(gradeAt(pos, z)); }
    };
    const onSkip = () => done('skip');
    $('reveal').addEventListener('pointerdown', onTap);
    document.addEventListener('keydown', onKey);
    $('rv-skip').addEventListener('click', onSkip);
  });
}

async function reveal(ev) {
  let total = 0;
  const news = [];
  if (auto) {
    for (const id of ev.born) {
      const res = scoreKitten(S.cats[id], 'auto');
      total += res.fish;
      if (res.newDex) news.push(res.ph.name);
    }
    gainFish(total, $('colony'));
    if (news.length) toast(`\u{1F4D6} New in Catdex: ${news.join(', ')}`);
    return;
  }

  const box = $('reveal');
  box.hidden = false;
  let skipping = false;
  let count = 0;
  for (const l of ev.litters) {
    const mom = S.cats[l.mom];
    const dad = S.cats[l.dad];
    $('rv-parents').innerHTML = `${esc(mom.name)} <span class="pink">&#9792;</span> &times; <span class="blue">&#9794;</span> ${esc(dad.name)}`;
    for (const id of l.kits) {
      const kit = S.cats[id];
      count++;
      $('rv-count').textContent = `${count}/${ev.born.length}`;
      $('rv-combo').innerHTML = S.combo ? `COMBO <b>x${S.combo}</b>` : '';
      $('rv-combo').className = 'rv-combo' + (S.combo >= 10 ? ' fire' : S.combo >= 5 ? ' hot' : '');
      const stage = $('rv-stage');
      stage.className = 'rv-stage waiting';
      $('rv-cat').hidden = true;
      $('rv-info').innerHTML = '&nbsp;';
      $('rv-grade').textContent = '';
      $('rv-meter').hidden = skipping;

      let grade = skipping ? 'skip' : await playMeter(meterZone());
      if (grade === 'skip') { skipping = true; grade = 'auto'; }
      const res = scoreKitten(kit, grade);
      total += res.fish;
      if (res.newDex) news.push(res.ph.name);

      // pop the basket open
      $('rv-meter').hidden = true;
      stage.className = `rv-stage open r${res.r}${kit.shiny ? ' shiny' : ''}`;
      const img = $('rv-cat');
      img.src = sprite(kit);
      img.hidden = false;
      $('rv-grade').textContent = GRADES[grade].label;
      $('rv-grade').className = 'rv-grade g-' + grade;
      $('rv-info').innerHTML = `<b class="sex-${kit.sex}">${sexIcon(kit.sex)}</b> ${esc(kit.name)} &middot; <span class="rc${res.r}">${kit.shiny ? '&#10024; SHINY ' : ''}${res.ph.name}</span>
        <br><span class="rc${res.r}">${RARITY[res.r]}</span> &middot; <span class="gold">${pct(kit.origin)} DNA</span> &middot; <b class="gold">+${res.fish} &#128031;</b>
        ${res.newDex ? '<div class="new-dex">NEW IN CATDEX!</div>' : ''}${res.newShiny ? '<div class="new-dex">FIRST SHINY!</div>' : ''}`;
      if (!skipping) {
        sfx.grade(grade);
        if (res.r >= 2) sfx.rare(res.r);
        if (res.r >= 3) document.body.classList.add('flash');
        setTimeout(() => document.body.classList.remove('flash'), 400);
        floatText($('rv-cat'), `+${res.fish}`, 'fish');
        await sleep(res.r >= 3 || res.newDex ? 1100 : 650);
      }
    }
  }
  if (skipping) await sleep(300);
  box.hidden = true;
  gainFish(total);
  saveMeta();
  if (news.length) toast(`\u{1F4D6} New in Catdex: ${news.join(', ')}`);
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
    : c.adopted != null ? `adopted out in year ${c.adopted}, aged ${c.age}` : `died in year ${c.diedAt}, aged ${c.age}`;
  const sexChr = c.sex === 'F'
    ? `<div class="chr">X &middot; from mom${chrRow(c.sexc[0])}X &middot; from dad${chrRow(c.sexc[1])}</div>`
    : `<div class="chr">X &middot; from mom${chrRow(c.sexc[0])}Y &middot; from dad${chrRow(c.sexc[1], 'y')}</div>`;
  const kids = c.kids.map((k) => catLink(k)).join('');
  const orders = c.alive ? S.orders.filter((o) => fits(o, c)) : [];
  const r = rarityOf(c);
  openModal(`
    <div class="detail-head${c.alive ? '' : ' dead'}">
      <img src="${sprite(c)}" alt="" class="${c.shiny ? 'shiny' : ''}">
      <div>
        <div class="detail-name"><span class="sex-${c.sex}">${sexIcon(c.sex)}</span> ${esc(c.name)} ${founder ? '&#128081;' : ''}</div>
        <div class="detail-sub">${status}<br><span class="rc${r}">${c.shiny ? '&#10024; shiny ' : ''}${ph.name} &middot; ${RARITY[r].toLowerCase()}</span><br>generation ${c.gen} &middot; born year ${c.born}</div>
      </div>
    </div>
    ${orders.map((o) => `<button class="px-btn adopt-btn" type="button" data-adopt="${o.id}">&#127969; ADOPT OUT: ${esc(orderLabel(o))} &middot; +${o.reward} &#128031;</button>`).join('')}
    ${c.alive && canMatch(c) && !S.matches[c.id] && lettersLeft() > 0 ? '<button class="px-btn adopt-btn love" type="button" id="detail-match">&#128152; FIND HER A MATCH</button>' : ''}
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
  $('modal-body').querySelectorAll('[data-adopt]').forEach((b) => b.addEventListener('click', () => adopt(c.id, +b.dataset.adopt)));
  if ($('detail-match')) $('detail-match').addEventListener('click', () => openMatch(c.id));
}

function openOrder(oid) {
  const o = S.orders.find((x) => x.id === oid);
  if (!o) return;
  const cats = living().filter((c) => fits(o, c)).sort((a, b) => a.origin - b.origin);
  const rows = cats.map((c) => `<button class="pick-row" type="button" data-adopt-cat="${c.id}">
      <img src="${sprite(c)}" alt=""><span><b class="sex-${c.sex}">${sexIcon(c.sex)}</b> ${esc(c.name)}, ${c.age}y<br><small class="gold">${pct(c.origin)} origin DNA${c.origin > 0 ? ' leaves with them' : ''}</small></span>
      <b class="order-reward">+${o.reward} &#128031;</b></button>`).join('');
  openModal(`<h2>&#128203; ORDER</h2>
    <div class="order-head">${o.kind === 'dna' ? '<div class="order-dna">&#129516;</div>' : `<img src="${coatSprite(o.coat)}" alt="">`}
      <div><div class="detail-name">${esc(orderLabel(o))}</div><div class="detail-sub">pays <b class="gold">${o.reward} fish</b> and as much legacy &middot; ${o.expires - S.year + 1} years left</div></div></div>
    <p class="dim">${cats.length ? 'Pick a cat to adopt out. It leaves the yard for a good home (and takes its DNA along).' : o.kind === 'dna' ? 'No cat has that much origin DNA right now. Pair your best carriers with each other!' : 'No cat fits yet. Use love letters to breed one: check the coat genes and the Gene Scanner odds.'}</p>
    <div class="pick-list">${rows}</div>`);
  $('modal-body').querySelectorAll('[data-adopt-cat]').forEach((b) => b.addEventListener('click', () => adopt(+b.dataset.adoptCat, o.id)));
}

// Simulates many kittens of a pair to show what coats they can have.
function coatOdds(mom, dad, n = 240) {
  const counts = new Map();
  let dna = 0;
  for (let i = 0; i < n; i++) {
    const k = conceive(mom, dad);
    const name = phenotype(k).name;
    counts.set(name, (counts.get(name) || 0) + 1);
    dna += originPct(k);
  }
  return {
    coats: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, c]) => ({ name, p: c / n })),
    dna: dna / n
  };
}

function openMatch(qid) {
  const q = S.cats[qid];
  if (!canMatch(q) || lettersLeft() <= 0) return;
  if (!S.suitors[qid]) S.suitors[qid] = [0, 1, 2].map(() => strayCat('M'));
  const toms = living()
    .filter((c) => c.sex === 'M' && c.age + 1 >= 1 && c.age + 1 <= 14 && !closeKin(c, q))
    .sort((a, b) => b.origin - a.origin)
    .slice(0, 3);
  const options = [...S.suitors[qid].map((s) => ({ cat: s, suitor: true })), ...toms.map((t) => ({ cat: t, suitor: false }))];
  const wantedCoats = new Set(S.orders.filter((o) => o.kind === 'coat').map((o) => o.coat));
  const scan = up('scanner') > 0;
  const rows = options.map((opt, i) => {
    const d = opt.cat;
    const odds = coatOdds(q, d);
    const coats = scan
      ? odds.coats.slice(0, 5).map((x) => `<span class="odd${wantedCoats.has(x.name) ? ' want' : ''}">${wantedCoats.has(x.name) ? '&#128203;' : ''}${esc(x.name)} ${Math.round(x.p * 100)}%</span>`).join('')
      : '<span class="odd locked">&#128300; coat odds: buy the Gene Scanner</span>';
    return `<div class="suitor">
      <img src="${sprite(d)}" alt="">
      <div class="suitor-text">
        <b>${opt.suitor ? 'stray' : 'family'} &#9794; ${esc(d.name)}</b> <span class="dim">${d.age}y &middot; ${phenotype(d).name}</span>
        <div class="dim">kittens' DNA &asymp; <b class="gold">${pct(odds.dna)}</b>${opt.suitor ? '' : ` &middot; his ${pct(d.origin)}`}</div>
        <div class="odds">${coats}</div>
      </div>
      <button class="px-btn" type="button" data-pick="${i}">&#128152; MATCH</button>
    </div>`;
  }).join('');
  openModal(`<h2>&#128152; MATCHMAKER</h2>
    <div class="order-head"><img src="${sprite(q)}" alt=""><div><div class="detail-name"><span class="pink">&#9792;</span> ${esc(q.name)}</div>
    <div class="detail-sub">${phenotype(q).name} &middot; ${q.age}y &middot; <span class="gold">${pct(q.origin)} DNA</span><br>A match guarantees her a litter next year. ${lettersLeft()} letter${lettersLeft() > 1 ? 's' : ''} left.</div></div></div>
    <div class="suitors">${rows}</div>`);
  $('modal-body').querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
    const opt = options[+b.dataset.pick];
    S.matches[qid] = opt.suitor ? { suitor: opt.cat } : { tom: opt.cat.id };
    save();
    closeModal();
    render();
    meow(1.2);
    toast(`\u{1F498} ${q.name} ♥ ${opt.cat.name}`);
  }));
}

function openShop() {
  const rows = UPGRADES.map((u) => {
    const lvl = up(u.id);
    const max = u.cost.length;
    const cost = u.cost[lvl];
    const pips = Array.from({ length: max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
    return `<div class="shop-row">
      <div class="shop-icon">${u.icon}</div>
      <div class="shop-text"><b>${u.name}</b><span>${u.desc}</span><div class="pips">${pips}</div></div>
      ${lvl >= max ? '<span class="maxed">MAX</span>' : `<button class="px-btn" type="button" data-buy="${u.id}" ${META.fish < cost ? 'disabled' : ''}>${cost} &#128031;</button>`}
    </div>`;
  }).join('');
  openModal(`<h2>&#128722; CAT SHOP</h2>
    <p class="dim">Upgrades are kept forever, for every family you raise. You have <b class="gold">${META.fish} &#128031;</b>.</p>
    <div class="shop">${rows}</div>`);
  $('modal-body').querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
    const u = UPGRADES.find((x) => x.id === b.dataset.buy);
    const cost = u.cost[up(u.id)];
    if (META.fish < cost) return;
    META.fish -= cost;
    META.up[u.id] = up(u.id) + 1;
    saveMeta();
    sfx.cash();
    sfx.rare(2);
    toast(`${u.name} level ${up(u.id)}!`);
    if (u.id === 'board' && S && S.founderId && !S.over) fillOrders();
    openShop();
    if (S && S.founderId && !$('game').hidden) render();
    fishBadge(true);
  }));
}

function openDex() {
  const found = DEX.filter((d) => META.dex[d.name]).length;
  const shinies = DEX.filter((d) => META.dex[d.name] === 2).length;
  const cells = DEX.map((d) => {
    const got = META.dex[d.name] || 0;
    return `<div class="dex-cell${got ? '' : ' unknown'}${got === 2 ? ' shiny' : ''}">
      <img src="${coatSprite(d.name)}" alt="">
      <b class="rc${d.ph.rarity}">${got ? esc(d.name) : '???'}</b>
      <small>${RARITY[d.ph.rarity].toLowerCase()}${d.sexes.size === 1 ? ' &middot; &#9792; only' : ''}${got === 2 ? ' &middot; &#10024;' : ''}</small>
    </div>`;
  }).join('');
  openModal(`<h2>&#128214; CATDEX</h2>
    <p class="dim">${found}/${DEX.length} coats found &middot; ${shinies} shiny. A new coat pays 20 &#128031;, a first shiny 50 &#128031;.</p>
    <div class="dex">${cells}</div>`);
}

function openHelp() {
  openModal(`<div class="help">
    <h2>HOW TO PLAY</h2>
    <p>You chose one cat: the <b class="gold">founder</b>. All of its DNA is <b class="gold">origin DNA</b>. Every year the origin DNA in your yard adds to your <b class="gold">legacy</b> score. Keep it alive as long as you can.</p>
    <h3>THE LOOP</h3>
    <ul>
      <li><b>&#127874; Age everyone</b>: cats grow, some die, litters arrive.</li>
      <li><b>&#128062; Purr meter</b>: every kitten comes in a basket. Tap (or press space) when the paw is in the gold. PERFECT and GREAT build your combo, which multiplies fish and speeds the meter up. A MISS breaks it. Good timing makes shiny kittens likelier.</li>
      <li><b>&#128152; Love letters</b>: pick a mate for a queen. Her litter next year is guaranteed. Match carriers with carriers to keep DNA, or strays to breed coats.</li>
      <li><b>&#128203; Orders</b>: people want certain cats. Adopt one out for fish and legacy, but it takes its DNA with it.</li>
      <li><b>&#128722; Shop</b>: fish buy upgrades that last forever. <b>&#128214; Catdex</b>: collect all ${DEX.length} coats, and their shinies.</li>
    </ul>
    <h3>DNA, LIKE THE REAL THING</h3>
    <ul>
      <li>18 chromosome pairs plus XX (&#9792;) or XY (&#9794;). One copy of each pair from mom, one from dad, shuffled by crossing over. A 50% cat can have 40% or 60% kittens, and some get none.</li>
      <li><span class="pink">&#9792; Mothers</span> pass a mixed X and their mitochondria to every kitten. <span class="blue">&#9794; Fathers</span> pass their X whole to daughters and their Y only to sons, and roam to sire more litters.</li>
      <li>Coat genes: Orange on X (O), tabby (A), white spots (S), dilute (d d makes blue and cream). Orange on X is why calicos are girls.</li>
      <li>Cats breed from 1. Queens stop near 12, toms near 16. Death risk climbs with age. The yard holds about ${yardSize()} cats.</li>
    </ul>
    <h3>THE END</h3>
    <p>The family ends when no cat in the yard carries any origin DNA, or when you press END &amp; TREE. Legacy pays out as fish, and the family tree shows every cat that ever lived.</p>
    <div class="end-actions"><button id="restart-btn" class="px-btn" type="button">NEW FAMILY</button></div>
  </div>`);
  $('restart-btn').addEventListener('click', () => {
    if (!S || !S.founderId || S.over || confirm('Start over with a new cat? This family will be lost.')) newGame();
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
  let payout = 0;
  let newBest = false;
  if (!S.paid) {
    payout = Math.round(S.legacy / 10);
    newBest = S.legacy > META.best;
    META.best = Math.max(META.best, S.legacy);
    META.runs++;
    META.fish += payout;
    S.paid = { payout, newBest };
    saveMeta();
    save();
    if (payout) sfx.rare(newBest ? 4 : 2);
  } else ({ payout, newBest } = S.paid);
  openModal(`<div class="end">
    <h1 class="big">THE END</h1>
    <p>${esc(S.over ? S.over.why : 'You closed the book on this family.')}</p>
    <div class="legacy-big">LEGACY <b>${S.legacy}</b>${newBest ? '<span class="new-dex">NEW BEST!</span>' : `<small>best ${META.best}</small>`}</div>
    <div class="end-stats">
      <div class="stat"><span>fish payout</span><b class="gold">+${payout} &#128031;</b></div>
      <div class="stat"><span>years</span><b>${S.year}</b></div>
      <div class="stat"><span>cats in the family</span><b>${fam.length}</b></div>
      <div class="stat"><span>generations</span><b>${maxGen + 1}</b></div>
      <div class="stat"><span>best combo</span><b>x${S.bestCombo || 0}</b></div>
      <div class="stat"><span>orders filled</span><b>${S.ordersDone || 0}</b></div>
      <div class="stat"><span>peak ${esc(founder.name)} DNA</span><b class="gold">${(S.peak || 1).toFixed(2)}&times;</b></div>
      <div class="stat"><span>oldest</span><b>${esc(oldest.name)}, ${oldest.age}</b></div>
    </div>
    <div class="end-actions">
      <button id="end-tree" class="px-btn" type="button">&#127795; FAMILY TREE</button>
      <button id="end-shop" class="px-btn" type="button">&#128722; SHOP</button>
      <button id="end-new" class="px-btn age-btn" type="button">NEW FAMILY &#9654;</button>
    </div>
  </div>`);
  fishBadge(true);
  $('end-tree').addEventListener('click', () => { closeModal(); openTree(); });
  $('end-shop').addEventListener('click', openShop);
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
  byGen.forEach((row) => {
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
    const gone = !c.alive && c.adopted == null;
    const cls = ['tnode', gone ? 'dead' : '', c.adopted != null ? 'adopted' : '', c.origin > 0 ? 'carrier' : '', c.id === S.founderId ? 'founder' : '', c.shiny ? 'shiny' : ''].join(' ');
    const mark = c.alive ? '' : c.adopted != null ? '&#127969;' : '&#10013;';
    nodes += `<div class="${cls}" data-cat="${c.id}" style="left:${px(c)}px;top:${py(c)}px" title="${esc(c.name)}, ${esc(phenotype(c).name)}">
      <img src="${sprite(c)}" alt=""><b><span class="sex-${c.sex}">${sexIcon(c.sex)}</span>${mark}${esc(c.name)}</b><small>${pct(c.origin)}</small></div>`;
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
  return {
    year: 0, cats: {}, nextId: 1, nameCount: {}, log: [], founderId: null, over: null, peak: 1,
    legacy: 0, combo: 0, bestCombo: 0, matches: {}, suitors: {}, orders: [], orderSeq: 1, ordersDone: 0
  };
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
      <div class="fdesc"><span class="rc${ph.rarity}">${ph.name}</span>, 2 years<br>${perk}</div><div class="fpick">PICK ME</div>`;
    b.addEventListener('click', () => chooseFounder(i));
    $('founders').appendChild(b);
  });
  const found = DEX.filter((d) => META.dex[d.name]).length;
  $('meta-line').innerHTML = `&#128031; ${META.fish} fish &middot; best legacy ${META.best} &middot; best combo x${META.bestCombo || 0} &middot; &#128214; ${found}/${DEX.length} coats`;
}

function chooseFounder(i) {
  const c = founders[i];
  S.cats = { [c.id]: c };
  S.founderId = c.id;
  const ph = phenotype(c);
  if (!META.dex[ph.name]) { META.dex[ph.name] = 1; saveMeta(); }
  fillOrders();
  meow(1.1);
  save();
  start();
}

function newGame() {
  if (S && S.founderId) setAuto(false);
  closeModal();
  $('tree').hidden = true;
  $('game').hidden = true;
  $('footer').hidden = true;
  spriteCache.clear();
  phenoCache.clear();
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
$('auto-btn').addEventListener('click', () => setAuto(!auto));
$('retire-btn').addEventListener('click', () => {
  setAuto(false);
  if (busy) return;
  if (!S.over && !confirm('End this family here, cash in the legacy and see the whole tree?')) return;
  if (!S.over) { S.over = { year: S.year, why: 'You closed the book on this family.' }; save(); }
  $('age-btn').disabled = true;
  showEnd();
});
$('reroll-btn').addEventListener('click', () => { spriteCache.clear(); phenoCache.clear(); rollFounders(); });
$('splash-shop').addEventListener('click', openShop);
$('splash-dex').addEventListener('click', openDex);
$('fish').addEventListener('click', openShop);
$('shop-btn').addEventListener('click', openShop);
$('dex-btn').addEventListener('click', openDex);
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

META = loadMeta();
fishBadge();
S = load();
if (S && S.founderId && S.cats[S.founderId]) start();
else newGame();
