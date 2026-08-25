const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core.js');
const risk = require('../src/risk.js');

test('heat states expose readable risk tiers', () => {
  assert.equal(risk.heatState(0).key, 'cool');
  assert.equal(risk.heatState(35).key, 'warm');
  assert.equal(risk.heatState(65).key, 'hot');
  assert.equal(risk.heatState(85).key, 'critical');
});

test('pressure bonus rewards dangerous heat only', () => {
  assert.equal(risk.pressureBonus(64), 1);
  assert.equal(risk.pressureBonus(65), 1.10);
  assert.equal(risk.pressureBonus(85), 1.25);
});

test('installed risk layer raises earned BAG while preserving BANKED', () => {
  risk.install(core);
  const next = core.applySuccessfulGrab(core.createState({ heat: 70, banked: 500, multiplier: 2 }), { baseValue: 100, rarity: 'common' });
  assert.equal(next.lastEarned, 220);
  assert.equal(next.bag, 220);
  assert.equal(next.banked, 500);
});

test('risk layer never resurrects BAG when the grab itself causes a bust', () => {
  risk.install(core);
  const next = core.applySuccessfulGrab(core.createState({ heat: 99, bag: 400, multiplier: 2 }), { baseValue: 100, rarity: 'common' });
  assert.equal(next.phase, 'lockdown');
  assert.equal(next.bag, 0);
});
