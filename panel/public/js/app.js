// Hive · panel en vivo del enjambre (ADR 0015): arranque, navegación, conexión en vivo, tema y avisos.
import { api, sesion } from './api.js';
import { app } from './app-estado.js';
import { bandeja, eventosAvisables } from './datos.js';
import { VISTAS } from './vistas.js';
import { alCambiarEstado, cerrarCajon, abrirNuevaIssue } from './cajones.js';
import { $, h, rellenar, corto, duracion, hace, aviso, icono } from './ui.js';

const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

// ------------------------------------------------------------------ navegación

function vistaDeHash() {
  const v = location.hash.slice(1);
  return VISTAS[v] ? v : 'vivo';
}

function pintarNav() {
  const b = app.estado ? bandeja(app.estado, { filtro: app.filtro, propietario: app.login }).length : 0;
  rellenar($('nav'), Object.entries(VISTAS).map(([clave, v]) =>
    h('a', { href: `#${clave}`, class: 'nav-item', 'aria-current': app.vista === clave ? 'page' : null },
      icono(v.icono), h('span', {}, v.titulo), clave === 'bandeja' && b > 0 && h('span', { class: 'globo' }, String(b)))));
}

function pintarFiltros() {
  const repos = app.estado ? Object.keys(app.estado.repos).sort() : [];
  if (app.filtro !== 'todos' && !repos.includes(app.filtro)) app.filtro = 'todos';
  rellenar($('filtros'), ['todos', ...repos].map((r) =>
    h('button', { type: 'button', class: 'chip-filtro', 'aria-pressed': String(app.filtro === r), onclick: () => { app.filtro = r; guardar('hive:filtro', r); repintar(); } },
      r === 'todos' ? 'Todos los repos' : corto(r))));
}

function repintar() {
  if (!app.estado) return;
  app.vista = vistaDeHash();
  $('titulo-vista').textContent = VISTAS[app.vista].titulo;
  document.title = `${VISTAS[app.vista].titulo} · Hive`;
  pintarNav();
  pintarFiltros();
  // Al repintar no se pierde lo que estés escribiendo en un formulario de etiquetas o en la búsqueda.
  const enfocado = document.activeElement;
  if ($('vista').contains(enfocado) && (enfocado.tagName === 'SELECT' || enfocado.tagName === 'INPUT' || enfocado.tagName === 'TEXTAREA')) return;
  VISTAS[app.vista].pintar($('vista'));
  pintarSalud();
}
app.repintar = repintar;

// ------------------------------------------------------------------ salud y reloj

function pintarSalud() {
  const e = app.estado;
  if (!e) return;
  $('ultimo-webhook').textContent = `Último aviso de GitHub ${hace(e.ultimoWebhook)}`;
  $('conciliacion').textContent = `Conciliado ${hace(e.ultimaConciliacion)}${e.correcciones ? ` · ${e.correcciones} ${e.correcciones === 1 ? 'corrección' : 'correcciones'}` : ''}`;
  $('limite-api').textContent = e.limiteApi ? `API: ${e.limiteApi.quedan}/${e.limiteApi.total ?? '?'}` : '';
  const err = $('error-github');
  err.hidden = !e.error;
  err.textContent = e.error ? `No se pudo leer GitHub: ${e.error}` : '';
}

setInterval(() => {
  for (const el of document.querySelectorAll('[data-desde]')) if (el.dataset.desde) el.textContent = duracion(Date.now() - Date.parse(el.dataset.desde));
  pintarSalud();
}, 1000);

// ------------------------------------------------------------------ conexión en vivo

let ws = null;
let espera = 1000;
let latido = null;

function conectar() {
  const pulso = $('conexion');
  pulso.className = 'pulso';
  pulso.textContent = 'Conectando…';
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.addEventListener('open', () => {
    espera = 1000;
    pulso.className = 'pulso vivo';
    pulso.textContent = 'En vivo';
    clearInterval(latido);
    latido = setInterval(() => ws?.readyState === 1 && ws.send('ping'), 25_000);
  });
  ws.addEventListener('message', (m) => {
    if (m.data === 'pong') return;
    const d = JSON.parse(m.data);
    if (d.tipo !== 'estado') return;
    app.estado = d.estado;
    avisar();
    repintar();
    alCambiarEstado();
  });
  ws.addEventListener('close', async () => {
    clearInterval(latido);
    pulso.className = 'pulso caido';
    pulso.textContent = 'Reconectando…';
    try {
      if (!(await api('/api/yo')).login) return mostrarEntrada();
    } catch { /* sin red: se reintenta */ }
    setTimeout(conectar, espera);
    espera = Math.min(espera * 2, 15_000);
  });
}

