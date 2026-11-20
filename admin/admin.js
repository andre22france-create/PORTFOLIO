// admin.js — editor visuale con anteprima live e pubblicazione su GitHub.
import { renderPage, slugify, collectImages } from '../assets/render.js';

/* ============================================================
   Utilità
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v;
    else if (k === 'checked') e.checked = !!v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
const clone = (o) => JSON.parse(JSON.stringify(o));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const BASE = new URL('../', location.href).href; // radice del sito

function toast(msg, err = false, ms = 3200) {
  const t = h('div', { class: 'toast' + (err ? ' err' : '') }, msg);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), ms);
}

/* ============================================================
   Stato
   ============================================================ */
const S = {
  content: null,
  sel: { kind: 'home' },
  route: '/',
  source: 'local', // 'local' | 'github'
  base: { commit: null, blob: null },
  pending: new Map(), // path -> Blob (immagini non ancora pubblicate)
  urls: new Map(), // path -> object URL per l'anteprima
  meta: new Map(), // path -> {w,h,size}
  dirty: false,
  hist: [],
  histI: -1,
  device: 'desktop',
};

const CFG_KEY = 'af-editor-github';
const getCfg = () => { try { return JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch { return null; } };
const setCfg = (c) => { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch {} };

/* ============================================================
   IndexedDB: bozza e immagini non pubblicate (sopravvivono al refresh)
   ============================================================ */
const idb = {
  db: null,
  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((res, rej) => {
      try {
        const r = indexedDB.open('af-editor', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    }).catch(() => null);
    return this.db;
  },
  async tx(mode, fn) {
    const db = await this.open();
    if (!db) return null;
    return new Promise((res) => {
      const t = db.transaction('kv', mode); const st = t.objectStore('kv'); const r = fn(st);
      t.oncomplete = () => res(r && 'result' in r ? r.result : null); t.onerror = () => res(null);
    });
  },
  get: (k) => idb.tx('readonly', (s) => s.get(k)),
  set: (k, v) => idb.tx('readwrite', (s) => s.put(v, k)),
  del: (k) => idb.tx('readwrite', (s) => s.delete(k)),
  keys: () => idb.tx('readonly', (s) => s.getAllKeys()),
};

/* ============================================================
   Contenuti: normalizzazione, storico, bozza
   ============================================================ */
function normalize(c) {
  c.site ||= {}; c.site.projectRow ||= { left: '', center: '', right: '' };
  c.nav ||= []; c.home ||= {}; c.portfolio ||= {}; c.contact ||= {}; c.contact.links ||= [];
  c.home.aboutRow ||= { left: '', center: '', right: '' };
  c.home.projectsRow ||= { left: '', center: '', right: '' };
  c.portfolio.row ||= { left: '', center: '', right: '' };
  c.footer ||= {}; c.footer.links ||= [];
  c.projects ||= [];
  for (const p of c.projects) {
    p.blocks ||= []; p.coverFocus ||= { x: 50, y: 50 };
    for (const b of p.blocks) if (b.type !== 'text') { b.type = 'images'; b.images ||= []; b.columns ||= 1; }
  }
  return c;
}

function snapNow() {
  const j = JSON.stringify(S.content);
  if (S.hist[S.histI] === j) return;
  S.hist = S.hist.slice(0, S.histI + 1); S.hist.push(j);
  if (S.hist.length > 80) S.hist.shift();
  S.histI = S.hist.length - 1;
  updateUndo();
}
const snapSoon = debounce(snapNow, 600);
function undo(dir) {
  snapNow();
  const i = S.histI + dir;
  if (i < 0 || i >= S.hist.length) return;
  S.histI = i; S.content = JSON.parse(S.hist[i]); S.dirty = true;
  if (S.sel.kind === 'project' && !S.content.projects.find((p) => p.slug === S.sel.slug)) S.sel = { kind: 'portfolio' };
  saveDraftSoon(); renderAll(); updateStatus(); updateUndo();
}
function updateUndo() { $('#btn-undo').disabled = S.histI <= 0; $('#btn-redo').disabled = S.histI >= S.hist.length - 1; }

const saveDraft = async () => { await idb.set('draft', JSON.stringify({ content: S.content, savedAt: Date.now() })); };
const saveDraftSoon = debounce(saveDraft, 500);

/* ============================================================
   Cambiamenti → anteprima
   ============================================================ */
function changed({ structural = false } = {}) {
  S.dirty = true;
  structural ? snapNow() : snapSoon();
  saveDraftSoon(); schedulePreview(); updateStatus();
}

/* ============================================================
   Immagini
   ============================================================ */
const resolveImg = (p) => S.urls.get(p) || BASE + p;
const baseName = (p) => (p || '').split('/').pop();

async function processImage(file, hint) {
  const type = file.type || '';
  const stem = slugify(hint || file.name.replace(/\.[^.]+$/, '')).slice(0, 40);
  const id = Math.random().toString(36).slice(2, 8);
  if (/svg|gif/.test(type)) {
    return { path: `images/${stem}-${id}.${type.includes('svg') ? 'svg' : 'gif'}`, blob: file, w: 0, h: 0 };
  }
  if (!/^image\//.test(type)) throw new Error('Il file non è un’immagine.');
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const MAXW = 2400, MAXH = 16000;
  const k = Math.min(1, MAXW / bmp.width, MAXH / bmp.height);
  const cw = Math.round(bmp.width * k), ch = Math.round(bmp.height * k);
  // JPEG piccoli e già pronti: restano intatti
  if (type === 'image/jpeg' && k === 1 && file.size < 1.5e6) {
    bmp.close();
    return { path: `images/${stem}-${id}.jpg`, blob: file, w: cw, h: ch };
  }
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, 0, 0, cw, ch);
  let alpha = false;
  if (type === 'image/png' || type === 'image/webp') {
    const t = document.createElement('canvas'); t.width = 64; t.height = Math.max(1, Math.min(2000, Math.round(64 * ch / cw)));
    const tc = t.getContext('2d', { willReadFrequently: true }); tc.drawImage(bmp, 0, 0, t.width, t.height);
    const d = tc.getImageData(0, 0, t.width, t.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) { alpha = true; break; }
  }
  bmp.close();
  const mime = alpha ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((r) => cv.toBlob(r, mime, 0.88));
  if (!blob) throw new Error('Impossibile elaborare l’immagine.');
  return { path: `images/${stem}-${id}.${alpha ? 'png' : 'jpg'}`, blob, w: cw, h: ch };
}

async function addImage(file, hint) {
  const t0 = h('div', { class: 'toast' }, `Elaboro ${file.name}…`); $('#toasts').append(t0);
  try {
    const r = await processImage(file, hint);
    S.pending.set(r.path, r.blob);
    S.urls.set(r.path, URL.createObjectURL(r.blob));
    S.meta.set(r.path, { w: r.w, h: r.h, size: r.blob.size });
    idb.set('img:' + r.path, r.blob);
    return r.path;
  } catch (e) { toast(e.message || 'Errore con l’immagine', true); return null; }
  finally { t0.remove(); }
}

const fmtSize = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.round(n / 1e3) + ' KB');

/* ============================================================
   Componenti del form
   ============================================================ */
function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', {}, label), input, hint ? h('small', {}, hint) : null);
}
function fText(label, obj, key, { area = false, hint, rows, onInput } = {}) {
  const el = area
    ? h('textarea', { rows: rows || 5 }, obj[key] ?? '')
    : h('input', { type: 'text', value: obj[key] ?? '' });
  el.addEventListener('input', () => { obj[key] = el.value; changed(); onInput && onInput(); });
  return field(label, el, hint);
}
function fCheck(label, obj, key) {
  const el = h('input', { type: 'checkbox', checked: !!obj[key] });
  el.addEventListener('change', () => { obj[key] = el.checked; changed({ structural: true }); renderSidebar(); });
  return h('label', { class: 'check' }, el, h('span', {}, label));
}
function fRow(label, obj) {
  const mk = (k, ph) => {
    const i = h('input', { type: 'text', value: obj[k] ?? '', placeholder: ph });
    i.addEventListener('input', () => { obj[k] = i.value; changed(); });
    return i;
  };
  return h('div', { class: 'field' }, h('span', {}, label), h('div', { class: 'row3' }, mk('left', 'Sinistra'), mk('center', 'Centro'), mk('right', 'Destra')));
}

