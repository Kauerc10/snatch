(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SnatchClaw = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ASPECT = 16 / 9;
  const EPSILON = 1e-9;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function aspectDistance(a, b) {
    const dx = b.x - a.x;
    const dy = (b.y - a.y) * ASPECT;
    return Math.hypot(dx, dy);
  }

  function lerpPoint(a, b, t) {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
  }

  function nearestContact(point, targets, elapsedMs, targetAt) {
    let best = null;
    for (const target of targets) {
      const center = targetAt(target, elapsedMs);
      const distance = aspectDistance(point, center);
      const radius = Number(target.radius || 0.045);
      if (distance > radius + EPSILON) continue;
      if (!best || distance < best.distance || (distance === best.distance && String(target.id) < String(best.target.id))) {
        best = { target, center, distance };
      }
    }
    return best;
  }

  function resolveShot(options) {
    const {
      base,
      shot,
      targets = [],
      startElapsedMs = 0,
      targetAt = (target) => target,
      outboundSpeed = 1.55,
      returnSpeed = 2.05,
      stepMs = 1000 / 120,
    } = options || {};

    if (!base || !shot?.start || !shot?.end) throw new TypeError('base and shot start/end are required');
    if (!(outboundSpeed > 0) || !(returnSpeed > 0) || !(stepMs > 0)) throw new RangeError('claw speeds and stepMs must be positive');

    const outboundDistance = aspectDistance(shot.start, shot.end);
    const outboundDurationMs = outboundDistance / outboundSpeed * 1000;
    let hit = null;
    let latchAtMs = outboundDurationMs;
    let latchPoint = { x: shot.end.x, y: shot.end.y };

    const steps = Math.max(1, Math.ceil(outboundDurationMs / stepMs));
    for (let i = 0; i <= steps; i++) {
      const tMs = Math.min(outboundDurationMs, i * stepMs);
      const progress = outboundDurationMs <= EPSILON ? 1 : tMs / outboundDurationMs;
      const clawPoint = lerpPoint(shot.start, shot.end, progress);
      const contact = nearestContact(clawPoint, targets, startElapsedMs + tMs, targetAt);
      if (contact) {
        hit = contact.target;
        latchAtMs = tMs;
        // The claw is the physical contact point. Target center is used only for collision.
        latchPoint = clawPoint;
        break;
      }
    }

    const returnDistance = aspectDistance(latchPoint, base);
    const returnDurationMs = returnDistance / returnSpeed * 1000;
    const settleAtMs = latchAtMs + returnDurationMs;

    function positionAt(timeMs) {
      const time = Math.max(0, Number(timeMs) || 0);
      if (time >= settleAtMs) return { phase: 'settled', position: { x: base.x, y: base.y }, carrying: hit };
      if (time >= latchAtMs) {
        const progress = returnDurationMs <= EPSILON ? 1 : clamp((time - latchAtMs) / returnDurationMs, 0, 1);
        return { phase: hit ? 'returning' : 'returning-empty', position: lerpPoint(latchPoint, base, progress), carrying: hit };
      }
      const progress = latchAtMs <= EPSILON ? 1 : clamp(time / latchAtMs, 0, 1);
      return { phase: 'outbound', position: lerpPoint(shot.start, latchPoint, progress), carrying: null };
    }

    return {
      hit,
      latchPoint,
      latchAtMs,
      outboundDurationMs,
      returnDurationMs,
      settleAtMs,
      positionAt,
    };
  }

  return { ASPECT, aspectDistance, resolveShot };
});
