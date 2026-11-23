// Panel en vivo del enjambre (ADR 0015). Sin dependencias. Todo lo que viene de GitHub se pinta como texto.
'use strict';

const $ = (id) => document.getElementById(id);
const sesion = { login: null, csrf: null };
let estado = null;
let filtro = 'todos';
let ponerAbierto = null; // «repo#n» del formulario de etiqueta abierto
let formPoner = null; // { id, nodo }: se reutiliza al repintar para no perder la selección
const cacheEtiquetas = new Map();
let cajon = null; // { repo, numero, detalle, sha }
let vistos = new Set(); // eventos ya pintados (para resaltar los nuevos)

const NOMBRES = {
  'jefe-proyecto': 'jefe de proyecto', implementador: 'implementador', revisor: 'revisor', seguridad: 'seguridad',
  analista: 'analista', investigador: 'investigador', gobernanza: 'gobernanza', ci: 'CI', sistema: 'paso automático',
  despliegue: 'despliegue', otro: 'workflow',
};
const RESULTADO = { success: ['bien', 'bien'], failure: ['falló', 'mal'], cancelled: ['cancelado', 'neutro'], skipped: ['omitido', 'neutro'], timed_out: ['sin tiempo', 'mal'], action_required: ['espera aprobación', 'espera'] };

// ------------------------------------------------------------------ utilidades

function h(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'href') { if (/^https:\/\/github\.com\//.test(v) || v.startsWith('/')) el.setAttribute('href', v); }
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const hijo of hijos.flat()) if (hijo !== null && hijo !== undefined && hijo !== false) el.append(hijo instanceof Node ? hijo : String(hijo));
  return el;
}
/** replaceChildren sin los huecos (null/false), que si no se pintarían como el texto «null». */
const rellenar = (el, ...hijos) => el.replaceChildren(...hijos.flat().filter((x) => x !== null && x !== undefined && x !== false));
const enlace = (url, texto) => (url ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, texto) : texto);
const corto = (repo) => repo.split('/')[1] ?? repo;

function duracion(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
const hace = (iso) => (iso ? `hace ${duracion(Date.now() - Date.parse(iso))}` : '—');
const hora = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function aviso(texto, mal = false) {
  const t = h('div', { class: `toast${mal ? ' mal' : ''}`, role: 'status' }, texto);
  $('avisos').append(t);
  setTimeout(() => t.remove(), mal ? 9000 : 4500);
}

async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const r = await fetch(ruta, {
    method: metodo,
    credentials: 'same-origin',
    headers: metodo === 'GET' ? {} : { 'content-type': 'application/json', 'x-panel-csrf': sesion.csrf },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) mostrarEntrada();
  if (!r.ok) throw new Error(d.error ?? `Error ${r.status}`);
  return d;
}

function estadoEtiqueta(texto, clase) {
  return h('span', { class: `est ${clase}` }, texto);
}

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
    if (d.tipo === 'estado') {
      estado = d.estado;
      pintar();
    }
  });
  ws.addEventListener('close', async () => {
    clearInterval(latido);
    pulso.className = 'pulso caido';
    pulso.textContent = 'Reconectando…';
    try {
      if (!(await api('/api/yo')).login) return mostrarEntrada();
    } catch {
      // sin red: se reintenta
    }
    setTimeout(conectar, espera);
    espera = Math.min(espera * 2, 15_000);
  });
}

// ------------------------------------------------------------------ vistas

function reposVisibles() {
  if (!estado) return [];
  return Object.keys(estado.repos).sort().filter((r) => filtro === 'todos' || r === filtro);
}

function tituloDe(repo, vinculo) {
  if (!vinculo) return null;
  const r = estado.repos[repo];
  if (vinculo.pr && r.prs[vinculo.pr]) return { texto: `#${vinculo.pr} ${r.prs[vinculo.pr].titulo ?? ''}`, url: r.prs[vinculo.pr].url };
  if (vinculo.issue && r.issues[vinculo.issue]) return { texto: `#${vinculo.issue} ${r.issues[vinculo.issue].titulo}`, url: r.issues[vinculo.issue].url };
  const n = vinculo.pr ?? vinculo.issue;
  return n ? { texto: `#${n}`, url: null } : null;
}

function pintarFiltros() {
  const repos = Object.keys(estado.repos).sort();
  const nav = $('filtros');
  nav.replaceChildren(
    ...['todos', ...repos].map((r) =>
      h('button', { type: 'button', class: 'chip-filtro', 'aria-pressed': String(filtro === r), onclick: () => { filtro = r; pintar(); } }, r === 'todos' ? 'Todos los repos' : corto(r)),
    ),
  );
}