function imgSlot(obj, key, { hint, nameHint, onChange } = {}) {
  const wrap = h('div', { class: 'slot' });
  const input = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const take = async (file) => {
    if (!file) return;
    const p = await addImage(file, nameHint);
    if (p) { obj[key] = p; changed({ structural: true }); draw(); onChange && onChange(); }
  };
  input.addEventListener('change', () => { take(input.files[0]); input.value = ''; });
  const draw = () => {
    const src = obj[key];
    const m = S.meta.get(src);
    const isNew = src && S.pending.has(src);
    wrap.replaceChildren(
      h('div', { class: 'th', style: src ? `background-image:url("${resolveImg(src)}")` : '' }, src ? '' : 'Nessuna immagine'),
      h('div', { class: 'info' },
        h('div', { class: 'nm' }, src ? baseName(src) + (m ? ` · ${m.w ? m.w + '×' + m.h + ' · ' : ''}${fmtSize(m.size)}` : '') : (hint || 'Trascina qui un file o scegli')),
        h('div', { class: 'btns' },
          h('button', { class: 'btn btn--sm', type: 'button', onclick: () => input.click() }, src ? 'Sostituisci…' : 'Scegli immagine…'),
          src ? h('button', { class: 'btn btn--sm btn--danger', type: 'button', onclick: () => { obj[key] = ''; changed({ structural: true }); draw(); onChange && onChange(); } }, 'Rimuovi') : null,
          isNew ? h('span', { class: 'new' }, 'nuova, da pubblicare') : null),
      ),
      input);
  };
  wrap.addEventListener('dragover', (e) => { e.preventDefault(); wrap.classList.add('drag'); });
  wrap.addEventListener('dragleave', () => wrap.classList.remove('drag'));
  wrap.addEventListener('drop', (e) => { e.preventDefault(); wrap.classList.remove('drag'); take(e.dataTransfer.files[0]); });
  draw();
  return wrap;
}
const fImage = (label, obj, key, opts) => h('div', { class: 'field' }, h('span', {}, label), imgSlot(obj, key, opts), opts?.hint2 ? h('small', {}, opts.hint2) : null);

function listEditor(arr, cols, mkNew, addLabel) {
  const box = h('div');
  const draw = () => {
    box.replaceChildren(
      ...arr.map((it, i) =>
        h('div', { class: 'item' },
          h('div', { class: 'mini c' + cols.length, style: cols.length === 3 ? '' : '' },
            ...cols.map((c) => {
              const inp = h('input', { type: 'text', value: it[c.key] ?? '', placeholder: c.ph || '' });
              inp.addEventListener('input', () => { it[c.key] = inp.value; changed(); });
              return inp;
            })),
          h('div', { class: 'addrow', style: 'margin-top:6px' },
            h('button', { class: 'btn btn--sm', type: 'button', disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; changed({ structural: true }); draw(); } }, '↑'),
            h('button', { class: 'btn btn--sm', type: 'button', disabled: i === arr.length - 1, onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; changed({ structural: true }); draw(); } }, '↓'),
            h('button', { class: 'btn btn--sm btn--danger', type: 'button', onclick: () => { arr.splice(i, 1); changed({ structural: true }); draw(); } }, 'Elimina')),
        )),
      h('button', { class: 'btn btn--sm', type: 'button', onclick: () => { arr.push(mkNew()); changed({ structural: true }); draw(); } }, addLabel || '+ Aggiungi'));
  };
  draw();
  return box;
}

