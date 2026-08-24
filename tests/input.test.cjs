const test = require('node:test');
const assert = require('node:assert/strict');
const input = require('../src/input.js');

test('pointer normalization is viewport independent', () => {
  const phone = input.toNormalizedPointer({ left: 10, top: 20, width: 390, height: 693 }, 205, 366.5);
  const desktop = input.toNormalizedPointer({ left: 100, top: 50, width: 1080, height: 1920 }, 640, 1010);
  assert.ok(Math.abs(phone.x - desktop.x) < 1e-9);
  assert.ok(Math.abs(phone.y - desktop.y) < 1e-9);
});

test('flick direction mirrors drag around the claw and clamps reach', () => {
  const shot = input.flickToShot({ x: 0.5, y: 0.88 }, { x: 0.3, y: 0.98 });
  assert.ok(shot.end.x > shot.start.x);
  assert.ok(shot.end.y < shot.start.y);
  assert.ok(shot.end.x <= 1 && shot.end.x >= 0);
  assert.ok(shot.end.y <= 1 && shot.end.y >= 0);
});