function pintarAgentes() {
  const tarjetas = [];
  const recientes = [];
  for (const repo of reposVisibles()) {
    for (const e of Object.values(estado.repos[repo].ejecuciones)) {
      if (e.estado === 'completed') {
        if (Date.now() - Date.parse(e.actualizado ?? 0) < 2 * 3600e3) recientes.push({ repo, e });
        continue;
      }
      tarjetas.push(tarjetaAgente(repo, e));
    }
  }
  $('n-agentes').textContent = tarjetas.length;
  $('agentes').replaceChildren(...(tarjetas.length ? tarjetas : [h('p', { class: 'vacio' }, 'Ningún agente trabajando ahora mismo.')]));
  recientes.sort((a, b) => (b.e.actualizado ?? '').localeCompare(a.e.actualizado ?? ''));
  $('recientes').replaceChildren(
    ...recientes.slice(0, 12).map(({ repo, e }) => {
      const [t, c] = RESULTADO[e.conclusion] ?? [e.conclusion ?? '—', 'neutro'];
      const objetivo = tituloDe(repo, e.vinculo);
      return h('li', { dataset: { agente: e.agente } },
        h('span', { class: 'insignia' }, NOMBRES[e.agente] ?? e.workflow),
        h('span', { class: 'que' }, `${corto(repo)} · `, objetivo ? enlace(objetivo.url, objetivo.texto) : e.workflow, ` · ${duracion(Date.parse(e.actualizado) - Date.parse(e.inicio))}`),
        h('span', {}, estadoEtiqueta(t, c), ' ', enlace(e.url, '↗')),
      );
    }),
  );
  if (!recientes.length) $('recientes').replaceChildren(h('li', { class: 'vacio' }, 'Nada en las últimas 2 horas.'));
}

function tarjetaAgente(repo, e) {
  const jobs = Object.values(e.jobs ?? {}).sort((a, b) => (a.inicio ?? '~').localeCompare(b.inicio ?? '~'));
  const activo = jobs.find((j) => j.estado === 'in_progress' && j.agente !== 'sistema') ?? jobs.find((j) => j.estado === 'in_progress');
  const agente = activo?.agente && activo.agente !== 'sistema' ? activo.agente : e.agente;
  const objetivo = tituloDe(repo, e.vinculo);
  const pasos = activo?.pasos ?? [];
  const actual = pasos.find((p) => p.estado === 'in_progress') ?? pasos.find((p) => p.estado === 'queued');
  const hechos = pasos.filter((p) => p.estado === 'completed').length;
  return h('article', { class: `agente${activo ? ' activo' : ''}`, dataset: { agente } },
    h('div', { class: 'fila' },
      h('span', { class: 'insignia' }, NOMBRES[agente] ?? agente),
      h('span', { class: 'reloj', dataset: { desde: e.inicio ?? '' } }, e.inicio ? duracion(Date.now() - Date.parse(e.inicio)) : ''),
    ),
    h('div', { class: 'objetivo' }, objetivo ? enlace(objetivo.url, objetivo.texto) : (e.titulo ?? e.workflow)),
    h('div', { class: 'donde' }, `${repo} · ${e.workflow}${e.intento > 1 ? ` (intento ${e.intento})` : ''} · `, enlace(e.url, 'ver ejecución')),
    activo
      ? h('div', { class: 'paso' },
        h('div', {}, `Job ${activo.nombre} · `, actual ? `paso ${actual.numero}/${pasos.length}: ${actual.nombre}` : `${hechos}/${pasos.length} pasos`),
        h('div', { class: 'barra-pasos', 'aria-hidden': 'true' },
          pasos.map((p) => h('i', { class: p.estado === 'completed' ? (p.conclusion === 'failure' ? 'mal' : 'hecho') : p.estado === 'in_progress' ? 'ahora' : '' }))))
      : h('div', { class: 'paso' }, e.estado === 'queued' || e.estado === 'requested' ? 'En cola en GitHub' : 'Arrancando (sin datos de jobs aún)'),
    jobs.length > 1
      ? h('div', { class: 'jobs' }, jobs.map((j) => h('span', { class: `job ${j.estado === 'completed' ? j.conclusion : j.estado}`, dataset: { agente: j.agente }, title: NOMBRES[j.agente] ?? j.agente }, j.nombre)))
      : null,
  );
}

function agentesSobre(repo, numero, tipo) {
  return Object.values(estado.repos[repo].ejecuciones).filter((e) => e.estado !== 'completed' && e.vinculo?.[tipo] === numero);
}

function insigniaCi(pr) {
  const enj = pr.ci?.['ci (Enjambre)']?.estado;
  const checks = Object.values(pr.checks ?? {});
  const estadoCi = enj ?? (checks.some((c) => c === 'failure') ? 'failure' : checks.length && checks.every((c) => c === 'success' || c === 'skipped') ? 'success' : checks.length ? 'pending' : null);
  if (!estadoCi) return estadoEtiqueta('CI sin datos', 'neutro');
  return estadoEtiqueta(`CI ${estadoCi === 'success' ? 'verde' : estadoCi === 'pending' ? 'en marcha' : 'roja'}`, estadoCi === 'success' ? 'bien' : estadoCi === 'pending' ? 'espera' : 'mal');
}

function insigniaVeredicto(nombre, v) {
  if (!v) return estadoEtiqueta(`${nombre}: —`, 'neutro');
  const clase = v.veredicto === 'APROBAR' ? 'bien' : v.veredicto === 'BLOQUEAR' ? 'mal' : 'espera';
  return estadoEtiqueta(`${nombre}: ${v.veredicto ?? '?'}`, clase);
}