const group = (title, ...kids) => h('div', { class: 'group' }, title ? h('h3', {}, title) : null, ...kids);

/* ============================================================
   Form per ogni sezione
   ============================================================ */
function formHome(c) {
  const hm = c.home;
  return [
    h('h2', {}, 'Home'), h('p', { class: 'sub' }, 'La pagina iniziale: hero, presentazione e progetti in evidenza.'),
    group('Hero',
      fImage('Immagine hero (la montagna)', hm, 'heroImage', { nameHint: 'hero', hint2: 'Meglio un PNG con sfondo trasparente: così si vede la griglia di “+” dietro.' }),
      fText('Testo in basso a sinistra', hm, 'heroNote')),
    group('Presentazione',
      fRow('Riga sopra la sezione', hm.aboutRow),
      fImage('Foto ritratto', hm, 'portrait', { nameHint: 'portrait' }),
      fText('Testo alternativo della foto', hm, 'portraitAlt'),
      fText('Testo di presentazione', hm, 'aboutText', { area: true, rows: 9, hint: 'Un invio = a capo.' })),
    group('Sezione progetti',
      fRow('Riga sopra la sezione', hm.projectsRow),
      fText('Titolo gigante', hm, 'projectsHeading'),
      fText('Testo del pulsante finale', hm, 'viewAllLabel'),
      h('small', { style: 'color:var(--mut)' }, 'I progetti mostrati qui si scelgono spuntando “In evidenza nella home” dentro ogni progetto.')),
  ];
}
function formPortfolio(c) {
  const p = c.portfolio;
  return [
    h('h2', {}, 'Pagina Portfolio'), h('p', { class: 'sub' }, 'Elenco di tutti i progetti. L’ordine si cambia dalla barra a sinistra (frecce ↑ ↓).'),
    group('', fText('Titolo gigante nella hero', p, 'title'),
      fImage('Immagine hero', p, 'heroImage', { nameHint: 'portfolio-hero', hint2: 'Se vuota, usa la stessa della home.' }),
      fRow('Riga sopra la griglia', p.row)),
  ];
}
function formContact(c) {
  const k = c.contact;
  return [
    h('h2', {}, 'Contatti'), h('p', { class: 'sub' }, ''),
    group('', fText('Titolo', k, 'heading'), fImage('Foto ritratto', k, 'portrait', { nameHint: 'contact-portrait' }), fText('Testo alternativo della foto', k, 'portraitAlt')),
    group('Link', listEditor(k.links, [{ key: 'label', ph: 'Testo' }, { key: 'href', ph: 'https://… o mailto:…' }], () => ({ label: 'Nuovo link', href: 'https://' }), '+ Aggiungi link')),
  ];
}
function formGlobal(c) {
  return [
    h('h2', {}, 'Header e footer'), h('p', { class: 'sub' }, 'Elementi che compaiono su tutte le pagine.'),
    group('Header', fText('Nome in alto a sinistra', c.site, 'name'),
      h('div', { class: 'field' }, h('span', {}, 'Menu (testo · numero · link)'),
        listEditor(c.nav, [{ key: 'label', ph: 'Testo' }, { key: 'number', ph: '01' }, { key: 'href', ph: '/contact/' }], () => ({ label: 'NUOVA', number: '03', href: '/' }), '+ Voce di menu'))),
    group('Footer', fText('Scritta gigante', c.footer, 'wordmark'),
      fText('Copyright', c.footer, 'copyright'),
      h('div', { class: 'field' }, h('span', {}, 'Link del footer'),
        listEditor(c.footer.links, [{ key: 'label', ph: 'Testo' }, { key: 'href', ph: '/contact/' }], () => ({ label: 'NUOVO', href: '/' }), '+ Link')),
      fImage('Linea del percorso (opzionale)', c.footer, 'routeImage', { nameHint: 'route', hint2: 'Carica un SVG o PNG per sostituire la linea di default.' })),
  ];
}
function formSite(c) {
  const s = c.site;
  return [
    h('h2', {}, 'Sito e SEO'), h('p', { class: 'sub' }, 'Dati per Google e per le anteprime sui social.'),
    group('Indirizzo', fText('Indirizzo del sito', s, 'url', { hint: 'Il tuo dominio completo, es. https://www.tuodominio.it (senza / finale). Serve per canonical, sitemap e anteprime social.' })),
    group('Titolo e descrizione', fText('Titolo (tab del browser e Google)', s, 'title'), fText('Descrizione', s, 'description', { area: true, rows: 4, hint: 'Circa 150 caratteri.' }),
      fImage('Immagine per le anteprime social', s, 'ogImage', { nameHint: 'og-image', hint2: 'Consigliato 1200×630.' })),
    group('Dati personali (per Google)', fText('Nome', s, 'author'), fText('Professione', s, 'jobTitle'), fText('Città', s, 'city'), fText('Lingua del sito (codice)', s, 'lang')),
    group('Pagine progetto', fRow('Riga sotto la hero di ogni progetto', s.projectRow)),
  ];
}

