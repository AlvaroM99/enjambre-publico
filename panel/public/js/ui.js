// Utilidades de la interfaz (ADR 0015). Todo lo que viene de GitHub se pinta como texto: nunca innerHTML.

export const $ = (id) => document.getElementById(id);

export function h(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'href') { if (/^https:\/\/github\.com\//.test(v) || v.startsWith('/') || v.startsWith('#')) el.setAttribute('href', v); }
    else el.setAttribute(k, v === true ? '' : v);
  }
  anadir(el, hijos);
  return el;
}

function anadir(el, hijos) {
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : String(hijo));
  }
}

/** replaceChildren sin huecos (null/false), que si no se pintarían como el texto «null». */
export function rellenar(el, ...hijos) {
  el.replaceChildren();
  anadir(el, hijos);
  return el;
}

export const enlace = (url, texto, clase) => (url ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: clase }, texto) : texto);
export const corto = (repo) => repo.split('/')[1] ?? repo;

export function duracion(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
export const hace = (iso) => (iso ? `hace ${duracion(Date.now() - Date.parse(iso))}` : '—');
export const hora = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const fecha = (iso) => new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function aviso(texto, mal = false) {
  const t = h('div', { class: `toast${mal ? ' mal' : ''}`, role: 'status' }, texto);
  const caja = $('avisos');
  caja.append(t);
  // Como mucho 4 a la vez: los más viejos se van antes.
  while (caja.children.length > 4) caja.firstElementChild.remove();
  setTimeout(() => t.remove(), mal ? 9000 : 4500);
}

export const est = (texto, clase) => h('span', { class: `est ${clase}` }, texto);

const RESULTADOS = { success: ['bien', 'bien'], failure: ['falló', 'mal'], cancelled: ['cancelado', 'neutro'], skipped: ['omitido', 'neutro'], timed_out: ['sin tiempo', 'mal'], action_required: ['espera aprobación', 'espera'] };
export const resultado = (c) => RESULTADOS[c] ?? [c ?? '—', 'neutro'];

export function insigniaCi(ci) {
  if (!ci) return est('CI sin datos', 'neutro');
  return est(`CI ${ci === 'success' ? 'verde' : ci === 'pending' ? 'en marcha' : 'roja'}`, ci === 'success' ? 'bien' : ci === 'pending' ? 'espera' : 'mal');
}

export function insigniaVeredicto(nombre, v) {
  if (!v) return est(`${nombre}: —`, 'neutro');
  const clase = v.veredicto === 'APROBAR' ? 'bien' : v.veredicto === 'BLOQUEAR' ? 'mal' : 'espera';
  return est(`${nombre}: ${v.veredicto ?? '?'}`, clase);
}

// ------------------------------------------------------------------ iconos (SVG en línea, sin ficheros de fuera)

const SVG = 'http://www.w3.org/2000/svg';
const TRAZOS = {
  vivo: 'M3 12h4l3-8 4 16 3-8h4',
  bandeja: 'M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5',
  issues: 'M12 3a9 9 0 100 18 9 9 0 000-18zm0 6v4m0 3h.01',
  prs: 'M6 3v12M6 15a3 3 0 100 6 3 3 0 000-6zM6 3a3 3 0 100 6M18 21a3 3 0 100-6 3 3 0 000 6zM18 15V8a3 3 0 00-3-3h-4',
  actividad: 'M4 6h16M4 12h10M4 18h7',
  repos: 'M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4zM8 4v16',
  mas: 'M12 5v14M5 12h14',
  buscar: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',
  sol: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 7a5 5 0 100 10 5 5 0 000-10z',
  campana: 'M6 16V11a6 6 0 1112 0v5l2 2H4zM10 20a2 2 0 004 0',
  log: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
  reintentar: 'M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5',
  parar: 'M7 7h10v10H7z',
};
export function icono(nombre, clase = 'ico') {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', clase);
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG, 'path');
  p.setAttribute('d', TRAZOS[nombre] ?? '');
  s.append(p);
  return s;
}

/** Hexágono con las iniciales del agente: su «avatar» en todo el panel. */
export function avatar(agente, iniciales, activo = false) {
  return h('span', { class: `hex${activo ? ' activo' : ''}`, dataset: { agente }, 'aria-hidden': 'true' }, iniciales);
}

// ------------------------------------------------------------------ markdown mínimo y seguro

export function markdown(texto) {
  const caja = h('div', { class: 'md' });
  let codigo = null;
  let parrafo = [];
  let lista = null;
  const cerrar = () => {
    if (parrafo.length) caja.append(h('p', {}, enLinea(parrafo.join(' '))));
    parrafo = [];
    if (lista) caja.append(lista);
    lista = null;
  };
  for (const linea of String(texto ?? '').split('\n')) {
    if (linea.trimStart().startsWith('```')) {
      if (codigo) { caja.append(h('pre', { class: 'codigo' }, codigo.join('\n'))); codigo = null; } else { cerrar(); codigo = []; }
      continue;
    }
    if (codigo) { codigo.push(linea); continue; }
    const t = /^(#{1,4})\s+(.*)$/.exec(linea);
    if (t) { cerrar(); caja.append(h('h4', { class: `md-h${t[1].length}` }, enLinea(t[2]))); continue; }
    const li = /^\s*(?:[-*]|\d+\.)\s+(?:\[([ x])\]\s+)?(.*)$/.exec(linea);
    if (li) {
      if (parrafo.length) { caja.append(h('p', {}, enLinea(parrafo.join(' ')))); parrafo = []; }
      lista ??= h('ul', {});
      lista.append(h('li', {}, li[1] !== undefined ? (li[1] === 'x' ? '☑ ' : '☐ ') : '', enLinea(li[2])));
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(linea)) {
      cerrar();
      if (/^\s*\|[\s:|-]+\|\s*$/.test(linea)) continue;
      const celdas = linea.trim().slice(1, -1).split('|').map((c) => h('td', {}, enLinea(c.trim())));
      const ultima = caja.lastElementChild;
      const tabla = ultima?.classList?.contains('md-tabla') ? ultima : caja.appendChild(h('div', { class: 'md-tabla' }, h('table', {})));
      tabla.firstChild.append(h('tr', {}, celdas));
      continue;
    }
    if (!linea.trim()) { cerrar(); continue; }
    if (lista) cerrar();
    parrafo.push(linea.trim());
  }
  if (codigo) caja.append(h('pre', { class: 'codigo' }, codigo.join('\n')));
  cerrar();
  return caja;
}

/** `código` y **negrita** dentro de una línea, como nodos; el resto, texto tal cual. */
function enLinea(texto) {
  const partes = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let ultimo = 0;
  for (const m of texto.matchAll(re)) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    partes.push(m[0].startsWith('`') ? h('code', {}, m[0].slice(1, -1)) : h('strong', {}, m[0].slice(2, -2)));
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

export function lineasDiff(parche) {
  return h('pre', { class: 'diff' }, parche.split('\n').map((l) => h('span', { class: l.startsWith('@@') ? 'h' : l.startsWith('+') ? 'a' : l.startsWith('-') ? 'b' : '' }, l || ' ')));
}
