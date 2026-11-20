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

// Illustrazioni del footer fornite da Andrea (sentiero.svg e scala_sito.svg): path originali, non modificati.
// Cambia solo il viewBox, ritagliato sull'ingombro del disegno (l'originale è un artboard 1920x1080).
export const ROUTE = { viewBox: '77.19 389.94 1779.47 300.04', d: "M1844,566.74c-6.3,0-11.55,4.65-12.46,10.69-4.3.06-8.61.15-12.85.24-22.39.43-45.54.89-66.95-2.4-5.56-.87-11.25-1.3-16.74-1.73-4.09-.32-8.33-.65-12.55-1.15l-2.92-.37c-13-1.6-25.29-3.09-38.27,3.2-3.66,1.75-7.14,3.87-10.51,5.91-6.86,4.15-13.37,8.09-20.98,9.22-5.34.78-10.99.61-16.44.45-4.15-.11-8.41-.24-12.63.04-6.21.39-8.44,1.82-12.48,4.39l-1.34.84c-3.22,2.01-6.62,3.83-9.91,5.58-4.3,2.29-8.76,4.65-13.02,7.59-2.03,1.41-4.09,3.01-6.27,4.72-4.61,3.57-9.39,7.29-13.87,9.02-4.13,1.58-8.37,2.62-12.85,3.72-5.52,1.34-11.23,2.73-16.74,5.26-2.49,1.12-5.41,2.16-8.48,3.29-6.99,2.51-14.19,5.11-19.04,9.48-2.6,2.34-4.59,6.12-6.51,9.78-1.45,2.75-2.94,5.58-4.54,7.46l-.61.69c-2.7,3.2-5.54,6.51-8.76,9.02-2.44,1.93-4.78,2.88-7.46,4-.87.35-1.75.71-2.7,1.12-8.7,3.85-16.05,3.81-26.28,3.74h-.26c-6.68.02-12.7,1.28-18.54,2.55-3.61.78-7.35,1.6-11.16,2.08-7.07.87-15.03.5-22.74.13-2.29-.11-4.54-.22-6.73-.28-5.3-.15-9.39-.65-14.58-2.66-.71-.28-1.47-.5-2.25-.74-1.54-.43-2.99-.84-3.81-1.75-.87-.93-1.02-2.03-1.23-3.42-.3-2.03-.71-4.82-3.92-6.62-3.94-2.18-9.6-1.56-15.08-.93-3.07.35-5.97.67-8.09.43-5.32-.61-9.06-1.62-13.37-3.68-6.34-2.99-12.46-5.86-18.41-8.63-8.37-3.89-16.27-7.59-23.99-11.34-.78-.43-6.51-4.3-7.05-4.76-1.84-2.06-5.08-5.56-6.14-6.06-5.28-2.47-13.22-3.03-19.62-3.46-1.49-.11-2.9-.22-4.2-.32-6.88-.63-14.1-.39-21.07-.15-3.33.11-6.64.24-9.86.26-10.82.02-21.37-1.67-31.63-3.33-10.3-1.69-20.94-3.42-31.97-3.42-7.7,0-14.56-.84-21.81-1.73-1.67-.19-3.33-.41-5.02-.61-1.73-.19-3.46-.35-5.11-.48-10.12-.82-15.01-1.62-15.51-10.84-.04-.67-.09-1.38-.15-2.12-.26-3.63-.58-8.18.8-10.84,1.06-2.05,2.25-3.03,3.53-4.05,1.73-1.41,3.72-3.01,4.8-6.92,3.22-11.57-4.09-15.58-10.56-19.1-1.1-.61-2.25-1.23-3.35-1.9-5.69-3.44-7.59-7.72-9.8-12.68-1.15-2.55-2.34-5.21-4.11-7.96-4-6.14-10.45-9.6-16.66-12.96-2.14-1.15-4.15-2.23-6.06-3.4-7.27-4.54-14.23-9.19-19.17-16.18-1.84-2.6-3.5-5.28-5.13-7.85-3.14-4.98-6.34-10.1-10.82-14.9-.48-.5-.95-1.04-1.45-1.58-5.1-5.65-12.83-14.15-21.72-8.44-1.56,1.02-2.57,2.83-3.55,4.61-.91,1.62-1.84,3.31-2.99,3.98-4.59,2.7-5.3,1.75-7.9-1.82-.52-.69-1.06-1.45-1.69-2.21-.69-.87-1.19-1.9-1.71-3.01-.32-.65-.63-1.32-1-1.97-.43-.78-1.32-1.21-2.21-1.08-.45.06-1.9-.06-3.07-.15-3.37-.3-5.88-.45-7.55.24-3.55,1.47-5.8,4.8-7.98,8-1.17,1.75-2.27,3.37-3.48,4.54-5.8,5.62-11.64,9.02-17.39,10.1-9.09,1.69-18.73,1.38-28.08,1.1-10.04-.32-20.44-.65-30.24,1.51-.09.02-.17.04-.26.09-.26-2.05-.13-4.41,0-6.71.13-2.51.28-5.08-.06-7.33-.17-1.04-1.04-1.82-2.1-1.84-18.69-.37-28.81-18.3-38.59-35.65-4.63-8.22-9.02-15.96-14.21-21.78-7.31-8.18-11.92-10.25-23.06-10.25h-.56c-1.21,0-2.49,0-3.76-.02-6.58-.04-14.04-.13-19.69,2.34-1.41.61-2.6,1.54-3.72,2.42-1.51,1.21-2.81,2.18-4.3,2.21-2.38-.09-2.6-.76-3.33-2.99-.54-1.58-1.19-3.55-2.99-5.19-4.11-3.72-13.46-4.61-20.96-5.32-2.29-.22-4.28-.41-5.75-.65-1.28-.19-2.75-.52-4.3-.87-2.36-.52-5.04-1.08-7.57-1.38-1.45-.17-3.31-.28-5.28-.41-3.68-.22-7.83-.45-10.19-1.15-2.01-.61-2.83-1.71-3.85-3.11-.67-.93-1.45-1.97-2.6-2.88-3.07-2.38-7.05-4.59-10.56-6.53-.95-.52-1.88-1.04-2.77-1.54-5.82-3.31-14.43-5.06-23.15-5.26h-3.53c-8.85.22-17.44,2.01-22.93,5.41-10.34,6.38-24.19,13.97-39.7,16.01-3.48.48-7.07.43-10.54.43-5-.04-10.19-.09-15.06,1.34-2.57.76-5.21,1.19-8,1.67-4.72.8-9.58,1.62-14.15,4.02-.56.3-.95.84-1.1,1.45-1.51.24-2.81.78-4,1.28-1.15.5-2.25.95-3.48,1.1-2.64.32-5.6.17-8.48.02-1.67-.09-3.29-.15-4.87-.15h-1.86c-8.24-.06-13.33-.04-20.98,4.54-1.67-.26-3.31-.13-4.93.41-.09.04-.17.06-.26.11-1.75.87-2.44,2.21-2.9,3.07-.41.8-.5.93-1.04,1.1-1.58.48-4.54.19-6.94-.02-1.38-.13-2.68-.24-3.83-.26-2.38,0-4.93-.13-7.61-.28-6.81-.35-13.84-.71-19.97.87-4.98,1.3-9.39,3.35-13.67,5.34-7.94,3.74-15.47,7.25-25.35,4.87-16.51-4-23.19-13.93-32.43-27.71l-1.17-1.75c-.43-.63-1.15-1-1.93-.95s-1.45.5-1.8,1.17c-3.48,6.79-5.84,12.72-6.64,20.66-6.71,1-14.23,1-16.79-.93-.67-.5-1.58-.56-2.34-.17-.74.41-1.17,1.21-1.12,2.03.06,1.08.39,3.42.8,6.4.54,3.98,1.51,11.08,1.51,13.43-2.08.69-8.87.24-12.27,0-3.98-.26-6.51-.41-8.05-.15-.91.15-1.6.84-1.77,1.73-.32,1.84-.56,3.55-.78,5.21-.58,4.41-1.08,8.03-3.29,12.05-.74-.37-1.47-.78-2.21-1.19-1.41-.76-2.86-1.56-4.54-2.29-4.33-1.88-10.04-2.16-14.84-2.4-8.41-.41-21.33,2.86-22.22,13.61-.26,3.29,1.93,6.36,4.05,9.35,1.62,2.27,3.44,4.87,3.12,6.38-.15.65-.78,1.3-1.86,1.93-1.3.74-2.01.61-2.44.45-2.53-.97-4.54-6.99-5.99-11.4-1.41-4.18-2.51-7.46-4.3-9.06-.61-.56-1.47-.69-2.23-.41-6.1,2.42-7.01,8.74-7.81,14.32-.41,2.94-.8,5.73-1.84,7.79-2.03-1.34-2.83-4.65-3.72-9.24-1.02-5.26-2.16-11.18-7.79-11.94-1.1-.15-2.16.61-2.4,1.71-1.08,5.26-.84,10.9-.61,16.35.13,2.83.24,5.54.17,8.16l-.02,1.43c-.04,3.03-.06,4.69-1.28,7.14-.61,1.23-1.47,2.08-2.38,2.99-1.54,1.49-3.4,3.33-3.46,6.9-1.71.56-3.05.58-4,.02-2.94-1.69-3.72-8.8-4.41-15.1-.97-8.85-1.97-18.02-9.09-18.78-1.82-.17-3.4.35-4.63,1.51-3.22,3.14-3.01,10.02-2.47,17.41.09,1.32.17,2.47.17,3.27.02,4.78-.63,9.09-1.32,13.63-.43,2.86-.87,5.78-1.12,8.83-4.56.63-8.72.74-11.36-1.99-1.99-2.06-1.73-5.24-1.47-8.59.22-2.9.45-5.91-.78-8.46-1.04-2.14-2.23-4.56-5.75-5.65-5.08-1.58-6.92.65-8.22,2.86-.39.63-.71,1.19-1.17,1.49-1.67,1.12-2.1,2.88-2.36,4.02-.06.26-.15.61-.19.8-.8-.91-2.06-3.24-2.57-4.2-.3-.56-.54-1.02-.74-1.34-.48-.78-1.38-1.19-2.27-1.02-4.5.89-6.42,4.67-8.13,8-.71,1.38-1.38,2.68-2.18,3.72-3.79,4.91-7.9,6.19-13.56,7.96l-.71.22c-7.18,2.25-10.36,5.71-14.75,10.51l-1.41,1.54c-2.29,1.06-4.39,2.44-6.25,4.13-.15.13-.28.3-.39.48-.91,1.51-1.45,3.18-1.58,4.91-1.02,1.45-1.99,3.18-2.94,4.87-1.12,1.99-2.27,4.05-3.27,5.17-1.84,2.08-4,4.05-6.1,5.95-3.44,3.14-7.01,6.38-9.56,10.41-1.64,2.55-3.16,5.39-4.63,8.13-1.84,3.44-3.76,7.01-5.91,10.02-1.56,2.21-3.72,4.17-6.01,6.25-1.77,1.6-3.61,3.24-5.19,5.06-.65.76-1.6,1.73-2.68,2.86-.17.17-.35.37-.52.54h-17.67c-1.19,0-2.16.97-2.16,2.16v18.67c0,1.21.97,2.16,2.16,2.16h18.67c1.19,0,2.16-.95,2.16-2.16v-17.85c.17-.19.35-.37.5-.52,1.12-1.19,2.12-2.23,2.81-3.03,1.41-1.62,3.07-3.12,4.82-4.69,2.36-2.14,4.8-4.35,6.64-6.94,2.29-3.22,4.28-6.92,6.21-10.49,1.49-2.79,2.9-5.43,4.43-7.85,2.27-3.53,5.45-6.45,8.85-9.52,2.16-1.99,4.41-4.05,6.4-6.27,1.3-1.47,2.53-3.63,3.81-5.93,1.02-1.77,2.03-3.61,3.03-4.93.28-.37.43-.8.43-1.28.02-1.15.3-2.18.84-3.18,1.58-1.38,3.33-2.51,5.26-3.35.26-.11.5-.28.71-.5l1.71-1.88c4.24-4.61,6.79-7.4,12.87-9.3l.69-.22c5.95-1.86,11.1-3.46,15.71-9.43,1.06-1.36,1.84-2.92,2.62-4.41,1.28-2.51,2.27-4.28,3.7-5.17,2.03,3.74,3.7,6.38,6.1,6.27,3.46-.15,4.13-2.96,4.46-4.3.19-.76.32-1.28.56-1.45,1.28-.84,1.95-1.99,2.49-2.88.8-1.38.95-1.64,3.22-.93,1.6.5,2.1,1.28,3.12,3.4.74,1.51.56,3.81.37,6.23-.3,3.98-.65,8.48,2.68,11.94,4.78,4.93,12.03,3.76,16.83,2.99,1-.15,1.75-1,1.82-1.99.22-3.5.74-6.9,1.23-10.19.67-4.5,1.38-9.17,1.36-14.3,0-.89-.09-2.12-.19-3.57-.28-3.89-.87-11.98,1.19-13.97.19-.19.5-.39,1.15-.32,3.63.39,4.5,8.13,5.24,14.95.89,8.03,1.71,15.6,6.58,18.39,2.47,1.41,5.58,1.28,9.26-.37.87-.39,1.38-1.3,1.25-2.23-.3-2.62.56-3.46,2.12-5,1.04-1.02,2.31-2.27,3.24-4.17,1.62-3.31,1.67-5.8,1.71-8.96l.02-1.41c.06-2.77-.04-5.67-.17-8.46-.17-4.11-.37-8.35.06-12.31.95,1.41,1.51,3.87,2.16,7.2,1.02,5.28,2.27,11.83,8.33,13.2.82.17,1.64-.11,2.16-.76,2.42-3.01,3.03-7.16,3.59-11.18.71-4.98,1.36-8.35,3.68-10.12.76,1.49,1.58,3.96,2.27,6.04,1.93,5.8,4.13,12.35,8.57,14.06,1.93.74,4,.48,6.14-.74,2.18-1.25,3.5-2.86,3.92-4.76.76-3.4-1.58-6.66-3.81-9.82-1.6-2.23-3.4-4.78-3.27-6.47.63-7.66,11.21-9.95,17.89-9.65,4.24.22,9.54.48,13.13,2.06,1.51.65,2.81,1.36,4.2,2.12,1.3.71,2.66,1.47,4.24,2.16.97.43,2.12.11,2.7-.8,3.59-5.54,4.24-10.36,4.91-15.47.15-1.06.3-2.18.48-3.33,1.45.02,3.53.15,5.56.3,8.72.58,14.17.78,16.16-1.64,1.02-1.21,1.06-2.88-.84-16.7-.11-.87-.24-1.71-.35-2.49,6.38,1.6,15.73.11,17.89-.26,1-.17,1.73-1,1.8-1.99.45-6.73,2.12-11.9,4.67-17.37,9,13.39,16.55,23.9,34.09,28.14,11.38,2.75,19.95-1.25,28.21-5.13,4.09-1.93,8.33-3.89,12.91-5.08,5.47-1.43,12.18-1.06,18.67-.74,2.73.15,5.32.28,7.81.28.95.02,2.16.13,3.46.24,2.9.28,6.19.56,8.59-.15,2.29-.69,3.09-2.23,3.61-3.24.32-.63.5-.89.87-1.1,1.08-.35,2.16-.37,3.27-.09.56.15,1.17.04,1.67-.26,7.03-4.39,10.9-4.39,19.45-4.35h1.86c1.49,0,3.07.06,4.65.15,3.05.15,6.21.3,9.22-.06,1.84-.22,3.33-.84,4.63-1.41,1.82-.76,3.12-1.3,5.02-.87,1.12.26,2.23-.41,2.55-1.51.15-.5.11-1-.09-1.43,3.37-1.41,7.01-2.01,10.82-2.66,2.79-.45,5.67-.95,8.5-1.77,4.26-1.23,8.91-1.21,13.8-1.19,3.63.04,7.38.06,11.14-.43,16.33-2.16,30.7-10.02,41.4-16.61,10.36-6.4,34.01-6.45,45.19-.09.91.5,1.84,1.04,2.81,1.56,3.53,1.97,7.18,3.98,9.99,6.17.67.52,1.17,1.21,1.75,2.01,1.21,1.64,2.7,3.7,6.12,4.69,2.83.84,7.27,1.1,11.16,1.34,1.9.11,3.7.22,5.04.37,2.31.28,4.78.82,7.16,1.34,1.64.35,3.18.67,4.52.89,1.62.26,3.66.45,6.04.69,6.14.58,15.4,1.45,18.45,4.22.97.89,1.36,2.03,1.8,3.35.8,2.44,1.93,5.75,7.29,5.95,2.99.13,5.24-1.62,7.14-3.14.95-.76,1.86-1.47,2.77-1.86,4.8-2.08,11.77-2.01,17.91-1.97,1.32.02,2.6.02,3.83.02,10.12-.06,13.84,1.49,20.38,8.8,4.89,5.47,9.15,13.02,13.67,21.03,9.58,17,20.42,36.21,40.32,37.77.06,1.43-.02,3.03-.13,4.67-.26,4.69-.56,10.02,2.42,13.69.48.58,1.21.89,1.99.78.74-.11,1.38-.58,1.69-1.28.32-.78.61-1.56.8-2.38,8.85-1.73,18.06-1.43,27.8-1.12,9.56.28,19.45.61,29.01-1.19,6.6-1.23,13.2-5.02,19.6-11.23,1.54-1.49,2.81-3.37,4.07-5.23,1.82-2.68,3.7-5.45,6.04-6.43.82-.35,3.89-.09,5.54.06.97.09,1.77.15,2.47.17.09.19.17.39.26.58.61,1.28,1.23,2.6,2.27,3.87.56.69,1.06,1.38,1.54,2.03,2.64,3.61,5.6,7.68,13.59,2.99,2.18-1.28,3.46-3.57,4.59-5.62.67-1.23,1.45-2.62,2.1-3.05,5.39-3.46,10.3,1.23,16.18,7.7.5.56,1,1.1,1.47,1.62,4.2,4.5,7.18,9.24,10.32,14.26,1.67,2.64,3.37,5.36,5.28,8.07,5.41,7.64,12.74,12.57,20.42,17.33,1.99,1.25,4.17,2.42,6.27,3.55,5.75,3.09,11.68,6.3,15.1,11.51,1.58,2.44,2.7,4.95,3.76,7.38,2.31,5.15,4.67,10.47,11.53,14.6,1.15.71,2.34,1.36,3.53,1.99,6.47,3.55,10.75,5.88,8.46,14.15-.74,2.6-1.84,3.48-3.37,4.72-1.41,1.15-3.16,2.57-4.65,5.43-1.93,3.74-1.56,8.96-1.25,13.15.04.69.09,1.38.13,2.03.71,13.41,10.25,14.17,19.49,14.9,1.6.13,3.27.28,4.95.48,1.69.19,3.33.39,4.98.58,7.4.93,14.39,1.77,22.35,1.77,10.69,0,21.16,1.71,31.28,3.35,10.43,1.71,21.18,3.37,32.34,3.4,3.27-.02,6.62-.15,9.99-.26,6.84-.24,13.91-.48,20.53.13,1.32.11,2.77.22,4.28.32,5.97.43,13.39.95,17.96,3.01.69.58,3.18,3.2,4.89,5.08.78.89,7.94,5.56,8.31,5.75,7.83,3.79,15.75,7.48,24.12,11.38,5.95,2.79,12.07,5.62,18.39,8.63,4.78,2.27,8.91,3.42,14.73,4.07,2.62.28,5.75-.06,9.06-.45,4.59-.5,9.78-1.08,12.48.41,1.32.74,1.47,1.56,1.77,3.48.24,1.69.56,3.81,2.29,5.71,1.67,1.8,3.85,2.44,5.8,3.01.65.17,1.3.37,1.9.58,5.73,2.23,10.36,2.79,15.99,2.96,2.16.06,4.41.17,6.68.28,4.26.19,8.59.39,12.83.39,3.63,0,7.2-.13,10.64-.56,4-.5,7.83-1.32,11.53-2.14,5.78-1.25,11.25-2.44,17.33-2.44h.54c10.34.06,18.52.11,28.06-4.11.91-.39,1.77-.76,2.6-1.1,2.88-1.17,5.58-2.29,8.48-4.56,3.57-2.79,6.53-6.27,9.41-9.63l.58-.71c1.93-2.25,3.53-5.3,5.08-8.24,1.75-3.31,3.55-6.75,5.58-8.59,4.22-3.79,11.01-6.23,17.61-8.61,3.16-1.15,6.14-2.23,8.8-3.42,5.15-2.36,10.64-3.7,15.96-5,4.43-1.08,9-2.18,13.39-3.89,5.08-1.95,10.1-5.86,14.97-9.63,2.12-1.67,4.15-3.24,6.08-4.56,4.05-2.79,8.39-5.11,12.59-7.36,3.35-1.77,6.81-3.63,10.17-5.73l1.36-.87c3.89-2.47,5.34-3.37,10.45-3.72,4-.26,8.18-.13,12.22-.02,5.65.15,11.49.32,17.2-.5,8.48-1.25,15.66-5.6,22.61-9.8,3.29-1.99,6.68-4.05,10.15-5.71,11.85-5.73,23.51-4.3,35.87-2.79l2.94.35c4.28.52,8.57.84,12.72,1.17,5.65.45,11.01.87,16.4,1.69,21.81,3.35,45.15,2.9,67.71,2.44,4.24-.06,8.55-.15,12.83-.22,1.1,5.82,6.23,10.25,12.4,10.25,6.97,0,12.63-5.67,12.63-12.63s-5.67-12.63-12.63-12.63ZM95.85,632h-14.34v-14.34h14.34v14.34ZM1844,587.68c-3.76,0-6.94-2.53-7.96-5.97-.24-.74-.35-1.51-.35-2.34,0-.69.09-1.36.26-1.99.89-3.63,4.15-6.32,8.05-6.32,4.56,0,8.31,3.72,8.31,8.31s-3.74,8.31-8.31,8.31Z" };
export const SCALE = { viewBox: '419.28 510.92 1081.45 58.16', d: "M419.28,510.92v58.16h1081.45v-58.16H419.28ZM493.2,512.77h68.41v11.43h-68.41v-11.43ZM421.12,512.77h68.38v11.43h-68.38v-11.43ZM489.51,567.23h-68.38v-39.33h68.38v39.33ZM853.7,512.77h68.38v11.43h-68.38v-11.43ZM781.6,512.77h68.41v11.43h-68.41v-11.43ZM709.49,512.77h68.41v11.43h-68.41v-11.43ZM637.41,512.77h68.41v11.43h-68.41v-11.43ZM633.72,524.2h-68.41v-11.43h68.41v11.43ZM922.11,567.23h-284.7v-39.33h284.7v39.33ZM994.19,524.2h-68.41v-11.43h68.41v11.43ZM1066.3,524.2h-68.41v-11.43h68.41v11.43ZM1138.37,524.2h-68.38v-11.43h68.38v11.43ZM1210.48,524.2h-68.41v-11.43h68.41v11.43ZM1282.59,524.2h-68.41v-11.43h68.41v11.43ZM1354.66,524.2h-68.38v-11.43h68.38v11.43ZM1426.77,524.2h-68.41v-11.43h68.41v11.43ZM1498.88,524.2h-68.41v-11.43h68.41v11.43Z" };