function pintarPrs() {
  const filas = [];
  for (const repo of reposVisibles()) {
    for (const pr of Object.values(estado.repos[repo].prs)) {
      if (pr.estado !== 'open') continue;
      const corriendo = agentesSobre(repo, pr.numero, 'pr');
      filas.push(h('article', { class: 'pr' },
        h('div', {},
          h('div', { class: 'titulo' }, enlace(pr.url, `#${pr.numero}`), ` ${pr.titulo ?? ''}`),
          h('div', { class: 'meta' },
            h('span', {}, `${corto(repo)} · ${pr.rama ?? ''} → ${pr.base ?? ''}`),
            estadoEtiqueta(pr.borrador ? 'borrador' : 'listo', pr.borrador ? 'neutro' : 'bien'),
            insigniaCi(pr),
            insigniaVeredicto('revisor', pr.veredictos?.revisor),
            insigniaVeredicto('seguridad', pr.veredictos?.seguridad),
            pr.aprobado ? estadoEtiqueta('aprobado por ti', 'bien') : null,
            pr.revisores?.length ? h('span', {}, `revisión pedida a ${pr.revisores.join(', ')}`) : null,
            corriendo.map((e) => h('span', { class: 'en-marcha', dataset: { agente: e.agente } }, NOMBRES[e.agente] ?? e.workflow)),
          ),
        ),
        h('button', { type: 'button', class: 'boton secundario', onclick: () => abrirPr(repo, pr.numero) }, 'Revisar'),
      ));
    }
  }
  $('n-prs').textContent = filas.length;
  $('prs').replaceChildren(...(filas.length ? filas : [h('p', { class: 'vacio' }, 'No hay PR abiertos.')]));
}

// La columna sale de lo que está pasando (agentes en marcha, plan, PR), no solo de las etiquetas: una etiqueta puede
// quedarse puesta sin que ningún agente trabaje (p. ej. implementar puesto antes de que hubiera plan).
const COLUMNAS = [
  ['propuesta', 'Propuestas', (i) => i.etiquetas.includes('enjambre:propuesta')],
  ['preparar', 'Análisis', (i, x) => i.etiquetas.includes('enjambre:analizar') || x.agentes.includes('analista')],
  ['planificar', 'Plan', (i, x) => i.etiquetas.includes('enjambre:planificar') || Boolean(i.plan) || x.agentes.includes('jefe-proyecto')],
  ['implementar', 'Implementando', (i, x) => i.etiquetas.includes('enjambre:en-curso') || x.agentes.includes('implementador')],
  ['revision', 'PR abierto', (i, x) => x.tienePr],
];

function columnaDe(issue, contexto) {
  for (let i = COLUMNAS.length - 1; i >= 0; i--) if (COLUMNAS[i][2](issue, contexto)) return COLUMNAS[i][0];
  return 'otras';
}

function pintarTablero() {
  const grupos = Object.fromEntries([...COLUMNAS.map((c) => c[0]), 'otras'].map((c) => [c, []]));
  let total = 0;
  for (const repo of reposVisibles()) {
    const r = estado.repos[repo];
    const conPr = new Set(Object.values(r.prs).filter((p) => p.estado === 'open' && p.issue).map((p) => p.issue));
    for (const i of Object.values(r.issues)) {
      if (i.estado !== 'open') continue;
      total++;
      const agentes = agentesSobre(repo, i.numero, 'issue').map((e) => e.agente);
      grupos[columnaDe(i, { tienePr: conPr.has(i.numero), agentes })].push(tarjetaIssue(repo, i));
    }
  }
  $('n-issues').textContent = total;
  const nombres = Object.fromEntries([...COLUMNAS.map((c) => [c[0], c[1]]), ['otras', 'Otras abiertas']]);
  $('tablero').replaceChildren(
    ...Object.entries(grupos).map(([clave, tarjetas]) =>
      h('div', { class: 'columna' }, h('h3', {}, h('span', {}, nombres[clave]), h('span', {}, String(tarjetas.length))), tarjetas)),
  );
}

function tarjetaIssue(repo, i) {
  const id = `${repo}#${i.numero}`;
  const corriendo = agentesSobre(repo, i.numero, 'issue');
  return h('article', { class: 'issue' },
    h('div', { class: 'donde' }, `${corto(repo)} #${i.numero} `, enlace(i.url, '↗')),
    h('button', { type: 'button', class: 'titulo enlace-titulo', onclick: () => abrirIssue(repo, i.numero) }, i.titulo),
    corriendo.map((e) => h('div', { class: 'en-marcha', dataset: { agente: e.agente } }, `${NOMBRES[e.agente] ?? e.workflow} trabajando`)),
    !corriendo.length && i.plan && !i.etiquetas.includes('enjambre:en-curso')
      ? h('button', { type: 'button', class: 'pendiente', onclick: () => abrirIssue(repo, i.numero) }, 'Plan listo: revísalo y apruébalo')
      : null,
    !corriendo.length && i.nota && !i.nota.titulo.startsWith('Plan') ? h('div', { class: 'ultima-nota', title: 'Último comentario de un agente' }, i.nota.titulo) : null,
    h('div', { class: 'etiquetas' },
      i.etiquetas.map((et) => h('span', { class: `etiqueta${et.startsWith('enjambre:') ? ' enjambre' : ''}` }, et,
        h('button', { type: 'button', 'aria-label': `Quitar ${et}`, title: 'Quitar', onclick: () => cambiarEtiqueta(repo, i.numero, et, 'quitar') }, '×'))),
      h('button', { type: 'button', class: 'mas', onclick: () => { ponerAbierto = ponerAbierto === id ? null : id; formPoner = null; pintarTablero(); } }, '+ etiqueta'),
    ),
    ponerAbierto === id ? (formPoner?.id === id ? formPoner.nodo : (formPoner = { id, nodo: formularioEtiqueta(repo, i) }).nodo) : null,
  );
}

