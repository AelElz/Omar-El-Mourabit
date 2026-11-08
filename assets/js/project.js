/* ==========================================================================
   Case-study pages — shared behaviour
   ========================================================================== */
(function () {
  'use strict';
  const OEM = window.OEM;
  if (!OEM || !OEM.ok) return;
  const reduce = OEM.reduce;
  const P = (OEM.project = {});

  P.$ = (s, c) => (c || document).querySelector(s);
  P.$$ = (s, c) => Array.from((c || document).querySelectorAll(s));

  /* svg helpers */
  P.svg = (tag, attrs, parent) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };
  P.poly = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('');

  /* run something only while it is on screen */
  P.whileVisible = (el, onShow, onHide) => {
    if (!('IntersectionObserver' in window)) { onShow(); return; }
    new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? onShow() : onHide && onHide())), { rootMargin: '80px' }).observe(el);
  };

  /* horizontal pinned track */
  P.horizontal = (section, pinSel, trackSel) => {
    if (reduce) return null;
    section.classList.add('is-h');
    const track = section.querySelector(trackSel);
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    return gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: section.querySelector(pinSel), start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1, refreshPriority: 10 },
    });
  };

  /* sticky stacked cards that recede as the next one lands */
  P.stack = (container, cardSel) => {
    const cards = P.$$(cardSel, container);
    cards.forEach((c) => { const s = document.createElement('div'); s.className = 'pcard__shade'; c.appendChild(s); });
    if (reduce || cards.length < 2) return;
    const absTop = (el) => el.getBoundingClientRect().top + window.scrollY;
    const offsets = () => {
      const out = [0];
      for (let i = 1; i < cards.length; i++) out.push(out[i - 1] + cards[i - 1].offsetHeight + (parseFloat(getComputedStyle(cards[i - 1]).marginBottom) || 0));
      return out;
    };
    const last = cards[cards.length - 1];
    cards.forEach((card, i) => {
      if (i === cards.length - 1) return;
      const depth = cards.length - 1 - i;
      gsap.timeline({
        scrollTrigger: {
          start: () => absTop(container) + offsets()[i + 1] - window.innerHeight,
          end: () => absTop(container) + offsets()[cards.length - 1] - (parseFloat(getComputedStyle(last).top) || 0),
          scrub: true, invalidateOnRefresh: true,
        },
      })
        .to(card, { scale: 1 - depth * 0.05, ease: 'none' }, 0)
        .to(card.querySelector('.pcard__shade'), { opacity: 0.15 + depth * 0.12, ease: 'none' }, 0);
    });
    cards.forEach((card, i) => {
      gsap.from(card.querySelectorAll('.pcard__step, h3, p, .chips, .perm'), {
        y: 28, autoAlpha: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07,
        scrollTrigger: { start: () => absTop(container) + offsets()[i] - window.innerHeight * 0.8, once: true, invalidateOnRefresh: true },
      });
    });
  };

  /* footer */
  function footer() {
    P.$$('[data-top]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); OEM.scrollTo(0, { duration: 2 }); }));
    if (reduce || !P.$('.p-foot')) return;
    gsap.from('.p-foot .contact__line', { yPercent: 100, autoAlpha: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.p-foot', start: 'top 75%', once: true } });
    gsap.to('.p-foot .contact__mark', { rotate: 270, ease: 'none', scrollTrigger: { trigger: '.p-foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });
    gsap.from('.next__title', { yPercent: 30, autoAlpha: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '.next', start: 'top 80%', once: true } });
  }

  /* page start: the intro is built paused now (its start states apply under the wipe),
     the reveals are armed now, and the intro plays as the wipe opens */
  P.start = (buildIntro) => {
    footer();
    OEM.reveals();
    const intro = buildIntro ? buildIntro() : null;
    const go = () => {
      if (intro) intro.play(0);
      ScrollTrigger.refresh();
      OEM.goToHash();
    };
    if (OEM.arrivedByWipe) OEM.revealWipe().then(go);
    else go();
  };
})();
