// render.js — motore di rendering condiviso.
// Usato sia da build.js (Node) sia dall'anteprima live dell'editor (browser).
// Funzioni pure: nessun accesso a DOM, file o rete.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const nl2br = (s) => esc(s).replace(/\r?\n/g, '<br>');

export const slugify = (s) =>
  String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project';

export const IMAGE_KEYS = ['src', 'cover', 'hero', 'heroImage', 'portrait', 'ogImage', 'favicon', 'routeImage'];
export function collectImages(content) {
  const used = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        if (IMAGE_KEYS.includes(k) && typeof val === 'string') { if (val) used.add(val); }
        else walk(val);
      }
    }
  };
  walk(content);
  return used;
}

export const pad2 = (n) => String(n).padStart(2, '0');

export const ROUTE_D =
  'M30 112 C45 100 55 80 72 68 C80 62 84 70 88 58 L92 74 L100 60 L106 76 L112 56 C118 66 124 52 132 62 L140 40 C150 36 158 30 175 28 C200 24 215 20 240 10 C262 4 275 8 292 12 L320 16 C332 20 340 18 350 30 C358 44 366 60 374 70 L396 72 C402 70 410 62 416 62 C428 64 436 80 450 84 C470 92 490 100 510 110 C540 122 560 132 590 134 C620 136 640 136 660 128 C675 120 685 108 700 106 C725 100 735 94 760 92 C790 90 810 90 828 90';

export function listRoutes(c) {
  return [
    { path: '/', kind: 'home' },
    { path: '/work/portfolio/', kind: 'portfolio' },
    ...(c.projects || []).map((p) => ({ path: `/work/portfolio/${p.slug}/`, kind: 'project', slug: p.slug })),
    { path: '/contact/', kind: 'contact' },
  ];
}

function norm(o = {}) {
  return {
    asset: o.asset || ((p) => '/' + p), // css, js, font
    img: o.img || ((p) => '/' + p), // immagini dei contenuti
    preview: !!o.preview,
    base: o.base || '',
  };
}

const isExternal = (h) => /^https?:\/\//i.test(h || '');
const linkAttrs = (h) => (isExternal(h) ? ' target="_blank" rel="noopener"' : '');

function pic(src, alt, o, { ph = '16/9', style = '', eager = false, phClass = '' } = {}) {
  if (!src) return `<div class="ph ${phClass}" style="aspect-ratio:${ph}"><span>Image to add</span></div>`;
  return `<img src="${esc(o.img(src))}" alt="${esc(alt || '')}" ${eager ? 'fetchpriority="high"' : o.preview ? 'loading="eager"' : 'loading="lazy"'} decoding="async"${style ? ` style="${style}"` : ''}>`;
}

const fit = (cls, text) => `<div class="${cls}" data-fit><span class="fit-in">${esc(text)}</span></div>`;

function row(r = {}, { dia = true, ap = false } = {}) {
  return `<div class="row"><span class="row-l">${dia ? '<i class="dia"></i>' : ''}${esc(r.left)}</span><span class="row-c">${esc(r.center)}</span><span class="row-r"${ap ? ' data-ap="rowr"' : ''}>${esc(r.right)}</span></div>`;
}


function header(c, path) {
  const nav = (c.nav || [])
    .map((n) => {
      const cur = n.href !== '/' && path === n.href ? ' aria-current="page"' : '';
      return `<a href="${esc(n.href)}"${cur}${n.href === '/contact/' ? ' data-ap="navlast"' : ''}>${esc(n.label)}${n.number ? `<sup>${esc(n.number)}</sup>` : ''}</a>`;
    })
    .join('');
  return `<header class="hdr" data-ap="hdr"><a class="hdr-name" href="/">${esc(c.site.name)}</a><nav class="hdr-nav" aria-label="Main">${nav}</nav></header>`;
}

function footer(c, o) {
  const f = c.footer || {};
  const route = f.routeImage
    ? `<img class="route" src="${esc(o.img(f.routeImage))}" alt="" loading="lazy">`
    : `<svg class="route" viewBox="0 0 850 150" aria-hidden="true"><path d="${ROUTE_D}"/><rect x="24" y="106" width="12" height="12"/><circle cx="828" cy="90" r="8"/></svg>`;
  const links = (f.links || []).map((l) => `<a href="${esc(l.href)}"${linkAttrs(l.href)}><span class="ar">↘︎</span>${esc(l.label)}</a>`).join('');
  return `<footer class="ftr" data-theme="blue">
  <div class="plusgrid" data-grid aria-hidden="true"></div>
  <a class="ftr-home" href="/" aria-label="Home">${fit('ftr-word', f.wordmark || c.site.name)}</a>
  <div class="ftr-mid">${route}<nav class="ftr-links" aria-label="Footer">${links}</nav></div>
  <div class="ftr-copy">${esc(f.copyright)}</div>
</footer>`;
}

