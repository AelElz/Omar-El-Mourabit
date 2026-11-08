/* ==========================================================================
   Case study 01 — Analog MPPT in OrCAD PSpice
   ========================================================================== */
(function () {
  'use strict';
  const OEM = window.OEM;
  if (!OEM || !OEM.ok || !OEM.project) return;
  const { $, $$, svg, poly, whileVisible } = OEM.project;
  const reduce = OEM.reduce;
  const D = OEM.data;

  /* ---------- single-diode PV model (36 cells), for the illustrations ---------- */
  function pvModel(G, T) {
    const n = 1.3, Ns = 36, Rs = 0.3;
    const Vt = (1.380649e-23 * (T + 273.15)) / 1.602177e-19;
    const a = n * Ns * Vt;
    const IscT = 4.8 + 0.0025 * (T - 25);
    const VocT = 21.6 - 0.08 * (T - 25);
    const I0 = IscT / (Math.exp(VocT / a) - 1);
    const Iph = IscT * (G / 1000);
    const I = (V) => {
      let i = Iph;
      for (let k = 0; k < 40; k++) {
        const e = Math.exp((V + i * Rs) / a);
        const f = Iph - I0 * (e - 1) - i;
        const df = (-I0 * e * Rs) / a - 1;
        const di = f / df;
        i -= di;
        if (Math.abs(di) < 1e-8) break;
      }
      return Math.max(0, i);
    };
    const Voc = a * Math.log(Iph / I0 + 1);
    let Pmax = 0, Vmpp = 0;
    const pts = [];
    for (let k = 0; k <= 180; k++) {
      const V = (k / 180) * Voc;
      const i = I(V);
      const p = V * i;
      pts.push([V, i, p]);
      if (p > Pmax) { Pmax = p; Vmpp = V; }
    }
    return { I, Voc, Pmax, Vmpp, pts };
  }

  /* ---------- hero: the P–V hump, a tracker climbs it and becomes the mark ---------- */
  function hero() {
    const s = $('.mppt-hero__svg');
    const m = pvModel(1000, 25);
    // fit the drawing to the screen's aspect so the peak (and the mark) stays in view on phones
    const VW = Math.round(Math.min(1440, Math.max(520, (900 * s.clientWidth) / Math.max(1, s.clientHeight))));
    s.setAttribute('viewBox', `0 0 ${VW} 900`);
    const X = (V) => VW * 0.075 + (V / m.Voc) * VW * 0.85;
    const Y = (p) => 430 - (p / m.Pmax) * 300;
    let g = '';
    for (let x = 0; x <= VW; x += 80) g += `<line x1="${x}" y1="0" x2="${x}" y2="900"/>`;
    for (let y = 20; y <= 900; y += 80) g += `<line x1="0" y1="${y}" x2="${VW}" y2="${y}"/>`;
    $('.mppt-hero__grid', s).innerHTML = g;
    const pts = m.pts.map(([V, , p]) => [X(V), Y(p)]);
    const curve = $('.mppt-hero__curve', s);
    curve.setAttribute('d', poly(pts));
    $('.mppt-hero__area', s).setAttribute('d', poly(pts) + `L${X(m.Voc)} 430 L${X(0)} 430 Z`);

    const grp = $('.mppt-hero__mpp', s);
    const tracker = $('.mppt-hero__tracker', s);
    const label = $('.mppt-hero__label', s);
    const dotD = 'M79.5,49 C96.07,49 109.5,62.43 109.5,79 C109.5,95.57 96.07,109 79.5,109 C62.93,109 49.5,95.57 49.5,79 C49.5,62.43 62.93,49 79.5,49 Z';
    tracker.setAttribute('d', dotD);
    tracker.setAttribute('transform', 'translate(-23.85 -23.7) scale(0.3)');
    const glow = $('.mppt-hero__glow', s);
    const mx = X(m.Vmpp), my = Y(m.Pmax);
    const flip = mx > VW * 0.7 && VW < 1000;
    label.setAttribute('x', flip ? mx - 40 : mx + 48);
    label.setAttribute('y', my - 34);
    if (flip) label.setAttribute('text-anchor', 'end');

    const at = (V) => [X(V), Y(V * m.I(V))];
    const place = (V) => { const [x, y] = at(V); grp.setAttribute('transform', `translate(${x} ${y})`); };

    if (reduce) {
      place(m.Vmpp);
      tracker.setAttribute('d', OEM.UNION_D);
      return null;
    }
    const st = { V: m.Voc * 0.08 };
    place(st.V);
    gsap.set(glow, { attr: { r: 12 }, opacity: 0 });
    gsap.set(label, { autoAlpha: 0 });
    gsap.to('.p-hero__word', { yPercent: -18, ease: 'none', scrollTrigger: { trigger: '.p-hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to(s, { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.p-hero', start: 'top top', end: 'bottom top', scrub: true } });
    return gsap.timeline({ paused: true, delay: 0.1 })
      .from(curve, { drawSVG: 0, duration: 1.8, ease: 'power2.inOut' })
      .from('.mppt-hero__area', { autoAlpha: 0, duration: 1 }, 0.8)
      .from('.p-hero__word', { y: 80, autoAlpha: 0, duration: 1.6, ease: 'expo.out' }, 0)
      .to(st, { V: m.Vmpp, duration: 2, ease: 'power2.inOut', onUpdate: () => place(st.V) }, 0.9)
      .to(tracker, { morphSVG: OEM.UNION_D, duration: 0.7, ease: 'back.out(1.4)' }, '>-0.1')
      .fromTo(glow, { attr: { r: 14 }, opacity: 0.9 }, { attr: { r: 70 }, opacity: 0, duration: 1.4, ease: 'expo.out' }, '<')
      .to(label, { autoAlpha: 1, duration: 0.6 }, '<+0.2')
      .add(() => {
        // perturb and observe, forever: a small hunt around the peak
        gsap.to(st, { V: m.Vmpp + 0.55, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1, onUpdate: () => place(st.V) });
        gsap.fromTo(glow, { attr: { r: 14 }, opacity: 0.8 }, { attr: { r: 64 }, opacity: 0, duration: 2.2, ease: 'expo.out', repeat: -1, repeatDelay: 0.4 });
        gsap.to(tracker, { rotation: 360, svgOrigin: '79.5 79', duration: 18, ease: 'none', repeat: -1 });
      });
  }

  /* ---------- the live thing: P–V explorer with a perturb-and-observe tracker ---------- */
  function explorer() {
    const root = $('#pv-svg');
    if (!root) return;
    const W = 720, H = 440, L = 58, R = 58, T = 18, B = 46;
    const VMAX = 24, PMAX = 90, IMAX = 6;
    const X = (v) => L + (v / VMAX) * (W - L - R);
    const Y = (p) => T + (1 - p / PMAX) * (H - T - B);
    const YI = (i) => T + (1 - i / IMAX) * (H - T - B);
    let ax = '';
    for (let v = 0; v <= VMAX; v += 4) ax += `<line x1="${X(v)}" y1="${T}" x2="${X(v)}" y2="${H - B}"/><text x="${X(v)}" y="${H - B + 22}" text-anchor="middle">${v} V</text>`;
    for (let p = 0; p <= PMAX; p += 15) ax += `<line x1="${L}" y1="${Y(p)}" x2="${W - R}" y2="${Y(p)}"${p === 0 ? ' class="ax__zero"' : ''}/><text x="${L - 10}" y="${Y(p) + 4}" text-anchor="end">${p} W</text>`;
    for (let i = 0; i <= IMAX; i += 1) ax += `<text x="${W - R + 10}" y="${YI(i) + 4}">${i} A</text>`;
    $('#pv-ax').innerHTML = ax;

    const pPath = $('#pv-p'), iPath = $('#pv-i'), dot = $('#pv-dot'), mpp = $('#pv-mpp'), mppV = $('#pv-mpp-v'), trailG = $('#pv-trail');
    const gIn = $('#pv-g'), tIn = $('#pv-t'), gOut = $('#pv-g-out'), tOut = $('#pv-t-out');
    const out = { pmax: $('#pv-pmax'), vmpp: $('#pv-vmpp'), ptr: $('#pv-ptr'), eff: $('#pv-eff') };
    const runBtn = $('#pv-run'), cloudBtn = $('#pv-cloud');
    const trail = [];
    for (let k = 0; k < 14; k++) trail.push(svg('circle', { r: 3.5, fill: '#8cc3ea', opacity: 0 }, trailG));

    const state = { G: 1000, T: 25, Gt: 1000, Tt: 25, V: 9, dir: 1, Pprev: 0, on: true, acc: 0, k: 0 };
    let model = pvModel(state.G, state.T);
    const fill = (el) => el.style.setProperty('--fill', ((el.value - el.min) / (el.max - el.min)) * 100 + '%');

    function draw() {
      model = pvModel(state.G, state.T);
      pPath.setAttribute('d', poly(model.pts.map(([v, , p]) => [X(v), Y(p)])));
      iPath.setAttribute('d', poly(model.pts.map(([v, i]) => [X(v), YI(i)])));
      mpp.setAttribute('cx', X(model.Vmpp)); mpp.setAttribute('cy', Y(model.Pmax));
      mppV.setAttribute('x1', X(model.Vmpp)); mppV.setAttribute('x2', X(model.Vmpp));
      mppV.setAttribute('y1', Y(model.Pmax) + 10); mppV.setAttribute('y2', H - B);
    }
    function pAt(V) { return V * model.I(V); }
    function stepTracker() {
      if (!state.on) { state.V = Math.min(14, model.Voc * 0.98); return; }
      const P = pAt(state.V);
      if (P < state.Pprev) state.dir *= -1;
      state.Pprev = P;
      state.V = Math.max(0.5, Math.min(model.Voc - 0.2, state.V + state.dir * 0.32));
    }
    function render() {
      const P = pAt(state.V);
      dot.setAttribute('cx', X(state.V)); dot.setAttribute('cy', Y(P));
      trail.forEach((c, k) => {
        const h = trail.length - k;
        const v = trail._hist && trail._hist[k];
        if (v === undefined) return;
        c.setAttribute('cx', X(v)); c.setAttribute('cy', Y(pAt(v))); c.setAttribute('opacity', ((k + 1) / trail.length * 0.5).toFixed(2));
        void h;
      });
      out.pmax.textContent = model.Pmax.toFixed(1);
      out.vmpp.textContent = model.Vmpp.toFixed(1);
      out.ptr.textContent = P.toFixed(1);
      out.eff.textContent = Math.min(100, (P / model.Pmax) * 100).toFixed(1);
    }

    let active = false;
    const loop = (time, delta) => {
      if (!active) return;
      let dirty = false;
      if (Math.abs(state.G - state.Gt) > 0.5 || Math.abs(state.T - state.Tt) > 0.05) {
        state.G += (state.Gt - state.G) * 0.12; state.T += (state.Tt - state.T) * 0.12; dirty = true;
      }
      if (dirty) draw();
      state.acc += delta;
      if (state.acc > 80) {
        state.acc = 0;
        stepTracker();
        trail._hist = (trail._hist || []).concat(state.V).slice(-trail.length);
      }
      render();
    };
    gsap.ticker.add(loop);
    whileVisible(root, () => { active = true; }, () => { active = false; });

    gIn.addEventListener('input', () => { state.Gt = +gIn.value; gOut.textContent = gIn.value + ' W/m²'; fill(gIn); });
    tIn.addEventListener('input', () => { state.Tt = +tIn.value; tOut.textContent = tIn.value + ' °C'; fill(tIn); });
    runBtn.addEventListener('click', () => {
      state.on = !state.on;
      runBtn.setAttribute('aria-pressed', String(state.on));
      runBtn.textContent = state.on ? 'Tracker on' : 'Tracker off · fixed 14 V';
      if (state.on) { state.Pprev = 0; }
    });
    let cloud = null;
    cloudBtn.addEventListener('click', () => {
      if (cloud) cloud.kill();
      const base = +gIn.value;
      const proxy = { g: base };
      cloud = gsap.timeline()
        .to(proxy, { g: Math.max(150, base * 0.32), duration: 1.4, ease: 'power2.inOut' })
        .to(proxy, { g: base, duration: 2.2, ease: 'power2.inOut', delay: 1 });
      cloud.eventCallback('onUpdate', () => { state.Gt = proxy.g; gIn.value = Math.round(proxy.g / 10) * 10; gOut.textContent = gIn.value + ' W/m²'; fill(gIn); });
    });
    fill(gIn); fill(tIn);
    draw(); render();
    if (!reduce) gsap.from(pPath, { drawSVG: 0, duration: 1.6, ease: 'power2.inOut', scrollTrigger: { trigger: root, start: 'top 80%', once: true } });
  }

  /* ---------- the loop: seven animated mini scopes ---------- */
  function scopes() {
    const W = 360, H = 180;
    const grid = (el) => {
      const g = svg('g', { class: 'g' }, el);
      for (let x = 30; x < W; x += 30) svg('line', { x1: x, y1: 0, x2: x, y2: H }, g);
      for (let y = 30; y < H; y += 30) svg('line', { x1: 0, y1: y, x2: W, y2: y }, g);
    };
    const label = (el, x, y, t, fill) => { const n = svg('text', { x, y }, el); n.textContent = t; if (fill) n.setAttribute('style', 'fill:' + fill); return n; };
    const line = (el, pts, cls, extra) => svg('path', Object.assign({ d: poly(pts), class: 'tr ' + cls }, extra || {}), el);
    const sample = (fn, x0 = 10, x1 = 350, n = 240) => { const a = []; for (let k = 0; k <= n; k++) { const x = x0 + ((x1 - x0) * k) / n; a.push([x, fn(x)]); } return a; };
    const tri = (u) => 2 * Math.abs(u - Math.floor(u + 0.5));                       // 0..1 triangle
    const vref = D.vrefAt;
    const Ps = (t) => 73 - 60 * Math.pow(vref(t) - 2.985, 2);                          // power near the peak, from Vref

    const builders = {
      sense(el) {
        line(el, sample((x) => 56 + 3.5 * tri(x / 18) - 1.5 * Math.sin(x / 40)), 'tr--paper');
        line(el, sample((x) => 120 + 7 * tri(x / 18 + 0.5) + 2 * Math.sin(x / 33)), 'tr--sun');
        label(el, 12, 40, 'Vpv'); label(el, 12, 104, 'Ipv', '#FFD24A');
      },
      multiply(el) {
        line(el, sample((x) => 160 - (D.powerAt(((x - 10) / 340) * 160) / 80) * 140), 'tr--sun');
        label(el, 12, 22, 'P = V × I  (0 – 160 ms)', '#FFD24A');
      },
      compare(el) {
        const t = (x) => 100 + ((x - 10) / 340) * 50;
        const y = (p) => 80 - (p - 72.7) * 120;
        line(el, sample((x) => y(Ps(t(x)))), 'tr--sun');
        line(el, sample((x) => y(Ps(t(x) - 1.3))), 'tr--faint');
        line(el, sample((x) => (Ps(t(x)) >= Ps(t(x) - 1.3) ? 128 : 160), 10, 350, 600), 'tr--paper tr--thin');
        label(el, 12, 22, 'P(t)  vs  P(t − τ)', '#FFD24A'); label(el, 12, 122, 'rising?');
      },
      decide(el) {
        const t = (x) => 60 + ((x - 10) / 340) * 100;
        const q = (x) => (vref(t(x) + 0.4) >= vref(t(x)) ? 1 : 0);
        line(el, sample((x) => (q(x) ? 40 : 88), 10, 350, 700), 'tr--paper tr--thin');
        line(el, sample((x) => 168 - ((vref(t(x)) - 1.8) / 1.4) * 60), 'tr--sky');
        label(el, 12, 30, 'Q'); label(el, 12, 118, 'Vref', '#8cc3ea');
      },
      integrate(el) {
        line(el, sample((x) => 165 - (vref(((x - 10) / 340) * 160) / 4) * 150), 'tr--sky');
        label(el, 12, 22, 'Vref  (0 – 160 ms, from the run)', '#8cc3ea');
      },
      modulate(el) {
        const r = (x) => 0.22 + 0.5 * ((x - 10) / 340);
        const yv = (v) => 104 - v * 76;
        line(el, sample((x) => yv(tri((x - 10) / 34)), 10, 350, 400), 'tr--faint');
        line(el, sample((x) => yv(r(x))), 'tr--sky');
        line(el, sample((x) => (r(x) > tri((x - 10) / 34) ? 128 : 162), 10, 350, 1400), 'tr--sun tr--thin');
        label(el, 12, 20, 'carrier  ·  Vref', '#8cc3ea'); label(el, 12, 122, 'PWM', '#FFD24A');
      },
      drive(el) {
        const s = (d, cls) => svg('path', { d, class: 'sym ' + (cls || '') }, el);
        s('M24 50 H70');                                                            // from the panel
        s('M70 50 q8 -16 16 0 q8 -16 16 0 q8 -16 16 0 q8 -16 16 0', 'sym--sun');   // L1
        s('M134 50 H182');
        s('M182 38 L182 62 L204 50 Z M204 38 V62');                                   // D1
        s('M204 50 H330 V70');
        s('M330 70 l10 6 l-20 8 l20 8 l-20 8 l20 8 l-10 6 V140');                    // load
        s('M262 50 V84 M248 84 H276 M248 94 H276 M262 94 V140');                      // C8
        s('M150 50 V84 M140 84 V112 M140 92 L150 92 M150 92 V140 M126 98 H138');      // M1
        s('M24 140 H330');
        s('M24 50 V140', 'sym--sun');
        const flow = svg('path', { d: 'M24 50 H182 M204 50 H330 V140 H24', class: 'flow' }, el);
        label(el, 30, 34, 'PV'); label(el, 80, 34, 'L1', '#FFD24A'); label(el, 120, 120, 'IRF540'); label(el, 300, 34, '50 Ω');
        el._flow = flow;
      },
    };

    $$('[data-scope]').forEach((el) => {
      grid(el);
      builders[el.dataset.scope](el);
      if (reduce) return;
      const traces = el.querySelectorAll('.tr');
      let tl = null;
      if (el._flow) tl = gsap.to(el._flow, { strokeDashoffset: -160, duration: 2.4, ease: 'none', repeat: -1, paused: true });
      else tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8, paused: true })
        .fromTo(traces, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 2.6, ease: 'none', stagger: 0 })
        .to(traces, { opacity: 0.25, duration: 0.5 }, '+=0.6')
        .set(traces, { opacity: 1 });
      whileVisible(el, () => tl.play(), () => tl.pause());
    });
  }

  /* ---------- schematic tour ---------- */
  function schematic(pinned) {
    const sec = $('.schem');
    const caps = $$('.schem__cap', sec);
    const dots = $$('.schem__dots span', sec);
    const zoom = $('.schem__zoom', sec);
    const frame = $('.schem__frame', sec);
    const dim = $('.schem__dim', sec);
    const box = $('.schem__box', sec);
    if (!pinned) return () => {};
    const R = [
      { x: 0, y: 0, w: 852, h: 630 },
      { x: 205, y: 10, w: 400, h: 150 },
      { x: 25, y: 200, w: 225, h: 230 },
      { x: 330, y: 170, w: 515, h: 260 },
      { x: 0, y: 435, w: 315, h: 195 },
      { x: 285, y: 380, w: 480, h: 250 },
      { x: 595, y: 0, w: 257, h: 235 },
    ];
    const hole = (r) => `M0 0H852V630H0Z M${r.x} ${r.y}H${r.x + r.w}V${r.y + r.h}H${r.x}Z`;
    sec.classList.add('is-pinned');
    gsap.set(caps, { autoAlpha: 0 });
    gsap.set(caps[0], { autoAlpha: 1 });
    dim.setAttribute('d', hole(R[0]));
    let cur = 0;
    function go(i) {
      if (i === cur) return;
      const prev = cur; cur = i;
      const r = R[i];
      const fw = frame.clientWidth, fh = frame.clientHeight, k = fw / 852;
      const s = i === 0 ? 1 : gsap.utils.clamp(1, 2, Math.min(852 / r.w, 630 / r.h) * 0.82);
      let tx = fw / 2 - s * k * (r.x + r.w / 2);
      let ty = fh / 2 - s * k * (r.y + r.h / 2);
      tx = gsap.utils.clamp(fw - s * fw, 0, tx);
      ty = gsap.utils.clamp(fh - s * fh, 0, ty);
      gsap.to(zoom, { x: tx, y: ty, scale: s, duration: 1.1, ease: 'expo.inOut', overwrite: true });
      gsap.to(dim, { morphSVG: { shape: hole(r), shapeIndex: 0 }, duration: 0.9, ease: 'expo.inOut', overwrite: true });
      gsap.to(box, { attr: { x: r.x, y: r.y, width: r.w, height: r.h }, opacity: i === 0 ? 0 : 1, duration: 0.9, ease: 'expo.inOut', overwrite: true });
      gsap.to(caps[prev], { autoAlpha: 0, y: -16, duration: 0.35, overwrite: true });
      gsap.fromTo(caps[i], { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.6, delay: 0.2, ease: 'power3.out', overwrite: true });
      dots.forEach((d, k2) => d.classList.toggle('is-on', k2 === i));
    }
    const st = ScrollTrigger.create({
      trigger: '.schem__pin', start: 'top top', end: () => '+=' + window.innerHeight * 3.2, pin: true, anticipatePin: 1, refreshPriority: 9,
      onUpdate: (self) => go(Math.min(R.length - 1, Math.floor(self.progress * R.length * 0.999))),
    });
    return () => { st.kill(); sec.classList.remove('is-pinned'); gsap.set([zoom, ...caps], { clearProps: 'all' }); dim.setAttribute('d', hole(R[0])); cur = 0; };
  }

  /* ---------- the analysis: scroll plays the simulation ---------- */
  function analysis(pinned) {
    const sec = $('.analysis');
    const root = $('#an-svg');
    const W = 900, L = 62, R = 22;
    const pTop = 26, pBot = 292, vTop = 338, vBot = 516;
    const X = (t) => L + (t / 160) * (W - L - R);
    const YP = (p) => pTop + (1 - p / 80) * (pBot - pTop);
    const YV = (v) => vTop + (1 - v / 4) * (vBot - vTop);
    let ax = '';
    for (let t = 0; t <= 160; t += 20) ax += `<line x1="${X(t)}" y1="${pTop}" x2="${X(t)}" y2="${pBot}"/><line x1="${X(t)}" y1="${vTop}" x2="${X(t)}" y2="${vBot}"/><text x="${X(t)}" y="${vBot + 24}" text-anchor="middle">${t} ms</text>`;
    for (let p = 0; p <= 80; p += 20) ax += `<line x1="${L}" y1="${YP(p)}" x2="${W - R}" y2="${YP(p)}"${p === 0 ? ' class="ax__zero"' : ''}/><text x="${L - 10}" y="${YP(p) + 4}" text-anchor="end">${p} W</text>`;
    for (let v = 0; v <= 4; v += 1) ax += `<line x1="${L}" y1="${YV(v)}" x2="${W - R}" y2="${YV(v)}"${v === 0 ? ' class="ax__zero"' : ''}/><text x="${L - 10}" y="${YV(v) + 4}" text-anchor="end">${v} V</text>`;
    ax += `<text class="ax__title" x="${L}" y="${pTop - 8}">Panel power P(t)</text><text class="ax__title" x="${L}" y="${vTop - 8}">Control voltage Vref(t)</text>`;
    $('#an-ax').innerHTML = ax;

    const bands = $('.bands', root);
    const bandDefs = [[0, 19, 'an__band'], [19, 92, 'an__band an__band--2'], [92, 160, 'an__band an__band--3']];
    const bandEls = bandDefs.map(([a, b, c]) => svg('rect', { x: X(a), y: pTop, width: X(b) - X(a), height: vBot - pTop, class: c, opacity: 0 }, bands));

    // paths + cumulative lengths so the drawn length follows the cursor exactly
    const build = (fn, Yf) => {
      const pts = [], lens = [0];
      for (let t = 0; t <= 160.0001; t += 0.25) pts.push([X(t), Yf(fn(t))]);
      for (let k = 1; k < pts.length; k++) lens.push(lens[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      return { d: poly(pts), lens };
    };
    const pB = build(D.powerAt, YP), vB = build(D.vrefAt, YV);
    const pEl = $('#an-p'), vEl = $('#an-v');
    pEl.setAttribute('d', pB.d); vEl.setAttribute('d', vB.d);
    const cur = $('#an-cur'), dp = $('#an-dp'), dv = $('#an-dv');
    cur.setAttribute('y1', pTop); cur.setAttribute('y2', vBot);
    const peak = $('#an-peak');
    const pk = [X(7.8), YP(73.6)];
    peak.querySelector('line').setAttribute('x1', pk[0]); peak.querySelector('line').setAttribute('y1', pk[1]);
    peak.querySelector('line').setAttribute('x2', pk[0] + 60); peak.querySelector('line').setAttribute('y2', pk[1] - 4);
    peak.querySelector('text').setAttribute('x', pk[0] + 66); peak.querySelector('text').setAttribute('y', pk[1]);
    const mppG = $('#an-mpp-g'), mpp = $('#an-mpp');
    const dotD = 'M79.5,39 C101.6,39 119.5,56.9 119.5,79 C119.5,101.1 101.6,119 79.5,119 C57.4,119 39.5,101.1 39.5,79 C39.5,56.9 57.4,39 79.5,39 Z';
    mpp.setAttribute('d', dotD);
    gsap.set(mppG, { autoAlpha: 0 });
    const tRead = $('[data-t]', sec), pRead = $('[data-p]', sec), vRead = $('[data-v]', sec);
    const phases = $$('.an__phase', sec);
    let locked = false;

    function set(t) {
      const k = Math.round(t / 0.25);
      gsap.set(pEl, { drawSVG: `0 ${pB.lens[k]}` });
      gsap.set(vEl, { drawSVG: `0 ${vB.lens[k]}` });
      const x = X(t), P = D.powerAt(t), V = D.vrefAt(t);
      cur.setAttribute('x1', x); cur.setAttribute('x2', x);
      dp.setAttribute('cx', x); dp.setAttribute('cy', YP(P));
      dv.setAttribute('cx', x); dv.setAttribute('cy', YV(V));
      tRead.textContent = t.toFixed(1); pRead.textContent = P.toFixed(1); vRead.textContent = V.toFixed(2);
      peak.setAttribute('opacity', t > 8.5 ? 1 : 0);
      bandEls.forEach((b, i) => b.setAttribute('opacity', t >= bandDefs[i][0] ? 1 : 0));
      phases.forEach((ph) => ph.classList.toggle('is-on', t >= +ph.dataset.from && t < +ph.dataset.to));
      mppG.setAttribute('transform', `translate(${x - 15} ${YP(P) - 15}) scale(${30 / 159})`);
      const nowLocked = t >= 92;
      if (nowLocked !== locked) {
        locked = nowLocked;
        if (locked) {
          gsap.to(mppG, { autoAlpha: 1, duration: 0.3 });
          gsap.to(mpp, { morphSVG: OEM.UNION_D, duration: 0.6, ease: 'back.out(1.5)' });
          gsap.to(dp, { autoAlpha: 0, duration: 0.2 });
        } else {
          gsap.to(mpp, { morphSVG: dotD, duration: 0.4 });
          gsap.to(mppG, { autoAlpha: 0, duration: 0.3, delay: 0.2 });
          gsap.to(dp, { autoAlpha: 1, duration: 0.2 });
        }
      }
    }

    if (reduce) { set(160); return () => {}; }
    set(0);
    const proxy = { t: 0 };
    let st;
    if (pinned) {
      sec.classList.add('is-pinned');
      st = ScrollTrigger.create({
        trigger: '.an__pin', start: 'top top', end: () => '+=' + window.innerHeight * 2.6, pin: true, scrub: 0.7, anticipatePin: 1, refreshPriority: 8,
        onUpdate: (s) => { proxy.t = s.progress * 160; set(proxy.t); },
      });
    } else {
      st = ScrollTrigger.create({
        trigger: root, start: 'top 75%', end: 'bottom 25%', scrub: 0.7,
        onUpdate: (s) => set(s.progress * 160),
      });
    }
    return () => { st.kill(); sec.classList.remove('is-pinned'); };
  }

  /* ---------- go ---------- */
  explorer();
  scopes();
  const loopSec = $('.loop');
  const mm = gsap.matchMedia();
  mm.add({ desk: '(min-width: 1101px)', motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
    const ok = ctx.conditions.desk && ctx.conditions.motion;
    let h = null;
    if (ok) h = OEM.project.horizontal(loopSec, '.loop__pin', '.loop__track');
    const a = schematic(ok);
    return () => { a(); if (h) { h.scrollTrigger && h.scrollTrigger.kill(); h.kill(); gsap.set('.loop__track', { clearProps: 'all' }); loopSec.classList.remove('is-h'); } };
  });
  mm.add({ desk: '(min-width: 1101px)', motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
    const b = analysis(ctx.conditions.desk && ctx.conditions.motion);
    return () => b();
  });
  OEM.project.start(hero);
})();
