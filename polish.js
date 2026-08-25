(() => {
  'use strict';
  const risk = window.SnatchRisk;
  const core = window.SnatchCore;
  if (!risk || !core) return;

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const dateId = () => new Date().toISOString().slice(0, 10);
  const dayNumber = (id) => Math.floor((Date.parse(id + 'T00:00:00Z') - Date.parse('2026-01-01T00:00:00Z')) / 86400000) + 1;

  const arena = $('arena');
  const heatValue = $('heat-value');
  const heatStatus = $('heat-status');
  const riskBonus = $('risk-bonus');
  const bag = $('bag');
  const cashout = $('cashout-btn');
  const landingChallenge = $('landing-challenge');
  const landingBest = $('landing-best');
  const decision = $('decision-modal');
  const decisionBag = $('decision-bag');
  const safeBtn = $('safe-btn');
  const oneMoreBtn = $('one-more-btn');

  function numericMoney(text) {
    return Number(String(text || '').replace(/[^0-9.-]/g, '')) || 0;
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

  const observer = new MutationObserver(() => {
    syncRiskHud();
    syncLanding();
    syncDecision();
  });
  [heatValue, bag, decisionBag, decision].filter(Boolean).forEach((node) => observer.observe(node, { subtree: true, childList: true, characterData: true, attributes: true }));

  syncRiskHud();
  syncLanding();
  syncDecision();
})();
