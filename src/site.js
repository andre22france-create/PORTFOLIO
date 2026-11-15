// site.js — piccoli comportamenti del sito: fit del testo, reveal allo scroll, righello.
(function () {
  var doc = document;

  // 1) Titoli che riempiono la larghezza disponibile
  function fitAll() {
    var els = doc.querySelectorAll('[data-fit]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], inner = el.firstElementChild;
      if (!inner) continue;
      var cs = getComputedStyle(el);
      var avail = el.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
      if (!avail || avail < 0) continue;
      el.style.fontSize = '100px';
      var w = inner.getBoundingClientRect().width;
      if (w > 0) el.style.fontSize = (100 * avail / w).toFixed(2) + 'px';
    }
  }
  var raf;
  function scheduleFit() { cancelAnimationFrame(raf); raf = requestAnimationFrame(fitAll); }
  fitAll();
  window.addEventListener('resize', scheduleFit);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fitAll);
  window.addEventListener('load', fitAll);

  // 2) Reveal allo scroll
  var rev = doc.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    rev.forEach(function (el) { io.observe(el); });
  } else {
    rev.forEach(function (el) { el.classList.add('in'); });
  }

  // 3) Righello: avanza con lo scroll e cambia colore sopra sfondi chiari
  var ruler = doc.querySelector('.ruler');
  if (ruler) {
    var bar = ruler.firstElementChild;
    var tick = function () {
      var h = doc.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
      bar.style.setProperty('--p', (p * 78).toFixed(1) + '%');
      var r = ruler.getBoundingClientRect();
      var under = doc.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      var t = under && under.closest ? under.closest('[data-theme]') : null;
      ruler.classList.toggle('is-dark', !t || t.getAttribute('data-theme') !== 'blue');
    };
    window.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick);
    tick();
  }
})();