function formularioEtiqueta(repo, i) {
  const caja = h('div', { class: 'poner' }, h('span', { class: 'nota' }, 'Cargando etiquetas…'));
  (async () => {
    try {
      if (!cacheEtiquetas.has(repo)) cacheEtiquetas.set(repo, await api(`/api/etiquetas?repo=${encodeURIComponent(repo)}`));
      // en-curso la gestiona el workflow y revisar solo sirve en un PR: no se ofrecen en una issue.
      const todas = cacheEtiquetas.get(repo).filter((l) => !i.etiquetas.includes(l.nombre) && !l.sistema && !l.soloPr)
        .sort((a, b) => Number(b.nombre.startsWith('enjambre:')) - Number(a.nombre.startsWith('enjambre:')) || a.nombre.localeCompare(b.nombre));
      const sel = h('select', { 'aria-label': 'Etiqueta' }, todas.map((l) => h('option', { value: l.nombre }, l.nombre)));
      const pista = h('span', { class: 'pista' });
      const actualizarPista = () => {
        const l = todas.find((x) => x.nombre === sel.value);
        pista.textContent = l?.arranca ? 'Esta etiqueta arranca un agente en GitHub Actions.' : '';
      };
      sel.addEventListener('change', actualizarPista);
      actualizarPista();
      caja.replaceChildren(sel,
        h('button', { type: 'button', class: 'boton', onclick: () => cambiarEtiqueta(repo, i.numero, sel.value, 'poner') }, 'Poner'),
        h('button', { type: 'button', class: 'enlace', onclick: () => { ponerAbierto = null; formPoner = null; pintarTablero(); } }, 'Cancelar'),
        pista);
    } catch (e) {
      caja.replaceChildren(h('span', { class: 'nota' }, e.message));
    }
  })();
  return caja;
}

async function cambiarEtiqueta(repo, numero, etiqueta, accion) {
  try {
    await api('/api/etiqueta', { metodo: 'POST', cuerpo: { repo, numero, etiqueta, accion } });
    ponerAbierto = null;
    formPoner = null;
    pintarTablero();
    aviso(`${accion === 'poner' ? 'Puesta' : 'Quitada'} «${etiqueta}» en ${corto(repo)} #${numero}. El panel se actualizará cuando GitHub lo confirme.`);
  } catch (e) {
    aviso(`No se pudo ${accion} la etiqueta: ${e.message}`, true);
  }
}

function pintarCronologia() {
  const eventos = (estado.eventos ?? []).filter((e) => filtro === 'todos' || e.repo === filtro).slice(0, 200);
  const primera = vistos.size === 0;
  $('cronologia').replaceChildren(
    ...eventos.map((e) => {
      const clave = `${e.t}|${e.repo}|${e.texto}`;
      const nuevo = !primera && !vistos.has(clave);
      vistos.add(clave);
      return h('li', { class: nuevo ? 'nuevo' : '' },
        h('time', { datetime: e.t }, hora(e.t)),
        h('span', { class: 'repo' }, corto(e.repo)),
        h('span', {}, e.actor ? `${e.actor} ` : '', enlace(e.url, e.texto)));
    }),
  );
  if (!eventos.length) $('cronologia').replaceChildren(h('li', { class: 'vacio' }, 'Aún no ha llegado ningún evento.'));
}

function pintarSalud() {
  $('ultimo-webhook').textContent = `Último webhook: ${hace(estado.ultimoWebhook)}`;
  $('conciliacion').textContent = `Conciliado con GitHub: ${hace(estado.ultimaConciliacion)}${estado.correcciones ? ` · ${estado.correcciones} ${estado.correcciones === 1 ? 'corrección' : 'correcciones'}` : ''}`;
  const err = $('error-github');
  err.hidden = !estado.error;
  err.textContent = estado.error ? `No se pudo leer GitHub: ${estado.error}` : '';
}