export function listRoutes(c) {
  return [
    { path: '/', kind: 'home' },
    { path: '/work/projects/', kind: 'portfolio' },
    ...(c.projects || []).map((p) => ({ path: `/work/projects/${p.slug}/`, kind: 'project', slug: p.slug })),
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
      return `<a href="${esc(n.href)}"${cur}${n.href === '/contact/' ? ' data-ap="navlast"' : ''}><span class="lbl">${esc(n.label)}</span>${n.number ? `<sup>${esc(n.number)}</sup>` : ''}</a>`;
    })
    .join('');
  return `<header class="hdr" data-ap="hdr"><a class="hdr-name" href="/">${esc(c.site.name)}</a><nav class="hdr-nav" aria-label="Main">${nav}</nav></header>`;
}

function footer(c, o) {
  const f = c.footer || {};
  const route = f.routeImage
    ? `<img class="route" src="${esc(o.img(f.routeImage))}" alt="" loading="lazy">`
    : `<svg class="route" viewBox="${ROUTE.viewBox}" aria-hidden="true"><path d="${ROUTE.d}"/></svg>`;
  const scale = `<svg class="scale" viewBox="${SCALE.viewBox}" aria-hidden="true"><path d="${SCALE.d}"/></svg>`;
  const links = (f.links || []).map((l) => `<a href="${esc(l.href)}"${linkAttrs(l.href)}><span class="ar">↘︎</span>${esc(l.label)}</a>`).join('');
  return `<footer class="ftr" data-theme="blue">
  <div class="plusgrid" data-grid aria-hidden="true"></div>
  <a class="ftr-home" href="/" aria-label="Home">${fit('ftr-word', f.wordmark || c.site.name)}</a>
  <div class="ftr-mid">${route}<nav class="ftr-links" aria-label="Footer">${links}</nav><div class="ftr-copy">${esc(f.copyright)}</div>${scale}</div>
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
<link rel="icon" href="${esc(o.asset('favicon.ico'))}" sizes="48x48">
<link rel="icon" type="image/png" href="${esc(o.asset('favicon/favicon-192.png'))}" sizes="192x192">
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
  return `<a class="pcard pcard--${variant}" href="/work/projects/${esc(p.slug)}/">
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
  <a class="cta" href="/work/projects/">${fit('cta-in', h.viewAllLabel)}</a>
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
    title: `Projects — ${c.site.author}`, description: c.site.description, bodyClass: 'page-portfolio', main,
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
<a class="explore cta" href="/work/projects/#work">${fit('explore-in', p.exploreLabel)}</a>
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
  if (path === '/work/projects/') return renderPortfolio(c, path, o);
  if (path === '/contact/') return renderContact(c, path, o);
  const m = path.match(/^\/work\/projects\/([^/]+)\/$/);
  if (m) {
    const p = (c.projects || []).find((x) => x.slug === m[1]);
    if (p) return renderProject(c, path, o, p);
  }
  return render404(c, o);
}
