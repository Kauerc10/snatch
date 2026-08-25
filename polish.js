(() => {
  'use strict';
  const risk = window.SnatchRisk;
  const core = window.SnatchCore;
  if (!risk || !core) return;

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const dateId = () => new Date().toISOString().slice(0, 10);
  const dayNumber = (id) => Math.floor((Date.parse(id + 'T00:00:00Z') - Date.parse('2026-01-01T00:00:00Z')) / 86400000) + 1;
  const dailyKey = (id) => `snatch.daily.${id}`;

  const arena = $('arena');
  const heatValue = $('heat-value');
  const heatStatus = $('heat-status');
  const riskBonus = $('risk-bonus');
  const bag = $('bag');
  const cashout = $('cashout-btn');
  const landingChallenge = $('landing-challenge');
  const landingBest = $('landing-best');
  const dailyBtn = $('daily-btn');
  const decision = $('decision-modal');
  const decisionBag = $('decision-bag');
  const safeBtn = $('safe-btn');
  const oneMoreBtn = $('one-more-btn');
  const result = $('result-modal');
  const shareGrid = $('share-grid');

  let activeRankedDate = null;
  let storageGuardInstalled = false;

  function numericMoney(text) {
    return Number(String(text || '').replace(/[^0-9.-]/g, '')) || 0;
  }

  function normalizeLockdown(state) {
    if (!state || state.phase !== 'lockdown') return state;
    const deadline = Math.min(Number(state.lockdownUntilMs || 0), core.RULESET.roundMs);
    return deadline === state.lockdownUntilMs ? state : Object.assign({}, state, { lockdownUntilMs: deadline });
  }

  function hardenRuntimeCore() {
    if (core.__snatchHardeningInstalled) return;

    const aspect = 16 / 9;
    core.segmentCircleHit = function segmentCircleHit(a, b, c, radius) {
      const abx = b.x - a.x;
      const aby = (b.y - a.y) * aspect;
      const acx = c.x - a.x;
      const acy = (c.y - a.y) * aspect;
      const denom = abx * abx + aby * aby;
      const t = denom === 0 ? 0 : Math.max(0, Math.min(1, (acx * abx + acy * aby) / denom));
      const px = a.x + (b.x - a.x) * t;
      const py = a.y + (b.y - a.y) * t;
      const dx = c.x - px;
      const dy = (c.y - py) * aspect;
      return dx * dx + dy * dy <= radius * radius;
    };

    core.pickFirstHit = function pickFirstHit(shot, targets) {
      const projectionT = (point) => {
        const abx = shot.end.x - shot.start.x;
        const aby = (shot.end.y - shot.start.y) * aspect;
        const denom = abx * abx + aby * aby || 1;
        return ((point.x - shot.start.x) * abx + (point.y - shot.start.y) * aspect * aby) / denom;
      };
      return targets
        .filter((target) => core.segmentCircleHit(shot.start, shot.end, target, target.radius || 0.045))
        .map((target) => ({ target, t: projectionT(target) }))
        .filter((entry) => entry.t >= 0 && entry.t <= 1)
        .sort((a, b) => a.t - b.t)[0]?.target || null;
    };

    for (const name of ['applySuccessfulGrab', 'applyMiss', 'applyHazard', 'applyBust']) {
      const original = core[name]?.bind(core);
      if (!original) continue;
      core[name] = (...args) => normalizeLockdown(original(...args));
    }

    Object.defineProperty(core, '__snatchHardeningInstalled', { value: true, enumerable: false });
  }

  function installDailyStorageGuard() {
    if (storageGuardInstalled || !window.localStorage) return;
    storageGuardInstalled = true;

    const shouldBlock = (key) => activeRankedDate
      && String(key).startsWith('snatch.daily.')
      && String(key) !== dailyKey(activeRankedDate);

    if (typeof Storage !== 'undefined' && localStorage instanceof Storage) {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function guardedSetItem(key, value) {
        if (this === localStorage && shouldBlock(key)) return;
        return originalSetItem.call(this, key, value);
      };
    } else {
      const originalSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (key, value) => {
        if (shouldBlock(key)) return;
        return originalSetItem(key, value);
      };
    }
  }

  function reserveRankedDailyAfterStart() {
    if (!dailyBtn || localStorage.getItem('snatch.onboarded') !== '1') {
      activeRankedDate = null;
      return;
    }
    const runDate = dateId();
    if (localStorage.getItem(dailyKey(runDate)) === '1') {
      activeRankedDate = null;
      return;
    }
    activeRankedDate = runDate;
    localStorage.setItem(dailyKey(activeRankedDate), '1');
  }

  function syncDailyResult() {
    if (!activeRankedDate || !result || result.getAttribute('aria-hidden') !== 'false') return;
    if (shareGrid) {
      const lines = String(shareGrid.textContent || '').split('\n');
      if (lines.length) lines[0] = `SNATCH #${dayNumber(activeRankedDate)}`;
      shareGrid.textContent = lines.join('\n');
    }
    activeRankedDate = null;
  }

  function syncRiskHud() {
    const heat = Number(heatValue?.textContent || 0);
    const tier = risk.heatState(heat);
    const bonus = risk.pressureBonus(heat);
    if (arena) arena.dataset.heat = tier.key;
    if (heatStatus) heatStatus.textContent = tier.label;
    if (riskBonus) {
      riskBonus.textContent = bonus > 1 ? `RISK PAYOUT +${Math.round((bonus - 1) * 100)}%` : 'PRESSURE BONUS OFF';
      riskBonus.classList.toggle('active', bonus > 1);
    }

    const bagValue = numericMoney(bag?.textContent);
    if (cashout) {
      cashout.classList.toggle('urgent', bagValue > 0 && heat >= 85 && !cashout.disabled);
      const main = cashout.querySelector('b');
      const hint = cashout.querySelector('small');
      if (main) main.textContent = bagValue > 0 ? `BANK ${fmt(bagValue)}` : 'CASH OUT';
      if (hint) hint.textContent = bagValue > 0 ? 'SEGURE PARA SALVAR' : 'PEGUE ALGO PRIMEIRO';
    }
  }

  function syncLanding() {
    if (landingChallenge) landingChallenge.textContent = `SNATCH #${dayNumber(dateId())}`;
    if (landingBest) landingBest.textContent = fmt(Number(localStorage.getItem('snatch.best') || 0));
  }

  function syncDecision() {
    if (!decision || decision.getAttribute('aria-hidden') !== 'false') return;
    const amount = numericMoney(decisionBag?.textContent);
    if (safeBtn) safeBtn.textContent = `BANK ${fmt(amount)}`;
    if (oneMoreBtn) oneMoreBtn.textContent = `DOUBLE TO ${fmt(amount * 2)}`;
  }

  hardenRuntimeCore();
  installDailyStorageGuard();
  dailyBtn?.addEventListener('click', reserveRankedDailyAfterStart);

  const observer = new MutationObserver(() => {
    syncRiskHud();
    syncLanding();
    syncDecision();
    syncDailyResult();
  });
  [heatValue, bag, decisionBag, decision, result].filter(Boolean).forEach((node) => observer.observe(node, { subtree: true, childList: true, characterData: true, attributes: true }));

  syncRiskHud();
  syncLanding();
  syncDecision();
  syncDailyResult();
})();
