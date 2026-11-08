/* ==========================================================================
   Case study 03 — Automated concrete batching station (STEP 7, WinCC)
   ========================================================================== */
(function () {
  'use strict';
  const OEM = window.OEM;
  if (!OEM || !OEM.ok || !OEM.project) return;
  const { $, $$, svg, poly } = OEM.project;
  const reduce = OEM.reduce;

  const clock = () => {
    try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date()); }
    catch (e) { return new Date().toTimeString().slice(0, 8); }
  };

  /* ---------- hero: hoppers drawn, then a batch loops ---------- */
  function hero() {
    const s = $('.mlx-hero__svg');
    const lines = $$('.mlx-line', s);
    const fills = $$('.hfill', s);
    const mfill = $('.mfill', s);
    if (reduce) return null;
    gsap.to(s, { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.p-hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.p-hero__word', { yPercent: -16, ease: 'none', scrollTrigger: { trigger: '.p-hero', start: 'top top', end: 'bottom top', scrub: true } });
    const base = fills.map((f) => ({ y: +f.getAttribute('y'), h: +f.getAttribute('height') }));
    return gsap.timeline({ paused: true })
      .from('.p-hero__word', { y: 80, autoAlpha: 0, duration: 1.6, ease: 'expo.out' }, 0)
      .from(lines, { drawSVG: 0, duration: 1.6, ease: 'power2.inOut', stagger: 0.12 }, 0.1)
      .from(fills, { attr: { y: 165, height: 0 }, duration: 1.2, ease: 'power3.out', stagger: 0.1 }, 0.8)
      .add(() => {
        const loop = gsap.timeline({ repeat: -1, repeatDelay: 0.6, delay: 0.4 });
        fills.forEach((f, i) => {
          loop.to(f, { attr: { y: base[i].y + 34, height: base[i].h - 34 }, duration: 0.9, ease: 'power1.inOut' })
            .to(mfill, { attr: { y: `-=${28}`, height: `+=${28}` }, duration: 0.9, ease: 'power1.inOut' }, '<');
        });
        loop.to(mfill, { attr: { y: 390, height: 0 }, duration: 1, ease: 'power2.in' }, '+=0.8')
          .to(fills, { attr: (i) => ({ y: base[i].y, height: base[i].h }), duration: 0.8, ease: 'power2.out', stagger: 0.08 }, '+=0.2');
      });
  }

  /* ---------- the live thing: an HMI replica that runs a batch ---------- */
  function hmi() {
    const names = { s: 'sable', g: 'gravier', c: 'ciment' };
    const cap = { s: 2400, g: 3300, c: 1100 };
    const lv = { s: 0.9, g: 0.85, c: 0.8 };
    const w = { s: 0, g: 0, c: 0, w: 0 };
    const mx = { v: 0 };
    const el = {
      state: $('#hmi-state'), stateTxt: $('#hmi-state b'), clock: $('[data-hmi-clock]'), list: $('#alarm-list'),
      go: $('#b-go'), stop: $('#b-stop'), fill: $('#b-fill'), blade: $('#blade'), tmix: $('#t-mix'), lm: $('#l-m'),
    };
    const lamps = { s: $('#k-s'), g: $('#k-g'), c: $('#k-c'), m: $('#k-m'), d: $('#k-d'), w: $('#k-w') };
    const valves = { s: $('#v-s'), g: $('#v-g'), c: $('#v-c'), m: $('#v-m') };
    const pipes = { s: $('#p-s'), g: $('#p-g'), c: $('#p-c'), w: $('#p-w') };
    const lvEl = { s: $('#l-s'), g: $('#l-g'), c: $('#l-c') };
    const wEl = { s: $('#w-s'), g: $('#w-g'), c: $('#w-c'), w: $('#w-w') };
    const inputs = { s: $('#r-s'), g: $('#r-g'), c: $('#r-c'), w: $('#r-w') };
    let tl = null, spin = null, running = false, estop = false;

    const fillVar = (inp) => inp.style.setProperty('--fill', ((inp.value - inp.min) / (inp.max - inp.min)) * 100 + '%');
    Object.entries(inputs).forEach(([k, inp]) => {
      const out = $('#r-' + k + '-out');
      const unit = k === 'w' ? ' L' : ' kg';
      inp.addEventListener('input', () => { out.textContent = inp.value + unit; fillVar(inp); });
      fillVar(inp);
    });
    const recipe = () => ({ s: +inputs.s.value, g: +inputs.g.value, c: +inputs.c.value, w: +inputs.w.value });

    function render() {
      ['s', 'g', 'c'].forEach((k) => { const h = Math.max(0, lv[k]) * 125; lvEl[k].setAttribute('y', 165 - h); lvEl[k].setAttribute('height', h); });
      const mh = Math.max(0, Math.min(1, mx.v)) * 122;
      el.lm.setAttribute('y', 372 - mh); el.lm.setAttribute('height', mh);
      wEl.s.textContent = `S ${String(Math.round(w.s)).padStart(4, ' ')} kg`;
      wEl.g.textContent = `G ${String(Math.round(w.g)).padStart(4, ' ')} kg`;
      wEl.c.textContent = `C ${String(Math.round(w.c)).padStart(4, ' ')} kg`;
      wEl.w.textContent = `Eau ${Math.round(w.w)} L`;
    }
    const lamp = (k, state) => { lamps[k].classList.remove('on', 'done', 'err'); if (state) lamps[k].classList.add(state); };
    const valve = (k, open) => valves[k].classList.toggle('open', open);
    const flow = (k, on) => pipes[k].classList.toggle('flowing', on);
    function setState(text, mode) {
      el.stateTxt.textContent = text;
      el.state.classList.toggle('is-run', mode === 'run');
      el.state.classList.toggle('is-alarm', mode === 'alarm');
    }
    function log(text, kind) {
      const empty = el.list.querySelector('.alarms__empty');
      if (empty) empty.remove();
      const li = document.createElement('li');
      li.className = kind || '';
      li.innerHTML = `<span>${clock()}</span><span class="k">${text}</span><span>${kind === 'err' ? 'Défaut' : kind === 'ok' ? 'OK' : 'Info'}</span>`;
      el.list.prepend(li);
      while (el.list.children.length > 30) el.list.lastChild.remove();
      if (!reduce) gsap.from(li, { backgroundColor: kind === 'err' ? '#fde2df' : '#fff7d6', duration: 1.2 });
    }
    function buttons() {
      el.go.disabled = running || estop;
      el.fill.disabled = running;
      el.stop.textContent = estop ? 'Réarmer' : 'Arrêt d’urgence';
    }
    const resetLamps = () => Object.keys(lamps).forEach((k) => lamp(k, null));

    function run() {
      if (running || estop) return;
      const R = recipe();
      for (const k of ['s', 'g', 'c']) {
        if (lv[k] * cap[k] < R[k]) {
          lamp(k, 'err');
          setState('Défaut', 'alarm');
          log(`Trémie ${names[k]} vide`, 'err');
          return;
        }
      }
      running = true; buttons(); resetLamps();
      Object.assign(w, { s: 0, g: 0, c: 0, w: 0 }); render();
      setState('Marche', 'run'); log('Cycle lancé', 'ok');
      const k2 = reduce ? 0.35 : 1;
      tl = gsap.timeline({
        onComplete: () => {
          running = false; buttons(); setState('Prêt'); log('Cycle terminé', 'ok');
          gsap.delayedCall(1.4, () => { if (!running && !estop) resetLamps(); });
        },
      });
      ['s', 'g', 'c'].forEach((k) => {
        const d = (0.8 + (R[k] / 1000) * 1.2) * k2;
        tl.add(() => { lamp(k, 'on'); valve(k, true); flow(k, true); log(`Dosage ${names[k]} · consigne ${R[k]} kg`); })
          .to(lv, { [k]: lv[k] - R[k] / cap[k], duration: d, ease: 'none', onUpdate: render })
          .to(w, { [k]: R[k], duration: d, ease: 'none' }, '<')
          .to(mx, { v: `+=${R[k] / 2700}`, duration: d, ease: 'none' }, '<')
          .add(() => { lamp(k, 'done'); valve(k, false); flow(k, false); });
      });
      const dw = (0.6 + (R.w / 250) * 0.8) * k2;
      tl.add(() => { lamp('w', 'on'); flow('w', true); log(`Pompe ON · eau ${R.w} L`); })
        .to(w, { w: R.w, duration: dw, ease: 'none', onUpdate: render })
        .to(mx, { v: `+=${R.w / 2700}`, duration: dw, ease: 'none' }, '<')
        .add(() => { lamp('w', 'done'); flow('w', false); });
      const mixT = 3 * k2;
      const cd = { t: 3 };
      tl.add(() => {
        lamp('m', 'on'); log('Malaxage · 3 s');
        if (!reduce) spin = gsap.to(el.blade, { rotation: '+=1080', svgOrigin: '310 318', duration: mixT, ease: 'power1.inOut' });
      })
        .to(cd, { t: 0, duration: mixT, ease: 'none', onUpdate: () => { el.tmix.textContent = '00:0' + Math.ceil(cd.t); } })
        .add(() => { lamp('m', 'done'); el.tmix.textContent = '00:00'; });
      tl.add(() => { lamp('d', 'on'); valve('m', true); log('Vidange TRMLT'); })
        .to(mx, { v: 0, duration: 1.6 * k2, ease: 'power1.in', onUpdate: render })
        .add(() => { lamp('d', 'done'); valve('m', false); });
    }

    function emergency() {
      if (estop) { // réarmer
        estop = false; resetLamps(); setState('Prêt'); log('Défaut acquitté · réarmement', 'ok');
        if (mx.v > 0.01) { log('Vidange de sécurité'); valve('m', true); gsap.to(mx, { v: 0, duration: 1.2, onUpdate: render, onComplete: () => valve('m', false) }); }
        buttons();
        return;
      }
      estop = true;
      if (tl) { tl.kill(); tl = null; }
      if (spin) spin.kill();
      running = false;
      Object.keys(valves).forEach((k) => valve(k, false));
      Object.keys(pipes).forEach((k) => flow(k, false));
      Object.keys(lamps).forEach((k) => { if (lamps[k].classList.contains('on')) lamp(k, 'err'); });
      setState('Arrêt d’urgence', 'alarm');
      log('ARRÊT D’URGENCE', 'err');
      buttons();
    }

    function refill() {
      if (running) return;
      gsap.to(lv, { s: 1, g: 1, c: 1, duration: reduce ? 0 : 1, ease: 'power2.out', onUpdate: render });
      ['s', 'g', 'c'].forEach((k) => { if (lamps[k].classList.contains('err')) lamp(k, null); });
      if (!estop) setState('Prêt');
      log('Réservoirs remplis', 'ok');
    }

    el.go.addEventListener('click', run);
    el.stop.addEventListener('click', emergency);
    el.fill.addEventListener('click', refill);
    setInterval(() => { el.clock.textContent = clock(); }, 1000);
    el.clock.textContent = clock();
    render(); buttons();
  }

  /* ---------- the sequence chart, drawn as you scroll ---------- */
  function grafcet() {
    const root = $('#gf');
    const steps = [
      ['0', 'Attente · cycle prêt', 'Marche · réservoirs pleins'],
      ['1', 'Vanne TRS · dosage sable', 'Poids sable = consigne'],
      ['2', 'Vanne TRG · dosage gravier', 'Poids gravier = consigne'],
      ['3', 'Vanne TRC · dosage ciment', 'Poids ciment = consigne'],
      ['4', 'Pompe ON · ajout d’eau', 'Volume eau = consigne'],
      ['5', 'Malaxeur ON · temporisation', 'Temporisation écoulée'],
      ['6', 'Vanne TRMLT · vidange', 'Malaxeur vide'],
    ];
    const X = 60, S = 64, GAP = 128, Y0 = 30, CX = X + S / 2;
    const links = svg('g', {}, root);
    const groups = [];
    steps.forEach(([n, act, cond], i) => {
      const y = Y0 + i * GAP;
      const g = svg('g', { class: 'step' + (i === 0 ? ' init' : '') }, root);
      svg('rect', { x: X, y, width: S, height: S, rx: 4 }, g);
      if (i === 0) svg('rect', { class: 'inner', x: X + 6, y: y + 6, width: S - 12, height: S - 12, rx: 2 }, g);
      const t = svg('text', { x: CX, y: y + S / 2 + 9 }, g); t.textContent = n;
      const a = svg('g', { class: 'act' }, root);
      svg('rect', { x: 150, y: y + 8, width: 386, height: 48, rx: 10 }, a);
      const at = svg('text', { x: 168, y: y + 38 }, a); at.textContent = act;
      svg('path', { class: 'link', d: `M${X + S} ${y + S / 2} H150` }, links);
      const barY = y + S + 32;
      svg('path', { class: 'link', d: i < steps.length - 1 ? `M${CX} ${y + S} V${y + GAP}` : `M${CX} ${y + S} V${barY + 26} H22 V10 H${CX} V${Y0}` }, links);
      svg('path', { class: 'tr-bar', d: `M${CX - 22} ${barY} H${CX + 22}` }, links);
      const c = svg('text', { class: 'cond', x: CX + 34, y: barY + 5 }, links); c.textContent = cond;
      groups.push({ g, a });
    });
    svg('path', { class: 'link', d: `M${CX - 6} ${Y0 - 10} L${CX} ${Y0} L${CX + 6} ${Y0 - 10}` }, links);

    const setActive = (i) => groups.forEach((o, k) => o.g.classList.toggle('on', k === i));
    if (reduce) { setActive(0); return; }
    const shapes = root.querySelectorAll('rect, .link, .tr-bar');
    gsap.set(shapes, { drawSVG: '0%' });
    gsap.set(root.querySelectorAll('text'), { autoAlpha: 0 });
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: root, start: 'top 75%', end: 'bottom 70%', scrub: 0.6,
        onUpdate: (s) => setActive(Math.min(steps.length - 1, Math.floor(s.progress * steps.length * 0.999))),
      },
    });
    tl.to(shapes, { drawSVG: '100%', duration: 1, stagger: 0.05, ease: 'none' })
      .to(root.querySelectorAll('text'), { autoAlpha: 1, duration: 0.3, stagger: 0.04, ease: 'none' }, 0.1);
  }

  /* ---------- level curves over four batches ---------- */
  function trends() {
    const root = $('#trend-svg');
    const W = 900, H = 340, L = 56, R = 16, T = 18, B = 44;
    const X = (t) => L + (t / 100) * (W - L - R);
    const Y = (v) => T + (1 - v) * (H - T - B);
    const batches = [5, 25, 45, 75];
    const drop = { s: 0.28, g: 0.25, c: 0.24 };
    const start = { s: 0.9, g: 0.85, c: 0.8 };
    const win = { s: [0, 3], g: [3, 6], c: [6, 8] };
    // hopper level at time t: drops during its dosing window of each batch, refilled at 60–66
    const events = [['b', 5], ['b', 25], ['b', 45], ['r', 60], ['b', 75]];
    const level = (k, t) => {
      let v = start[k];
      for (const [type, at] of events) {
        if (type === 'r') {
          if (t <= at) return v;
          if (t < at + 6) return v + (1 - v) * ((t - at) / 6);
          v = 1;
        } else {
          const [a, z] = win[k];
          if (t <= at + a) return v;
          if (t < at + z) return v - drop[k] * ((t - at - a) / (z - a));
          v -= drop[k];
        }
      }
      return v;
    };
    const mixer = (t) => {
      for (const b of batches) {
        const u = t - b;
        if (u < 0) return 0;
        if (u < 9) return Math.min(0.9, u / 9 * 0.9);
        if (u < 12) return 0.9;
        if (u < 14) return 0.9 * (1 - (u - 12) / 2);
      }
      return 0;
    };
    let ax = '';
    for (let v = 0; v <= 1.0001; v += 0.25) ax += `<line x1="${L}" y1="${Y(v)}" x2="${W - R}" y2="${Y(v)}"${v === 0 ? ' class="ax__zero"' : ''}/><text x="${L - 10}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v * 100)}%</text>`;
    [['Cycle 1', 12], ['Cycle 2', 32], ['Cycle 3', 52], ['Remplissage', 63], ['Cycle 4', 82]].forEach(([t, x]) => { ax += `<text x="${X(x)}" y="${H - 14}" text-anchor="middle">${t}</text>`; });
    ax += `<line x1="${L}" y1="${Y(0.15)}" x2="${W - R}" y2="${Y(0.15)}" style="stroke:#e74c3c;stroke-dasharray:4 5;opacity:.7"/><text x="${W - R}" y="${Y(0.15) - 8}" text-anchor="end" style="fill:#ff8a7a">Seuil bas · 15 %</text>`;
    const g = svg('g', { class: 'ax' }, root); g.innerHTML = ax;
    const series = [['s', '#e3c27a'], ['g', '#8cc3ea'], ['c', '#c9c4bb']];
    const paths = series.map(([k, col]) => {
      const pts = []; for (let t = 0; t <= 100; t += 0.25) pts.push([X(t), Y(Math.max(0, level(k, t)))]);
      return svg('path', { d: poly(pts), class: 'tr', style: `stroke:${col}` }, root);
    });
    const mpts = []; for (let t = 0; t <= 100; t += 0.25) mpts.push([X(t), Y(mixer(t))]);
    paths.push(svg('path', { d: poly(mpts), class: 'tr tr--sun tr--thin' }, root));
    const alarmDot = svg('circle', { cx: X(53), cy: Y(level('s', 53)), r: 7, fill: '#e74c3c' }, root);
    if (reduce) return;
    gsap.from(paths, { drawSVG: 0, duration: 2.4, ease: 'power1.inOut', stagger: 0.15, scrollTrigger: { trigger: root, start: 'top 78%', once: true } });
    gsap.from(alarmDot, { scale: 0, transformOrigin: '50% 50%', duration: 0.6, ease: 'back.out(3)', delay: 2.2, scrollTrigger: { trigger: root, start: 'top 78%', once: true } });
  }

  /* ---------- go ---------- */
  hmi();
  grafcet();
  trends();
  OEM.project.stack($('#access .pstack'), '.pcard');
  const shots = $('.shots');
  const mm = gsap.matchMedia();
  mm.add({ desk: '(min-width: 1101px)', motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
    if (!(ctx.conditions.desk && ctx.conditions.motion)) return () => {};
    const h = OEM.project.horizontal(shots, '.shots__pin', '.shots__track');
    return () => { if (h) { h.scrollTrigger && h.scrollTrigger.kill(); h.kill(); gsap.set('.shots__track', { clearProps: 'all' }); shots.classList.remove('is-h'); } };
  });
  OEM.project.start(hero);
})();
