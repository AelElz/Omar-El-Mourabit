/* ==========================================================================
   Home — loader, hero, stacked projects, horizontal toolkit, education
   odometer, experience mask + scope timeline, contact.
   ========================================================================== */
(function () {
  'use strict';
  const OEM = window.OEM || {};
  if (!OEM.ok) return;

  const reduce = OEM.reduce;
  const lenis = OEM.lenis;
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

  /* ---------- hero name: fit to width and split into letters once Anton is in ---------- */
  const nameEl = $('.hero__name');
  let refit = () => {};
  let nameSplit = null;

  /* ---------- MPPT trace on the first project card ---------- */
  (function buildTrace() {
    const svg = $('.card__media--trace .trace');
    if (!svg) return;
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const W = 640, H = 400, L = 52, R = 22, T = 26, B = 40;
    const x = (t) => L + (t / 160) * (W - L - R);
    const y = (p) => T + (1 - p / 80) * (H - T - B);
    const g = svg.querySelector('.trace__grid');
    let html = '';
    for (let t = 0; t <= 160; t += 20) html += `<line x1="${x(t)}" y1="${T}" x2="${x(t)}" y2="${H - B}"/>` + (t % 40 === 0 ? `<text x="${x(t)}" y="${H - B + 22}" text-anchor="middle">${t} ms</text>` : '');
    for (let p = 0; p <= 80; p += 20) html += `<line x1="${L}" y1="${y(p)}" x2="${W - R}" y2="${y(p)}"/><text x="${L - 10}" y="${y(p) + 4}" text-anchor="end">${p} W</text>`;
    g.innerHTML = html;
    const line = svg.querySelector('.trace__line');
    line.setAttribute('d', OEM.pathFrom(OEM.data.powerAt, { step: 0.4, x, y }));
    const dot = svg.querySelector('.trace__dot');
    const len = line.getTotalLength();
    const place = (k) => { const p = line.getPointAtLength(len * k); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); };
    place(1);
    if (reduce) return;
    const st = { k: 0 };
    gsap.set(line, { drawSVG: '0%' });
    place(0);
    gsap.to(st, {
      k: 1, duration: 2.6, ease: 'power1.inOut',
      onUpdate: () => { gsap.set(line, { drawSVG: `0% ${st.k * 100}%` }); place(st.k); },
      scrollTrigger: { trigger: svg, start: 'top 75%', once: true },
    });
  })();

  /* ---------- loader ---------- */
  const loader = $('.loader');
  function runLoader() {
    return new Promise((resolve) => {
      if (!loader) { resolve(); return; }
      let seen = false;
      try { seen = sessionStorage.getItem('oem-seen') === '1'; sessionStorage.setItem('oem-seen', '1'); } catch (e) { /* ignore */ }
      if (reduce || OEM.arrivedByWipe) { loader.remove(); resolve(); return; }

      loader.style.animation = 'none';
      const union = $('.loader__union', loader);
      const circle = $('.loader__circle', loader);
      const mark = $('.loader__mark', loader);
      const words = $$('.loader__words span', loader);
      const count = $('.loader__count b', loader);
      union.setAttribute('d', OEM.UNION_D);
      lenis && lenis.stop();
      window.scrollTo(0, 0);

      const q = seen ? 0.6 : 1;            // second visit in a session: quicker
      const step = 0.5 * q;
      const c = { v: 0 };
      const tl = gsap.timeline({
        onComplete: () => { loader.remove(); lenis && lenis.start(); },
      });

      tl.set(union, { drawSVG: '0%' })
        .to(union, { drawSVG: '100%', duration: 1.2 * q, ease: 'power2.inOut' }, 0)
        .to(c, { v: 100, duration: (3 * 0.5 + 0.36) * q, ease: 'power1.inOut', onUpdate: () => { count.textContent = Math.round(c.v); } }, 0);

      // one word at a time: the old word leaves before the next one rises
      gsap.set(words, { yPercent: 105, visibility: 'visible' });
      words.forEach((w, i) => {
        const t = i * step;
        tl.to(w, { yPercent: 0, duration: 0.28 * q, ease: 'power3.out' }, t + (i ? 0.08 * q : 0));
        if (i < words.length - 1) tl.to(w, { yPercent: -105, duration: 0.14 * q, ease: 'power2.in' }, t + step - 0.12 * q);
      });

      // the mark fills, turns, becomes a sun, and the sun opens onto the hero
      const end = (words.length - 1) * step + 0.36 * q;   // last word fully in
      const open = { r: 0 };
      tl.to(union, { fillOpacity: 1, duration: 0.28, ease: 'power1.out' }, Math.max(1.2 * q, end - 0.25))
        .to(mark, { rotate: 90, duration: 0.6, ease: 'expo.inOut' }, '>-0.05')
        .to(union, { morphSVG: circle, duration: 0.45, ease: 'power2.inOut' }, '<+0.08')
        .to(['.loader__words', '.loader__foot', '.loader__grid', '.loader__glow'], { autoAlpha: 0, duration: 0.3 }, '<')
        .add(() => {
          // swap the yellow disc for a hole of the same size, centred on it
          const r = mark.getBoundingClientRect();
          open.r = (r.width * 79) / 239;
          loader.style.setProperty('--hx', r.left + r.width / 2 + 'px');
          loader.style.setProperty('--hy', r.top + r.height / 2 + 'px');
          loader.style.setProperty('--hole', open.r + 'px');
          loader.classList.add('is-opening');
          gsap.set(mark, { autoAlpha: 0 });
        })
        .to(open, {
          r: () => Math.hypot(innerWidth, innerHeight), duration: 0.85, ease: 'power2.in',
          onUpdate: () => loader.style.setProperty('--hole', open.r + 'px'),
        })
        .add(resolve, '<+0.05');
    });
  }

  /* ---------- hero intro + scroll ----------
     The intro is built paused at load, so its start states are applied while the
     loader (or the page wipe) still covers the hero: nothing blinks when it plays.
     Intro and scroll never animate the same element: the intro moves the inner
     parts (img, letters, meta children, sun), the scroll moves their containers. */
  function buildIntro() {
    if (reduce) return null;
    return gsap.timeline({ paused: true })
      .from('.hero__sun', { scale: 0.55, rotation: -40, autoAlpha: 0, duration: 2.2, ease: 'expo.out' }, 0)
      .from('.hero__portrait img', { yPercent: 10, scale: 1.06, autoAlpha: 0, duration: 1.6, ease: 'expo.out' }, 0)
      .from('.hero__meta > *', { y: 22, autoAlpha: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07 }, 0.4)
      .from('.topbar, .menu-btn', { autoAlpha: 0, duration: 0.8 }, 0.45);
  }

  // the letters join the intro when the font is ready (inserted at the playhead if it already started)
  const nameReady = OEM.fontsReady.then(() => {
    refit = OEM.fit(nameEl, '.hero__line');
    nameSplit = SplitText.create('.hero__line', { type: 'chars', charsClass: 'hero__char' });
    if (intro) intro.from(nameSplit.chars, { yPercent: 115, duration: 1.25, ease: 'expo.out', stagger: 0.035 }, Math.max(0.12, intro.time()));
    gsap.set('.hero__line', { opacity: 1 });
    ScrollTrigger.refresh();
  });

  function heroScroll() {
    if (reduce) return;
    const shade = document.createElement('div');
    shade.style.cssText = 'position:absolute;inset:0;background:#030c18;opacity:0;z-index:6;pointer-events:none';
    $('.hero').appendChild(shade);
    gsap.timeline({ scrollTrigger: { trigger: '.sheet', start: 'top bottom', end: 'top top', scrub: true } })
      .to('.hero__portrait', { yPercent: -7, scale: 0.94, ease: 'none' }, 0)
      .to('.hero__name', { yPercent: -35, ease: 'none' }, 0)
      .to('.hero__meta', { y: -80, autoAlpha: 0, ease: 'none' }, 0)
      .to('.hero__bg', { scale: 1.12, ease: 'none' }, 0)
      .to(shade, { opacity: 0.6, ease: 'none' }, 0);
  }

  /* ---------- projects: stacked cards ---------- */
  function stackedCards() {
    const stack = $('.stack');
    const cards = $$('.card', stack);
    cards.forEach((c) => { const s = document.createElement('div'); s.className = 'card__shade'; c.appendChild(s); });
    if (reduce) return;
    const absTop = (el) => el.getBoundingClientRect().top + window.scrollY;
    const offsets = () => {
      const out = [0];
      for (let i = 1; i < cards.length; i++) {
        const mb = parseFloat(getComputedStyle(cards[i - 1]).marginBottom) || 0;
        out.push(out[i - 1] + cards[i - 1].offsetHeight + mb);
      }
      return out;
    };
    const stickyTop = (el) => parseFloat(getComputedStyle(el).top) || 0;
    const last = cards[cards.length - 1];

    cards.forEach((card, i) => {
      if (i === cards.length - 1) return;
      const depth = cards.length - 1 - i;
      gsap.timeline({
        scrollTrigger: {
          start: () => absTop(stack) + offsets()[i + 1] - window.innerHeight,
          end: () => absTop(stack) + offsets()[cards.length - 1] - stickyTop(last),
          scrub: true,
          invalidateOnRefresh: true,
        },
      })
        .to(card, { scale: 1 - depth * 0.05, ease: 'none' }, 0)
        .to(card.querySelector('.card__shade'), { opacity: 0.18 + depth * 0.12, ease: 'none' }, 0);
    });

    cards.forEach((card, i) => {
      const parts = card.querySelectorAll('.card__top, .card__title, .card__en, .card__stats, .chips, .btn');
      const at = () => absTop(stack) + offsets()[i];
      gsap.from(parts, {
        y: 30, autoAlpha: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07,
        scrollTrigger: { start: () => at() - window.innerHeight * 0.8, once: true, invalidateOnRefresh: true },
      });
      const img = card.querySelector('.card__media img');
      if (img) gsap.fromTo(img, { scale: 1.18 }, { scale: 1, ease: 'none', scrollTrigger: { start: () => at() - window.innerHeight, end: () => at() - (parseFloat(getComputedStyle(card).top) || 0), scrub: true, invalidateOnRefresh: true } });
    });
  }

  /* ---------- toolkit: horizontal scroll ---------- */
  function toolkit() {
    const sec = $('.toolkit');
    const track = $('.toolkit__track', sec);
    const bar = $('.toolkit__progress span', sec);
    if (reduce) { gsap.set(bar, { scaleX: 1 }); return; }
    sec.classList.add('is-h');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '.toolkit__pin', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.8, refreshPriority: 10,
        invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: (s) => gsap.set(bar, { scaleX: s.progress }),
      },
    });
    $$('.tk', track).forEach((tk) => {
      gsap.from(tk.querySelectorAll('.tk__list li'), {
        y: 26, autoAlpha: 0, duration: 0.6, ease: 'power3.out', stagger: 0.04,
        scrollTrigger: { trigger: tk, containerAnimation: tween, start: 'left 82%', once: true },
      });
      gsap.fromTo(tk.querySelector('.tk__word'), { xPercent: 12 }, {
        xPercent: -6, ease: 'none',
        scrollTrigger: { trigger: tk, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
      });
    });
  }

  /* ---------- education: pinned years with an odometer ---------- */
  function education(pinned) {
    const sec = $('.edu');
    const items = $$('.edu__item', sec);
    if (!pinned) return () => {};
    const years = ['2019', '2020', '2022', '2026'];
    const ghosts = ['2020', '2022', '2026', 'Next'];
    const odo = $('[data-odo]', sec);
    const ghost = $('[data-ghost]', sec);
    const tick = $('.edu__tick span', sec);
    odo.innerHTML = years[0].split('').map(() => '<span class="odo__col">' + '0123456789'.split('').map((d) => `<span>${d}</span>`).join('') + '</span>').join('');
    const cols = $$('.odo__col', odo);
    sec.classList.add('is-pinned');
    let cur = -1;

    function setStep(i, instant) {
      if (i === cur) return;
      const prev = cur;
      cur = i;
      years[i].split('').forEach((d, k) => gsap.to(cols[k], { yPercent: -10 * +d, duration: instant ? 0 : 1.1, ease: 'expo.inOut', delay: instant ? 0 : k * 0.06 }));
      ghost.textContent = ghosts[i];
      gsap.fromTo(ghost, { yPercent: 30, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: instant ? 0 : 0.8, ease: 'power3.out' });
      tick.style.transform = `translateY(${i * 100}%)`;
      items.forEach((it, k) => it.classList.toggle('is-active', k === i));
      if (prev > -1) gsap.to(items[prev], { autoAlpha: 0, y: i > prev ? -40 : 40, duration: 0.45, ease: 'power2.in', overwrite: true });
      gsap.fromTo(items[i], { autoAlpha: 0, y: prev === -1 ? 0 : (i > prev ? 50 : -50) }, { autoAlpha: 1, y: 0, duration: instant ? 0 : 0.8, delay: instant ? 0 : 0.25, ease: 'power3.out', overwrite: true });
      gsap.from(items[i].querySelectorAll('.edu__when, .edu__school, .edu__title, .edu__desc, .edu__tags, .edu__photo'), { y: 24, autoAlpha: 0, duration: 0.7, stagger: 0.06, delay: 0.3, ease: 'power3.out' });
    }
    gsap.set(items, { autoAlpha: 0 });
    setStep(0, true);

    const st = ScrollTrigger.create({
      trigger: '.edu__pin', start: 'top top', end: () => '+=' + window.innerHeight * 2.6, pin: true, anticipatePin: 1, refreshPriority: 9,
      onUpdate: (s) => setStep(Math.min(years.length - 1, Math.floor(s.progress * years.length * 0.999))),
    });
    return () => { st.kill(); sec.classList.remove('is-pinned'); gsap.set(items, { clearProps: 'all' }); };
  }

  /* ---------- experience intro: the mark grows into the light page ---------- */
  function experienceIntro() {
    const union = $('.xpi__union');
    union.setAttribute('d', OEM.UNION_D);
    if (reduce) { gsap.set('.xpi__mask', { autoAlpha: 0 }); return; }
    const mask = $('.xpi__mask');
    const cover = () => (Math.hypot(innerWidth, innerHeight) / mask.getBoundingClientRect().width) * 1.2 * (gsap.getProperty(mask, 'scale') || 1);
    gsap.timeline({
      scrollTrigger: { trigger: '.xpi__pin', start: 'top top', end: '+=170%', pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 8 },
    })
      .to('.xpi__kicker', { autoAlpha: 0, y: -30, duration: 0.2, ease: 'none' }, 0)
      .to('.xpi__word', { scale: 0.88, duration: 1, ease: 'none' }, 0)
      .to(mask, { rotate: 180, duration: 1, ease: 'power1.in' }, 0)
      .to(mask, { scale: () => cover(), duration: 1, ease: 'power3.in' }, 0)
      .to(union, { fill: '#F7F9FC', duration: 0.35, ease: 'none' }, 0.15)
      .to(union, { morphSVG: '.xpi__circle', duration: 0.5, ease: 'power1.inOut' }, 0.3);
  }

  /* ---------- experience: scope timeline ---------- */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const SPAN = 36;               // Jul 2023 → Jun 2026
  const monthLabel = (m) => { const abs = 6 + Math.floor(m); return MONTHS[abs % 12] + ' ' + (2023 + Math.floor(abs / 12)); };

  function buildScope() {
    const pct = (m) => (m / SPAN) * 100 + '%';
    const ruler = $('.scope__ruler');
    ruler.innerHTML = [[0, 'Jul ’23'], [6, 'Jan ’24'], [12, 'Jul ’24'], [18, 'Jan ’25'], [24, 'Jul ’25'], [30, 'Jan ’26'], [35, 'Jun ’26']]
      .map(([m, l]) => `<span class="scope__tick" style="left:${pct(m)}">${l}</span>`).join('');
    const clip = (lane, from, to, label, step, cls) =>
      `<span class="scope__clip ${cls || ''}" data-from="${from}" data-to="${to}" data-step="${step}" style="left:${pct(from)};width:calc(${pct(to - from)} - 3px)">${label}</span>`;
    $('[data-lane="work"]').innerHTML =
      clip('work', 0, 2, 'Émile Zola', 0) + clip('work', 24, 27, 'Schneider Electric', 1) + clip('work', 31, 36, 'DARDIS · PFE', 2);
    $('[data-lane="proj"]').innerHTML =
      clip('proj', 19, 24, 'Parallel inverters', -1, 'scope__clip--proj') + clip('proj', 26, 29, 'Analog MPPT', -1, 'scope__clip--proj');
    // SUN lane: one hump per ~2 weeks, taller in summer
    let d = 'M0 40';
    const N = 80;
    for (let i = 0; i <= N * 6; i++) {
      const xx = (i / (N * 6)) * 1000;
      const m = (i / (N * 6)) * SPAN;
      const season = 0.55 + 0.45 * Math.cos((2 * Math.PI * m) / 12);
      const hump = Math.pow(Math.max(0, Math.sin((i / 6) * Math.PI)), 2);
      d += ` L${xx.toFixed(1)} ${(40 - hump * season * 34).toFixed(1)}`;
    }
    d += ' L1000 40 Z';
    $('.scope__wave path').setAttribute('d', d);
  }

  function experience(pinned) {
    const sec = $('.xp');
    const entries = $$('.xp__entry', sec);
    const drawIn = (entry) => {
      const paths = entry.querySelectorAll('.pcb__trace, .iec__bus, .iec__link');
      if (paths.length && !reduce) gsap.fromTo(paths, { drawSVG: 0 }, { drawSVG: '100%', duration: 1.4, ease: 'power2.inOut', stagger: 0.05 });
    };
    if (!pinned) {
      if (!reduce) entries.forEach((en) => {
        gsap.from(en.children, { y: 30, autoAlpha: 0, duration: 1, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: en, start: 'top 80%', once: true, onEnter: () => drawIn(en) } });
      });
      return () => {};
    }
    buildScope();
    sec.classList.add('is-pinned');
    const figs = entries.map((e) => e.querySelector('.xp__fig'));
    const infos = entries.map((e) => e.querySelector('.xp__item'));
    const head = $('.scope__head-line span');
    const now = $('[data-scope-now]');
    const clips = $$('.scope__clip');
    let cur = -1;

    function show(i) {
      if (i === cur) return;
      const prev = cur;
      cur = i;
      if (prev > -1) {
        gsap.to(figs[prev], { autoAlpha: 0, scale: 0.97, duration: 0.5, ease: 'power2.inOut', overwrite: true });
        gsap.to(infos[prev], { autoAlpha: 0, y: i > prev ? -30 : 30, duration: 0.4, ease: 'power2.in', overwrite: true });
      }
      gsap.fromTo(figs[i], { autoAlpha: 0, scale: 1.04 }, { autoAlpha: 1, scale: 1, duration: 0.8, ease: 'power3.out', overwrite: true });
      gsap.fromTo(infos[i], { autoAlpha: 0, y: prev === -1 ? 0 : (i > prev ? 40 : -40) }, { autoAlpha: 1, y: 0, duration: 0.75, delay: 0.15, ease: 'power3.out', overwrite: true });
      gsap.from(infos[i].children, { y: 18, autoAlpha: 0, duration: 0.6, stagger: 0.05, delay: 0.2, ease: 'power3.out' });
      drawIn(entries[i]);
    }

    // equal scroll for each job: progress → month, piecewise
    const map = (p) => {
      if (p < 1 / 3) return gsap.utils.mapRange(0, 1 / 3, 0, 12.5, p);
      if (p < 2 / 3) return gsap.utils.mapRange(1 / 3, 2 / 3, 12.5, 29.5, p);
      return gsap.utils.mapRange(2 / 3, 1, 29.5, 35.99, p);
    };
    function update(p) {
      const m = map(p);
      head.style.left = (m / SPAN) * 100 + '%';
      now.textContent = monthLabel(m);
      clips.forEach((c) => c.classList.toggle('is-on', m >= +c.dataset.from && m < +c.dataset.to));
      show(Math.min(2, Math.floor(p * 3 * 0.9999)));
    }
    gsap.set([...figs, ...infos], { autoAlpha: 0 });
    update(0);

    const st = ScrollTrigger.create({
      trigger: '.xp__pin', start: 'top top', end: () => '+=' + window.innerHeight * 3, pin: true, scrub: 0.6, anticipatePin: 1, refreshPriority: 7,
      onUpdate: (s) => update(s.progress),
    });
    return () => { st.kill(); sec.classList.remove('is-pinned'); gsap.set([...figs, ...infos], { clearProps: 'all' }); cur = -1; };
  }

  /* ---------- contact ---------- */
  function contact() {
    if (reduce) return;
    const lines = $$('.contact__line');
    gsap.from(lines, {
      yPercent: 100, autoAlpha: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1,
      scrollTrigger: { trigger: '.contact', start: 'top 70%', once: true },
    });
    gsap.from('.contact__row > *, .contact__foot', {
      y: 24, autoAlpha: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08,
      scrollTrigger: { trigger: '.contact__row', start: 'top 92%', once: true },
    });
    gsap.to('.contact__mark', { rotate: 270, ease: 'none', scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  }

  /* ---------- go ---------- */
  const intro = buildIntro();
  heroScroll();
  OEM.reveals();
  OEM.marquee($('[data-marquee]'));
  stackedCards();
  toolkit();

  const mm = gsap.matchMedia();
  mm.add({ desk: '(min-width: 1101px)', motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
    const pinned = ctx.conditions.desk && ctx.conditions.motion;
    const a = education(pinned);
    return () => { a(); };
  });
  experienceIntro();
  mm.add({ desk: '(min-width: 1101px)', motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
    const pinned = ctx.conditions.desk && ctx.conditions.motion;
    const b = experience(pinned);
    return () => { b(); };
  });
  contact();

  $$('[data-top]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); OEM.scrollTo(0, { duration: 2 }); }));

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    refit();
    if (intro) intro.play(0);
    ScrollTrigger.refresh();
    OEM.goToHash();
  };

  const opened = OEM.arrivedByWipe ? (runLoader(), OEM.revealWipe()) : runLoader();
  Promise.all([opened, nameReady]).then(start);
})();