function layout(c, path, o, { title, description, ogImage, bodyClass, main, jsonld }) {
  const s = c.site;
  const url = s.url ? s.url.replace(/\/+$/, '') : '';
  const canon = url ? `<link rel="canonical" href="${esc(url + path)}"><meta property="og:url" content="${esc(url + path)}">` : '';
  const abs = (p) => (p ? (url ? url + '/' + p : o.img(p)) : '');
  const og = ogImage || s.ogImage;
  return `<!doctype html>
<html lang="${esc(s.lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${o.base ? `<base href="${esc(o.base)}">` : ''}
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${canon}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${og ? `<meta property="og:image" content="${esc(abs(og))}"><meta name="twitter:card" content="summary_large_image">` : ''}
<link rel="icon" type="image/png" href="${esc(o.asset('favicon/favicon-light.png'))}" media="(prefers-color-scheme: light)">
<link rel="icon" type="image/png" href="${esc(o.asset('favicon/favicon-dark.png'))}" media="(prefers-color-scheme: dark)">
<link rel="apple-touch-icon" href="${esc(o.asset('favicon/apple-touch-icon.png'))}">
<meta name="theme-color" content="#0028D7">
<link rel="preload" href="${esc(o.asset('fonts/ApfelGrotezk-Regular.woff2'))}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${esc(o.asset('assets/site.css'))}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body class="${bodyClass}${o.preview ? ' is-preview' : ''}">
<script>document.documentElement.classList.add('js')</script>
<main>
${main}
</main>
${footer(c, o)}
<script src="${esc(o.asset('assets/site.js'))}" defer></script>
</body>
</html>`;
}

function projectCard(p, i, o, variant) {
  const f = p.coverFocus || { x: 50, y: 50 };
  const style = `object-position:${Number(f.x ?? 50)}% ${Number(f.y ?? 50)}%`;
  return `<a class="pcard pcard--${variant}" href="/work/portfolio/${esc(p.slug)}/">
  <div class="pimg">${pic(p.cover, p.coverAlt || p.title, o, { ph: variant === 'wide' ? '2.8/1' : '1.4/1', style })}</div>
  <div class="pcap"><span class="pc-i">(${pad2(i + 1)})</span><span class="pc-t"><b>${esc(p.title)}</b><em>${esc(p.category)}</em></span><span class="pc-y">© ${esc(p.year)}</span></div>
</a>`;
}

function renderHome(c, path, o) {
  const h = c.home;
  const feat = (c.projects || []).filter((p) => p.featured);
  const hero = h.heroImage
    ? `<img class="hero-img" data-ap="bg" src="${esc(o.img(h.heroImage))}" alt="" fetchpriority="high">`
    : '';
  const about = (h.aboutText || '').split(/\n/).map((t) => esc(t)).join('<br>');
  const main = `
<section class="hero" data-theme="blue">
  ${hero}
  <div class="plusgrid" data-grid aria-hidden="true"></div>
  ${header(c, path)}
  <div class="hero-foot" data-ap="foot">${esc(h.heroNote)}</div>
  <div class="hero-dim" aria-hidden="true"></div>
</section>
<div class="curtain">
${row(h.aboutRow)}
<section class="about">
  <figure class="portrait">${pic(h.portrait, h.portraitAlt, o, { ph: '3/4' })}</figure>
  <span class="about-arrow" aria-hidden="true">→</span>
  <p class="about-text">${about}</p>
</section>
${row(h.projectsRow)}
<section class="projects" id="work">
  ${fit('giant', h.projectsHeading)}
  <div class="plist">${feat.map((p, i) => projectCard(p, i, o, 'wide')).join('')}</div>
  <a class="cta" href="/work/portfolio/">${fit('cta-in', h.viewAllLabel)}</a>
</section>
</div>`;
  const s = c.site;
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'Person', name: s.author, jobTitle: s.jobTitle,
    ...(s.url ? { url: s.url } : {}),
    address: { '@type': 'PostalAddress', addressLocality: s.city, addressCountry: s.country },
  };
  return layout(c, path, o, { title: s.title, description: s.description, bodyClass: 'page-home', main, jsonld });
}

