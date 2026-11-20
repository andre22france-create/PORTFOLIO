// build.js — genera il sito statico in dist/ a partire da content/content.json
// Uso: node build.js        (nessuna dipendenza da installare)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage, listRoutes, esc } from './src/render.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const rd = (p) => path.join(root, p);

const content = JSON.parse(fs.readFileSync(rd('content/content.json'), 'utf8'));

// --- controlli sui contenuti
const warnings = [];
const slugs = new Set();
for (const p of content.projects || []) {
  if (!/^[a-z0-9-]+$/.test(p.slug || '')) warnings.push(`Slug non valido: "${p.slug}"`);
  if (slugs.has(p.slug)) throw new Error(`Slug duplicato: ${p.slug}`);
  slugs.add(p.slug);
}

// --- pulizia e copia asset
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
const copyDir = (src, dst) => { if (fs.existsSync(src)) fs.cpSync(src, dst, { recursive: true }); };
for (const f of ['site.css', 'site.js', 'render.js']) fs.copyFileSync(rd('src/' + f), path.join(dist, 'assets', f));
copyDir(rd('fonts'), path.join(dist, 'fonts'));
copyDir(rd('favicon'), path.join(dist, 'favicon'));
fs.copyFileSync(rd('favicon/favicon.ico'), path.join(dist, 'favicon.ico')); // Google cerca /favicon.ico di default
copyDir(rd('images'), path.join(dist, 'images'));
copyDir(rd('admin'), path.join(dist, 'admin'));
fs.mkdirSync(path.join(dist, 'content'), { recursive: true });
fs.copyFileSync(rd('content/content.json'), path.join(dist, 'content/content.json'));

// --- pagine
const routes = listRoutes(content);
for (const r of routes) {
  const html = renderPage(content, r.path);
  const out = r.path === '/' ? path.join(dist, 'index.html') : path.join(dist, r.path, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
}
fs.writeFileSync(path.join(dist, '404.html'), renderPage(content, '/__404__'));

// --- immagini: segnala quelle mancanti
let empty = 0;
const used = new Set();
const walk = (v) => {
  if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v)) {
      if (['src', 'cover', 'hero', 'heroImage', 'portrait', 'ogImage', 'favicon', 'routeImage'].includes(k) && typeof val === 'string') {
        if (!val) empty++; else used.add(val);
      } else walk(val);
    }
  }
};
walk(content);
for (const u of used) if (!fs.existsSync(rd(u))) warnings.push(`Immagine referenziata ma non trovata: ${u}`);
if (!fs.existsSync(rd('fonts/ApfelGrotezk-Regular.woff2'))) warnings.push('Font mancante: fonts/ApfelGrotezk-Regular.woff2 (il sito usa un carattere di ripiego)');

// --- sitemap, robots, headers
const base = (content.site.url || '').replace(/\/+$/, '');
if (base) {
  const urls = routes.map((r) => `  <url><loc>${esc(base + r.path)}</loc></url>`).join('\n');
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${base}/sitemap.xml\n`);
} else {
  fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\n`);
  warnings.push('content.site.url è vuoto: canonical, sitemap e anteprime social sono disattivati finché non scrivi il dominio (Editor → Sito → "Indirizzo del sito").');
}
// vecchi indirizzi /work/portfolio/... → /work/projects/...
fs.writeFileSync(path.join(dist, '_redirects'), '/work/portfolio /work/projects/ 301\n/work/portfolio/ /work/projects/ 301\n/work/portfolio/* /work/projects/:splat 301\n');
fs.writeFileSync(path.join(dist, '_headers'), `/admin/*\n  X-Robots-Tag: noindex\n  Cache-Control: no-store\n/content/*\n  Cache-Control: no-store\n/images/*\n  Cache-Control: public, max-age=86400\n/fonts/*\n  Cache-Control: public, max-age=31536000\n/favicon/*\n  Cache-Control: public, max-age=86400\n`);

console.log(`Build ok: ${routes.length} pagine → dist/`);
console.log(`Immagini ancora da inserire: ${empty}`);
for (const w of warnings) console.log('⚠ ' + w);