function formProject(c, p) {
  const el = [];
  const rerender = () => renderForm();
  el.push(h('h2', {}, p.title || 'Progetto'),
    h('p', { class: 'sub url' }, '/work/portfolio/' + p.slug + '/'));

  const slugIn = h('input', { type: 'text', value: p.slug });
  slugIn.addEventListener('change', () => {
    const v = slugify(slugIn.value);
    if (!v || c.projects.some((x) => x !== p && x.slug === v)) { toast('Indirizzo non valido o già usato', true); slugIn.value = p.slug; return; }
    p.slug = v; S.sel = { kind: 'project', slug: v }; changed({ structural: true }); renderSidebar(); renderForm(); refreshPreview(true);
  });

  el.push(group('Dati',
    fText('Titolo', p, 'title', { onInput: () => { renderSidebar(); $('#form h2').textContent = p.title || 'Progetto'; } }),
    h('div', { class: 'row2' }, fText('Categoria', p, 'category'), fText('Anno', p, 'year')),
    field('Indirizzo della pagina (slug)', slugIn, 'Cambiarlo cambia l’URL del progetto.'),
    fCheck('In evidenza nella home', p, 'featured')));

  const cf = p.coverFocus;
  const rng = (lab, k) => {
    const out = h('span', {}, cf[k] + '%');
    const r = h('input', { type: 'range', min: 0, max: 100, value: cf[k] });
    r.addEventListener('input', () => { cf[k] = Number(r.value); out.textContent = r.value + '%'; changed(); });
    return h('div', { class: 'range' }, h('span', {}, lab), r, out);
  };
  el.push(group('Immagini principali',
    fImage('Copertina (miniatura in home e portfolio)', p, 'cover', { nameHint: p.slug + '-cover' }),
    fText('Testo alternativo della copertina', p, 'coverAlt'),
    h('div', { class: 'field' }, h('span', {}, 'Punto focale del ritaglio'), rng('X', 'x'), rng('Y', 'y'),
      h('small', {}, 'In home la copertina è ritagliata in orizzontale: sposta il punto per scegliere cosa resta visibile.')),
    fImage('Immagine hero della pagina (opzionale)', p, 'hero', { nameHint: p.slug + '-hero', hint2: 'Se vuota, usa la copertina.' })));

  el.push(group('Testo',
    fText('Descrizione del progetto', p, 'intro', { area: true, rows: 7 }),
    fText('Testo del pulsante finale', p, 'exploreLabel')));

  // blocchi
  const blocksBox = h('div');
  const drawBlocks = () => {
    blocksBox.replaceChildren(
      ...p.blocks.map((b, i) => blockEditor(p, b, i, drawBlocks)),
      h('div', { class: 'addrow' },
        h('button', { class: 'btn btn--sm', type: 'button', onclick: () => { p.blocks.push({ type: 'images', columns: 1, images: [{ src: '', alt: '' }] }); changed({ structural: true }); drawBlocks(); } }, '+ Blocco immagini'),
        h('button', { class: 'btn btn--sm', type: 'button', onclick: () => { p.blocks.push({ type: 'text', text: '' }); changed({ structural: true }); drawBlocks(); } }, '+ Blocco testo'),
        (() => {
          const f = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
          f.addEventListener('change', async () => {
            const files = [...f.files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
            for (const file of files) {
              const path = await addImage(file, p.slug);
              if (path) p.blocks.push({ type: 'images', columns: 1, images: [{ src: path, alt: '' }] });
            }
            f.value = ''; changed({ structural: true }); drawBlocks();
          });
          return h('span', {}, f, h('button', { class: 'btn btn--sm', type: 'button', onclick: () => f.click() }, '+ Carica più immagini (un blocco ciascuna)'));
        })()));
  };
  drawBlocks();
  el.push(group('Galleria (dall’alto in basso)', h('small', { style: 'display:block;margin-bottom:10px;color:var(--mut)' }, 'Ogni blocco è una riga della pagina: 1 colonna = immagine a tutta larghezza, 2 o 3 colonne = immagini affiancate.'), blocksBox));

  el.push(group('', h('button', {
    class: 'btn btn--danger', type: 'button', onclick: () => {
      if (!confirm(`Eliminare il progetto “${p.title}”? Si può annullare con “Annulla” finché non pubblichi.`)) return;
      c.projects.splice(c.projects.indexOf(p), 1); S.sel = { kind: 'portfolio' }; changed({ structural: true }); renderAll();
    },
  }, 'Elimina progetto')));
  return el;
}

function blockEditor(p, b, i, redraw) {
  const mv = (d) => { const j = i + d; if (j < 0 || j >= p.blocks.length) return; [p.blocks[j], p.blocks[i]] = [p.blocks[i], p.blocks[j]]; changed({ structural: true }); redraw(); };
  const head = h('div', { class: 'item-h' },
    h('b', {}, `${i + 1}. ${b.type === 'text' ? 'Testo' : `Immagini · ${b.columns} col.`}`),
    h('button', { class: 'btn btn--sm', type: 'button', disabled: i === 0, onclick: () => mv(-1) }, '↑'),
    h('button', { class: 'btn btn--sm', type: 'button', disabled: i === p.blocks.length - 1, onclick: () => mv(1) }, '↓'),
    h('button', { class: 'btn btn--sm btn--danger', type: 'button', onclick: () => { p.blocks.splice(i, 1); changed({ structural: true }); redraw(); } }, '✕'));
  if (b.type === 'text') return h('div', { class: 'item' }, head, fText('Testo', b, 'text', { area: true, rows: 4 }));

  const colSel = h('select', {}, ...[1, 2, 3].map((n) => h('option', { value: n }, n === 1 ? '1 colonna (a tutta larghezza)' : `${n} colonne`)));
  colSel.value = String(b.columns);
  colSel.addEventListener('change', () => { b.columns = Number(colSel.value); changed({ structural: true }); redraw(); });
  const list = h('div', { class: 'imgs-in-block' });
  const drawImgs = () => {
    list.replaceChildren(
      ...b.images.map((im, k) =>
        h('div', { class: 'sub-i' },
          imgSlot(im, 'src', { nameHint: `${p.slug}-${i + 1}-${k + 1}` }),
          h('div', { class: 'mini c2' },
            (() => { const a = h('input', { type: 'text', value: im.alt || '', placeholder: 'Testo alternativo (descrizione)' }); a.addEventListener('input', () => { im.alt = a.value; changed(); }); return a; })(),
            h('div', { class: 'addrow', style: 'margin:0' },
              h('button', { class: 'btn btn--sm', type: 'button', disabled: k === 0, onclick: () => { [b.images[k - 1], b.images[k]] = [b.images[k], b.images[k - 1]]; changed({ structural: true }); drawImgs(); } }, '←'),
              h('button', { class: 'btn btn--sm', type: 'button', disabled: k === b.images.length - 1, onclick: () => { [b.images[k + 1], b.images[k]] = [b.images[k], b.images[k + 1]]; changed({ structural: true }); drawImgs(); } }, '→'),
              h('button', { class: 'btn btn--sm btn--danger', type: 'button', onclick: () => { b.images.splice(k, 1); changed({ structural: true }); drawImgs(); } }, 'Togli'))))),
      h('button', { class: 'btn btn--sm', type: 'button', onclick: () => { b.images.push({ src: '', alt: '' }); changed({ structural: true }); drawImgs(); } }, '+ Immagine in questo blocco'));
  };
  drawImgs();
  return h('div', { class: 'item' }, head, field('Layout', colSel), list);
}

/* ============================================================
   Sidebar
   ============================================================ */
function selIs(a, b) { return a.kind === b.kind && (a.kind !== 'project' || a.slug === b.slug); }
function renderSidebar() {
  const c = S.content, sb = $('#sidebar');
  const item = (label, sel, extra = []) =>
    h('div', { class: 'sb-item' + (selIs(S.sel, sel) ? ' on' : '') },
      h('button', { class: 'go', type: 'button', onclick: () => select(sel) }, label), ...extra);
  sb.replaceChildren(
    h('h4', {}, 'Pagine'),
    item('Home', { kind: 'home' }), item('Portfolio (elenco)', { kind: 'portfolio' }), item('Contatti', { kind: 'contact' }),
    h('h4', {}, 'Progetti'),
    ...c.projects.map((p, i) =>
      item([h('span', { class: 'dot' + (p.featured ? '' : ' off'), title: p.featured ? 'In evidenza nella home' : 'Non in home' }), p.title || '(senza titolo)'], { kind: 'project', slug: p.slug }, [
        h('button', { class: 'mv', title: 'Su', onclick: () => moveProject(i, -1) }, '↑'),
        h('button', { class: 'mv', title: 'Giù', onclick: () => moveProject(i, 1) }, '↓'),
      ])),
    h('button', { class: 'sb-new', type: 'button', onclick: newProjectDialog }, '+ Nuovo progetto'),
    h('h4', {}, 'Globale'),
    item('Header e footer', { kind: 'footer' }), item('Sito e SEO', { kind: 'site' }));
}
function moveProject(i, d) {
  const a = S.content.projects, j = i + d;
  if (j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]]; changed({ structural: true }); renderSidebar();
}