function renderPortfolio(c, path, o) {
  const p = c.portfolio;
  const heroSrc = p.heroImage || c.home.heroImage;
  const hero = heroSrc ? `<img class="hero-img" data-ap="bg" src="${esc(o.img(heroSrc))}" alt="" fetchpriority="high">` : '';
  const main = `
<section class="hero hero--page" data-theme="blue">
  ${hero}
  <div class="plusgrid" data-grid aria-hidden="true"></div>
  ${header(c, path)}
  <h1 class="hero-title" data-ap="ptitle">${esc(p.title)}</h1>
</section>
<div class="curtain">
${row(p.row, { ap: true })}
<section class="projects projects--grid" id="work">
  <div class="pgrid" data-ap="work">${(c.projects || []).map((pr, i) => projectCard(pr, i, o, 'card')).join('')}</div>
</section>
</div>`;
  return layout(c, path, o, {
    title: `Portfolio — ${c.site.author}`, description: c.site.description, bodyClass: 'page-portfolio', main,
  });
}

function renderBlocks(p, o) {
  return (p.blocks || [])
    .map((b, bi) => {
      if (b.type === 'text') return `<p class="ptext">${nl2br(b.text)}</p>`;
      const cols = Math.min(3, Math.max(1, Number(b.columns) || 1));
      const ph = cols === 1 ? '16/9' : cols === 2 ? '4/3' : '4/5';
      const figs = (b.images || [])
        .map((im, ii) => `<figure>${pic(im.src, im.alt || `${p.title} — ${bi + 1}.${ii + 1}`, o, { ph })}</figure>`)
        .join('');
      return `<div class="gal gal--${cols} ">${figs}</div>`;
    })
    .join('\n');
}

function renderProject(c, path, o, p) {
  const heroSrc = p.hero || p.cover;
  const hero = heroSrc
    ? `<img class="hero-img hero-img--cover" data-ap="pbg" src="${esc(o.img(heroSrc))}" alt="" fetchpriority="high">`
    : '';
  const main = `
<section class="phero" data-theme="dark">
  ${hero}
  ${header(c, path)}
  <h1 class="phero-title" data-ap="ptitle2">${esc(p.title)}</h1>
</section>
<div class="curtain">
${row(c.site.projectRow)}
<section class="pintro"><p>${nl2br(p.intro)}</p></section>
<section class="pblocks">
${renderBlocks(p, o)}
</section>
<a class="explore cta" href="/work/portfolio/#work">${fit('explore-in', p.exploreLabel)}</a>
</div>`;
  const desc = String(p.intro || c.site.description).replace(/\s+/g, ' ').slice(0, 160);
  return layout(c, path, o, {
    title: `${p.title} — ${c.site.author}`, description: desc, ogImage: p.cover || p.hero, bodyClass: 'page-project', main,
  });
}

function renderContact(c, path, o) {
  const k = c.contact;
  const links = (k.links || [])
    .map((l) => `<li><a href="${esc(l.href)}"${linkAttrs(l.href)}><span class="ar">→</span>${esc(l.label)}</a></li>`)
    .join('');
  const main = `
<section class="contact" data-theme="blue">
  ${header(c, path)}
  <figure class="portrait portrait--contact" data-ap="cimg">${pic(k.portrait, k.portraitAlt, o, { ph: '4/5', phClass: 'ph--blue' })}</figure>
  <div class="contact-r">
    <h1 data-ap="ctitle">${esc(k.heading)}</h1>
    <ul>${links}</ul>
  </div>
</section>`;
  return layout(c, path, o, {
    title: `Contact — ${c.site.author}`, description: c.site.description, bodyClass: 'page-contact', main,
  });
}

function render404(c, o) {
  const main = `<section class="contact" data-theme="blue">${header(c, '/404')}<div class="contact-r" style="grid-column:1/-1"><h1>PAGE NOT FOUND</h1><ul><li><a href="/"><span class="ar">→</span>Back to home</a></li></ul></div></section>`;
  return layout(c, '/404', o, { title: `Not found — ${c.site.author}`, description: c.site.description, bodyClass: 'page-contact', main });
}

export function renderPage(content, path, opts) {
  const o = norm(opts);
  const c = content;
  if (path === '/' || path === '') return renderHome(c, '/', o);
  if (path === '/work/portfolio/') return renderPortfolio(c, path, o);
  if (path === '/contact/') return renderContact(c, path, o);
  const m = path.match(/^\/work\/portfolio\/([^/]+)\/$/);
  if (m) {
    const p = (c.projects || []).find((x) => x.slug === m[1]);
    if (p) return renderProject(c, path, o, p);
  }
  return render404(c, o);
}
