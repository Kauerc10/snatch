(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SnatchCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RULESET = Object.freeze({
    roundMs: 60000,
    cashoutCommitMs: 650,
    bustHeat: 100,
    postBustHeat: 12,
    lockdownMs: 1650,
  });

  const HEAT_BY_RARITY = Object.freeze({ common: 3, rare: 5, epic: 7, mythic: 10, wtf: 14 });

  const ITEMS = Object.freeze([
    ['banana-suit','Banana de Terno','common',120,0.90,'steady','banana'],
    ['wifi-brain','Cérebro Wi-Fi','rare',260,0.82,'wave','brain'],
    ['exec-frog','Sapo Executivo','rare',310,0.78,'dash','frog'],
    ['radio-duck','Pato Radioativo','epic',560,0.72,'wave','duck'],
    ['legend-chair','Cadeira Lendária','common',150,1.15,'steady','chair'],
    ['sus-egg','Ovo Suspeito','common',105,0.70,'float','egg'],
    ['clt-rock','Pedra CLT','rare',285,1.35,'steady','rock'],
    ['imperial-capy','Capivara Imperial','mythic',1250,1.20,'float','capy'],
    ['turbo-toaster','Torradeira Turbo','common',135,1.05,'steady','toaster'],
    ['legal-pigeon','Pombo Jurídico','rare',330,0.76,'dash','pigeon'],
    ['pixel-cactus','Cacto Pixel','common',115,0.88,'wave','cactus'],
    ['moon-sock','Meia Lunar','rare',245,0.65,'float','sock'],
    ['tax-crown','Coroa do Imposto','epic',620,0.90,'dash','crown'],
    ['disco-potato','Batata Disco','common',145,0.78,'wave','potato'],
    ['quantum-mug','Caneca Quântica','epic',690,0.84,'float','mug'],
    ['ceo-slime','Geleca CEO','rare',355,0.95,'wave','slime'],
    ['panic-lamp','Luminária em Pânico','common',130,1.08,'steady','lamp'],
    ['forbidden-remote','Controle Proibido','epic',740,0.72,'dash','remote'],
    ['cosmic-sandal','Chinelo Cósmico','mythic',1360,0.82,'wave','sandal'],
    ['printer-goblin','Goblin da Impressora','rare',390,1.02,'dash','goblin'],
    ['golden-garlic','Alho Dourado','epic',810,0.74,'float','garlic'],
    ['night-bread','Pão Noturno','common',160,0.92,'steady','bread'],
    ['portal-kettle','Chaleira Portal','mythic',1480,1.18,'wave','kettle'],
    ['boss-crab','Caranguejo Gerente','rare',420,1.12,'steady','crab'],
    ['ghost-keyboard','Teclado Fantasma','epic',860,1.26,'float','keyboard'],
    ['meteor-cookie','Cookie Meteoro','rare',450,0.68,'dash','cookie'],
    ['oracle-bucket','Balde Oráculo','mythic',1620,1.30,'float','bucket'],
    ['void-rubberduck','Patinho do Vazio','wtf',3200,0.62,'dash','voidduck'],
    ['reality-fork','Garfo da Realidade','wtf',3600,0.58,'wave','fork'],
    ['infinite-capy','Capivara Infinita','wtf',4200,1.05,'float','infcapy'],
  ].map(([id, displayName, rarity, baseValue, weight, movementProfile, icon]) => ({ id, displayName, rarity, baseValue, weight, movementProfile, icon })));

  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createRng(seed) {
    const seedFn = xmur3(String(seed));
    return mulberry32(seedFn());
  }

  function multiplierForChain(chain) {
    if (chain >= 15) return 16;
    if (chain >= 10) return 8;
    if (chain >= 6) return 4;
    if (chain >= 3) return 2;
    return 1;
  }

  function createState(overrides) {
    return Object.assign({
      phase: 'playing', elapsedMs: 0, banked: 0, bag: 0, heat: 0,
      greedChain: 0, multiplier: 1, busts: 0, grabs: 0, misses: 0,
    }, overrides || {});
  }

  function applyBust(state) {
    return Object.assign({}, state, {
      bag: 0,
      heat: RULESET.postBustHeat,
      greedChain: 0,
      multiplier: 1,
      busts: state.busts + 1,
      phase: 'lockdown',
      lockdownUntilMs: (state.elapsedMs || 0) + RULESET.lockdownMs,
    });
  }

  function withHeat(state, amount) {
    const nextHeat = Math.min(100, Math.max(0, state.heat + amount));
    const heated = Object.assign({}, state, { heat: nextHeat });
    return nextHeat >= RULESET.bustHeat ? applyBust(heated) : heated;
  }

  function applySuccessfulGrab(state, item) {
    const earned = Math.round(item.baseValue * state.multiplier);
    const nextChain = state.greedChain + 1;
    const next = Object.assign({}, state, {
      bag: Math.max(0, state.bag + earned),
      greedChain: nextChain,
      multiplier: multiplierForChain(nextChain),
      grabs: (state.grabs || 0) + 1,
      lastEarned: earned,
    });
    return withHeat(next, HEAT_BY_RARITY[item.rarity] || 3);
  }

  function applyMiss(state) {
    return withHeat(Object.assign({}, state, { misses: (state.misses || 0) + 1 }), 8);
  }

  function applyHazard(state) {
    return withHeat(state, 22);
  }

  function completeCashout(state, heldMs) {
    if (heldMs < RULESET.cashoutCommitMs || state.bag <= 0) return Object.assign({}, state);
    return Object.assign({}, state, {
      banked: state.banked + state.bag,
      bag: 0,
      heat: RULESET.postBustHeat,
      greedChain: 0,
      multiplier: 1,
      phase: 'playing',
      cashouts: (state.cashouts || 0) + 1,
    });
  }

  function resolveOneMore(state, success) {
    return Object.assign({}, state, {
      banked: success ? state.banked + state.bag * 2 : state.banked,
      bag: 0,
      phase: 'finished',
      oneMoreSuccess: !!success,
    });
  }

  function hashString(input) {
    const seed = xmur3(input)();
    return seed.toString(16).padStart(8, '0');
  }

  function weightedItem(rng) {
    const roll = rng();
    let pool;
    if (roll < 0.58) pool = ITEMS.filter((x) => x.rarity === 'common');
    else if (roll < 0.83) pool = ITEMS.filter((x) => x.rarity === 'rare');
    else if (roll < 0.95) pool = ITEMS.filter((x) => x.rarity === 'epic');
    else if (roll < 0.992) pool = ITEMS.filter((x) => x.rarity === 'mythic');
    else pool = ITEMS.filter((x) => x.rarity === 'wtf');
    return pool[Math.floor(rng() * pool.length) % pool.length];
  }

  function buildChallenge(challengeId, seed) {
    const rng = createRng(`${challengeId}:${seed}`);
    const spawns = [];
    let atMs = 500;
    let index = 0;
    while (atMs < RULESET.roundMs - 250) {
      const item = weightedItem(rng);
      spawns.push({
        id: `${challengeId}-${index++}`,
        atMs: Math.floor(atMs),
        itemId: item.id,
        lane: Math.floor(rng() * 5),
        motionSeed: Math.floor(rng() * 1e9),
        direction: rng() > 0.5 ? 1 : -1,
      });
      atMs += 780 + rng() * 780;
    }
    const finalCandidates = ITEMS.filter((item) => item.rarity === 'mythic' || item.rarity === 'wtf');
    const finalItem = finalCandidates[Math.floor(rng() * finalCandidates.length) % finalCandidates.length];
    const challenge = {
      challengeId,
      seed,
      roundMs: RULESET.roundMs,
      spawns,
      finalTarget: { itemId: finalItem.id, motionSeed: Math.floor(rng() * 1e9), difficulty: 0.86 },
    };
    challenge.publicHash = hashString(JSON.stringify(challenge));
    return challenge;
  }

  const ARENA_ASPECT = 16 / 9;

  function segmentCircleHit(a, b, c, radius) {
    const abx = b.x - a.x;
    const aby = (b.y - a.y) * ARENA_ASPECT;
    const acx = c.x - a.x;
    const acy = (c.y - a.y) * ARENA_ASPECT;
    const denom = abx * abx + aby * aby;
    const t = denom === 0 ? 0 : Math.max(0, Math.min(1, (acx * abx + acy * aby) / denom));
    const px = a.x + (b.x - a.x) * t;
    const py = a.y + (b.y - a.y) * t;
    const dx = c.x - px;
    const dy = (c.y - py) * ARENA_ASPECT;
    return dx * dx + dy * dy <= radius * radius;
  }

  function itemById(id) { return ITEMS.find((item) => item.id === id); }

  function targetPosition(spawn, elapsedMs) {
    const item = itemById(spawn.itemId) || ITEMS[0];
    const age = Math.max(0, elapsedMs - spawn.atMs);
    const speed = 0.000105 * (1.42 - Math.min(1.35, item.weight) * 0.22);
    const base = spawn.direction > 0 ? -0.14 + age * speed : 1.14 - age * speed;
    const laneY = 0.20 + spawn.lane * 0.095;
    const phase = (spawn.motionSeed % 6283) / 1000;
    let x = base;
    let y = laneY;
    if (item.movementProfile === 'wave') y += Math.sin(age * 0.006 + phase) * 0.035;
    if (item.movementProfile === 'float') y += Math.sin(age * 0.0036 + phase) * 0.055;
    if (item.movementProfile === 'dash') x += Math.sin(age * 0.009 + phase) * 0.028 * spawn.direction;
    return { x, y: Math.max(0.12, Math.min(0.68, y)) };
  }

  function projectionT(shot, point) {
    const abx = shot.end.x - shot.start.x;
    const aby = (shot.end.y - shot.start.y) * ARENA_ASPECT;
    const denom = abx * abx + aby * aby || 1;
    return ((point.x - shot.start.x) * abx + (point.y - shot.start.y) * ARENA_ASPECT * aby) / denom;
  }

  function pickFirstHit(shot, targets) {
    return targets
      .filter((target) => segmentCircleHit(shot.start, shot.end, target, target.radius || 0.045))
      .map((target) => ({ target, t: projectionT(shot, target) }))
      .filter((entry) => entry.t >= 0 && entry.t <= 1)
      .sort((a, b) => a.t - b.t)[0]?.target || null;
  }

  return {
    RULESET, HEAT_BY_RARITY, ITEMS,
    createRng, multiplierForChain, createState,
    applySuccessfulGrab, applyMiss, applyHazard, applyBust,
    completeCashout, resolveOneMore,
    buildChallenge, segmentCircleHit, itemById, targetPosition, pickFirstHit,
  };
});