function newProjectDialog() {
  const t = h('input', { type: 'text', placeholder: 'Es. NOME DEL PROGETTO' });
  const cat = h('input', { type: 'text', placeholder: 'Es. Branding', value: 'Branding' });
  const yr = h('input', { type: 'text', value: String(new Date().getFullYear()) });
  const go = () => {
    const title = t.value.trim(); if (!title) { t.focus(); return; }
    let slug = slugify(title), n = 2; const base = slug;
    while (S.content.projects.some((p) => p.slug === slug)) slug = base + '-' + n++;
    S.content.projects.push({ slug, title: title.toUpperCase(), category: cat.value.trim(), year: yr.value.trim(), featured: false, cover: '', coverAlt: '', coverFocus: { x: 50, y: 50 }, hero: '', intro: '', exploreLabel: '→EXPLORE ANOTHER PROJECTS←', blocks: [] });
    changed({ structural: true }); closeModal(); select({ kind: 'project', slug });
  };
  t.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  openModal(h('div', { class: 'modal' },
    h('h2', {}, 'Nuovo progetto'),
    field('Titolo', t), h('div', { class: 'row2' }, field('Categoria', cat), field('Anno', yr)),
    h('p', {}, 'Dopo averlo creato aggiungi copertina, testo e galleria. Lo trovi in fondo all’elenco: usa le frecce per spostarlo.'),
    h('div', { class: 'acts' }, h('button', { class: 'btn', onclick: closeModal }, 'Annulla'), h('button', { class: 'btn btn--primary', onclick: go }, 'Crea progetto'))));
  setTimeout(() => t.focus(), 30);
}

/* ============================================================
   Selezione, form, rendering globale
   ============================================================ */
