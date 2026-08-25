(() => {
  'use strict';

  const core = window.SnatchCore;
  const risk = window.SnatchRisk;
  const input = window.SnatchInput;
  const clawLib = window.SnatchClaw;
  if (!core || !risk || !input || !clawLib) throw new Error('SNATCH runtime failed to load');
  risk.install(core);

  const $ = (id) => document.getElementById(id);
  const refs = {
    landing: $('landing-screen'), game: $('game-screen'), dailyBtn: $('daily-btn'), freeBtn: $('free-btn'), dailyNote: $('daily-note'),
    canvas: $('game-canvas'), arena: $('arena'), banked: $('banked'), bag: $('bag'), heat: $('heat-value'), heatFill: $('heat-fill'), heatStatus: $('heat-status'), riskBonus: $('risk-bonus'),
    multiplier: $('multiplier'), timer: $('timer'), modeLabel: $('mode-label'), modeSide: $('side-mode'), personalBest: $('personal-best'),
    challengeId: $('challenge-id'), landingChallenge: $('landing-challenge'), landingBest: $('landing-best'), sideChain: $('side-chain'), lastLoot: $('last-loot'),
    toast: $('toast'), hint: $('tutorial-hint'), lockdown: $('lockdown'), bagTray: $('bag-tray'), vignette: $('tension-vignette'),
    cashout: $('cashout-btn'), cashoutProgress: document.querySelector('.cashout-progress'), cashoutMain: document.querySelector('.cashout-copy b'), cashoutHint: document.querySelector('.cashout-copy small'),
    decision: $('decision-modal'), decisionBag: $('decision-bag'), safeBtn: $('safe-btn'), oneMoreBtn: $('one-more-btn'), oneMoreObject: $('one-more-object'),
    result: $('result-modal'), resultKicker: $('result-kicker'), resultScore: $('result-score'), resultGrabs: $('result-grabs'), resultBusts: $('result-busts'),
    resultChain: $('result-chain'), shareGrid: $('share-grid'), shareBtn: $('share-btn'), againBtn: $('again-btn'), homeBtn: $('home-btn'),
  };

  const ctx = refs.canvas.getContext('2d');
  const BASE = Object.freeze({ x: 0.5, y: 0.79 });
  const OUTBOUND_SPEED = 1.55;
  const RETURN_SPEED = 2.05;
  const FINAL_WINDOW_MS = 5200;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;

  const RARITY = Object.freeze({
    common: { color: '#b7b3c6', fill: '#343141', label: 'COMMON' },
    rare: { color: '#53ebff', fill: '#123f4d', label: 'RARE' },
    epic: { color: '#a886ff', fill: '#3b2862', label: 'EPIC' },
    mythic: { color: '#d5ff3f', fill: '#465216', label: 'MYTHIC' },
    wtf: { color: '#ff8ec3', fill: '#67243f', label: 'WTF' },
  });

  const ICON_MAP = Object.freeze({
    banana: '🍌', brain: '🧠', frog: '🐸', duck: '🦆', chair: '🪑', egg: '🥚', rock: '🗿', capy: '🦫', toaster: '🍞', pigeon: '🐦',
    cactus: '🌵', sock: '🧦', crown: '👑', potato: '🥔', mug: '☕', slime: '🟢', lamp: '💡', remote: '🎮', sandal: '🩴', goblin: '👺',
    garlic: '🧄', bread: '🍞', kettle: '🫖', crab: '🦀', keyboard: '⌨️', cookie: '🍪', bucket: '🪣', voidduck: '🐤', fork: '🍴', infcapy: '🦫',
  });

  const app = {
    game: null,
    raf: 0,
    drag: null,
    pointerDown: false,
    cashoutStart: null,
    particles: [],
    toastUntil: 0,
    audio: createAudio(),
  };

  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const utcDateId = (date = new Date()) => date.toISOString().slice(0, 10);
  const dayNumber = (dateId) => Math.floor((Date.parse(dateId + 'T00:00:00Z') - Date.parse('2026-01-01T00:00:00Z')) / 86400000) + 1;
  const dailyKey = (dateId) => `snatch.daily.${dateId}`;
  const hasOnboarded = () => localStorage.getItem('snatch.onboarded') === '1';
  const dailyConsumed = (dateId = utcDateId()) => localStorage.getItem(dailyKey(dateId)) === '1';

  function createAudio() {
    let ac = null;
    let nextHeartbeat = 0;
    let unlocked = false;

    function ensure() {
      try {
        ac ||= new (window.AudioContext || window.webkitAudioContext)();
        if (ac.state === 'suspended') ac.resume();
        unlocked = true;
        return ac;
      } catch (_) {
        return null;
      }
    }

    function tone(freq = 420, duration = .07, gain = .028, type = 'triangle', delay = 0) {
      const audio = ensure();
      if (!audio) return;
      const now = audio.currentTime + delay;
      const osc = audio.createOscillator();
      const g = audio.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(Math.max(.0001, gain), now);
      g.gain.exponentialRampToValueAtTime(.0001, now + duration);
      osc.connect(g); g.connect(audio.destination);
      osc.start(now); osc.stop(now + duration + .01);
    }

    return {
      unlock: ensure,
      launch() { tone(260, .045, .025, 'square'); tone(430, .08, .018, 'triangle', .025); },
      latch(rarity) {
        const f = { common: 390, rare: 520, epic: 650, mythic: 780, wtf: 940 }[rarity] || 420;
        tone(f, .095, .035, 'triangle');
      },
      miss() { tone(155, .085, .022, 'square'); },
      settle(rarity) {
        const f = { common: 470, rare: 570, epic: 690, mythic: 820, wtf: 980 }[rarity] || 500;
        tone(f, .08, .025, 'sine');
      },
      cashout() {
        if (!unlocked) ensure();
        setTimeout(() => { tone(220, .08, .045, 'triangle'); tone(510, .14, .03, 'sine', .045); }, 110);
      },
      bust() { tone(105, .23, .05, 'sawtooth'); },
      multiplier(mult) { tone(420 + Math.min(16, mult) * 22, .06, .022, 'square'); },
      heartbeat(heat, nowMs) {
        if (heat < 65 || !unlocked) return;
        const interval = heat >= 85 ? 380 : 620;
        if (nowMs < nextHeartbeat) return;
        nextHeartbeat = nowMs + interval;
        tone(heat >= 85 ? 82 : 112, .055, .022, 'square');
        tone(heat >= 85 ? 64 : 90, .045, .016, 'square', .085);
      },
    };
  }

  function modeConfig(requested) {
    const runDate = utcDateId();
    if (requested === 'daily') {
      if (!hasOnboarded()) return { mode: 'onboarding', duration: 20000, seed: 'onboarding-v1', label: 'QUICK PRACTICE', ranked: false, runDate: 'training' };
      if (dailyConsumed(runDate)) return { mode: 'daily-practice', duration: 60000, seed: `daily:${runDate}:v1`, label: 'PRACTICE', ranked: false, runDate };
      return { mode: 'daily-ranked', duration: 60000, seed: `daily:${runDate}:v1`, label: 'DAILY', ranked: true, runDate };
    }
    return { mode: 'free-run', duration: 60000, seed: `free:${Date.now()}:${Math.floor(performance.now())}`, label: 'FREE RUN', ranked: false, runDate };
  }

  function updateLanding() {
    const today = utcDateId();
    refs.landingChallenge.textContent = `SNATCH #${dayNumber(today)}`;
    refs.landingBest.textContent = fmt(Number(localStorage.getItem('snatch.best') || 0));
    if (!hasOnboarded()) {
      refs.dailyBtn.textContent = 'QUICK PRACTICE';
      refs.dailyNote.textContent = 'Primeira vez? Faça uma rodada curta e libere o Daily.';
    } else if (dailyConsumed(today)) {
      refs.dailyBtn.textContent = 'PRACTICE DAILY';
      refs.dailyNote.textContent = `SNATCH #${dayNumber(today)} já foi jogado. Practice não altera o ranking.`;
    } else {
      refs.dailyBtn.textContent = "TODAY'S HEIST";
      refs.dailyNote.textContent = `SNATCH #${dayNumber(today)} | uma tentativa oficial.`;
    }
  }

  function startGame(requested) {
    const config = modeConfig(requested);
    const challengeId = config.mode.startsWith('daily') ? config.runDate : config.mode === 'onboarding' ? 'training' : `free-${Date.now()}`;
    const challenge = core.buildChallenge(challengeId, config.seed);
    const now = performance.now();

    if (config.ranked) localStorage.setItem(dailyKey(config.runDate), '1');

    app.game = {
      requested,
      config,
      challenge,
      state: core.createState(),
      startAt: now,
      elapsed: 0,
      realElapsed: 0,
      lastFrame: now,
      timerExpired: false,
      timerHandled: false,
      consumedSpawnIds: new Set(),
      eventTrail: [],
      maxChain: 0,
      finished: false,
      bagItems: [],
      lastLoot: null,
      claw: createIdleClaw(),
      shakeUntil: 0,
      shakePower: 0,
      oneMore: null,
      bustHideAt: 0,
    };

    refs.decision.setAttribute('aria-hidden', 'true');
    refs.result.setAttribute('aria-hidden', 'true');
    refs.landing.setAttribute('aria-hidden', 'true');
    refs.landing.style.display = 'none';
    refs.game.setAttribute('aria-hidden', 'false');
    refs.game.style.display = 'grid';
    refs.modeLabel.textContent = config.label;
    refs.modeSide.textContent = config.label;
    refs.challengeId.textContent = config.mode.startsWith('daily') ? `SNATCH #${dayNumber(config.runDate)}` : config.mode === 'onboarding' ? 'TRAINING' : 'PROCEDURAL RUN';
    refs.hint.style.display = 'block';
    app.drag = null;
    app.pointerDown = false;
    app.cashoutStart = null;
    app.particles.length = 0;
    syncHud();
    cancelAnimationFrame(app.raf);
    app.raf = requestAnimationFrame(loop);
  }

  function createIdleClaw() {
    return {
      phase: 'idle',
      position: { x: BASE.x, y: BASE.y },
      resolution: null,
      launchedAt: 0,
      latchHandled: false,
      hitDescriptor: null,
      carrying: null,
      oneMore: false,
    };
  }

  function radiusFor(item) {
    if (item.rarity === 'wtf') return .044;
    if (item.rarity === 'mythic') return .048;
    if (item.rarity === 'epic') return .052;
    return .056;
  }

  function iconFor(item) {
    return ICON_MAP[item.icon] || '✦';
  }

  function descriptorForSpawn(spawn) {
    const item = core.itemById(spawn.itemId);
    return { id: spawn.id, spawn, item, radius: radiusFor(item) };
  }

  function targetAtDescriptor(target, elapsedMs) {
    if (elapsedMs < target.spawn.atMs) {
      return { x: target.spawn.direction > 0 ? -1 : 2, y: .5 };
    }
    return core.targetPosition(target.spawn, elapsedMs);
  }

  function allAvailableDescriptors() {
    const game = app.game;
    if (!game) return [];
    return game.challenge.spawns
      .filter((spawn) => !game.consumedSpawnIds.has(spawn.id))
      .map(descriptorForSpawn);
  }

  function activeTargets(elapsedMs) {
    const game = app.game;
    if (!game) return [];
    const result = [];
    for (const spawn of game.challenge.spawns) {
      if (game.consumedSpawnIds.has(spawn.id) || spawn.atMs > elapsedMs) continue;
      const pos = core.targetPosition(spawn, elapsedMs);
      if (pos.x < -0.16 || pos.x > 1.16) continue;
      const descriptor = descriptorForSpawn(spawn);
      result.push({ ...descriptor, ...pos });
    }
    return result;
  }

  function startAim(point) {
    const game = app.game;
    if (!game || game.finished) return;
    if (game.timerExpired && game.state.phase !== 'one-more-attempt') return;
    if (game.state.phase === 'lockdown') return;
    if (game.state.phase !== 'playing' && game.state.phase !== 'one-more-attempt') return;
    if (game.claw.phase !== 'idle') return;
    app.audio.unlock();
    app.pointerDown = true;
    app.drag = point;
    game.claw.phase = 'aiming';
    refs.hint.style.display = 'none';
  }

  function releaseAim(point) {
    const game = app.game;
    if (!game || game.claw.phase !== 'aiming') return;
    app.pointerDown = false;
    app.drag = point;
    const shot = input.flickToShot(BASE, point);

    let targets;
    let targetAt;
    let startElapsedMs;
    let isOneMore = game.state.phase === 'one-more-attempt';

    if (isOneMore) {
      const final = game.oneMore?.target;
      if (!final) return;
      targets = [final];
      targetAt = oneMoreTargetAt;
      startElapsedMs = performance.now() - game.oneMore.startedAt;
      game.oneMore.shotCommitted = true;
    } else {
      targets = allAvailableDescriptors();
      targetAt = targetAtDescriptor;
      startElapsedMs = game.elapsed;
    }

    const resolution = clawLib.resolveShot({
      base: BASE,
      shot,
      targets,
      startElapsedMs,
      targetAt,
      outboundSpeed: OUTBOUND_SPEED,
      returnSpeed: RETURN_SPEED,
      stepMs: 1000 / 120,
    });

    game.claw = {
      phase: 'outbound',
      position: { x: BASE.x, y: BASE.y },
      resolution,
      launchedAt: performance.now(),
      latchHandled: false,
      hitDescriptor: resolution.hit,
      carrying: null,
      oneMore: isOneMore,
    };
    app.drag = null;
    app.audio.launch();
  }

  function oneMoreTargetAt(target, elapsedMs) {
    const t = Math.max(0, elapsedMs) / 1000;
    const seed = target.motionSeed || 0;
    return {
      x: .5 + Math.sin(t * 3.6 + seed * .000001) * .33,
      y: .28 + Math.cos(t * 2.5 + seed * .000002) * .08,
    };
  }

  function updateClaw(now) {
    const game = app.game;
    if (!game || game.claw.phase === 'idle' || game.claw.phase === 'aiming') return;
    const claw = game.claw;
    const elapsed = now - claw.launchedAt;
    const pose = claw.resolution.positionAt(elapsed);
    claw.position = pose.position;
    claw.phase = pose.phase === 'returning-empty' ? 'returning' : pose.phase;

    if (!claw.latchHandled && elapsed >= claw.resolution.latchAtMs) {
      claw.latchHandled = true;
      if (claw.resolution.hit) {
        claw.carrying = claw.resolution.hit;
        if (!claw.oneMore && claw.resolution.hit.id) game.consumedSpawnIds.add(claw.resolution.hit.id);
        app.audio.latch(claw.resolution.hit.item?.rarity || 'rare');
        emitParticles(claw.position.x, claw.position.y, rarityColor(claw.resolution.hit.item?.rarity || 'rare'), claw.resolution.hit.item?.rarity === 'wtf' ? 22 : 14);
        shake(110, claw.resolution.hit.item?.rarity === 'wtf' ? 7 : 4);
      } else {
        app.audio.miss();
      }
    }

    if (elapsed >= claw.resolution.settleAtMs) settleClaw(now);
  }

  function settleClaw(now) {
    const game = app.game;
    if (!game || game.claw.phase === 'idle') return;
    const claw = game.claw;
    const hit = claw.resolution?.hit || null;
    const wasOneMore = claw.oneMore;

    game.claw = createIdleClaw();

    if (wasOneMore) {
      finishOneMore(!!hit);
      return;
    }

    const beforeBusts = game.state.busts;
    if (hit?.item) {
      game.state = core.applySuccessfulGrab(game.state, hit.item);
      game.maxChain = Math.max(game.maxChain, game.state.greedChain);
      game.eventTrail.push('grab');
      game.lastLoot = hit.item;
      if (game.state.busts === beforeBusts) {
        game.bagItems.push({ item: hit.item, earned: game.state.lastEarned });
        if (game.bagItems.length > 4) game.bagItems.shift();
        app.audio.settle(hit.item.rarity);
        app.audio.multiplier(game.state.multiplier);
        showToast(`${iconFor(hit.item)} +${fmt(game.state.lastEarned)} ${hit.item.displayName}`, hit.item.rarity === 'mythic' || hit.item.rarity === 'wtf' ? 1350 : 900);
      }
    } else {
      game.state = core.applyMiss(game.state);
      game.eventTrail.push('miss');
      showToast('MISS +8 HEAT', 700);
    }

    if (game.state.busts > beforeBusts) triggerBust(now);
    syncHud();
    if (game.timerExpired) maybeHandleTimerEnd();
  }

  function triggerBust(now = performance.now()) {
    const game = app.game;
    if (!game) return;
    game.bagItems.length = 0;
    game.eventTrail.push('bust');
    game.bustHideAt = now + 900;
    refs.lockdown.setAttribute('aria-hidden', 'false');
    showToast('BAG LOST', 900);
    app.audio.bust();
    shake(360, 10);
    try { navigator.vibrate?.([50, 30, 70]); } catch (_) {}
  }

  function syncLockdown(now) {
    const game = app.game;
    if (!game) return;
    if (game.bustHideAt && now >= game.bustHideAt) {
      refs.lockdown.setAttribute('aria-hidden', 'true');
      game.bustHideAt = 0;
    }
    if (game.state.phase === 'lockdown' && game.realElapsed >= Number(game.state.lockdownUntilMs || 0)) {
      game.state = { ...game.state, phase: 'playing' };
      refs.lockdown.setAttribute('aria-hidden', 'true');
      if (game.timerExpired) maybeHandleTimerEnd();
    }
  }

  function beginOneMore() {
    const game = app.game;
    if (!game || game.finished || !game.oneMore) return;
    refs.decision.setAttribute('aria-hidden', 'true');
    const item = core.itemById(game.challenge.finalTarget.itemId);
    game.state = { ...game.state, phase: 'one-more-attempt' };
    game.claw = createIdleClaw();
    game.oneMore = {
      ...game.oneMore,
      startedAt: performance.now(),
      deadlineAt: performance.now() + FINAL_WINDOW_MS,
      shotCommitted: false,
      target: {
        id: 'FINAL',
        item,
        radius: .044,
        motionSeed: game.challenge.finalTarget.motionSeed,
      },
    };
    refs.oneMoreObject.textContent = iconFor(item);
    showToast('ONE SHOT. NO PANIC.', 1000);
  }

  function finishOneMore(success) {
    const game = app.game;
    if (!game || game.state.phase !== 'one-more-attempt') return;
    game.eventTrail.push(success ? 'one-more-win' : 'one-more-loss');
    game.state = core.resolveOneMore(game.state, success);
    showToast(success ? 'DOUBLE BANKED!' : 'GREED GOT YOU', 1100);
    if (success) app.audio.settle('mythic'); else app.audio.bust();
    setTimeout(() => showResult(success ? 'ONE MORE CRAVADO' : undefined), 420);
  }

  function maybeHandleTimerEnd() {
    const game = app.game;
    if (!game || game.finished || game.timerHandled) return;
    if (!game.timerExpired) return;
    if (game.claw.phase !== 'idle') return;
    if (game.state.phase === 'lockdown') return;
    game.timerHandled = true;
    handleTimerEnd();
  }

  function handleTimerEnd() {
    const game = app.game;
    if (!game) return;
    if (game.config.mode === 'onboarding') {
      if (game.state.bag > 0) {
        game.state = core.completeCashout(game.state, core.RULESET.cashoutCommitMs);
        game.bagItems.length = 0;
      }
      localStorage.setItem('snatch.onboarded', '1');
      showResult('TRAINING COMPLETE');
      return;
    }
    if (game.state.bag > 0) {
      game.state = { ...game.state, phase: 'one-more-decision' };
      game.oneMore = { pendingBag: game.state.bag };
      refs.decisionBag.textContent = fmt(game.state.bag);
      refs.safeBtn.textContent = `BANK ${fmt(game.state.bag)}`;
      refs.oneMoreBtn.textContent = `DOUBLE TO ${fmt(game.state.bag * 2)}`;
      refs.oneMoreObject.textContent = iconFor(core.itemById(game.challenge.finalTarget.itemId));
      refs.decision.setAttribute('aria-hidden', 'false');
    } else {
      showResult();
    }
  }

  function safeOneMoreCashout() {
    const game = app.game;
    if (!game) return;
    refs.decision.setAttribute('aria-hidden', 'true');
    game.state = core.completeCashout({ ...game.state, phase: 'playing' }, core.RULESET.cashoutCommitMs);
    game.bagItems.length = 0;
    game.eventTrail.push('cashout');
    showResult();
  }

  function showResult(customKicker) {
    const game = app.game;
    if (!game || game.finished) return;
    game.finished = true;
    refs.cashout.disabled = true;
    refs.lockdown.setAttribute('aria-hidden', 'true');
    refs.decision.setAttribute('aria-hidden', 'true');

    const score = game.state.banked;
    const best = Math.max(score, Number(localStorage.getItem('snatch.best') || 0));
    localStorage.setItem('snatch.best', String(best));

    refs.resultKicker.textContent = customKicker || (game.config.ranked ? 'DAILY HEIST COMPLETE' : 'RUN COMPLETE');
    refs.resultScore.textContent = fmt(score);
    refs.resultGrabs.textContent = String(game.state.grabs || 0);
    refs.resultBusts.textContent = String(game.state.busts || 0);
    refs.resultChain.textContent = String(game.maxChain || 0);
    refs.shareGrid.textContent = buildShareText(score);
    refs.result.setAttribute('aria-hidden', 'false');
    refs.againBtn.textContent = game.config.mode === 'onboarding' ? "PLAY TODAY'S HEIST" : game.config.ranked ? 'PRACTICE DAILY' : 'PLAY AGAIN';
    updateLanding();
  }

  function buildShareText(score) {
    const game = app.game;
    const id = game.config.mode.startsWith('daily') ? `SNATCH #${dayNumber(game.config.runDate)}` : game.config.mode === 'onboarding' ? 'SNATCH TRAINING' : 'SNATCH FREE RUN';
    const symbols = game.eventTrail.slice(-10).map((e) => ({ grab:'🟩', miss:'⬛', bust:'🟥', cashout:'🟨', 'one-more-win':'💎', 'one-more-loss':'💀' }[e] || '⬜'));
    while (symbols.length < 8) symbols.push('▫️');
    return `${id}\n${fmt(score)}  x${game.maxChain}\n${symbols.slice(0,5).join('')}\n${symbols.slice(5,10).join('')}\n\nONE MORE?`;
  }

  function updateCashout(now) {
    const game = app.game;
    if (!game || app.cashoutStart == null || game.state.phase !== 'playing' || game.claw.phase !== 'idle' || game.timerExpired) return;
    const held = now - app.cashoutStart;
    const progress = Math.min(1, held / core.RULESET.cashoutCommitMs);
    refs.cashoutProgress.style.width = `${progress * 100}%`;
    if (held >= core.RULESET.cashoutCommitMs) {
      const before = game.state.banked;
      game.state = core.completeCashout(game.state, held);
      app.cashoutStart = null;
      refs.cashoutProgress.style.width = '0%';
      if (game.state.banked > before) {
        game.bagItems.length = 0;
        game.eventTrail.push('cashout');
        showToast('BANKED. SAFE.', 900);
        app.audio.cashout();
        shake(100, 2);
      }
      syncHud();
    }
  }

  function syncHud() {
    const game = app.game;
    if (!game) return;
    const s = game.state;
    refs.banked.textContent = fmt(s.banked);
    refs.bag.textContent = fmt(s.bag);
    refs.heat.textContent = String(Math.round(s.heat));
    refs.heatFill.style.width = `${Math.min(100, s.heat)}%`;
    refs.multiplier.textContent = `x${s.multiplier}`;
    refs.sideChain.textContent = `${s.greedChain} GRABS`;
    refs.lastLoot.textContent = game.lastLoot ? `${iconFor(game.lastLoot)} ${game.lastLoot.displayName}` : '--';
    const tier = risk.heatState(s.heat);
    const bonus = risk.pressureBonus(s.heat);
    refs.heatStatus.textContent = tier.label;
    refs.riskBonus.textContent = bonus > 1 ? `RISK PAYOUT +${Math.round((bonus - 1) * 100)}%` : 'PRESSURE BONUS OFF';
    refs.riskBonus.classList.toggle('active', bonus > 1);
    refs.arena.dataset.heat = tier.key;
    refs.vignette.dataset.heat = tier.key;
    refs.vignette.classList.toggle('active', s.heat >= 35);
    refs.personalBest.textContent = fmt(Number(localStorage.getItem('snatch.best') || 0));

    const canCashout = s.bag > 0 && s.phase === 'playing' && game.claw.phase === 'idle' && !game.timerExpired;
    refs.cashout.disabled = !canCashout;
    refs.cashout.classList.toggle('urgent', canCashout && s.heat >= 85);
    refs.cashoutMain.textContent = s.bag > 0 ? `BANK ${fmt(s.bag)}` : 'CASH OUT';
    refs.cashoutHint.textContent = s.bag > 0 ? 'SEGURE PARA SALVAR' : 'PEGUE ALGO PRIMEIRO';
    renderBagTray();
  }

  function renderBagTray() {
    const game = app.game;
    if (!game) return;
    refs.bagTray.innerHTML = game.bagItems.map(({ item, earned }) => {
      const rarity = RARITY[item.rarity] || RARITY.common;
      return `<div class="bag-chip" style="--rarity:${rarity.color}"><span class="emoji">${iconFor(item)}</span><span class="meta"><b>${fmt(earned)}</b><small>${rarity.label}</small></span></div>`;
    }).join('');
  }

  function showToast(text, duration = 760) {
    refs.toast.textContent = text;
    refs.toast.classList.add('show');
    app.toastUntil = performance.now() + duration;
  }

  function syncToast(now) {
    if (app.toastUntil && now >= app.toastUntil) {
      refs.toast.classList.remove('show');
      app.toastUntil = 0;
    }
  }

  function emitParticles(x, y, color, count = 12) {
    const game = app.game;
    const rng = core.createRng(`${game?.challenge.seed || 'fx'}:${game?.eventTrail.length || 0}:${Math.round(x*1000)}:${Math.round(y*1000)}`);
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const speed = .05 + rng() * .10;
      app.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, born: performance.now(), life: 420 + rng() * 300, color });
    }
  }

  function shake(duration, power) {
    if (reducedMotion || !app.game) return;
    app.game.shakeUntil = performance.now() + duration;
    app.game.shakePower = power;
  }

  function rarityColor(rarity) {
    return (RARITY[rarity] || RARITY.common).color;
  }

  function loop(now) {
    const game = app.game;
    if (!game || game.finished) return;

    game.realElapsed = Math.max(0, now - game.startAt);
    game.elapsed = Math.min(game.realElapsed, game.config.duration);
    game.state.elapsedMs = game.elapsed;
    game.timerExpired = game.realElapsed >= game.config.duration;

    syncLockdown(now);
    updateCashout(now);
    updateClaw(now);

    if (game.state.phase === 'one-more-attempt' && game.oneMore) {
      const remaining = Math.max(0, game.oneMore.deadlineAt - now);
      refs.timer.textContent = `${(remaining / 1000).toFixed(1)}s`;
      if (remaining <= 0 && !game.oneMore.shotCommitted && game.claw.phase === 'idle') finishOneMore(false);
    } else {
      refs.timer.textContent = `${Math.max(0, (game.config.duration - game.elapsed) / 1000).toFixed(1)}s`;
    }

    if (game.timerExpired) maybeHandleTimerEnd();
    app.audio.heartbeat(game.state.heat, now);
    syncToast(now);
    syncHud();
    draw(now);
    app.raf = requestAnimationFrame(loop);
  }

  function draw(now) {
    const game = app.game;
    if (!game) return;
    const w = refs.canvas.width;
    const h = refs.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (game.shakeUntil > now && !reducedMotion) {
      const p = game.shakePower || 3;
      ctx.translate((Math.random() - .5) * p, (Math.random() - .5) * p);
    }
    drawWorld(w, h, now);
    if (game.state.phase === 'one-more-attempt') drawOneMoreTarget(w, h, now);
    else drawTargets(w, h, game.elapsed);
    if (game.claw.phase === 'aiming' && app.drag) drawAim(w, h, app.drag);
    drawCableAndClaw(w, h, now);
    drawParticles(w, h, now);
    ctx.restore();
  }

  function drawWorld(w, h, now) {
    const g = ctx;
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1a1730'); bg.addColorStop(1, '#07060b');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);

    const glow = g.createRadialGradient(w*.5,h*.38,30,w*.5,h*.38,w*.68);
    glow.addColorStop(0,'rgba(155,121,255,.12)'); glow.addColorStop(1,'rgba(7,6,11,0)');
    g.fillStyle = glow; g.fillRect(0,0,w,h);

    g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 1;
    for (let y=.16;y<.71;y+=.095) { g.beginPath(); g.moveTo(0,y*h); g.lineTo(w,y*h); g.stroke(); }
    for (let x=.1;x<1;x+=.1) { g.beginPath(); g.moveTo(x*w,.14*h); g.lineTo(x*w,.70*h); g.stroke(); }

    const beltY = h*.49, beltH = h*.27;
    g.fillStyle = '#0c0a12'; roundRect(g, 16, beltY-beltH/2+7, w-32, beltH+6, 24, true);
    g.fillStyle = '#15131f'; roundRect(g, 16, beltY-beltH/2, w-32, beltH, 24, true);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; roundRect(g,16,beltY-beltH/2,w-32,beltH,24,false);
    drawStripes(g, 26, beltY-beltH/2+9, w-52, 11);
    drawStripes(g, 26, beltY+beltH/2-20, w-52, 11);
    const shift = (now*.05)%44;
    for (let x=-44+shift;x<w+44;x+=44) {
      g.fillStyle='rgba(255,255,255,.04)'; roundRect(g,x,beltY-55,22,110,8,true);
    }

    const baseX = BASE.x*w, baseY = BASE.y*h;
    g.fillStyle = '#171421'; roundRect(g,baseX-52,baseY-8,104,54,20,true);
    g.strokeStyle='rgba(255,255,255,.09)'; g.lineWidth=2; roundRect(g,baseX-52,baseY-8,104,54,20,false);
    g.fillStyle='#d5ff3f'; roundRect(g,baseX-18,baseY+8,36,10,5,true);
  }

  function drawTargets(w, h, elapsed) {
    for (const target of activeTargets(elapsed)) drawLoot(target.item, target.x*w, target.y*h, target.radius*w);
  }

  function drawOneMoreTarget(w, h, now) {
    const game = app.game;
    if (!game?.oneMore?.target) return;
    const elapsed = Math.max(0, now - game.oneMore.startedAt);
    const p = oneMoreTargetAt(game.oneMore.target, elapsed);
    drawLoot(game.oneMore.target.item, p.x*w, p.y*h, .044*w, true);
  }

  function drawLoot(item, x, y, radiusPx, final = false) {
    const rarity = RARITY[item.rarity] || RARITY.common;
    const width = Math.max(58, radiusPx*2.2);
    const height = Math.max(72, radiusPx*2.65);
    ctx.save();
    ctx.translate(x,y);
    ctx.shadowColor=rarity.color; ctx.shadowBlur=final ? 28 : item.rarity === 'mythic' || item.rarity === 'wtf' ? 22 : 12;
    ctx.fillStyle=rarity.fill; roundRect(ctx,-width/2,-height/2,width,height,18,true);
    ctx.shadowBlur=0; ctx.strokeStyle=rarity.color; ctx.lineWidth=2; roundRect(ctx,-width/2,-height/2,width,height,18,false);
    ctx.fillStyle='rgba(255,255,255,.04)'; roundRect(ctx,-width/2+5,-height/2+5,width-10,20,10,true);
    ctx.font=`${Math.max(25,radiusPx*.92)}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#fff'; ctx.fillText(iconFor(item),0,-8);
    ctx.font='900 12px Inter,system-ui'; ctx.fillStyle='#fff'; ctx.fillText(fmt(item.baseValue),0,height/2-19);
    ctx.font='800 8px Inter,system-ui'; ctx.fillStyle=rarity.color; ctx.fillText(rarity.label,0,height/2-7);
    ctx.restore();
  }

  function drawAttachedLoot(descriptor, x, y) {
    if (!descriptor?.item) return;
    const item = descriptor.item;
    const rarity = RARITY[item.rarity] || RARITY.common;
    ctx.save(); ctx.translate(x,y);
    ctx.shadowColor=rarity.color; ctx.shadowBlur=18;
    ctx.fillStyle=rarity.fill; roundRect(ctx,-26,-29,52,58,15,true);
    ctx.shadowBlur=0; ctx.strokeStyle=rarity.color; ctx.lineWidth=2; roundRect(ctx,-26,-29,52,58,15,false);
    ctx.font='28px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#fff'; ctx.fillText(iconFor(item),0,0);
    ctx.restore();
  }

  function drawCableAndClaw(w, h, now) {
    const game = app.game;
    const claw = game.claw;
    const pos = claw.position || BASE;
    const bx=BASE.x*w, by=BASE.y*h, cx=pos.x*w, cy=pos.y*h;
    const dist=Math.hypot(cx-bx,cy-by);

    ctx.save();
    ctx.strokeStyle='rgba(12,10,18,.9)'; ctx.lineWidth=7; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(bx,by-12); ctx.lineTo(cx,cy); ctx.stroke();
    ctx.strokeStyle='rgba(213,255,63,.78)'; ctx.lineWidth=2.4;
    ctx.beginPath(); ctx.moveTo(bx,by-12); ctx.lineTo(cx,cy); ctx.stroke();
    if (dist>35) {
      const nodes=Math.floor(dist/42);
      for(let i=1;i<=nodes;i++){
        const t=i/(nodes+1), nx=bx+(cx-bx)*t, ny=(by-12)+(cy-(by-12))*t;
        ctx.fillStyle='rgba(213,255,63,.78)'; ctx.beginPath(); ctx.arc(nx,ny,2.8,0,Math.PI*2); ctx.fill();
      }
    }
    ctx.restore();

    if (claw.carrying) drawAttachedLoot(claw.carrying,cx,cy-42);
    drawClaw(cx,cy,claw.phase);
  }

  function drawClaw(x,y,phase) {
    ctx.save(); ctx.translate(x,y);
    ctx.fillStyle='#242037'; roundRect(ctx,-18,-14,36,28,12,true);
    ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.lineWidth=2; roundRect(ctx,-18,-14,36,28,12,false);
    ctx.fillStyle='#d5ff3f'; ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#d5ff3f'; ctx.lineWidth=4; ctx.lineCap='round';
    const open = phase === 'outbound' || phase === 'aiming' ? 1.15 : .82;
    ctx.beginPath();
    ctx.moveTo(-9,5); ctx.lineTo(-16*open,20);
    ctx.moveTo(9,5); ctx.lineTo(16*open,20);
    ctx.moveTo(0,7); ctx.lineTo(0,22); ctx.stroke();
    ctx.restore();
  }

  function drawAim(w,h,dragPoint) {
    const shot=input.flickToShot(BASE,dragPoint);
    const bx=BASE.x*w, by=BASE.y*h, ex=shot.end.x*w, ey=shot.end.y*h;
    ctx.save();
    ctx.strokeStyle='rgba(213,255,63,.88)'; ctx.lineWidth=3; ctx.setLineDash([8,10]);
    ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(ex,ey); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(213,255,63,.12)'; ctx.beginPath(); ctx.arc(ex,ey,24,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(213,255,63,.96)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(ex,ey,14,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.22)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(dragPoint.x*w,dragPoint.y*h); ctx.stroke();
    ctx.restore();
  }

  function drawParticles(w,h,now) {
    app.particles=app.particles.filter((p)=>now-p.born<p.life);
    for(const p of app.particles){
      const age=(now-p.born)/1000, alpha=Math.max(0,1-(now-p.born)/p.life);
      p.x+=p.vx*.016; p.y+=p.vy*.016; p.vy+=.11*.016;
      ctx.globalAlpha=alpha; ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x*w,p.y*h,3+alpha*4,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  function drawStripes(g,x,y,w,h){
    g.fillStyle='rgba(255,179,71,.72)';
    for(let sx=x;sx<x+w;sx+=18){g.beginPath();g.moveTo(sx,y+h);g.lineTo(sx+8,y);g.lineTo(sx+14,y);g.lineTo(sx+6,y+h);g.closePath();g.fill();}
  }

  function roundRect(g,x,y,w,h,r,fill){g.beginPath();g.roundRect(x,y,w,h,r);if(fill)g.fill();else g.stroke();}

  function canvasPoint(event) {
    const rect = refs.canvas.getBoundingClientRect();
    return input.toNormalizedPointer(rect, event.clientX, event.clientY);
  }

  refs.canvas.addEventListener('pointerdown', (e) => {
    if (!app.game) return;
    refs.canvas.setPointerCapture?.(e.pointerId);
    startAim(canvasPoint(e));
    e.preventDefault();
  });
  refs.canvas.addEventListener('pointermove', (e) => {
    if (!app.pointerDown || !app.game || app.game.claw.phase !== 'aiming') return;
    app.drag = canvasPoint(e);
  });
  refs.canvas.addEventListener('pointerup', (e) => {
    if (!app.pointerDown) return;
    releaseAim(canvasPoint(e));
  });
  refs.canvas.addEventListener('pointercancel', () => {
    app.pointerDown = false;
    app.drag = null;
    if (app.game?.claw.phase === 'aiming') app.game.claw = createIdleClaw();
  });

  refs.cashout.addEventListener('pointerdown', (e) => {
    if (!app.game || refs.cashout.disabled) return;
    app.audio.unlock();
    refs.cashout.setPointerCapture?.(e.pointerId);
    app.cashoutStart = performance.now();
    e.preventDefault();
  });
  const cancelCashout = () => { app.cashoutStart = null; refs.cashoutProgress.style.width = '0%'; };
  refs.cashout.addEventListener('pointerup', cancelCashout);
  refs.cashout.addEventListener('pointercancel', cancelCashout);
  refs.cashout.addEventListener('pointerleave', (e) => { if (e.buttons === 0) cancelCashout(); });

  refs.dailyBtn.addEventListener('click', () => startGame('daily'));
  refs.freeBtn.addEventListener('click', () => startGame('free'));
  refs.safeBtn.addEventListener('click', safeOneMoreCashout);
  refs.oneMoreBtn.addEventListener('click', beginOneMore);
  refs.againBtn.addEventListener('click', () => {
    refs.result.setAttribute('aria-hidden', 'true');
    if (app.game?.config.mode === 'onboarding' || app.game?.config.ranked) startGame('daily');
    else startGame(app.game?.requested || 'free');
  });
  refs.homeBtn.addEventListener('click', () => {
    refs.result.setAttribute('aria-hidden', 'true');
    refs.game.setAttribute('aria-hidden', 'true'); refs.game.style.display='none';
    refs.landing.setAttribute('aria-hidden', 'false'); refs.landing.style.display='grid';
    cancelAnimationFrame(app.raf);
    app.game = null;
    updateLanding();
  });
  refs.shareBtn.addEventListener('click', async () => {
    const text = refs.shareGrid.textContent;
    try {
      if (navigator.share) await navigator.share({ title: 'SNATCH!', text });
      else if (navigator.clipboard) await navigator.clipboard.writeText(text);
      refs.shareBtn.textContent = 'COPIED!';
    } catch (_) {
      refs.shareBtn.textContent = 'SELECT THE GRID ABOVE';
    }
    setTimeout(() => refs.shareBtn.textContent = 'SHARE RESULT', 1400);
  });

  updateLanding();
})();