// ------------------------------------------------------------------ avisos del navegador

const avisados = new Set();
let primeraCarga = true;
function avisar() {
  const nuevos = eventosAvisables(app.estado).filter((e) => !avisados.has(`${e.t}|${e.texto}`));
  for (const e of nuevos) avisados.add(`${e.t}|${e.texto}`);
  if (primeraCarga) { primeraCarga = false; return; }
  if (leer('hive:avisos') !== 'si' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  for (const e of nuevos.slice(0, 3)) {
    try {
      new Notification(`Hive · ${corto(e.repo)}${e.numero ? ` #${e.numero}` : ''}`, { body: e.texto, tag: `${e.repo}#${e.numero}` });
    } catch { /* el navegador no deja */ }
  }
}

function pintarBotonAvisos() {
  const activos = leer('hive:avisos') === 'si' && typeof Notification !== 'undefined' && Notification.permission === 'granted';
  const b = $('avisos-navegador');
  b.setAttribute('aria-pressed', String(activos));
  b.title = activos ? 'Avisos del navegador activados' : 'Activar avisos del navegador (plan listo, PR para ti, fallos)';
}

async function alternarAvisos() {
  if (typeof Notification === 'undefined') return aviso('Este navegador no tiene avisos.', true);
  if (leer('hive:avisos') === 'si') {
    guardar('hive:avisos', 'no');
  } else {
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (p !== 'granted') return aviso('El navegador no ha dado permiso para avisos.', true);
    guardar('hive:avisos', 'si');
    aviso('Avisos activados: plan listo, PR para ti y fallos.');
  }
  pintarBotonAvisos();
}

// ------------------------------------------------------------------ tema

function aplicarTema(t) {
  if (t === 'claro' || t === 'oscuro') document.documentElement.dataset.theme = t === 'claro' ? 'light' : 'dark';
  else delete document.documentElement.dataset.theme;
}
function alternarTema() {
  const oscuroAhora = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  const nuevo = oscuroAhora ? 'claro' : 'oscuro';
  guardar('hive:tema', nuevo);
  aplicarTema(nuevo);
}

// ------------------------------------------------------------------ arranque

function mostrarEntrada() {
  $('app').hidden = true;
  $('entrar').hidden = false;
}

async function arrancar() {
  aplicarTema(leer('hive:tema'));
  app.filtro = leer('hive:filtro') ?? 'todos';
  sesion.alSalir = mostrarEntrada;
  $('cerrar-cajon').addEventListener('click', cerrarCajon);
  $('velo').addEventListener('click', cerrarCajon);
  $('tema').addEventListener('click', alternarTema);
  $('avisos-navegador').addEventListener('click', alternarAvisos);
  $('nueva-issue').addEventListener('click', () => abrirNuevaIssue(app.filtro !== 'todos' ? app.filtro : null));
  $('busqueda').addEventListener('input', (ev) => { app.busqueda = ev.target.value.trim(); VISTAS[app.vista].pintar($('vista')); });
  $('conciliar').addEventListener('click', async () => {
    try { await api('/api/conciliar', { metodo: 'POST' }); aviso('Conciliando con GitHub…'); } catch (e) { aviso(e.message, true); }
  });
  $('salir').addEventListener('click', async () => {
    try { await api('/salir', { metodo: 'POST' }); } catch { /* da igual */ }
    location.reload();
  });
  window.addEventListener('hashchange', () => { repintar(); $('vista').focus({ preventScroll: true }); });
  document.addEventListener('keydown', (e) => {
    const escribiendo = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (e.key === 'Escape' && app.cajon) cerrarCajon();
    if (escribiendo || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); $('busqueda').focus(); }
    if (e.key === 'n') { e.preventDefault(); abrirNuevaIssue(app.filtro !== 'todos' ? app.filtro : null); }
    const atajos = { 1: 'vivo', 2: 'bandeja', 3: 'issues', 4: 'prs', 5: 'actividad', 6: 'repos' };
    if (atajos[e.key]) location.hash = `#${atajos[e.key]}`;
  });
  pintarBotonAvisos();

  let yo;
  try { yo = await api('/api/yo'); } catch { yo = {}; }
  if (!yo.login) return mostrarEntrada();
  sesion.login = yo.login;
  sesion.csrf = yo.csrf;
  app.login = yo.login;
  $('login').textContent = yo.login;
  $('app').hidden = false;
  conectar();
}

arrancar();