function routeFor(sel) {
  switch (sel.kind) {
    case 'home': return '/';
    case 'portfolio': return '/work/portfolio/';
    case 'contact': return '/contact/';
    case 'project': return `/work/portfolio/${sel.slug}/`;
    default: return S.route;
  }
}
function select(sel) {
  S.sel = sel; S.route = routeFor(sel);
  renderSidebar(); renderForm(); refreshPreview(true);
}
function renderForm() {
  const c = S.content, f = $('#form'), top = f.scrollTop;
  let nodes;
  switch (S.sel.kind) {
    case 'home': nodes = formHome(c); break;
    case 'portfolio': nodes = formPortfolio(c); break;
    case 'contact': nodes = formContact(c); break;
    case 'footer': nodes = formGlobal(c); break;
    case 'site': nodes = formSite(c); break;
    case 'project': {
      const p = c.projects.find((x) => x.slug === S.sel.slug);
      if (!p) { S.sel = { kind: 'portfolio' }; return renderForm(); }
      nodes = formProject(c, p); break;
    }
  }
  f.replaceChildren(...nodes); f.scrollTop = top;
}
function renderAll() { renderSidebar(); renderForm(); refreshPreview(true); }

/* ============================================================
   Anteprima
   ============================================================ */
const frame = () => $('#pv-frame');
function layoutPreview() {
  const stage = $('#pv-stage'), fr = frame();
  const W = stage.clientWidth, H = stage.clientHeight;
  stage.classList.toggle('mobile', S.device === 'mobile');
  if (S.device === 'mobile') {
    const vw = 390, vh = Math.min(H - 24, 844);
    fr.style.width = vw + 'px'; fr.style.height = vh + 'px';
    fr.style.transform = 'none'; fr.style.left = Math.max(0, (W - vw) / 2) + 'px'; fr.style.top = '12px';
  } else {
    const vw = 1440, sc = Math.min(1, W / vw);
    fr.style.width = vw + 'px'; fr.style.height = H / sc + 'px';
    fr.style.transform = `scale(${sc})`; fr.style.left = '0'; fr.style.top = '0';
  }
}
let pvScroll = 0, pvRoute = null;
function refreshPreview(resetScroll = false) {
  const fr = frame();
  try { if (!resetScroll && pvRoute === S.route && fr.contentWindow) pvScroll = fr.contentWindow.scrollY; else pvScroll = 0; } catch { pvScroll = 0; }
  pvRoute = S.route;
  const html = renderPage(S.content, S.route, { preview: true, base: BASE, asset: (p) => BASE + p, img: resolveImg });
  fr.srcdoc = html;
  $('#pv-route').textContent = S.route;
  layoutPreview();
}
const schedulePreview = debounce(() => refreshPreview(false), 220);
frame().addEventListener('load', () => {
  const w = frame().contentWindow, d = frame().contentDocument;
  if (!d) return;
  if (pvScroll) { w.scrollTo(0, pvScroll); setTimeout(() => w.scrollTo(0, pvScroll), 120); }
  d.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    const href = (a.getAttribute('href') || '').split('#')[0];
    if (href === '/') select({ kind: 'home' });
    else if (href === '/work/portfolio/') select({ kind: 'portfolio' });
    else if (href === '/contact/') select({ kind: 'contact' });
    else { const m = href.match(/^\/work\/portfolio\/([^/]+)\/$/); if (m) select({ kind: 'project', slug: m[1] }); }
  });
});
window.addEventListener('resize', layoutPreview);

/* ============================================================
   Modali
   ============================================================ */
function openModal(node) {
  closeModal();
  const bg = h('div', { class: 'modal-bg' }, node);
  bg.addEventListener('mousedown', (e) => { if (e.target === bg && !node.dataset.sticky) closeModal(); });
  $('#modal-root').append(bg);
}
function closeModal() { $('#modal-root').replaceChildren(); }

/* ============================================================
   GitHub
   ============================================================ */