function pintar() {
  if (!estado) return;
  pintarFiltros();
  pintarAgentes();
  pintarPrs();
  pintarTablero();
  pintarCronologia();
  pintarSalud();
  if (cajon?.tipo === 'pr') {
    const pr = estado.repos[cajon.repo]?.prs[cajon.numero];
    if (pr && cajon.detalle && (pr.sha !== cajon.detalle.sha || pr.estado !== cajon.detalle.estado)) cargarPr();
  }
  if (cajon?.tipo === 'issue' && cajon.detalle) {
    const i = estado.repos[cajon.repo]?.issues[cajon.numero];
    const huella = JSON.stringify([i?.etiquetas, i?.nota?.fecha, i?.estado]);
    if (i && huella !== cajon.huella) {
      cajon.huella = huella;
      cargarIssue();
    } else if (cajon.detalle) {
      pintarIssue(); // ejecuciones y PR enlazados cambian sin que cambie la issue
    }
  }
}

// ------------------------------------------------------------------ cajón de la issue: plan, comentarios y flujo

function abrirIssue(repo, numero) {
  cajon = { tipo: 'issue', repo, numero, detalle: null, confirmar: false };
  $('cajon').hidden = false;
  $('velo').hidden = false;
  $('cajon-titulo').textContent = `${corto(repo)} #${numero}`;
  $('cajon-cuerpo').replaceChildren(h('p', { class: 'nota' }, 'Cargando la issue desde GitHub…'));
  cargarIssue();
}

async function cargarIssue() {
  const actual = cajon;
  try {
    const d = await api(`/api/issue?repo=${encodeURIComponent(actual.repo)}&numero=${actual.numero}`);
    if (cajon !== actual) return;
    if (d.esPr) return abrirPr(actual.repo, actual.numero);
    actual.detalle = d;
    const i = estado?.repos[actual.repo]?.issues[actual.numero];
    actual.huella = JSON.stringify([i?.etiquetas, i?.nota?.fecha, i?.estado]);
    pintarIssue();
  } catch (e) {
    $('cajon-cuerpo').replaceChildren(h('p', { class: 'aviso' }, e.message));
  }
}

