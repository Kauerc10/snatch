(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SnatchInput = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function toNormalizedPointer(rect, clientX, clientY) {
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  }

  function flickToShot(claw, dragPoint) {
    const dx = claw.x - dragPoint.x;
    const dy = claw.y - dragPoint.y;
    const len = Math.hypot(dx, dy) || 1;
    const maxReach = 1.15;
    const scale = maxReach / len;
    return {
      start: { x: claw.x, y: claw.y },
      end: {
        x: clamp01(claw.x + dx * scale),
        y: clamp01(claw.y + dy * scale),
      },
    };
  }

  return { toNormalizedPointer, flickToShot };
});
