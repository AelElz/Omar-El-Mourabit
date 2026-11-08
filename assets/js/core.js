/* ==========================================================================
   Omar El Mourabit — core
   Lenis + GSAP (ScrollTrigger, DrawSVG, MorphSVG, SplitText), menu,
   page transitions, reveal helpers, clock, shared data.
   ========================================================================== */
(function () {
  'use strict';

  const OEM = (window.OEM = window.OEM || {});
  const body = document.body;
  const root = body.dataset.root || '';
  const isHome = body.dataset.page === 'home';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  OEM.reduce = reduce;
  OEM.root = root;

  // the loader and pinned scenes assume the page starts at the top; hashes are handled after the intro
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ---------- clock (works without GSAP) ---------- */
  function tick() {
    const now = new Date();
    let time = '';
    let off = 'GMT+1';
    try {
      time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit' }).format(now);
      const part = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Casablanca', timeZoneName: 'shortOffset' })
        .formatToParts(now).find((p) => p.type === 'timeZoneName');
      if (part) off = part.value === 'GMT' ? 'GMT+0' : part.value;
    } catch (e) { /* older browsers keep the default */ }
    document.querySelectorAll('[data-clock]').forEach((n) => { n.textContent = time || n.textContent; });
    document.querySelectorAll('[data-offset]').forEach((n) => { n.textContent = off; });
  }
  tick();
  setInterval(tick, 15000);

  /* ---------- shared data: Omar's PSpice traces, digitised ----------
     t in ms. Power anchors read from V(R11:2)*ABS(I(R13)); Vref from V(U2A:+). */
  OEM.data = (function () {
    const P = [[0, 3], [2, 22], [4, 45], [6, 64], [7.8, 73.6], [9.2, 64.5], [10.5, 47], [12, 31.5], [14, 20.5], [16.5, 15.6],
      [19.5, 14.1], [23, 14.8], [26.4, 16.5], [31, 19.1], [36.4, 22.1], [41, 25.1], [46.4, 28.5], [51, 32], [56.3, 36.3],
      [61, 40.6], [66.3, 45.5], [70.5, 48.7], [74.3, 51.2], [76.8, 52.7], [78.5, 54.6], [80.3, 57.4], [82.2, 60.4],
      [84.2, 63.3], [86.2, 66.2], [88.2, 69], [90.3, 71.6], [92.2, 73], [94, 73.3]];
    const V = [[0, 0.03], [10, 0.03], [12, 0.11], [16.4, 0.37], [22, 0.68], [28.6, 0.98], [35, 1.26], [41, 1.5], [48, 1.75],
      [55, 1.98], [62, 2.2], [69, 2.41], [76, 2.61], [83, 2.79], [90, 2.95], [96.5, 3.08], [103, 2.9], [110, 3.06], [115.3, 2.9],
      [121, 3.06], [126.2, 2.9], [131.5, 3.06], [136.8, 2.9], [142, 3.06], [147.3, 2.9], [152.5, 3.06], [157.8, 2.9], [160, 2.97]];

    // monotone cubic (Fritsch–Carlson) so the curves stay smooth without overshoot
    function monotone(pts) {
      const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const d = [], m = new Array(n);
      for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
      m[0] = d[0]; m[n - 1] = d[n - 2];
      for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
      for (let i = 0; i < n - 1; i++) {
        if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
        const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
        if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
      }
      return function (x) {
        if (x <= xs[0]) return ys[0];
        if (x >= xs[n - 1]) return ys[n - 1];
        let i = 0; while (x > xs[i + 1]) i++;
        const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
        return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
      };
    }
    const pCurve = monotone(P);
    const vLinear = (x) => { // the Vref hunting is a triangle: linear between anchors after the ramp
      if (x < 96.5) return vRamp(x);
      for (let i = 0; i < V.length - 1; i++) {
        if (x >= V[i][0] && x <= V[i + 1][0]) {
          const k = (x - V[i][0]) / (V[i + 1][0] - V[i][0]);
          return V[i][1] + k * (V[i + 1][1] - V[i][1]);
        }
      }
      return V[V.length - 1][1];
    };
    const vRamp = monotone(V.slice(0, 16));
    const powerAt = (t) => {
      if (t <= 94) return pCurve(t);
      const u = t - 94;
      return 72.95 + 0.5 * Math.sin((2 * Math.PI * u) / 3.9) + 0.32 * Math.sin((2 * Math.PI * u) / 10.6 + 1.1);
    };
    return { powerAt, vrefAt: vLinear, tMax: 160, pMax: 80, vMax: 4 };
  })();

  /* polyline path from a function */
  OEM.pathFrom = function (fn, { t0 = 0, t1 = 160, step = 0.4, x, y }) {
    let d = '';
    for (let t = t0; t <= t1 + 1e-9; t += step) d += (d ? 'L' : 'M') + x(t).toFixed(2) + ' ' + y(fn(t)).toFixed(2);
    return d;
  };

  /* ---------- no GSAP? keep everything static and visible ---------- */
  if (typeof window.gsap === 'undefined') {
    document.documentElement.classList.remove('js');
    OEM.ok = false;
    return;
  }
  OEM.ok = true;

  gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, MorphSVGPlugin, SplitText);
  // ScrollTrigger remembers the browser's restoration mode from before this script ran and
  // puts it back later; make "manual" its value too, or reloads land mid-page under the loader
  ScrollTrigger.clearScrollMemory('manual');
  if (!location.hash) window.addEventListener('load', () => { if (window.scrollY > 0 && document.querySelector('.loader')) window.scrollTo(0, 0); });

  // Anton drives every display line; split and fit those only once it has loaded
  OEM.fontsReady = (document.fonts && document.fonts.load)
    ? Promise.race([document.fonts.load('400 100px Anton').catch(() => {}).then(() => document.fonts.ready), new Promise((r) => setTimeout(r, 2500))])
    : Promise.resolve();
  const unionPath = document.getElementById('union-path');
  OEM.UNION_D = unionPath ? unionPath.getAttribute('d') : '';

  /* ---------- Lenis smooth scroll, synced with ScrollTrigger ---------- */
  let lenis = null;
  if (!reduce && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  OEM.lenis = lenis;

  OEM.scrollTo = function (target, opts) {
    const o = Object.assign({ duration: 1.5 }, opts || {});
    if (lenis) { lenis.scrollTo(target, o); return; }
    if (typeof target === 'number') window.scrollTo({ top: target, behavior: reduce || o.immediate ? 'auto' : 'smooth' });
    else if (target) target.scrollIntoView({ behavior: reduce || o.immediate ? 'auto' : 'smooth' });
  };

  window.addEventListener('scroll', () => body.classList.toggle('is-scrolled', window.scrollY > 120), { passive: true });

  /* ---------- menu ---------- */
  const href = (hash) => (isHome ? hash : root + 'index.html' + hash);
  const sections = [['01', 'About', '#about'], ['02', 'Projects', '#projects'], ['03', 'Toolkit', '#toolkit'],
    ['04', 'Education', '#education'], ['05', 'Experience', '#experience'], ['06', 'Contact', '#contact']];
  const cases = [['MPPT — an analog tracker in PSpice', 'projects/mppt.html'],
    ['Parallel inverters — SPWM on dSPACE', 'projects/parallel-inverters.html'],
    ['Mixing station — STEP 7 and WinCC', 'projects/mixing-station.html']];

  const btn = document.createElement('button');
  btn.className = 'menu-btn';
  btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'site-menu');
  btn.setAttribute('aria-label', 'Open menu');
  btn.innerHTML = '<span></span><span></span>';

  const menu = document.createElement('nav');
  menu.className = 'menu';
  menu.id = 'site-menu';
  menu.setAttribute('aria-label', 'Site');
  menu.innerHTML =
    '<div class="menu__backdrop"></div>' +
    '<div class="menu__panel">' +
      '<p class="menu__label">Menu</p>' +
      '<ul class="menu__list">' +
        sections.map(([n, label, h]) => `<li><a href="${href(h)}"${isHome ? '' : ' data-transition'}><small>${n}</small>${label}<span class="arr" aria-hidden="true">→</span></a></li>`).join('') +
      '</ul>' +
      '<div class="menu__cases"><p class="menu__label">Case studies</p>' +
        cases.map(([label, p]) => `<a href="${root}${p}" data-transition>${label}</a>`).join('') +
      '</div>' +
      '<div class="menu__foot">' +
        '<p class="menu__label">Get in touch</p>' +
        '<a class="menu__mail" href="mailto:omar.elmou14@gmail.com">omar.elmou14@gmail.com</a>' +
        `<a class="menu__cv" href="${root}assets/cv/Omar-El-Mourabit-CV.pdf" download><span>Download CV<small>PDF · 309 KB</small></span><span aria-hidden="true">↓</span></a>` +
      '</div>' +
    '</div>';
  body.appendChild(menu);
  body.appendChild(btn);

  const panel = menu.querySelector('.menu__panel');
  const backdrop = menu.querySelector('.menu__backdrop');
  const menuItems = menu.querySelectorAll('.menu__list li, .menu__cases, .menu__foot');
  let open = false;
  gsap.set(panel, { xPercent: 102 });
  const menuTl = gsap.timeline({ paused: true })
    .to(backdrop, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0)
    .fromTo(menuItems, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out', stagger: 0.045 }, 0.12);

  function openMenu() {
    if (open) return;
    open = true;
    menu.classList.add('is-open');
    body.classList.add('menu-open');
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Close menu');
    lenis && lenis.stop();
    gsap.to(panel, { xPercent: 0, duration: 0.75, ease: 'expo.out' });
    menuTl.timeScale(1).play();
    setTimeout(() => { const f = menu.querySelector('a'); f && f.focus({ preventScroll: true }); }, 120);
  }
  function closeMenu(immediate) {
    if (!open) return;
    open = false;
    body.classList.remove('menu-open');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Open menu');
    lenis && lenis.start();
    gsap.to(panel, { xPercent: 102, duration: immediate ? 0 : 0.55, ease: 'expo.in' });
    menuTl.timeScale(1.8).reverse();
    gsap.delayedCall(immediate ? 0 : 0.56, () => { if (!open) menu.classList.remove('is-open'); });
  }
  OEM.closeMenu = closeMenu;
  btn.addEventListener('click', () => (open ? closeMenu() : openMenu()));
  backdrop.addEventListener('click', () => closeMenu());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) { closeMenu(); btn.focus(); }
    if (e.key === 'Tab' && open) { // keep focus in the panel
      const f = [btn, ...menu.querySelectorAll('a')];
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ---------- in-page anchors through Lenis ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    let target = null;
    if (id === '#top' || id === '#') target = 0;
    else { try { target = document.querySelector(id); } catch (err) { return; } }
    if (target === null) return;
    e.preventDefault();
    if (open) closeMenu(true);
    OEM.scrollTo(target, { duration: 1.6 });
    if (target !== 0 && history.replaceState) history.replaceState(null, '', id);
  });

  /* ---------- page transitions: the mark morphs into a sun that covers the screen ---------- */
  const wipe = document.createElement('div');
  wipe.className = 'wipe';
  wipe.setAttribute('aria-hidden', 'true');
  wipe.innerHTML = `<svg viewBox="0 0 159 158"><path class="wipe__shape" d="${OEM.UNION_D}"/><circle class="wipe__circle" cx="79.2" cy="79" r="79"/></svg>`;
  body.appendChild(wipe);
  const wSvg = wipe.querySelector('svg');
  const wShape = wipe.querySelector('.wipe__shape');
  const wCircle = wipe.querySelector('.wipe__circle');
  const coverScale = () => {
    const size = wSvg.getBoundingClientRect().width / (gsap.getProperty(wSvg, 'scale') || 1) || Math.min(innerWidth, innerHeight) * 0.24;
    return (Math.hypot(innerWidth, innerHeight) / size) * 1.12;
  };

  let leaving = false;
  function leave(url) {
    if (leaving) return;
    leaving = true;
    if (reduce) { location.href = url; return; }
    try { sessionStorage.setItem('oem-wipe', '1'); } catch (e) { /* private mode */ }
    gsap.set(wipe, { visibility: 'visible' });
    gsap.set(wShape, { attr: { d: OEM.UNION_D } });
    gsap.timeline({ onComplete: () => { location.href = url; } })
      .fromTo(wSvg, { scale: 0, rotate: -120 }, { scale: 1, rotate: 0, duration: 0.55, ease: 'back.out(1.6)' })
      .to(wShape, { morphSVG: wCircle, duration: 0.35, ease: 'power2.inOut' }, '-=0.12')
      .to(wSvg, { scale: coverScale(), duration: 0.55, ease: 'power3.in' }, '-=0.18');
  }
  OEM.leave = leave;

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-transition]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin && location.protocol !== 'file:') return;
    // same page + hash: let the anchor handler deal with it
    if (url.pathname === location.pathname && url.hash) return;
    e.preventDefault();
    if (open) closeMenu(true);
    leave(a.href);
  });

  let arrived = false;
  try { arrived = sessionStorage.getItem('oem-wipe') === '1'; sessionStorage.removeItem('oem-wipe'); } catch (e) { /* ignore */ }
  OEM.arrivedByWipe = arrived && !reduce;

  OEM.revealWipe = function () {
    return new Promise((resolve) => {
      if (!OEM.arrivedByWipe) { resolve(); return; }
      gsap.set(wipe, { visibility: 'visible' });
      gsap.set(wShape, { morphSVG: wCircle });
      gsap.set(wSvg, { scale: coverScale(), rotate: 0 });
      gsap.timeline({ onComplete: () => { gsap.set(wipe, { visibility: 'hidden' }); } })
        .to(wSvg, { scale: 1, duration: 0.75, ease: 'expo.out' })
        .add(resolve, 0.25)
        .to(wShape, { morphSVG: OEM.UNION_D, duration: 0.35, ease: 'power2.inOut' }, 0.45)
        .to(wSvg, { scale: 0, rotate: 120, duration: 0.45, ease: 'back.in(1.6)' }, 0.7);
    });
  };

  // bfcache: coming back with the browser button must not show a covered page
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) { leaving = false; gsap.set(wipe, { visibility: 'hidden' }); gsap.set(wSvg, { scale: 0 }); }
  });

  /* ---------- reveal helpers ---------- */
  OEM.reveals = function (scope) {
    const s = scope || document;
    if (reduce) return;

    s.querySelectorAll('[data-reveal]').forEach((el) => {
      gsap.from(el, {
        y: 28, autoAlpha: 0, duration: 1.05, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });

    s.querySelectorAll('[data-stagger]').forEach((group) => {
      gsap.from(group.children, {
        y: 26, autoAlpha: 0, duration: 0.9, ease: 'power3.out', stagger: 0.075,
        scrollTrigger: { trigger: group, start: 'top 86%', once: true },
      });
    });

    OEM.fontsReady.then(() => s.querySelectorAll('[data-split]').forEach((el) => {
      SplitText.create(el, {
        type: 'lines', mask: 'lines', autoSplit: true,
        onSplit(self) {
          return gsap.from(self.lines, {
            yPercent: 112, duration: 1.15, ease: 'expo.out', stagger: 0.09,
            scrollTrigger: { trigger: el, start: 'top 87%', once: true },
          });
        },
      });
    }));

    OEM.fontsReady.then(() => s.querySelectorAll('[data-words]').forEach((el) => {
      SplitText.create(el, {
        type: 'words', autoSplit: true,
        onSplit(self) {
          return gsap.fromTo(self.words, { opacity: 0.16 }, {
            opacity: 1, ease: 'none', stagger: 0.1,
            scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: true },
          });
        },
      });
    }));

    s.querySelectorAll('[data-parallax]').forEach((img) => {
      const wrap = img.closest('[data-parallax-wrap]') || img.parentElement;
      gsap.fromTo(img, { yPercent: -8 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: wrap, start: 'top bottom', end: 'bottom top', scrub: true },
      });
      gsap.from(wrap, {
        clipPath: 'inset(12% 8% 12% 8% round 30px)', duration: 1.4, ease: 'expo.out',
        scrollTrigger: { trigger: wrap, start: 'top 85%', once: true },
      });
    });

    s.querySelectorAll('[data-draw]').forEach((svg) => {
      const paths = svg.querySelectorAll(svg.dataset.draw || 'path, line, polyline, rect, circle');
      gsap.from(paths, {
        drawSVG: 0, duration: 1.6, ease: 'power2.inOut', stagger: 0.06,
        scrollTrigger: { trigger: svg, start: 'top 82%', once: true },
      });
    });

    s.querySelectorAll('[data-count]').forEach((el) => {
      const to = parseFloat(el.dataset.count);
      const dec = (el.dataset.count.split('.')[1] || '').length;
      const obj = { v: 0 };
      gsap.to(obj, {
        v: to, duration: 1.8, ease: 'power2.out',
        onUpdate: () => { el.textContent = obj.v.toFixed(dec); },
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });
  };

  /* ---------- marquee whose speed follows the scroll ---------- */
  OEM.marquee = function (el) {
    const row = el.querySelector('.marquee__row');
    if (!row) return;
    const clone = row.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    el.appendChild(clone);
    if (reduce) return;
    const tween = gsap.to([row, clone], { xPercent: -100, duration: 34, ease: 'none', repeat: -1 });
    let dir = 1;
    ScrollTrigger.create({
      trigger: el, start: 'top bottom', end: 'bottom top',
      onUpdate(self) {
        const v = self.getVelocity();
        dir = v < 0 ? -1 : 1;
        gsap.to(tween, { timeScale: dir * (1 + Math.min(Math.abs(v) / 260, 5)), duration: 0.2, overwrite: true });
        gsap.to(tween, { timeScale: dir, duration: 1.2, delay: 0.25, overwrite: false });
      },
    });
  };

  /* ---------- fit a display line to its container ---------- */
  OEM.fit = function (el, lineSel) {
    const line = el.querySelector(lineSel);
    if (!line) return () => {};
    const run = () => {
      el.style.fontSize = '100px';
      const w = line.getBoundingClientRect().width;
      const avail = el.clientWidth;
      if (w > 0) el.style.fontSize = (100 * avail / w * 0.995).toFixed(2) + 'px';
    };
    run();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { run(); ScrollTrigger.refresh(); });
    let to;
    window.addEventListener('resize', () => { clearTimeout(to); to = setTimeout(run, 120); });
    return run;
  };

  /* ---------- keep measurements right once fonts and images land ---------- */
  window.addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());

  /* ---------- scroll to the hash after the intro ---------- */
  OEM.goToHash = function () {
    if (!location.hash || location.hash.length < 2) return;
    let el = null;
    try { el = document.querySelector(location.hash); } catch (e) { return; }
    if (el) setTimeout(() => OEM.scrollTo(el, { immediate: true, duration: 0 }), 60);
  };
})();