/** Markdown mínimo y seguro: títulos, listas, bloques de código y párrafos, siempre como texto. */
function markdown(texto) {
  const caja = h('div', { class: 'md' });
  let codigo = null;
  let parrafo = [];
  const cerrarParrafo = () => {
    if (parrafo.length) caja.append(h('p', { class: 'texto' }, parrafo.join('\n')));
    parrafo = [];
  };
  for (const linea of String(texto ?? '').split('\n')) {
    if (linea.startsWith('```')) {
      if (codigo) { caja.append(h('pre', { class: 'codigo' }, codigo.join('\n'))); codigo = null; } else { cerrarParrafo(); codigo = []; }
      continue;
    }
    if (codigo) { codigo.push(linea); continue; }
    const t = /^(#{1,4})\s+(.*)$/.exec(linea);
    if (t) { cerrarParrafo(); caja.append(h('h4', { class: `md-h${t[1].length}` }, t[2])); continue; }
    if (!linea.trim()) { cerrarParrafo(); continue; }
    parrafo.push(linea);
  }
  if (codigo) caja.append(h('pre', { class: 'codigo' }, codigo.join('\n')));
  cerrarParrafo();
  return caja;
}

async function lanzar(boton, accion, texto) {
  boton.disabled = true;
  try {
    await api('/api/accion', { metodo: 'POST', cuerpo: { repo: cajon.repo, numero: cajon.numero, accion } });
    aviso(texto);
    cajon.confirmar = false;
    if (cajon.tipo === 'issue' && cajon.detalle) pintarIssue();
  } catch (e) {
    boton.disabled = false;
    aviso(e.message, true);
  }
}

const PASOS_FLUJO = [
  ['plan', 'Plan', 'El jefe de proyecto escribe el plan'],
  ['aprobado', 'Tu aprobación', 'Apruebas el plan y arranca el implementador'],
  ['pr', 'PR', 'El implementador abre el PR; CI y revisión arrancan solas'],
  ['listo', 'Tu revisión', 'Revisas el PR entero, apruebas y fusionas aquí'],
];

function pintarIssue() {
  const d = cajon.detalle;
  const r = estado?.repos[cajon.repo] ?? { issues: {}, prs: {}, ejecuciones: {} };
  const i = r.issues[d.numero] ?? { etiquetas: d.etiquetas };
  const etiquetas = i.etiquetas ?? d.etiquetas;
  const corriendo = agentesSobre(cajon.repo, d.numero, 'issue');
  const prs = Object.values(r.prs).filter((p) => p.issue === d.numero).sort((a, b) => b.numero - a.numero);
  const prAbierto = prs.find((p) => p.estado === 'open');
  const implementando = etiquetas.includes('enjambre:en-curso') || corriendo.some((e) => e.agente === 'implementador');
  const planificando = corriendo.some((e) => e.agente === 'jefe-proyecto');
  const plan = d.plan;
  const etapa = prAbierto ? (prAbierto.borrador ? 'pr' : 'listo') : implementando ? 'aprobado' : plan ? 'plan' : null;
  const indice = PASOS_FLUJO.findIndex((p) => p[0] === etapa);
  $('cajon-titulo').textContent = `${corto(cajon.repo)} #${d.numero} · ${d.titulo}`;

  const confirmacion = cajon.confirmar
    ? h('div', { class: 'confirmar' },
      h('p', { class: 'texto' }, `Apruebas el plan de #${d.numero} (${plan?.titulo ?? ''}). El implementador trabajará en una rama, abrirá un PR en borrador y la CI y la revisión arrancarán solas. Lo fusionas tú cuando te llegue.`),
      h('div', { class: 'acciones' },
        h('button', { type: 'button', class: 'boton', onclick: (ev) => lanzar(ev.target, 'implementar', `Plan de #${d.numero} aprobado: arranca el implementador.`) }, 'Confirmar: implementar'),
        h('button', { type: 'button', class: 'boton secundario', onclick: () => { cajon.confirmar = false; pintarIssue(); } }, 'Cancelar')))
    : null;

  const botonImplementar = h('button', {
    type: 'button', class: 'boton', disabled: !plan || implementando || Boolean(prAbierto),
    title: !plan ? 'Primero hace falta un plan' : implementando ? 'Ya hay un implementador trabajando' : prAbierto ? 'Ya hay un PR abierto' : '',
    onclick: () => { cajon.confirmar = true; pintarIssue(); },
  }, 'Aprobar plan e implementar');

  rellenar($('cajon-cuerpo'),
    h('div', { class: 'bloque' },
      h('ol', { class: 'flujo' }, PASOS_FLUJO.map(([, nombre, ayuda], n) =>
        h('li', { class: n < indice ? 'hecho' : n === indice ? 'ahora' : '', title: ayuda }, nombre))),
      h('p', { class: 'nota' }, `${d.autor} · `, enlace(d.url, 'abrir en GitHub')),
      h('div', { class: 'etiquetas' }, etiquetas.map((et) => h('span', { class: `etiqueta${et.startsWith('enjambre:') ? ' enjambre' : ''}` }, et))),
      corriendo.map((e) => h('div', { class: 'en-marcha', dataset: { agente: e.agente } }, `${NOMBRES[e.agente] ?? e.workflow} trabajando · `, enlace(e.url, 'ver ejecución'))),
    ),
    h('div', { class: 'bloque' },
      h('h3', {}, 'Qué hacer ahora'),
      h('p', { class: 'nota' }, prAbierto
        ? `El PR #${prAbierto.numero} está ${prAbierto.borrador ? 'en borrador: la CI y la revisión siguen' : 'listo para tu revisión'}.`
        : implementando ? 'El implementador está trabajando. El PR aparecerá aquí.'
          : planificando ? 'El jefe de proyecto está escribiendo el plan.'
            : plan ? 'Hay un plan. Léelo abajo y apruébalo para que arranque el implementador.'
              : 'Aún no hay plan. Pide uno al jefe de proyecto.'),
      h('div', { class: 'acciones' },
        h('button', { type: 'button', class: plan ? 'boton secundario' : 'boton', disabled: planificando || implementando,
          onclick: (ev) => lanzar(ev.target, 'planificar', `Pedido el plan de #${d.numero} al jefe de proyecto.`) }, plan ? 'Rehacer el plan' : 'Planificar'),
        botonImplementar,
        h('button', { type: 'button', class: 'boton secundario', disabled: corriendo.some((e) => e.agente === 'analista'),
          onclick: (ev) => lanzar(ev.target, 'analizar', `Pedido el análisis de #${d.numero} al analista.`) }, 'Analizar'),
        prAbierto ? h('button', { type: 'button', class: 'boton secundario', onclick: () => abrirPr(cajon.repo, prAbierto.numero) }, `Revisar PR #${prAbierto.numero}`) : null,
      ),
      confirmacion,
    ),
    prs.length ? h('div', { class: 'bloque' }, h('h3', {}, 'PR de esta issue'),
      prs.map((p) => h('div', { class: 'acciones' },
        h('button', { type: 'button', class: 'enlace', onclick: () => abrirPr(cajon.repo, p.numero) }, `#${p.numero} ${p.titulo ?? ''}`),
        estadoEtiqueta(p.estado === 'merged' ? 'fusionado' : p.estado !== 'open' ? 'cerrado' : p.borrador ? 'borrador' : 'listo', p.estado === 'open' && !p.borrador ? 'bien' : 'neutro'),
        p.estado === 'open' ? insigniaCi(p) : null,
        p.estado === 'open' ? insigniaVeredicto('revisor', p.veredictos?.revisor) : null))) : null,
    h('div', { class: 'bloque' }, h('h3', {}, 'Descripción'), markdown(d.cuerpo || '(sin descripción)')),
    h('div', { class: 'bloque' }, h('h3', {}, `Comentarios (${d.comentarios.length})`),
      d.comentarios.map((c) => h('div', { class: `comentario${c.esPlan ? ' plan' : ''}` },
        h('div', { class: 'quien' }, c.esPlan ? '★ Plan que aprobarías · ' : '', `${c.autor} · ${new Date(c.fecha).toLocaleString('es-ES')} · `, enlace(c.url, 'ver en GitHub')),
        markdown(c.cuerpo)))),
  );
}

// ------------------------------------------------------------------ cajón del PR

function abrirPr(repo, numero) {
  cajon = { tipo: 'pr', repo, numero, detalle: null };
  $('cajon').hidden = false;
  $('velo').hidden = false;
  $('cajon-titulo').textContent = `${corto(repo)} #${numero}`;
  $('cajon-cuerpo').replaceChildren(h('p', { class: 'nota' }, 'Cargando el PR desde GitHub…'));
  cargarPr();
}

function cerrarPr() {
  cajon = null;
  $('cajon').hidden = true;
  $('velo').hidden = true;
}

async function cargarPr() {
  const actual = cajon;
  try {
    const d = await api(`/api/pr?repo=${encodeURIComponent(actual.repo)}&numero=${actual.numero}`);
    if (cajon !== actual) return;
    actual.detalle = d;
    pintarPr();
  } catch (e) {
    $('cajon-cuerpo').replaceChildren(h('p', { class: 'aviso' }, e.message));
  }
}

function lineasDiff(parche) {
  return h('pre', { class: 'diff' }, parche.split('\n').map((l) => h('span', { class: l.startsWith('@@') ? 'h' : l.startsWith('+') ? 'a' : l.startsWith('-') ? 'b' : '' }, l || ' ')));
}

function pintarPr() {
  const d = cajon.detalle;
  const pr = estado?.repos[cajon.repo]?.prs[d.numero] ?? {};
  $('cajon-titulo').textContent = `${corto(cajon.repo)} #${d.numero} · ${d.titulo}`;
  const verde = d.combinado === 'success' || (d.estados.length === 0 && d.checks.length > 0 && d.checks.every((c) => ['success', 'skipped', 'neutral'].includes(c.conclusion)));
  const yaAprobado = d.resenas.some((r) => r.estado === 'APPROVED' && r.sha === d.sha);

  const advertencias = [];
  if (d.borrador) advertencias.push('Es un borrador: GitHub no deja fusionarlo hasta que esté listo.');
  if (!verde) advertencias.push(`La CI no está en verde (estado combinado: ${d.combinado ?? 'sin datos'}).`);
  if (pr.veredictos?.revisor?.veredicto !== 'APROBAR') advertencias.push(`El revisor no ha dado APROBAR (${pr.veredictos?.revisor?.veredicto ?? 'sin veredicto'}).`);
  if (pr.veredictos?.seguridad && pr.veredictos.seguridad.veredicto !== 'APROBAR') advertencias.push(`Seguridad: ${pr.veredictos.seguridad.veredicto}.`);
  if (d.fusionable === false) advertencias.push(`GitHub dice que no se puede fusionar (${d.estadoFusion}).`);

  const comentario = h('textarea', { placeholder: 'Comentario de la aprobación (opcional)', 'aria-label': 'Comentario de la aprobación' });
  const metodo = h('select', { 'aria-label': 'Método de fusión' }, h('option', { value: 'squash' }, 'squash'), h('option', { value: 'merge' }, 'merge'), h('option', { value: 'rebase' }, 'rebase'));
  const confirmacion = h('div', { class: 'confirmar', hidden: true });
  const abierto = d.estado === 'open';

  const botonFusionar = h('button', {
    type: 'button', class: 'boton peligro', disabled: !abierto || d.borrador || d.fusionable === false,
    onclick: () => {
      confirmacion.hidden = false;
      confirmacion.replaceChildren(...[
        h('p', { class: 'texto' }, `Vas a fusionar #${d.numero} en ${d.base} con ${metodo.value}, sobre el commit ${d.sha.slice(0, 7)}. Si llega otro commit antes, GitHub lo rechazará.`),
        advertencias.length ? h('ul', { class: 'advertencias' }, advertencias.map((a) => h('li', {}, a))) : null,
        h('div', { class: 'acciones' },
          h('button', { type: 'button', class: 'boton peligro', onclick: (ev) => fusionar(ev.target, metodo.value) }, `Confirmar fusión de #${d.numero}`),
          h('button', { type: 'button', class: 'boton secundario', onclick: () => { confirmacion.hidden = true; } }, 'Cancelar')),
      ].filter(Boolean));
    },
  }, 'Fusionar…');

  rellenar($('cajon-cuerpo'),
    h('div', { class: 'bloque' },
      h('div', { class: 'acciones' },
        estadoEtiqueta(d.estado === 'merged' ? 'fusionado' : d.estado === 'closed' ? 'cerrado' : d.borrador ? 'borrador' : 'listo', d.estado === 'open' && !d.borrador ? 'bien' : 'neutro'),
        estadoEtiqueta(verde ? 'CI verde' : `CI ${d.combinado ?? 'sin datos'}`, verde ? 'bien' : d.combinado === 'pending' ? 'espera' : 'mal'),
        insigniaVeredicto('revisor', pr.veredictos?.revisor),
        insigniaVeredicto('seguridad', pr.veredictos?.seguridad),
        yaAprobado ? estadoEtiqueta('aprobado por ti', 'bien') : null),
      h('p', { class: 'nota' }, `${d.autor} · ${d.rama} → ${d.base} · +${d.adiciones} −${d.borrados} · commit ${d.sha.slice(0, 7)} · `, enlace(d.url, 'abrir en GitHub')),
    ),
    abierto ? h('div', { class: 'bloque' },
      h('h3', {}, 'Tu decisión'),
      comentario,
      h('div', { class: 'acciones' },
        h('button', { type: 'button', class: 'boton', disabled: yaAprobado, onclick: (ev) => aprobar(ev.target, comentario.value) }, yaAprobado ? 'Ya aprobado' : 'Aprobar'),
        h('span', { class: 'nota' }, 'Método:'), metodo, botonFusionar,
        h('button', { type: 'button', class: 'boton secundario', title: 'Revisor y seguridad vuelven a revisar el PR',
          onclick: (ev) => lanzar(ev.target, 'revisar', `Pedida otra revisión de #${d.numero}.`) }, 'Pedir otra revisión')),
      confirmacion,
    ) : null,
    h('div', { class: 'bloque' }, h('h3', {}, 'Descripción'), h('p', { class: 'texto' }, d.cuerpo || '(sin descripción)')),
    h('div', { class: 'bloque' }, h('h3', {}, `Checks (${d.checks.length + d.estados.length})`),
      [...d.estados.map((s) => h('div', {}, estadoEtiqueta(s.estado, s.estado === 'success' ? 'bien' : s.estado === 'pending' ? 'espera' : 'mal'), ' ', enlace(s.url, s.contexto))),
        ...d.checks.map((c) => h('div', {}, estadoEtiqueta(c.conclusion ?? c.estado, c.conclusion === 'success' ? 'bien' : !c.conclusion ? 'espera' : c.conclusion === 'skipped' ? 'neutro' : 'mal'), ' ', enlace(c.url, c.nombre)))]),
    h('div', { class: 'bloque' }, h('h3', {}, `Comentarios (${d.comentarios.length})`),
      d.comentarios.map((c) => h('div', { class: 'comentario' }, h('div', { class: 'quien' }, `${c.autor} · ${hora(c.fecha)} · `, enlace(c.url, 'ver')), h('p', { class: 'texto' }, c.cuerpo)))),
    h('div', { class: 'bloque' }, h('h3', {}, `Ficheros (${d.ficheros.length})`),
      d.ficheros.map((f) => h('details', { class: 'fichero' },
        h('summary', {}, h('span', {}, f.nombre), h('span', { class: 'mas-l' }, `+${f.adiciones}`), h('span', { class: 'menos-l' }, `−${f.borrados}`)),
        f.parche ? lineasDiff(f.parche) : h('p', { class: 'nota' }, 'Sin diff de texto (binario o demasiado grande).'),
        f.recortado ? h('p', { class: 'nota' }, 'Diff recortado: el resto está en GitHub.') : null))),
  );
}

async function aprobar(boton, texto) {
  const d = cajon.detalle;
  boton.disabled = true;
  try {
    await api('/api/aprobar', { metodo: 'POST', cuerpo: { repo: cajon.repo, numero: d.numero, sha: d.sha, comentario: texto } });
    aviso(`Aprobado #${d.numero} sobre ${d.sha.slice(0, 7)}.`);
    cargarPr();
  } catch (e) {
    boton.disabled = false;
    aviso(`No se pudo aprobar: ${e.message}`, true);
  }
}

async function fusionar(boton, metodo) {
  const d = cajon.detalle;
  boton.disabled = true;
  try {
    const r = await api('/api/fusionar', { metodo: 'POST', cuerpo: { repo: cajon.repo, numero: d.numero, sha: d.sha, metodo } });
    if (!r.ok) throw new Error(r.mensaje ?? 'GitHub no lo fusionó');
    aviso(`Fusionado #${d.numero} en ${d.base}.`);
    cargarPr();
  } catch (e) {
    boton.disabled = false;
    aviso(`No se pudo fusionar: ${e.message}`, true);
  }
}

// ------------------------------------------------------------------ arranque

function mostrarEntrada() {
  $('app').hidden = true;
  $('entrar').hidden = false;
  $('salud').hidden = true;
  $('salir').hidden = true;
}

async function arrancar() {
  $('cerrar-cajon').addEventListener('click', cerrarPr);
  $('velo').addEventListener('click', cerrarPr);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cajon) cerrarPr(); });
  $('conciliar').addEventListener('click', async () => {
    try {
      await api('/api/conciliar', { metodo: 'POST' });
      aviso('Conciliando con GitHub…');
    } catch (e) {
      aviso(e.message, true);
    }
  });
  $('salir').addEventListener('click', async () => {
    try { await api('/salir', { metodo: 'POST' }); } catch { /* da igual */ }
    location.reload();
  });
  let yo;
  try {
    yo = await api('/api/yo');
  } catch {
    yo = {};
  }
  if (!yo.login) {
    mostrarEntrada();
    return;
  }
  sesion.login = yo.login;
  sesion.csrf = yo.csrf;
  $('login').textContent = yo.login;
  $('salir').hidden = false;
  $('app').hidden = false;
  conectar();
  setInterval(() => {
    for (const el of document.querySelectorAll('[data-desde]')) if (el.dataset.desde) el.textContent = duracion(Date.now() - Date.parse(el.dataset.desde));
    if (estado) pintarSalud();
  }, 1000);
}

arrancar();
