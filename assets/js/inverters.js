/* ==========================================================================
   Case study 02 — Two parallel inverters for a PV chain
   ========================================================================== */
(function () {
  'use strict';
  const OEM = window.OEM;
  if (!OEM || !OEM.ok || !OEM.project) return;
  const { $, $$, whileVisible } = OEM.project;
  const reduce = OEM.reduce;
  const TAU = Math.PI * 2;
  const tri = (u) => 4 * Math.abs(u - Math.floor(u) - 0.5) - 1;          // -1..1 triangle, period 1
  const f2 = (n) => n.toFixed(2);

  /* square-edged path from a boolean sampler */
  function gatePath(fn, x0, x1, yHi, yLo, n) {
    let d = '', prev = null;
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      const on = fn(k / n);
      const y = on ? yHi : yLo;
      if (prev === null) d = `M${f2(x)} ${y}`;
      else if (on !== prev) d += `L${f2(x)} ${prev ? yHi : yLo}L${f2(x)} ${y}`;
      prev = on;
    }
    return d + `L${f2(x1)} ${prev ? yHi : yLo}`;
  }
  function wavePath(fn, x0, x1, n) {
    let d = '';
    for (let k = 0; k <= n; k++) { const x = x0 + ((x1 - x0) * k) / n; d += (k ? 'L' : 'M') + f2(x) + ' ' + f2(fn(k / n)); }
    return d;
  }

  /* ---------- hero: a sine that keeps turning into its own SPWM pulses ---------- */
  function hero() {
    const svg = $('.inv-hero__wave');
    const w1 = $('.w1', svg), w2 = $('.w2', svg);
    const sine = wavePath((u) => 150 + 105 * Math.sin(u * TAU * 3), 0, 1440, 360);
    const pulses = gatePath((u) => Math.sin(u * TAU * 3) * 0.9 > tri(u * 3 * 9), 0, 1440, 45, 255, 2400);
    w1.setAttribute('d', sine);
    w2.setAttribute('d', wavePath((u) => 150 + 105 * Math.sin(u * TAU * 3 - 2.1), 0, 1440, 360));
    if (reduce) return null;
    gsap.to(svg, { yPercent: 30, ease: 'none', scrollTrigger: { trigger: '.p-hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.inv-hero__board', { yPercent: -10, rotate: 1, ease: 'none', scrollTrigger: { trigger: '.p-hero', start: 'top top', end: 'bottom top', scrub: true } });
    return gsap.timeline({ paused: true })
      .from([w2, w1], { drawSVG: 0, duration: 1.8, ease: 'power2.inOut', stagger: 0.2 }, 0)
      .from('.inv-hero__board', { y: 80, rotate: 12, autoAlpha: 0, duration: 1.4, ease: 'expo.out' }, 0.2)
      .add(() => {
        gsap.timeline({ repeat: -1, repeatDelay: 1.2, delay: 0.6 })
          .to(w1, { morphSVG: { shape: pulses, type: 'linear' }, duration: 1.2, ease: 'power2.inOut' })
          .to(w1, { morphSVG: { shape: sine, type: 'linear' }, duration: 1.2, ease: 'power2.inOut' }, '+=1.6');
      });
  }

  /* ---------- the chain: drawn in, then energy flows ---------- */
  function chain() {
    const svg = $('#arch');
    const pulses = $$('.pulse', svg);
    if (reduce) return;
    gsap.from(svg.querySelectorAll('.wire'), { drawSVG: 0, duration: 1.4, ease: 'power2.inOut', stagger: 0.1, scrollTrigger: { trigger: svg, start: 'top 80%', once: true } });
    gsap.from(svg.querySelectorAll('.blk'), { autoAlpha: 0, y: 16, duration: 0.7, ease: 'power3.out', stagger: 0.06, scrollTrigger: { trigger: svg, start: 'top 80%', once: true } });
    const flow = gsap.to(pulses, { strokeDashoffset: -240, duration: 2.2, ease: 'none', repeat: -1, paused: true });
    whileVisible(svg, () => flow.play(), () => flow.pause());
  }

  /* ---------- the live thing: an SPWM generator ---------- */
  function spwm() {
    const L = 64, R = 20, X0 = L, X1 = 900 - R;
    const rows = { ref: 120, amp: 88, s1: [244, 288], s3: [306, 350], s5: [368, 412], vab: 506, vamp: 64 };
    let ax = '';
    const lab = (y, t) => `<text x="${L - 12}" y="${y + 4}" text-anchor="end">${t}</text>`;
    ax += `<line x1="${X0}" y1="${rows.ref}" x2="${X1}" y2="${rows.ref}" class="ax__zero"/>`;
    ax += `<line x1="${X0}" y1="${rows.vab}" x2="${X1}" y2="${rows.vab}" class="ax__zero"/>`;
    for (let k = 0; k <= 4; k++) { const x = X0 + ((X1 - X0) * k) / 4; ax += `<line x1="${x}" y1="20" x2="${x}" y2="580"/>`; }
    ax += lab(rows.ref - rows.amp, '+1') + lab(rows.ref + rows.amp, '−1') + lab(266, 'S1') + lab(328, 'S3') + lab(390, 'S5') + lab(rows.vab, 'vab');
    ax += `<text class="ax__title" x="${X0}" y="20">References va, vb, vc and the carrier</text><text class="ax__title" x="${X0}" y="438">Line voltage vab and its fundamental</text>`;
    ax += `<text x="${X0}" y="596">0°</text><text x="${(X0 + X1) / 2}" y="596" text-anchor="middle">180°</text><text x="${X1}" y="596" text-anchor="end">360°</text>`;
    $('#spwm-ax').innerHTML = ax;

    const el = { car: $('#sp-car'), a: $('#sp-a'), b: $('#sp-b'), c: $('#sp-c'), s1: $('#sp-s1'), s3: $('#sp-s3'), s5: $('#sp-s5'), vab: $('#sp-vab'), fund: $('#sp-fund') };
    const mIn = $('#sp-m'), fIn = $('#sp-f'), play = $('#sp-play');
    const out = { m: $('#sp-m-out'), f: $('#sp-f-out'), fs: $('#sp-fs'), pulses: $('#sp-pulses'), vll: $('#sp-vll') };
    const st = { m: 0.8, mf: 15, phase: 0, run: !reduce, mT: 0.8 };
    const fill = (inp) => inp.style.setProperty('--fill', ((inp.value - inp.min) / (inp.max - inp.min)) * 100 + '%');

    function draw() {
      const { m, mf, phase } = st;
      const th = (u) => u * TAU + phase;
      const va = (u) => m * Math.sin(th(u));
      const vb = (u) => m * Math.sin(th(u) - TAU / 3);
      const vc = (u) => m * Math.sin(th(u) + TAU / 3);
      const car = (u) => tri((th(u) / TAU) * mf + 0.25);
      const Y = (v) => rows.ref - v * rows.amp;
      el.car.setAttribute('d', wavePath((u) => Y(car(u)), X0, X1, Math.max(400, mf * 40)));
      el.a.setAttribute('d', wavePath((u) => Y(va(u)), X0, X1, 300));
      el.b.setAttribute('d', wavePath((u) => Y(vb(u)), X0, X1, 300));
      el.c.setAttribute('d', wavePath((u) => Y(vc(u)), X0, X1, 300));
      const N = 1800;
      el.s1.setAttribute('d', gatePath((u) => va(u) >= car(u), X0, X1, rows.s1[0], rows.s1[1], N));
      el.s3.setAttribute('d', gatePath((u) => vb(u) >= car(u), X0, X1, rows.s3[0], rows.s3[1], N));
      el.s5.setAttribute('d', gatePath((u) => vc(u) >= car(u), X0, X1, rows.s5[0], rows.s5[1], N));
      // vab = (S1 − S3)·Vdc : three levels
      let d = '', prevY = null;
      for (let k = 0; k <= N; k++) {
        const u = k / N, x = X0 + (X1 - X0) * u;
        const v = (va(u) >= car(u) ? 1 : 0) - (vb(u) >= car(u) ? 1 : 0);
        const y = rows.vab - v * rows.vamp;
        if (prevY === null) d = `M${f2(x)} ${y}`;
        else if (y !== prevY) d += `L${f2(x)} ${prevY}L${f2(x)} ${y}`;
        prevY = y;
      }
      el.vab.setAttribute('d', d + `L${X1} ${prevY}`);
      el.fund.setAttribute('d', wavePath((u) => rows.vab - (Math.sqrt(3) / 2) * m * Math.sin(th(u) + Math.PI / 6) * rows.vamp, X0, X1, 300));
      out.fs.textContent = mf * 50;
      out.pulses.textContent = mf;
      out.vll.textContent = ((Math.sqrt(3) / 2) * m).toFixed(2);
    }

    let active = false;
    gsap.ticker.add((t, dt) => {
      if (!active) return;
      let dirty = false;
      if (Math.abs(st.m - st.mT) > 0.001) { st.m += (st.mT - st.m) * 0.2; dirty = true; }
      if (st.run) { st.phase += (dt / 1000) * TAU * 0.18; dirty = true; }
      if (dirty) draw();
    });
    whileVisible($('#spwm-svg'), () => { active = true; }, () => { active = false; });
    mIn.addEventListener('input', () => { st.mT = +mIn.value; out.m.textContent = (+mIn.value).toFixed(2); fill(mIn); });
    fIn.addEventListener('input', () => { st.mf = +fIn.value; out.f.textContent = fIn.value; fill(fIn); draw(); });
    play.addEventListener('click', () => {
      st.run = !st.run;
      play.setAttribute('aria-pressed', String(st.run));
      play.textContent = st.run ? 'Running' : 'Paused';
    });
    if (reduce) { play.setAttribute('aria-pressed', 'false'); play.textContent = 'Paused'; }
    fill(mIn); fill(fIn); draw();
  }

  /* ---------- sharing the load: scroll brings inverter 2 online ---------- */
  function share() {
    const W = 900, H = 360, L = 50, R = 16, mid = 180, amp = 130;
    let ax = `<line x1="${L}" y1="${mid}" x2="${W - R}" y2="${mid}" class="ax__zero"/>`;
    for (const v of [-1, -0.5, 0.5, 1]) ax += `<line x1="${L}" y1="${mid - v * amp}" x2="${W - R}" y2="${mid - v * amp}"/><text x="${L - 10}" y="${mid - v * amp + 4}" text-anchor="end">${v > 0 ? '+' : '−'}${Math.abs(v)}</text>`;
    $('#share-ax').innerHTML = ax;
    const pL = $('#sh-l'), p1 = $('#sh-1'), p2 = $('#sh-2');
    const s1 = $('[data-s1]'), s2 = $('[data-s2]');
    const st = { s: reduce ? 1 : 0, ph: 0 };
    const draw = () => {
      const a1 = 1 - st.s / 2, a2 = st.s / 2;
      const w = (a) => wavePath((u) => mid - a * amp * Math.sin(u * TAU * 3 + st.ph), L, W - R, 360);
      pL.setAttribute('d', w(1));
      p1.setAttribute('d', w(a1));
      p2.setAttribute('d', w(a2));
      s1.textContent = Math.round(a1 * 100);
      s2.textContent = Math.round(a2 * 100);
    };
    draw();
    if (reduce) return;
    ScrollTrigger.create({ trigger: '#share-svg', start: 'top 80%', end: 'bottom 35%', scrub: 0.6, onUpdate: (self) => { st.s = gsap.parseEase('power2.inOut')(self.progress); draw(); } });
    let active = false;
    gsap.ticker.add((t, dt) => { if (!active) return; st.ph += (dt / 1000) * 1.4; draw(); });
    whileVisible($('#share-svg'), () => { active = true; }, () => { active = false; });
  }

  /* ---------- go ---------- */
  chain();
  spwm();
  share();
  OEM.project.stack($('.pstack'), '.pcard');
  OEM.project.start(hero);
})();
