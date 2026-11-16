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

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;

  // 2) Griglia di "+" interattiva (stessa logica del componente Framer)
  var SP = 60, RADIUS = 150, MAXO = 1, BASE = 0.15, DARKEN = 0.3;
  var PATH = 'M3.25 0H4.75V3.25H8V4.75H4.75V8H3.25V4.75H0V3.25H3.25Z';
  var NS = 'http://www.w3.org/2000/svg';
  var grids = [];
  function buildGrids() {
    grids = [];
    var hosts = doc.querySelectorAll('[data-grid]');
    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i], w = host.clientWidth, h = host.clientHeight;
      var cols = Math.ceil(w / SP), rows = Math.ceil(h / SP), cells = [];
      host.textContent = '';
      var frag = doc.createDocumentFragment();
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var x = c * SP + SP / 2, y = r * SP + SP / 2;
        var svg = doc.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 8 8');
        svg.style.left = x + 'px'; svg.style.top = y + 'px';
        var p = doc.createElementNS(NS, 'path'); p.setAttribute('d', PATH);
        svg.appendChild(p); frag.appendChild(svg);
        cells.push({ el: svg, x: x, y: y });
      }
      host.appendChild(frag);
      grids.push({ host: host, cells: cells });
    }
  }
  var mx = null, my = null, mraf;
  function lightUp() {
    mraf = 0;
    if (mx === null) return;
    for (var g = 0; g < grids.length; g++) {
      var rc = grids[g].host.getBoundingClientRect(), px = mx - rc.left, py = my - rc.top, cells = grids[g].cells;
      for (var i = 0; i < cells.length; i++) {
        var dx = cells[i].x - px, dy = cells[i].y - py, d = Math.sqrt(dx * dx + dy * dy), o = BASE;
        if (d <= RADIUS) {
          var r = Math.max(BASE, (1 - d / RADIUS) * MAXO);
          o = r > BASE ? r + ((r - BASE) / (1 - BASE)) * DARKEN : r;
        }
        cells[i].el.style.opacity = Math.min(1, o).toFixed(3);
      }
    }
  }
  buildGrids();
  window.addEventListener('resize', function () {
    clearTimeout(buildGrids._t);
    buildGrids._t = setTimeout(function () { buildGrids(); }, 120);
  });
  window.addEventListener('load', buildGrids);
  if (!reduce) window.addEventListener('mousemove', function (e) {
    mx = e.clientX; my = e.clientY;
    if (!mraf) mraf = requestAnimationFrame(lightUp);
  }, { passive: true });

  // 3) Cursore a mirino (solo con mouse), si inverte sullo sfondo
  if (fine) {
    var cur = doc.createElement('div');
    cur.className = 'cursor'; cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML = '<svg viewBox="0 0 44 44"><path d="M 22.5 13.904 C 24.525 14.014 26.269 14.802 27.734 16.266 C 29.198 17.731 29.986 19.475 30.096 21.5 L 44 21.5 L 44 22.5 L 30.096 22.5 C 29.986 24.525 29.198 26.269 27.734 27.734 C 26.269 29.198 24.525 29.986 22.5 30.096 L 22.5 44 L 21.5 44 L 21.5 30.096 C 19.475 29.986 17.731 29.198 16.266 27.734 C 14.802 26.269 14.014 24.525 13.904 22.5 L 0 22.5 L 0 21.5 L 13.904 21.5 C 14.014 19.475 14.802 17.731 16.266 16.266 C 17.731 14.802 19.475 14.014 21.5 13.904 L 21.5 0 L 22.5 0 Z M 16.973 16.973 C 15.704 18.242 15.015 19.751 14.906 21.5 L 21.5 21.5 L 21.5 14.906 C 19.751 15.015 18.242 15.704 16.973 16.973 Z M 22.5 21.5 L 29.094 21.5 C 28.985 19.751 28.296 18.242 27.027 16.973 C 25.758 15.704 24.249 15.015 22.5 14.906 Z M 14.906 22.5 C 15.015 24.249 15.704 25.758 16.973 27.027 C 18.242 28.296 19.751 28.985 21.5 29.094 L 21.5 22.5 Z M 22.5 29.094 C 24.249 28.985 25.758 28.296 27.027 27.027 C 28.296 25.758 28.985 24.249 29.094 22.5 L 22.5 22.5 Z"/></svg>';
    doc.body.appendChild(cur);
    window.addEventListener('mousemove', function (e) {
      cur.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
      if (!cur.classList.contains('on')) { cur.classList.add('on'); doc.documentElement.classList.add('has-cursor'); }
    }, { passive: true });
    doc.documentElement.addEventListener('mouseleave', function () { cur.classList.remove('on'); doc.documentElement.classList.remove('has-cursor'); });
  }
})();
