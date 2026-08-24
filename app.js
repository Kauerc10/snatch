(() => {
  'use strict';

  const core = window.SnatchCore;
  const input = window.SnatchInput;
  if (!core || !input) throw new Error('SNATCH core failed to load');

  const $ = (id) => document.getElementById(id);
  const refs = {
    landing: $('landing-screen'), game: $('game-screen'), dailyBtn: $('daily-btn'), freeBtn: $('free-btn'), dailyNote: $('daily-note'),
    canvas: $('game-canvas'), arena: $('arena'), banked: $('banked'), bag: $('bag'), heat: $('heat-value'), heatFill: $('heat-fill'),
    multiplier: $('multiplier'), timer: $('timer'), modeLabel: $('mode-label'), modeSide: $('side-mode'), personalBest: $('personal-best'),
    challengeId: $('challenge-id'), sideChain: $('side-chain'), toast: $('toast'), hint: $('tutorial-hint'), lockdown: $('lockdown'),
    cashout: $('cashout-btn'), decision: $('decision-modal'), decisionBag: $('decision-bag'), safeBtn: $('safe-btn'), oneMoreBtn: $('one-more-btn'),
    result: $('result-modal'), resultKicker: $('result-kicker'), resultScore: $('result-score'), resultGrabs: $('result-grabs'),
    resultBusts: $('result-busts'), resultChain: $('result-chain'), shareGrid: $('share-grid'), shareBtn: $('share-btn'), againBtn: $('again-btn'), homeBtn: $('home-btn')
  };

  const ctx = refs.canvas.getContext('2d');
  const C = {
    bg: '#111018', grid: 'rgba(255,255,255,.045)', conveyor: '#1d1b27', conveyorLine: 'rgba(255,255,255,.09)',
    claw: '#dfff36', clawDark: '#15170b', common: '#d9d6e2', rare: '#55e9ff', epic: '#8e6bff', mythic: '#ffcf4a', wtf: '#ff4f9a', danger: '#ff4f6d', white: '#f8f6ff'
  };

  let game = null;
  let raf = 0;
  let drag = null;
  let shotFx = null;
  let particles = [];
  let cashoutStart = null;
  let toastTimer = 0;
  let audioCtx = null;

  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const utcDateId = () => new Date().toISOString().slice(0, 10);
  const dayNumber = (dateId) => Math.floor((Date.parse(dateId + 'T00:00:00Z') - Date.parse('2026-01-01T00:00:00Z')) / 86400000) + 1;
  const todayKey = () => `snatch.daily.${utcDateId()}`;
  const hasOnboarded = () => localStorage.getItem('snatch.onboarded') === '1';
  const dailyConsumed = () => localStorage.getItem(todayKey()) === '1';

  function updateLanding() {
    if (!hasOnboarded()) {
      refs.dailyBtn.textContent = 'QUICK PRACTICE';
      refs.dailyNote.textContent = 'Primeira vez? Faça uma rodada curta e libere o Daily.';
    } else if (dailyConsumed()) {
      refs.dailyBtn.textContent = 'PRACTICE DAILY';
      refs.dailyNote.textContent = `SNATCH #${dayNumber(utcDateId())} já foi jogado hoje. Practice não altera ranking.`;
    } else {
      refs.dailyBtn.textContent = "TODAY'S HEIST";
      refs.dailyNote.textContent = `SNATCH #${dayNumber(utcDateId())} | uma tentativa oficial local neste MVP.`;
    }
    refs.personalBest.textContent = fmt(Number(localStorage.getItem('snatch.best') || 0));
  }

  function tone(freq = 420, duration = .055, gain = .028) {
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.frequency.value = freq;
      osc.type = 'square';
      g.gain.value = gain;
      osc.connect(g); g.connect(audioCtx.destination);
      osc.start();
      g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + duration);
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  function vibration(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (_) {}
  }

  function showToast(text, toneType = 'normal') {
    refs.toast.textContent = text;
    refs.toast.style.color = toneType === 'danger' ? C.danger : toneType === 'rare' ? C.mythic : C.white;
    refs.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => refs.toast.classList.remove('show'), 580);
  }

  function modeConfig(requested) {
    if (requested === 'daily') {
      if (!hasOnboarded()) return { mode: 'onboarding', duration: 20000, seed: 'onboarding-v1', label: 'QUICK PRACTICE', ranked: false };
      if (dailyConsumed()) return { mode: 'daily-practice', duration: 60000, seed: `daily:${utcDateId()}:v1`, label: 'PRACTICE', ranked: false };
      return { mode: 'daily-ranked', duration: 60000, seed: `daily:${utcDateId()}:v1`, label: 'DAILY', ranked: true };
    }
    return { mode: 'free-run', duration: 60000, seed: `free:${Date.now()}`, label: 'FREE RUN', ranked: false };
  }

  function startGame(requested) {
    refs.decision.setAttribute('aria-hidden', 'true');
    refs.result.setAttribute('aria-hidden', 'true');
    refs.landing.setAttribute('aria-hidden', 'true');
    refs.game.setAttribute('aria-hidden', 'false');

    const config = modeConfig(requested);
    const challengeId = config.mode.startsWith('daily') ? utcDateId() : config.mode === 'onboarding' ? 'training' : `free-${Date.now()}`;
    const challenge = core.buildChallenge(challengeId, config.seed);
    game = {
      requested, config, challenge,
      state: core.createState(),
      startAt: performance.now(),
      lastFrame: performance.now(),
      elapsed: 0,
      consumedSpawnIds: new Set(),
      eventTrail: [],
      maxChain: 0,
      finished: false,
      finalTarget: null,
      oneMoreDeadline: 0,
      shots: 0,
    };

    refs.modeLabel.textContent = config.label;
    refs.modeSide.textContent = config.label;
    refs.challengeId.textContent = config.mode.startsWith('daily') ? `SNATCH #${dayNumber(utcDateId())}` : config.mode === 'onboarding' ? 'TRAINING' : 'PROCEDURAL RUN';
    refs.hint.classList.remove('hidden');
    refs.cashout.disabled = false;
    refs.cashout.style.setProperty('--p', 0);
    shotFx = null; particles = []; drag = null; cashoutStart = null;
    syncHud();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function syncHud() {
    if (!game) return;
    const s = game.state;
    refs.banked.textContent = fmt(s.banked);
    refs.bag.textContent = fmt(s.bag);
    refs.heat.textContent = String(Math.round(s.heat));
    refs.heatFill.style.width = `${Math.min(100, s.heat)}%`;
    refs.multiplier.textContent = `x${s.multiplier}`;
    refs.sideChain.textContent = `${s.greedChain} GRABS`;
    refs.cashout.disabled = s.bag <= 0 || (s.phase !== 'playing' && s.phase !== 'one-more-attempt');
  }

  function activeTargets(elapsed) {
    if (!game || game.state.phase === 'one-more-attempt') {
      if (!game?.finalTarget) return [];
      return [game.finalTarget];
    }
    const result = [];
    for (const spawn of game.challenge.spawns) {
      if (spawn.atMs > elapsed || game.consumedSpawnIds.has(spawn.id)) continue;
      const pos = core.targetPosition(spawn, elapsed);
      if (pos.x < -0.18 || pos.x > 1.18) continue;
      const item = core.itemById(spawn.itemId);
      result.push({ ...pos, id: spawn.id, item, spawn, radius: item.rarity === 'wtf' ? .038 : item.rarity === 'mythic' ? .043 : .048 });
    }
    return result;
  }

  function finalTargetPosition(now) {
    const t = Math.max(0, (now - game.oneMoreStartedAt) / 1000);
    const seed = game.challenge.finalTarget.motionSeed;
    return {
      x: .5 + Math.sin(t * 3.6 + seed * .000001) * .33,
      y: .28 + Math.cos(t * 2.5 + seed * .000002) * .08,
    };
  }

  function loop(now) {
    if (!game || game.finished) return;
    const realElapsed = now - game.startAt;
    game.elapsed = Math.min(realElapsed, game.config.duration);
    game.state.elapsedMs = game.elapsed;

    if (game.state.phase === 'lockdown' && game.elapsed >= (game.state.lockdownUntilMs || 0)) {
      game.state = { ...game.state, phase: 'playing' };
      refs.lockdown.setAttribute('aria-hidden', 'true');
    }

    if (game.state.phase === 'playing' && game.elapsed >= game.config.duration) {
      handleTimerEnd();
    }

    if (game.state.phase === 'one-more-attempt') {
      const p = finalTargetPosition(now);
      game.finalTarget.x = p.x; game.finalTarget.y = p.y;
      if (now >= game.oneMoreDeadline) finishOneMore(false);
    }

    updateCashout(now);
    draw(now);
    syncHud();
    refs.timer.textContent = game.state.phase === 'one-more-attempt'
      ? `${Math.max(0, (game.oneMoreDeadline - now) / 1000).toFixed(1)}s`
      : `${Math.max(0, (game.config.duration - game.elapsed) / 1000).toFixed(1)}s`;
    raf = requestAnimationFrame(loop);
  }

  function handleTimerEnd() {
    if (game.config.mode === 'onboarding') {
      if (game.state.bag > 0) game.state = core.completeCashout(game.state, core.RULESET.cashoutCommitMs);
      localStorage.setItem('snatch.onboarded', '1');
      finishRun('TRAINING COMPLETE');
      return;
    }
    if (game.state.bag > 0) {
      game.state = { ...game.state, phase: 'one-more-decision' };
      refs.decisionBag.textContent = fmt(game.state.bag);
      refs.decision.setAttribute('aria-hidden', 'false');
      refs.cashout.disabled = true;
    } else {
      finishRun();
    }
  }

  function beginOneMore() {
    refs.decision.setAttribute('aria-hidden', 'true');
    const item = core.itemById(game.challenge.finalTarget.itemId);
    game.state = { ...game.state, phase: 'one-more-attempt' };
    game.oneMoreStartedAt = performance.now();
    game.oneMoreDeadline = game.oneMoreStartedAt + 5200;
    game.finalTarget = { id: 'FINAL', x: .5, y: .28, radius: .038, item };
    showToast('ONE SHOT. NO PANIC.', 'danger');
    tone(155, .16, .035);
  }

  function finishOneMore(success) {
    if (!game || game.state.phase !== 'one-more-attempt') return;
    game.eventTrail.push(success ? 'one-more-win' : 'one-more-loss');
    game.state = core.resolveOneMore(game.state, success);
    showToast(success ? 'DOUBLE BANKED!' : 'GREED GOT YOU', success ? 'rare' : 'danger');
    success ? tone(840, .18, .04) : tone(110, .22, .04);
    setTimeout(() => finishRun(), 480);
  }

  function finishRun(customKicker) {
    if (!game || game.finished) return;
    game.finished = true;
    cancelAnimationFrame(raf);
    refs.cashout.disabled = true;
    refs.lockdown.setAttribute('aria-hidden', 'true');

    if (game.config.mode === 'daily-ranked') localStorage.setItem(todayKey(), '1');
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
    const id = game.config.mode.startsWith('daily') ? `SNATCH #${dayNumber(utcDateId())}` : 'SNATCH FREE RUN';
    const symbols = game.eventTrail.slice(-10).map((e) => ({ grab:'🟩', miss:'⬛', bust:'🟥', cashout:'🟨', 'one-more-win':'💎', 'one-more-loss':'💀' }[e] || '⬜'));
    while (symbols.length < 8) symbols.push('▫️');
    return `${id}\n${fmt(score)}  x${game.maxChain}\n${symbols.slice(0,5).join('')}\n${symbols.slice(5,10).join('')}\n\nONE MORE?`;
  }

  function particleBurst(x, y, color, count = 9) {
    const seed = core.createRng(`${game.challenge.seed}:${game.shots}:${x}:${y}`);
    for (let i = 0; i < count; i++) {
      const a = seed() * Math.PI * 2;
      const speed = .07 + seed() * .10;
      particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, born: performance.now(), life: 420 + seed() * 260, color });
    }
  }

  function fireShot(shot) {
    if (!game || (game.state.phase !== 'playing' && game.state.phase !== 'one-more-attempt')) return;
    if (game.state.phase === 'lockdown') return;
    game.shots++;
    refs.hint.classList.add('hidden');
    shotFx = { ...shot, born: performance.now(), hit: null };

    if (game.state.phase === 'one-more-attempt') {
      const hit = core.segmentCircleHit(shot.start, shot.end, game.finalTarget, game.finalTarget.radius);
      shotFx.hit = hit ? game.finalTarget : null;
      particleBurst(game.finalTarget.x, game.finalTarget.y, hit ? C.mythic : C.danger, hit ? 18 : 5);
      finishOneMore(hit);
      return;
    }

    const targets = activeTargets(game.elapsed);
    const hit = core.pickFirstHit(shot, targets);
    if (hit) {
      game.consumedSpawnIds.add(hit.id);
      shotFx.hit = hit;
      const beforeBusts = game.state.busts;
      game.state = core.applySuccessfulGrab(game.state, hit.item);
      game.maxChain = Math.max(game.maxChain, game.state.greedChain);
      game.eventTrail.push('grab');
      const color = C[hit.item.rarity] || C.white;
      particleBurst(hit.x, hit.y, color, hit.item.rarity === 'mythic' || hit.item.rarity === 'wtf' ? 18 : 10);
      showToast(`+${fmt(game.state.lastEarned)} ${hit.item.displayName}`, hit.item.rarity === 'mythic' || hit.item.rarity === 'wtf' ? 'rare' : 'normal');
      tone(hit.item.rarity === 'wtf' ? 980 : hit.item.rarity === 'mythic' ? 760 : 520 + game.state.multiplier * 18, .07, .026);
      vibration(hit.item.rarity === 'mythic' || hit.item.rarity === 'wtf' ? [18,25,18] : 10);
      if (game.state.busts > beforeBusts) triggerBust();
    } else {
      const beforeBusts = game.state.busts;
      game.state = core.applyMiss(game.state);
      game.eventTrail.push('miss');
      showToast('MISS +8 HEAT', 'danger');
      tone(165, .08, .025);
      if (game.state.busts > beforeBusts) triggerBust();
    }
  }

  function triggerBust() {
    game.eventTrail.push('bust');
    refs.lockdown.setAttribute('aria-hidden', 'false');
    showToast('BAG LOST', 'danger');
    vibration([50, 30, 70]);
    tone(95, .24, .045);
  }

  function updateCashout(now) {
    if (!game || cashoutStart == null || game.state.phase !== 'playing') return;
    const held = now - cashoutStart;
    refs.cashout.style.setProperty('--p', Math.min(1, held / core.RULESET.cashoutCommitMs));
    if (held >= core.RULESET.cashoutCommitMs) {
      const before = game.state.banked;
      game.state = core.completeCashout(game.state, held);
      cashoutStart = null;
      refs.cashout.style.setProperty('--p', 0);
      if (game.state.banked > before) {
        game.eventTrail.push('cashout');
        showToast('BANKED. SAFE.', 'rare');
        tone(680, .1, .03);
        vibration(16);
      }
    }
  }

  function canvasPoint(event) {
    const rect = refs.canvas.getBoundingClientRect();
    return input.toNormalizedPointer(rect, event.clientX, event.clientY);
  }

  refs.canvas.addEventListener('pointerdown', (e) => {
    if (!game || (game.state.phase !== 'playing' && game.state.phase !== 'one-more-attempt')) return;
    if (game.state.phase === 'lockdown') return;
    refs.canvas.setPointerCapture?.(e.pointerId);
    drag = canvasPoint(e);
    e.preventDefault();
  });
  refs.canvas.addEventListener('pointermove', (e) => { if (drag) drag = canvasPoint(e); });
  refs.canvas.addEventListener('pointerup', (e) => {
    if (!drag || !game) return;
    const endDrag = canvasPoint(e);
    const claw = { x: .5, y: .885 };
    const shot = input.flickToShot(claw, endDrag);
    drag = null;
    fireShot(shot);
  });
  refs.canvas.addEventListener('pointercancel', () => { drag = null; });

  refs.cashout.addEventListener('pointerdown', (e) => {
    if (!game || refs.cashout.disabled || game.state.phase !== 'playing') return;
    refs.cashout.setPointerCapture?.(e.pointerId);
    cashoutStart = performance.now();
    e.preventDefault();
  });
  const cancelCashout = () => { cashoutStart = null; refs.cashout.style.setProperty('--p', 0); };
  refs.cashout.addEventListener('pointerup', cancelCashout);
  refs.cashout.addEventListener('pointercancel', cancelCashout);
  refs.cashout.addEventListener('pointerleave', (e) => { if (e.buttons === 0) cancelCashout(); });

  refs.dailyBtn.addEventListener('click', () => startGame('daily'));
  refs.freeBtn.addEventListener('click', () => startGame('free'));
  refs.safeBtn.addEventListener('click', () => {
    refs.decision.setAttribute('aria-hidden', 'true');
    game.state = core.completeCashout(game.state, core.RULESET.cashoutCommitMs);
    game.eventTrail.push('cashout');
    finishRun();
  });
  refs.oneMoreBtn.addEventListener('click', beginOneMore);
  refs.againBtn.addEventListener('click', () => {
    refs.result.setAttribute('aria-hidden', 'true');
    if (game?.config.mode === 'onboarding' || game?.config.ranked) startGame('daily');
    else startGame(game?.requested || 'free');
  });
  refs.homeBtn.addEventListener('click', () => {
    refs.result.setAttribute('aria-hidden', 'true');
    refs.game.setAttribute('aria-hidden', 'true');
    refs.landing.setAttribute('aria-hidden', 'false');
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

  function draw(now) {
    const w = refs.canvas.width, h = refs.canvas.height;
    ctx.clearRect(0,0,w,h);
    drawWorld(w,h,now);
    drawTargets(w,h,now);
    drawShot(w,h,now);
    drawParticles(w,h,now);
    drawClaw(w,h);
    if (drag) drawAim(w,h,drag);
  }

  function drawWorld(w,h,now) {
    ctx.fillStyle = C.bg; ctx.fillRect(0,0,w,h);
    const glow = ctx.createRadialGradient(w*.5,h*.42,30,w*.5,h*.42,w*.7);
    glow.addColorStop(0,'rgba(142,107,255,.11)'); glow.addColorStop(1,'rgba(17,16,24,0)');
    ctx.fillStyle = glow; ctx.fillRect(0,0,w,h);

    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    for (let y=.16;y<.74;y+=.095) { ctx.beginPath(); ctx.moveTo(0,y*h); ctx.lineTo(w,y*h); ctx.stroke(); }
    for (let x=.1;x<1;x+=.1) { ctx.beginPath(); ctx.moveTo(x*w,.14*h); ctx.lineTo(x*w,.72*h); ctx.stroke(); }

    ctx.fillStyle = C.conveyor; roundRect(ctx, w*.03,h*.72,w*.94,h*.055,16,true,false);
    ctx.strokeStyle = C.conveyorLine; ctx.lineWidth = 4;
    const shift = (now*.08)%42;
    for (let x=-42+shift;x<w+42;x+=42) { ctx.beginPath(); ctx.moveTo(x,h*.732); ctx.lineTo(x+22,h*.762); ctx.stroke(); }
  }

  function drawTargets(w,h,now) {
    const targets = activeTargets(game.elapsed);
    for (const t of targets) {
      const x=t.x*w, y=t.y*h, r=t.radius*w;
      const rarity=t.item.rarity, color=C[rarity]||C.white;
      ctx.save(); ctx.translate(x,y);
      if (rarity==='mythic'||rarity==='wtf') { ctx.shadowColor=color; ctx.shadowBlur=20; }
      ctx.fillStyle=color;
      if (t.item.movementProfile==='dash') polygon(ctx,0,0,r,6,Math.PI/6);
      else if (t.item.movementProfile==='wave') polygon(ctx,0,0,r,5,-Math.PI/2);
      else if (t.item.movementProfile==='float') { ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill(); }
      else roundRect(ctx,-r,-r,r*2,r*2,r*.35,true,false);
      ctx.shadowBlur=0;
      ctx.fillStyle='#111018'; ctx.font=`900 ${Math.max(10,r*.68)}px ${getComputedStyle(document.body).fontFamily}`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(t.item.icon.slice(0,1).toUpperCase(),0,1);
      ctx.restore();
    }
  }

  function drawClaw(w,h) {
    const x=w*.5,y=h*.885,r=w*.058;
    ctx.save(); ctx.translate(x,y); ctx.fillStyle=C.claw; ctx.shadowColor='rgba(223,255,54,.25)'; ctx.shadowBlur=18;
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    ctx.fillStyle=C.clawDark; ctx.lineWidth=5; ctx.strokeStyle=C.clawDark;
    ctx.beginPath(); ctx.moveTo(-r*.42,-r*.15); ctx.lineTo(-r*.72,-r*.78); ctx.moveTo(r*.42,-r*.15); ctx.lineTo(r*.72,-r*.78); ctx.moveTo(0,-r*.28); ctx.lineTo(0,-r*.92); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,r*.24,0,Math.PI*2); ctx.fill(); ctx.restore();
  }

  function drawAim(w,h,dragPoint) {
    const shot=input.flickToShot({x:.5,y:.885},dragPoint);
    ctx.save(); ctx.setLineDash([9,11]); ctx.lineWidth=3; ctx.strokeStyle='rgba(223,255,54,.72)';
    ctx.beginPath(); ctx.moveTo(shot.start.x*w,shot.start.y*h); ctx.lineTo(shot.end.x*w,shot.end.y*h); ctx.stroke();
    ctx.setLineDash([]); ctx.strokeStyle='rgba(255,255,255,.22)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(.5*w,.885*h); ctx.lineTo(dragPoint.x*w,dragPoint.y*h); ctx.stroke(); ctx.restore();
  }

  function drawShot(w,h,now) {
    if (!shotFx) return;
    const age=now-shotFx.born;
    if (age>220) { shotFx=null; return; }
    const p=Math.min(1,age/110); const end=shotFx.hit||shotFx.end;
    ctx.save(); ctx.strokeStyle=C.claw; ctx.lineWidth=5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(shotFx.start.x*w,shotFx.start.y*h); ctx.lineTo((shotFx.start.x+(end.x-shotFx.start.x)*p)*w,(shotFx.start.y+(end.y-shotFx.start.y)*p)*h); ctx.stroke(); ctx.restore();
  }

  function drawParticles(w,h,now) {
    particles=particles.filter(p=>now-p.born<p.life);
    for (const p of particles) {
      const age=(now-p.born)/1000, alpha=Math.max(0,1-(now-p.born)/p.life);
      p.x+=p.vx*.016; p.y+=p.vy*.016; p.vy+=.11*.016;
      ctx.globalAlpha=alpha; ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x*w,p.y*h,3+alpha*4,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  function roundRect(c,x,y,w,h,r,fill,stroke){ c.beginPath(); c.roundRect(x,y,w,h,r); if(fill)c.fill(); if(stroke)c.stroke(); }
  function polygon(c,x,y,r,sides,rotation){ c.beginPath(); for(let i=0;i<sides;i++){const a=rotation+i*Math.PI*2/sides; const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r; i?c.lineTo(px,py):c.moveTo(px,py);} c.closePath(); c.fill(); }

  updateLanding();
})();
