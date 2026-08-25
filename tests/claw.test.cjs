const test = require('node:test');
const assert = require('node:assert/strict');
const claw = require('../src/claw.js');

const base = { x: 0.5, y: 0.885 };
const verticalShot = { start: base, end: { x: 0.5, y: 0.18 } };
const staticAt = (target) => ({ x: target.x, y: target.y });

test('same shot and targets resolve to the exact same physical claw timeline', () => {
  const options = {
    base,
    shot: verticalShot,
    startElapsedMs: 12000,
    targets: [{ id: 'duck', x: 0.5, y: 0.48, radius: 0.045 }],
    targetAt: staticAt,
  };
  const a = claw.resolveShot(options);
  const b = claw.resolveShot(options);
  assert.deepEqual(
    { hit: a.hit, latchAtMs: a.latchAtMs, settleAtMs: a.settleAtMs, latchPoint: a.latchPoint },
    { hit: b.hit, latchAtMs: b.latchAtMs, settleAtMs: b.settleAtMs, latchPoint: b.latchPoint },
  );
});

test('physical claw intercepts a target that moves into the flight path', () => {
  const movingAt = (target, elapsedMs) => ({
    x: target.x + target.vx * ((elapsedMs - 10000) / 1000),
    y: target.y,
  });
  const result = claw.resolveShot({
    base,
    shot: verticalShot,
    startElapsedMs: 10000,
    targets: [{ id: 'frog', x: 0.42, y: 0.5, vx: 0.20, radius: 0.055 }],
    targetAt: movingAt,
    stepMs: 1000 / 120,
  });
  assert.equal(result.hit?.id, 'frog');
  assert.ok(result.latchAtMs > 0);
  assert.ok(result.settleAtMs > result.latchAtMs);
});

test('9:16 aspect correction rejects a visually vertical miss', () => {
  const horizontalShot = { start: { x: 0.1, y: 0.5 }, end: { x: 0.9, y: 0.5 } };
  const result = claw.resolveShot({
    base: horizontalShot.start,
    shot: horizontalShot,
    startElapsedMs: 0,
    targets: [{ id: 'miss', x: 0.5, y: 0.52, radius: 0.03 }],
    targetAt: staticAt,
  });
  // Raw normalized delta is .02, but on a 9:16 arena it is .0356 width-units, outside a .03 radius.
  assert.equal(result.hit, null);
});

test('first contact wins even when another target is farther along the same shot', () => {
  const result = claw.resolveShot({
    base,
    shot: verticalShot,
    startElapsedMs: 0,
    targets: [
      { id: 'far', x: 0.5, y: 0.28, radius: 0.04 },
      { id: 'near', x: 0.5, y: 0.62, radius: 0.04 },
    ],
    targetAt: staticAt,
  });
  assert.equal(result.hit?.id, 'near');
});

test('return leg is faster than the outbound leg from the same distance', () => {
  const result = claw.resolveShot({
    base,
    shot: verticalShot,
    startElapsedMs: 0,
    targets: [],
    targetAt: staticAt,
    outboundSpeed: 1.55,
    returnSpeed: 2.05,
  });
  assert.ok(result.returnDurationMs < result.outboundDurationMs);
  const settled = result.positionAt(result.settleAtMs);
  assert.equal(settled.phase, 'settled');
  assert.deepEqual(settled.position, base);
});
