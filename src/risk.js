(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SnatchRisk = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function heatState(heat) {
    const value = Math.max(0, Math.min(100, Number(heat) || 0));
    if (value >= 85) return { key: 'critical', label: 'CRITICAL', value };
    if (value >= 65) return { key: 'hot', label: 'HOT', value };
    if (value >= 35) return { key: 'warm', label: 'WARM', value };
    return { key: 'cool', label: 'COOL', value };
  }

  function pressureBonus(heat) {
    const tier = heatState(heat).key;
    if (tier === 'critical') return 1.25;
    if (tier === 'hot') return 1.10;
    return 1;
  }

  function install(core) {
    if (!core || core.__snatchRiskInstalled) return core;
    const originalGrab = core.applySuccessfulGrab.bind(core);
    core.heatState = heatState;
    core.pressureBonus = pressureBonus;
    core.applySuccessfulGrab = function applyRiskGrab(state, item) {
      const bonus = pressureBonus(state.heat);
      const next = originalGrab(state, item);
      if (bonus <= 1 || next.phase === 'lockdown') return next;
      const earned = Math.round((next.lastEarned || 0) * bonus);
      return Object.assign({}, next, {
        bag: next.bag + earned - (next.lastEarned || 0),
        lastEarned: earned,
      });
    };
    Object.defineProperty(core, '__snatchRiskInstalled', { value: true, enumerable: false });
    return core;
  }

  return { heatState, pressureBonus, install };
});