async function gh(cfg, path, { method = 'GET', body } = {}) {
  const r = await fetch('https://api.github.com' + path, {
    method,
    headers: { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    let msg = ''; try { msg = (await r.json()).message; } catch {}
    const hint = r.status === 401 ? ' (token non valido o scaduto)' : r.status === 403 ? ' (permessi insufficienti sul token)' : r.status === 404 ? ' (repository, branch o permessi non corretti)' : '';
    throw new Error(`GitHub ${r.status}: ${msg}${hint}`);
  }
  return r.json();
}
const repoPath = (cfg) => `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;
const refPath = (cfg) => `${repoPath(cfg)}/git/ref/heads/${cfg.branch.split('/').map(encodeURIComponent).join('/')}`;
const b64ToText = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
const blobToB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });

async function loadFromGitHub(cfg) {
  const ref = await gh(cfg, refPath(cfg));
  const file = await gh(cfg, `${repoPath(cfg)}/contents/content/content.json?ref=${encodeURIComponent(cfg.branch)}`);
  return { content: normalize(JSON.parse(b64ToText(file.content))), commit: ref.object.sha, blob: file.sha };
}
async function loadLocal() {
  const r = await fetch(BASE + 'content/content.json?' + Date.now());
  if (!r.ok) throw new Error('content.json non trovato');
  return normalize(await r.json());
}

function settingsDialog() {
  const cfg = getCfg() || { owner: '', repo: '', branch: 'main', token: '' };
  const o = h('input', { type: 'text', value: cfg.owner, placeholder: 'es. andreafranceschetto' });
  const r = h('input', { type: 'text', value: cfg.repo, placeholder: 'es. portfolio' });
  const b = h('input', { type: 'text', value: cfg.branch });
  const t = h('input', { type: 'text', value: cfg.token, placeholder: 'github_pat_…', autocomplete: 'off' });
  t.type = 'password';
  const log = h('div', { class: 'log', hidden: true });
  const read = () => ({ owner: o.value.trim(), repo: r.value.trim(), branch: b.value.trim() || 'main', token: t.value.trim() });
  const say = (m, cls) => { log.hidden = false; log.replaceChildren(h('span', { class: cls || '' }, m)); };
  const save = async () => {
    const c = read();
    if (!c.owner || !c.repo || !c.token) { say('Compila utente, repository e token.', 'err'); return; }
    say('Verifico il collegamento…');
    try {
      const info = await gh(c, repoPath(c));
      if (info.permissions && info.permissions.push === false) throw new Error('Il token può solo leggere: serve il permesso “Contents: Read and write”.');
      const data = await loadFromGitHub(c);
      setCfg(c);
      S.source = 'github'; S.base = { commit: data.commit, blob: data.blob };
      if (!S.dirty) { S.content = data.content; S.sel = { kind: 'home' }; S.route = '/'; S.hist = []; S.histI = -1; snapNow(); renderAll(); }
      updateStatus(); updateBanner(); say('Collegato a ' + c.owner + '/' + c.repo + ' ✔', 'ok');
      setTimeout(closeModal, 900);
    } catch (e) { say(e.message, 'err'); }
  };
  openModal(h('div', { class: 'modal' },
    h('h2', {}, 'Collegamento a GitHub'),
    h('p', {}, 'Serve per pubblicare: l’editor salva le modifiche nel tuo repository e il sito si aggiorna da solo.'),
    h('ol', {},
      h('li', {}, 'Su GitHub apri ', h('code', {}, 'Settings → Developer settings → Personal access tokens → Fine-grained tokens'), ' e crea un nuovo token.'),
      h('li', {}, '“Repository access”: ', h('b', {}, 'Only select repositories'), ' e scegli solo il repository del sito.'),
      h('li', {}, '“Permissions → Repository permissions → ', h('b', {}, 'Contents'), '”: ', h('b', {}, 'Read and write'), '.'),
      h('li', {}, 'Imposta una scadenza (quando scade ne generi un altro) e incolla il token qui sotto.')),
    field('Utente o organizzazione GitHub', o), field('Nome del repository', r), field('Branch', b), field('Token', t),
    h('p', { style: 'font-size:12px;color:var(--mut)' }, 'Il token resta solo in questo browser e viene usato solo per parlare con api.github.com. Non condividerlo e non usarlo su computer che non sono tuoi.'),
    log,
    h('div', { class: 'acts' },
      getCfg() ? h('button', { class: 'btn btn--danger', onclick: () => { try { localStorage.removeItem(CFG_KEY); } catch {} S.source = 'local'; updateStatus(); updateBanner(); closeModal(); toast('Collegamento rimosso'); } }, 'Scollega') : null,
      h('button', { class: 'btn', onclick: closeModal }, 'Chiudi'),
      h('button', { class: 'btn btn--primary', onclick: save }, 'Verifica e salva'))));
}

async function publishFlow() {
  const cfg = getCfg();
  if (!cfg || S.source !== 'github') { settingsDialog(); return; }
  const referenced = collectImages(S.content);
  const toUpload = [...S.pending.keys()].filter((p) => referenced.has(p));
  const log = h('div', { class: 'log' });
  const line = (m, cls) => { log.append(h('div', { class: cls || '' }, m)); log.scrollTop = log.scrollHeight; };
  const closeBtn = h('button', { class: 'btn', onclick: closeModal, disabled: true }, 'Chiudi');
  const goBtn = h('button', { class: 'btn btn--primary' }, 'Pubblica ora');
  const modal = h('div', { class: 'modal' },
    h('h2', {}, 'Pubblica le modifiche'),
    h('p', {}, `Verranno salvati i testi aggiornati${toUpload.length ? ` e ${toUpload.length} ${toUpload.length === 1 ? 'immagine nuova' : 'immagini nuove'}` : ''} su ${cfg.owner}/${cfg.repo} (branch ${cfg.branch}).`),
    h('p', { style: 'font-size:12px;color:var(--mut)' }, 'Dopo la pubblicazione il sito si aggiorna in uno o due minuti.'),
    log, h('div', { class: 'acts' }, closeBtn, goBtn));
  modal.dataset.sticky = '1';
  openModal(modal);

  goBtn.onclick = async () => {
    goBtn.disabled = true; log.replaceChildren();
    try {
      line('Controllo lo stato del repository…');
      const ref = await gh(cfg, refPath(cfg));
      const headSha = ref.object.sha;
      if (headSha !== S.base.commit) {
        const cur = await gh(cfg, `${repoPath(cfg)}/contents/content/content.json?ref=${encodeURIComponent(cfg.branch)}`);
        if (cur.sha !== S.base.blob && !confirm('Il contenuto online è stato modificato da qualche altra parte dopo l’apertura dell’editor.\n\nPubblicando, quelle modifiche verranno sovrascritte. Continuare?')) {
          throw new Error('Pubblicazione annullata: ricarica l’editor per vedere la versione online.');
        }
      }
      const commit = await gh(cfg, `${repoPath(cfg)}/git/commits/${headSha}`);
      const entries = [];
      let n = 0;
      for (const path of toUpload) {
        n++; line(`Carico immagine ${n}/${toUpload.length}: ${baseName(path)} (${fmtSize(S.pending.get(path).size)})`);
        const blob = await gh(cfg, `${repoPath(cfg)}/git/blobs`, { method: 'POST', body: { content: await blobToB64(S.pending.get(path)), encoding: 'base64' } });
        entries.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
      }
      line('Salvo i contenuti…');
      const json = JSON.stringify(S.content, null, 2) + '\n';
      const cb = await gh(cfg, `${repoPath(cfg)}/git/blobs`, { method: 'POST', body: { content: json, encoding: 'utf-8' } });
      entries.push({ path: 'content/content.json', mode: '100644', type: 'blob', sha: cb.sha });
      const tree = await gh(cfg, `${repoPath(cfg)}/git/trees`, { method: 'POST', body: { base_tree: commit.tree.sha, tree: entries } });
      const nc = await gh(cfg, `${repoPath(cfg)}/git/commits`, { method: 'POST', body: { message: 'Aggiornamento contenuti dall’editor', tree: tree.sha, parents: [headSha] } });
      await gh(cfg, `${repoPath(cfg)}/git/refs/heads/${cfg.branch.split('/').map(encodeURIComponent).join('/')}`, { method: 'PATCH', body: { sha: nc.sha } });
      S.base = { commit: nc.sha, blob: cb.sha };
      for (const p of toUpload) { S.pending.delete(p); idb.del('img:' + p); }
      S.dirty = false; await idb.del('draft'); updateStatus();
      line('Pubblicato ✔ — il sito si aggiorna entro un paio di minuti.', 'ok');
      goBtn.remove();
    } catch (e) { line(e.message, 'err'); goBtn.disabled = false; goBtn.textContent = 'Riprova'; }
    closeBtn.disabled = false;
  };
}

/* ============================================================
   Stato, banner, barra superiore
   ============================================================ */
function updateStatus() {
  const chip = $('#status'), n = [...S.pending.keys()].filter((p) => collectImages(S.content).has(p)).length;
  if (S.source !== 'github') { chip.className = 'chip warn'; chip.textContent = 'Non collegato a GitHub'; }
  else if (S.dirty) { chip.className = 'chip warn'; chip.textContent = 'Modifiche non pubblicate' + (n ? ` · ${n} immagini` : ''); }
  else { chip.className = 'chip ok'; chip.textContent = 'Tutto pubblicato'; }
  $('#btn-publish').disabled = S.source === 'github' && !S.dirty;
}
function updateBanner(extra) {
  const b = $('#banner');
  b.replaceChildren();
  if (extra) { b.hidden = false; b.append(...extra); return; }
  if (S.source !== 'github') {
    b.hidden = false;
    b.append('Puoi già modificare e vedere l’anteprima, ma per pubblicare devi collegare GitHub.', h('button', { class: 'btn btn--sm', onclick: settingsDialog }, 'Collega GitHub'));
  } else b.hidden = true;
}

/* ============================================================
   Avvio
   ============================================================ */
async function init() {
  const cfg = getCfg();
  let draft = null;
  try { const raw = await idb.get('draft'); if (raw) draft = JSON.parse(raw); } catch {}

  try {
    if (cfg) {
      const d = await loadFromGitHub(cfg);
      S.content = d.content; S.source = 'github'; S.base = { commit: d.commit, blob: d.blob };
    } else S.content = await loadLocal();
  } catch (e) {
    toast('Non riesco a leggere da GitHub: ' + e.message, true, 6000);
    try { S.content = await loadLocal(); } catch { document.body.textContent = 'Impossibile caricare i contenuti.'; return; }
  }
  snapNow();
  renderAll(); updateStatus(); updateBanner();

  if (draft && draft.content && JSON.stringify(draft.content) !== JSON.stringify(S.content)) {
    const when = new Date(draft.savedAt).toLocaleString('it-IT');
    updateBanner([`Hai modifiche non pubblicate salvate in questo browser (${when}).`,
      h('button', { class: 'btn btn--sm', onclick: async () => {
        S.content = normalize(draft.content);
        for (const k of (await idb.keys()) || []) {
          if (typeof k === 'string' && k.startsWith('img:')) {
            const blob = await idb.get(k); const p = k.slice(4);
            if (blob) { S.pending.set(p, blob); S.urls.set(p, URL.createObjectURL(blob)); S.meta.set(p, { w: 0, h: 0, size: blob.size }); }
          }
        }
        S.dirty = true; S.hist = []; S.histI = -1; snapNow(); S.sel = { kind: 'home' }; S.route = '/';
        renderAll(); updateStatus(); updateBanner(); toast('Bozza ripristinata');
      } }, 'Ripristina'),
      h('button', { class: 'btn btn--sm', onclick: async () => { await idb.del('draft'); for (const k of (await idb.keys()) || []) if (String(k).startsWith('img:')) await idb.del(k); updateBanner(); } }, 'Scarta')]);
  }
}

$('#btn-undo').addEventListener('click', () => undo(-1));
$('#btn-redo').addEventListener('click', () => undo(1));
$('#btn-settings').addEventListener('click', settingsDialog);
$('#btn-publish').addEventListener('click', publishFlow);
$('#btn-export').addEventListener('click', () => {
  const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(S.content, null, 2) + '\n'], { type: 'application/json' })), download: 'content.json' });
  document.body.append(a); a.click(); a.remove();
});
$('#btn-pv-toggle').addEventListener('click', () => { document.body.classList.toggle('show-pv'); setTimeout(() => { layoutPreview(); }, 30); });
$('#dev-desktop').addEventListener('click', () => { S.device = 'desktop'; $('#dev-desktop').classList.add('on'); $('#dev-mobile').classList.remove('on'); layoutPreview(); });
$('#dev-mobile').addEventListener('click', () => { S.device = 'mobile'; $('#dev-mobile').classList.add('on'); $('#dev-desktop').classList.remove('on'); layoutPreview(); });
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); undo(e.shiftKey ? 1 : -1); }
});
window.__S = S; // utile per debug e test

init();
