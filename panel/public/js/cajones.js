// Cajones del panel (ADR 0015): issue (plan y flujo), PR (revisión entera, aprobar, fusionar), ejecución (pasos y
// registro) y nueva issue. Todo se hace aquí; GitHub queda a un enlace.
import { api, q, sesion } from './api.js';
import { app } from './app-estado.js';
import { NOMBRES, INICIALES, agentesActivos, estadoCi } from './datos.js';
import {
  $, h, rellenar, enlace, corto, duracion, fecha, aviso, est, resultado, insigniaCi, insigniaVeredicto, markdown, lineasDiff, avatar, icono,
} from './ui.js';

const cuerpo = () => $('cajon-cuerpo');

function mostrar(titulo) {
  $('cajon').hidden = false;
  $('velo').hidden = false;
  $('cajon-titulo').textContent = titulo;
  document.body.classList.add('con-cajon');
}

export function cerrarCajon() {
  app.cajon = null;
  $('cajon').hidden = true;
  $('velo').hidden = true;
  document.body.classList.remove('con-cajon');
}

// Al salir de un campo, el repintado que quedó pendiente espera un poco: así el clic en «Publicar» o «Aprobar» llega
// a su botón antes de que el cajón se vuelva a dibujar.
function repintarLuego() {
  setTimeout(() => { if (app.cajon?.pendiente) alCambiarEstado(); }, 400);
}

/** Al llegar estado nuevo, el cajón abierto se pone al día si cambió lo que enseña. */
export function alCambiarEstado() {
  const c = app.cajon;
  if (!c?.detalle) return;
  // Mientras escribes en el cajón no se repinta: si no, cada aviso en vivo borraría lo escrito.
  const foco = document.activeElement;
  if ($('cajon').contains(foco) && ['TEXTAREA', 'INPUT', 'SELECT'].includes(foco.tagName)) { c.pendiente = true; return; }
  c.pendiente = false;
  const r = app.estado?.repos[c.repo];
  if (c.tipo === 'pr') {
    const pr = r?.prs[c.numero];
    if (pr && (pr.sha !== c.detalle.sha || pr.estado !== c.detalle.estado || JSON.stringify(pr.veredictos) !== c.veredictos)) cargarPr();
    else pintarPr();
  } else if (c.tipo === 'issue') {
    const i = r?.issues[c.numero];
    const huella = JSON.stringify([i?.etiquetas, i?.nota?.fecha, i?.estado]);
    if (i && huella !== c.huella) cargarIssue();
    else pintarIssue();
  } else if (c.tipo === 'ejecucion') {
    pintarEjecucion();
  }
}

async function hacer(boton, ruta, datos, ok) {
  if (boton) boton.disabled = true;
  try {
    const r = await api(ruta, { metodo: 'POST', cuerpo: datos });
    aviso(typeof ok === 'function' ? ok(r) : ok);
    return r;
  } catch (e) {
    aviso(e.message, true);
    return null;
  } finally {
    if (boton) boton.disabled = false;
  }
}

function cajaComentario(repo, numero, alTerminar) {
  // El borrador vive en el cajón, no en el textarea: sobrevive a los repintados.
  const c = app.cajon;
  const area = h('textarea', { placeholder: 'Escribe un comentario (markdown)…', 'aria-label': 'Comentario', oninput: (ev) => { c.borrador = ev.target.value; }, onblur: repintarLuego });
  area.value = c?.borrador ?? '';
  return h('div', { class: 'bloque' },
    h('h3', {}, 'Comentar'),
    area,
    h('div', { class: 'acciones' },
      h('button', { type: 'button', class: 'boton secundario', onclick: async (ev) => {
        if (!area.value.trim()) return aviso('El comentario está vacío', true);
        if (await hacer(ev.target, '/api/comentar', { repo, numero, cuerpo: area.value }, `Comentario publicado en #${numero}.`)) { area.value = ''; c.borrador = ''; alTerminar?.(); }
      } }, 'Publicar comentario')));
}

function listaEjecuciones(repo, filtroVinculo) {
  const r = app.estado?.repos[repo];
  if (!r) return null;
  const lista = Object.values(r.ejecuciones).filter(filtroVinculo).sort((a, b) => (b.inicio ?? '').localeCompare(a.inicio ?? '')).slice(0, 8);
  if (!lista.length) return null;
  return h('div', { class: 'bloque' }, h('h3', {}, 'Ejecuciones de agentes'),
    lista.map((e) => {
      const [t, c] = e.estado === 'completed' ? resultado(e.conclusion) : [e.estado === 'in_progress' ? 'en marcha' : 'en cola', 'espera'];
      return h('div', { class: 'fila-ejecucion', dataset: { agente: e.agente } },
        avatar(e.agente, INICIALES[e.agente] ?? '··', e.estado !== 'completed'),
        h('button', { type: 'button', class: 'enlace', onclick: () => abrirEjecucion(repo, e.id) }, `${NOMBRES[e.agente] ?? e.workflow} · ${e.workflow}`),
        h('span', { class: 'nota' }, fecha(e.inicio)),
        est(t, c));
    }));
}

// ------------------------------------------------------------------ issue

const PASOS_FLUJO = [
  ['plan', 'Plan', 'El jefe de proyecto escribe el plan'],
  ['aprobado', 'Tu aprobación', 'Apruebas el plan y arranca el implementador'],
  ['pr', 'PR', 'El implementador abre el PR listo; CI y revisión arrancan solas'],
  ['listo', 'Tu revisión', 'Revisas el PR entero, apruebas y fusionas aquí'],
];

export function abrirIssue(repo, numero) {
  app.cajon = { tipo: 'issue', repo, numero, detalle: null, confirmar: false };
  mostrar(`${corto(repo)} #${numero}`);
  rellenar(cuerpo(), h('p', { class: 'nota' }, 'Cargando la issue desde GitHub…'));
  cargarIssue();
}

async function cargarIssue() {
  const c = app.cajon;
  try {
    const d = await api(`/api/issue?${q({ repo: c.repo, numero: c.numero })}`);
    if (app.cajon !== c) return;
    if (d.esPr) return abrirPr(c.repo, c.numero);
    c.detalle = d;
    const i = app.estado?.repos[c.repo]?.issues[c.numero];
    c.huella = JSON.stringify([i?.etiquetas, i?.nota?.fecha, i?.estado]);
    pintarIssue();
  } catch (e) {
    rellenar(cuerpo(), h('p', { class: 'aviso' }, e.message));
  }
}

async function lanzar(boton, accion, texto) {
  const c = app.cajon;
  if (await hacer(boton, '/api/accion', { repo: c.repo, numero: c.numero, accion }, texto)) {
    c.confirmar = false;
    if (app.cajon === c) (c.tipo === 'issue' ? pintarIssue : pintarPr)();
  }
}

function pintarIssue() {
  const c = app.cajon;
  const d = c.detalle;
  const r = app.estado?.repos[c.repo] ?? { issues: {}, prs: {}, ejecuciones: {} };
  const i = r.issues[d.numero] ?? { etiquetas: d.etiquetas };
  const etiquetas = i.etiquetas ?? d.etiquetas;
  const corriendo = agentesActivos(app.estado ?? { repos: {} }).filter((a) => a.repo === c.repo && a.ejecucion.vinculo?.issue === d.numero);
  const prs = Object.values(r.prs).filter((p) => p.issue === d.numero).sort((a, b) => b.numero - a.numero);
  const prAbierto = prs.find((p) => p.estado === 'open');
  const implementando = etiquetas.includes('enjambre:en-curso') || corriendo.some((a) => a.agente === 'implementador');
  const planificando = corriendo.some((a) => a.agente === 'jefe-proyecto');
  const plan = d.plan;
  const etapa = prAbierto ? (prAbierto.aprobado ? 'listo' : 'pr') : implementando ? 'aprobado' : plan ? 'plan' : null;
  const indice = PASOS_FLUJO.findIndex((p) => p[0] === etapa);
  const abierta = d.estado === 'open';
  $('cajon-titulo').textContent = `${corto(c.repo)} #${d.numero} · ${d.titulo}`;

  const confirmacion = c.confirmar && h('div', { class: 'confirmar' },
    h('p', {}, `Apruebas el plan de #${d.numero}. El implementador trabajará en una rama y abrirá un PR listo para revisión; la CI y la revisión de los agentes arrancan solas. Lo fusionas tú cuando te llegue.`),
    h('div', { class: 'acciones' },
      h('button', { type: 'button', class: 'boton', onclick: (ev) => lanzar(ev.target, 'implementar', `Plan de #${d.numero} aprobado: arranca el implementador.`) }, 'Confirmar: implementar'),
      h('button', { type: 'button', class: 'boton secundario', onclick: () => { c.confirmar = false; pintarIssue(); } }, 'Cancelar')));

  const queHacer = prAbierto
    ? `El PR #${prAbierto.numero} está abierto: ${prAbierto.veredictos?.revisor ? `revisor ${prAbierto.veredictos.revisor.veredicto}` : 'revisión en marcha'}.`
    : implementando ? 'El implementador está trabajando. El PR aparecerá aquí.'
      : planificando ? 'El jefe de proyecto está escribiendo el plan.'
        : plan ? 'Hay un plan. Léelo abajo (★) y apruébalo para que arranque el implementador.'
          : 'Aún no hay plan. Pide uno al jefe de proyecto.';

  rellenar(cuerpo(),
    h('div', { class: 'bloque' },
      h('ol', { class: 'flujo' }, PASOS_FLUJO.map(([, nombre, ayuda], n) => h('li', { class: n < indice ? 'hecho' : n === indice ? 'ahora' : '', title: ayuda }, nombre))),
      h('p', { class: 'nota' }, `${abierta ? 'Abierta' : 'Cerrada'} · ${d.autor} · `, enlace(d.url, 'ver en GitHub')),
      editorEtiquetas(c.repo, d.numero, etiquetas),
      corriendo.map((a) => h('div', { class: 'en-marcha', dataset: { agente: a.agente } }, `${NOMBRES[a.agente]} trabajando · `,
        h('button', { type: 'button', class: 'enlace', onclick: () => abrirEjecucion(c.repo, a.ejecucion.id) }, 'ver en vivo')))),
    abierta && h('div', { class: 'bloque' },
      h('h3', {}, 'Qué hacer ahora'),
      h('p', { class: 'nota' }, queHacer),
      h('div', { class: 'acciones' },
        h('button', { type: 'button', class: plan ? 'boton secundario' : 'boton', disabled: planificando || implementando,
          onclick: (ev) => lanzar(ev.target, 'planificar', `Pedido el plan de #${d.numero} al jefe de proyecto.`) }, plan ? 'Rehacer el plan' : 'Planificar'),
        h('button', { type: 'button', class: 'boton', disabled: !plan || implementando || Boolean(prAbierto),
          title: !plan ? 'Primero hace falta un plan' : implementando ? 'Ya hay un implementador trabajando' : prAbierto ? 'Ya hay un PR abierto' : '',
          onclick: () => { c.confirmar = true; pintarIssue(); } }, 'Aprobar plan e implementar'),
        h('button', { type: 'button', class: 'boton secundario', disabled: corriendo.some((a) => a.agente === 'analista'),
          onclick: (ev) => lanzar(ev.target, 'analizar', `Pedido el análisis de #${d.numero} al analista.`) }, 'Analizar'),
        prAbierto && h('button', { type: 'button', class: 'boton secundario', onclick: () => abrirPr(c.repo, prAbierto.numero) }, `Revisar PR #${prAbierto.numero}`)),
      confirmacion),
    prs.length > 0 && h('div', { class: 'bloque' }, h('h3', {}, 'PR de esta issue'),
      prs.map((p) => h('div', { class: 'acciones' },
        h('button', { type: 'button', class: 'enlace', onclick: () => abrirPr(c.repo, p.numero) }, `#${p.numero} ${p.titulo ?? ''}`),
        est(p.estado === 'merged' ? 'fusionado' : p.estado !== 'open' ? 'cerrado' : p.borrador ? 'borrador' : 'abierto', p.estado === 'merged' ? 'bien' : 'neutro'),
        p.estado === 'open' && insigniaCi(estadoCi(p)),
        p.estado === 'open' && insigniaVeredicto('revisor', p.veredictos?.revisor)))),
    listaEjecuciones(c.repo, (e) => e.vinculo?.issue === d.numero),
    h('div', { class: 'bloque' }, h('h3', {}, 'Descripción'), markdown(d.cuerpo || '(sin descripción)')),
    h('div', { class: 'bloque' }, h('h3', {}, `Comentarios (${d.comentarios.length})`),
      d.comentarios.map((cm) => h('div', { class: `comentario${cm.esPlan ? ' plan' : ''}` },
        h('div', { class: 'quien' }, cm.esPlan ? '★ Plan que aprobarías · ' : '', `${cm.autor} · ${fecha(cm.fecha)} · `, enlace(cm.url, 'ver en GitHub')),
        markdown(cm.cuerpo)))),
    cajaComentario(c.repo, d.numero, cargarIssue),
    h('div', { class: 'bloque' }, h('h3', {}, 'Estado de la issue'),
      h('div', { class: 'acciones' },
        abierta
          ? [h('button', { type: 'button', class: 'boton secundario', onclick: (ev) => hacer(ev.target, '/api/issue/estado', { repo: c.repo, numero: d.numero, estado: 'cerrar', motivo: 'completada' }, `#${d.numero} cerrada como completada.`) }, 'Cerrar como completada'),
            h('button', { type: 'button', class: 'boton secundario', onclick: (ev) => hacer(ev.target, '/api/issue/estado', { repo: c.repo, numero: d.numero, estado: 'cerrar', motivo: 'descartada' }, `#${d.numero} cerrada como descartada.`) }, 'Cerrar como descartada')]
          : h('button', { type: 'button', class: 'boton secundario', onclick: (ev) => hacer(ev.target, '/api/issue/estado', { repo: c.repo, numero: d.numero, estado: 'reabrir' }, `#${d.numero} reabierta.`) }, 'Reabrir'))),
  );
}

// ------------------------------------------------------------------ etiquetas

const cacheEtiquetas = new Map();
export async function etiquetasDe(repo) {
  if (!cacheEtiquetas.has(repo)) cacheEtiquetas.set(repo, await api(`/api/etiquetas?${q({ repo })}`));
  return cacheEtiquetas.get(repo);
}

export async function cambiarEtiqueta(repo, numero, etiqueta, accion) {
  return hacer(null, '/api/etiqueta', { repo, numero, etiqueta, accion },
    `${accion === 'poner' ? 'Puesta' : 'Quitada'} «${etiqueta}» en ${corto(repo)} #${numero}.`);
}

/**
 * Etiquetas de una issue o PR con × para quitar y un selector para poner. Lo abierto y lo elegido se guarda fuera
 * del DOM (app.editorEtiqueta): los avisos en vivo repintan el tablero y no pueden cerrar el formulario a medias.
 */
export function editorEtiquetas(repo, numero, etiquetas, { enPr = false } = {}) {
  const id = `${repo}#${numero}${enPr ? ':pr' : ''}`;
  const caja = h('div', { class: 'etiquetas' });
  const pintar = (abierto) => {
    if (abierto) app.editorEtiqueta = { id, valor: app.editorEtiqueta?.id === id ? app.editorEtiqueta.valor : null };
    else if (app.editorEtiqueta?.id === id) app.editorEtiqueta = null;
    rellenar(caja,
      etiquetas.map((et) => h('span', { class: `etiqueta${et.startsWith('enjambre:') ? ' enjambre' : ''}` }, et,
        h('button', { type: 'button', 'aria-label': `Quitar ${et}`, title: 'Quitar', onclick: () => cambiarEtiqueta(repo, numero, et, 'quitar') }, '×'))),
      abierto ? formulario() : h('button', { type: 'button', class: 'mas', onclick: () => pintar(true) }, '+ etiqueta'));
  };
  const formulario = () => {
    const f = h('span', { class: 'poner' }, h('span', { class: 'nota' }, 'Cargando…'));
    etiquetasDe(repo).then((todas) => {
      const opciones = todas.filter((l) => !etiquetas.includes(l.nombre) && !l.sistema && (enPr || !l.soloPr))
        .sort((a, b) => Number(b.nombre.startsWith('enjambre:')) - Number(a.nombre.startsWith('enjambre:')) || a.nombre.localeCompare(b.nombre));
      const sel = h('select', { 'aria-label': 'Etiqueta' }, opciones.map((l) => h('option', { value: l.nombre }, l.nombre)));
      if (app.editorEtiqueta?.id === id && opciones.some((o) => o.nombre === app.editorEtiqueta.valor)) sel.value = app.editorEtiqueta.valor;
      const pista = h('span', { class: 'pista' });
      const actualizar = () => {
        if (app.editorEtiqueta?.id === id) app.editorEtiqueta.valor = sel.value;
        pista.textContent = opciones.find((x) => x.nombre === sel.value)?.arranca ? 'Esta etiqueta arranca un agente.' : '';
      };
      sel.addEventListener('change', actualizar);
      actualizar();
      rellenar(f, sel,
        h('button', { type: 'button', class: 'boton', onclick: async () => { if (await cambiarEtiqueta(repo, numero, sel.value, 'poner')) pintar(false); } }, 'Poner'),
        h('button', { type: 'button', class: 'enlace', onclick: () => pintar(false) }, 'Cancelar'), pista);
    }).catch((e) => rellenar(f, h('span', { class: 'nota' }, e.message)));
    return f;
  };
  pintar(app.editorEtiqueta?.id === id);
  return caja;
}

// ------------------------------------------------------------------ PR

export function abrirPr(repo, numero) {
  app.cajon = { tipo: 'pr', repo, numero, detalle: null, confirmar: false, pestana: 'resumen' };
  mostrar(`${corto(repo)} #${numero}`);
  rellenar(cuerpo(), h('p', { class: 'nota' }, 'Cargando el PR desde GitHub…'));
  cargarPr();
}

async function cargarPr() {
  const c = app.cajon;
  try {
    const d = await api(`/api/pr?${q({ repo: c.repo, numero: c.numero })}`);
    if (app.cajon !== c) return;
    c.detalle = d;
    c.veredictos = JSON.stringify(app.estado?.repos[c.repo]?.prs[c.numero]?.veredictos);
    pintarPr();
  } catch (e) {
    rellenar(cuerpo(), h('p', { class: 'aviso' }, e.message));
  }
}

function pintarPr() {
  const c = app.cajon;
  const d = c.detalle;
  const pr = app.estado?.repos[c.repo]?.prs[d.numero] ?? {};
  $('cajon-titulo').textContent = `${corto(c.repo)} #${d.numero} · ${d.titulo}`;
  const verde = d.combinado === 'success' || (d.estados.length === 0 && d.checks.length > 0 && d.checks.every((x) => ['success', 'skipped', 'neutral'].includes(x.conclusion)));
  const yaAprobado = d.resenas.some((r) => r.estado === 'APPROVED' && r.sha === d.sha && r.autor === sesion.login);
  const abierto = d.estado === 'open';
  const advertencias = [];
  if (d.borrador) advertencias.push('Es un borrador: GitHub no deja fusionarlo hasta que esté listo.');
  if (!verde) advertencias.push(`La CI no está en verde (estado combinado: ${d.combinado ?? 'sin datos'}).`);
  if (pr.veredictos?.revisor?.veredicto !== 'APROBAR') advertencias.push(`El revisor no ha dado APROBAR (${pr.veredictos?.revisor?.veredicto ?? 'sin veredicto'}).`);
  if (pr.veredictos?.seguridad && pr.veredictos.seguridad.veredicto !== 'APROBAR') advertencias.push(`Seguridad: ${pr.veredictos.seguridad.veredicto}.`);
  if (d.fusionable === false) advertencias.push(`GitHub dice que no se puede fusionar (${d.estadoFusion}).`);
  if (!yaAprobado) advertencias.push('Aún no lo has aprobado tú.');

  const comentario = h('textarea', { placeholder: 'Comentario de tu revisión (obligatorio para pedir cambios)', 'aria-label': 'Comentario de la revisión', oninput: (ev) => { c.borradorResena = ev.target.value; }, onblur: repintarLuego });
  comentario.value = c.borradorResena ?? '';
  const metodo = h('select', { 'aria-label': 'Método de fusión' }, ['squash', 'merge', 'rebase'].map((m) => h('option', { value: m }, m)));
  const confirmacion = c.confirmar && h('div', { class: 'confirmar' },
    h('p', {}, `Vas a fusionar #${d.numero} en ${d.base} sobre el commit ${d.sha.slice(0, 7)}. Si llega otro commit antes, GitHub lo rechazará.`),
    advertencias.length > 0 && h('ul', { class: 'advertencias' }, advertencias.map((a) => h('li', {}, a))),
    h('label', { class: 'casilla' }, h('input', { type: 'checkbox', id: 'borrar-rama', checked: true }), ' Borrar la rama al fusionar'),
    h('div', { class: 'acciones' },
      h('button', { type: 'button', class: 'boton peligro', onclick: (ev) => fusionar(ev.target, c.metodo ?? 'squash') }, `Confirmar fusión de #${d.numero}`),
      h('button', { type: 'button', class: 'boton secundario', onclick: () => { c.confirmar = false; pintarPr(); } }, 'Cancelar')));
  metodo.value = c.metodo ?? 'squash';
  metodo.addEventListener('change', () => { c.metodo = metodo.value; });

  const resenar = async (boton, evento) => {
    const ok = { aprobar: `Aprobado #${d.numero} sobre ${d.sha.slice(0, 7)}.`, cambios: `Pedidos cambios en #${d.numero}.`, comentar: `Revisión comentada en #${d.numero}.` }[evento];
    if (await hacer(boton, '/api/pr/resena', { repo: c.repo, numero: d.numero, sha: d.sha, evento, comentario: comentario.value }, ok)) { c.borradorResena = ''; cargarPr(); }
  };

  const pestanas = [['resumen', 'Resumen'], ['ficheros', `Ficheros (${d.ficheros.length})`], ['conversacion', `Conversación (${d.comentarios.length + d.resenas.length})`], ['checks', `Checks (${d.checks.length + d.estados.length})`]];
  rellenar(cuerpo(),
    h('div', { class: 'bloque' },
      h('div', { class: 'acciones' },
        est(d.estado === 'merged' ? 'fusionado' : d.estado === 'closed' ? 'cerrado' : d.borrador ? 'borrador' : 'abierto', d.estado === 'merged' ? 'bien' : abierto && !d.borrador ? 'bien' : 'neutro'),
        est(verde ? 'CI verde' : `CI ${d.combinado ?? 'sin datos'}`, verde ? 'bien' : d.combinado === 'pending' ? 'espera' : 'mal'),
        insigniaVeredicto('revisor', pr.veredictos?.revisor), insigniaVeredicto('seguridad', pr.veredictos?.seguridad),
        yaAprobado && est('aprobado por ti', 'bien')),
      h('p', { class: 'nota' }, `${d.autor} · ${d.rama} → ${d.base} · +${d.adiciones} −${d.borrados} · commit ${d.sha.slice(0, 7)} · `, enlace(d.url, 'ver en GitHub')),
      editorEtiquetas(c.repo, d.numero, pr.etiquetas ?? [], { enPr: true })),
    abierto && h('div', { class: 'bloque decision' },
      h('h3', {}, 'Tu decisión'),
      comentario,
      h('div', { class: 'acciones' },
        h('button', { type: 'button', class: 'boton', disabled: yaAprobado, onclick: (ev) => resenar(ev.target, 'aprobar') }, yaAprobado ? 'Ya aprobado' : 'Aprobar'),
        h('button', { type: 'button', class: 'boton secundario', onclick: (ev) => resenar(ev.target, 'cambios') }, 'Pedir cambios'),
        h('button', { type: 'button', class: 'boton secundario', onclick: (ev) => resenar(ev.target, 'comentar') }, 'Solo comentar')),
      h('div', { class: 'acciones' },
        h('span', { class: 'nota' }, 'Fusión:'), metodo,
        h('button', { type: 'button', class: 'boton peligro', disabled: d.borrador || d.fusionable === false, onclick: () => { c.confirmar = true; pintarPr(); } }, 'Fusionar…'),
        d.borrador && h('button', { type: 'button', class: 'boton secundario', onclick: async (ev) => { if (await hacer(ev.target, '/api/pr/listo', { repo: c.repo, numero: d.numero }, `#${d.numero} listo para revisión.`)) cargarPr(); } }, 'Marcar listo'),
        d.estadoFusion === 'behind' && h('button', { type: 'button', class: 'boton secundario', title: 'Trae a la rama lo nuevo de la base',
          onclick: (ev) => hacer(ev.target, '/api/pr/actualizar', { repo: c.repo, numero: d.numero, sha: d.sha }, `Rama de #${d.numero} actualizada con ${d.base}.`) }, 'Actualizar rama'),
        h('button', { type: 'button', class: 'boton secundario', title: 'Revisor y seguridad vuelven a revisar el PR', onclick: (ev) => lanzar(ev.target, 'revisar', `Pedida otra revisión de #${d.numero}.`) }, 'Pedir otra revisión')),
      confirmacion),
    !abierto && d.rama && h('div', { class: 'bloque' }, h('h3', {}, 'Rama'),
      h('div', { class: 'acciones' }, h('code', {}, d.rama),
        h('button', { type: 'button', class: 'boton secundario', onclick: (ev) => hacer(ev.target, '/api/pr/borrar-rama', { repo: c.repo, numero: d.numero }, (r) => `Rama ${r.rama} borrada.`) }, 'Borrar la rama'))),
    h('nav', { class: 'pestanas', role: 'tablist' }, pestanas.map(([k, t]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(c.pestana === k), onclick: () => { c.pestana = k; pintarPr(); } }, t))),
    c.pestana === 'resumen' && h('div', { class: 'bloque' }, h('h3', {}, 'Descripción'), markdown(d.cuerpo || '(sin descripción)')),
    c.pestana === 'resumen' && listaEjecuciones(c.repo, (e) => e.vinculo?.pr === d.numero),
    c.pestana === 'ficheros' && h('div', { class: 'bloque' },
      h('div', { class: 'acciones' },
        h('button', { type: 'button', class: 'enlace', onclick: () => cuerpo().querySelectorAll('details.fichero').forEach((x) => { x.open = true; }) }, 'Abrir todos'),
        h('button', { type: 'button', class: 'enlace', onclick: () => cuerpo().querySelectorAll('details.fichero').forEach((x) => { x.open = false; }) }, 'Cerrar todos')),
      d.ficheros.map((f) => h('details', { class: 'fichero', open: d.ficheros.length <= 3 },
        h('summary', {}, h('span', {}, f.nombre), h('span', { class: 'mas-l' }, `+${f.adiciones}`), h('span', { class: 'menos-l' }, `−${f.borrados}`)),
        f.parche ? lineasDiff(f.parche) : h('p', { class: 'nota' }, 'Sin diff de texto (binario o demasiado grande).'),
        f.recortado && h('p', { class: 'nota' }, 'Diff recortado: el resto está en GitHub.')))),
    c.pestana === 'conversacion' && h('div', { class: 'bloque' },
      [...d.comentarios.map((x) => ({ ...x, tipo: 'comentario' })), ...d.resenas.map((x) => ({ ...x, tipo: 'resena' }))]
        .sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
        .map((x) => h('div', { class: 'comentario' },
          h('div', { class: 'quien' }, `${x.autor} · ${x.fecha ? fecha(x.fecha) : ''}${x.tipo === 'resena' ? ` · reseña ${x.estado}` : ''} · `, enlace(x.url, 'ver')),
          x.cuerpo ? markdown(x.cuerpo) : null))),
    c.pestana === 'conversacion' && cajaComentario(c.repo, d.numero, cargarPr),
    c.pestana === 'checks' && h('div', { class: 'bloque' },
      d.estados.map((s) => h('div', { class: 'acciones' }, est(s.estado, s.estado === 'success' ? 'bien' : s.estado === 'pending' ? 'espera' : 'mal'), enlace(s.url, s.contexto))),
      d.checks.map((x) => h('div', { class: 'acciones' }, est(x.conclusion ?? x.estado, x.conclusion === 'success' ? 'bien' : !x.conclusion ? 'espera' : x.conclusion === 'skipped' ? 'neutro' : 'mal'), enlace(x.url, x.nombre)))),
  );
}

async function fusionar(boton, metodo) {
  const c = app.cajon;
  const d = c.detalle;
  const borrar = document.getElementById('borrar-rama')?.checked;
  const r = await hacer(boton, '/api/fusionar', { repo: c.repo, numero: d.numero, sha: d.sha, metodo }, (x) => (x.ok ? `Fusionado #${d.numero} en ${d.base}.` : `GitHub no lo fusionó: ${x.mensaje ?? ''}`));
  if (r?.ok) {
    c.confirmar = false;
    if (borrar) await hacer(null, '/api/pr/borrar-rama', { repo: c.repo, numero: d.numero }, (x) => `Rama ${x.rama} borrada.`);
    cargarPr();
  }
}

// ------------------------------------------------------------------ ejecución: pasos en vivo y registro

export function abrirEjecucion(repo, id) {
  app.cajon = { tipo: 'ejecucion', repo, id, detalle: true, job: null, lineas: null };
  mostrar('Ejecución');
  pintarEjecucion();
}

function pintarEjecucion() {
  const c = app.cajon;
  const e = app.estado?.repos[c.repo]?.ejecuciones[c.id];
  if (!e) return rellenar(cuerpo(), h('p', { class: 'nota' }, 'Esta ejecución ya no está en el panel (se guardan las de las últimas 24 h).'));
  const [t, cl] = e.estado === 'completed' ? resultado(e.conclusion) : [e.estado === 'in_progress' ? 'en marcha' : 'en cola', 'espera'];
  const jobs = Object.values(e.jobs ?? {}).sort((a, b) => (a.inicio ?? '~').localeCompare(b.inicio ?? '~'));
  const objetivo = e.vinculo?.pr ?? e.vinculo?.issue;
  $('cajon-titulo').textContent = `${NOMBRES[e.agente] ?? e.workflow} · ${corto(c.repo)}${objetivo ? ` #${objetivo}` : ''}`;
  rellenar(cuerpo(),
    h('div', { class: 'bloque' },
      h('div', { class: 'acciones' }, avatar(e.agente, INICIALES[e.agente] ?? '··', e.estado !== 'completed'), est(t, cl),
        h('span', { class: 'nota' }, `${e.workflow} · ${e.evento ?? ''} · ${fecha(e.inicio)} · ${duracion((e.estado === 'completed' ? Date.parse(e.actualizado) : Date.now()) - Date.parse(e.inicio))}`)),
      h('p', { class: 'nota' }, e.titulo ?? '', ' · ', enlace(e.url, 'ver en GitHub')),
      h('div', { class: 'acciones' },
        e.vinculo?.issue && h('button', { type: 'button', class: 'boton secundario', onclick: () => abrirIssue(c.repo, e.vinculo.issue) }, `Abrir issue #${e.vinculo.issue}`),
        e.vinculo?.pr && h('button', { type: 'button', class: 'boton secundario', onclick: () => abrirPr(c.repo, e.vinculo.pr) }, `Abrir PR #${e.vinculo.pr}`),
        e.estado !== 'completed'
          ? h('button', { type: 'button', class: 'boton secundario', onclick: (ev) => hacer(ev.target, '/api/ejecucion', { repo: c.repo, id: e.id, accion: 'cancelar' }, 'Cancelación pedida.') }, icono('parar'), 'Cancelar')
          : [h('button', { type: 'button', class: 'boton secundario', onclick: (ev) => hacer(ev.target, '/api/ejecucion', { repo: c.repo, id: e.id, accion: 'reintentar-fallidos' }, 'Reintentando los jobs fallidos.') }, icono('reintentar'), 'Reintentar fallidos'),
            h('button', { type: 'button', class: 'boton secundario', onclick: (ev) => hacer(ev.target, '/api/ejecucion', { repo: c.repo, id: e.id, accion: 'reintentar' }, 'Reintentando la ejecución entera.') }, 'Reintentar todo')])),
    h('div', { class: 'bloque' }, h('h3', {}, `Jobs (${jobs.length})`),
      jobs.length ? jobs.map((j) => {
        const [tj, cj] = j.estado === 'completed' ? resultado(j.conclusion) : [j.estado === 'in_progress' ? 'en marcha' : 'en cola', 'espera'];
        return h('div', { class: 'job-detalle', dataset: { agente: j.agente } },
          h('div', { class: 'acciones' }, h('strong', {}, j.nombre), h('span', { class: 'nota' }, NOMBRES[j.agente] ?? j.agente), est(tj, cj),
            j.estado === 'completed'
              ? h('button', { type: 'button', class: 'enlace', onclick: () => verRegistro(j.id) }, icono('log'), c.job === j.id ? 'Recargar registro' : 'Ver registro')
              : h('span', { class: 'nota', title: 'GitHub solo da el registro de un job cuando termina' }, 'registro al terminar')),
          h('ol', { class: 'pasos' }, j.pasos.map((p) => h('li', { class: p.estado === 'completed' ? (p.conclusion === 'failure' ? 'mal' : p.conclusion === 'skipped' ? 'omitido' : 'hecho') : p.estado === 'in_progress' ? 'ahora' : '' }, p.nombre))),
          c.job === j.id && (c.lineas
            ? h('pre', { class: 'registro', tabindex: '0' }, c.lineas.join('\n'))
            : h('p', { class: 'nota' }, c.errorRegistro ?? 'Cargando el registro…')));
      }) : h('p', { class: 'nota' }, 'Sin datos de jobs aún: llegan con el primer paso.')),
  );
}

async function verRegistro(job) {
  const c = app.cajon;
  c.job = job;
  c.lineas = null;
  c.errorRegistro = null;
  pintarEjecucion();
  try {
    const r = await api(`/api/registro?${q({ repo: c.repo, job })}`);
    if (app.cajon !== c) return;
    c.lineas = r.lineas.length ? r.lineas : ['(registro vacío: el job aún no ha escrito nada)'];
  } catch (e) {
    c.errorRegistro = e.message;
  }
  if (app.cajon === c) {
    pintarEjecucion();
    cuerpo().querySelector('.registro')?.scrollTo({ top: 1e9 });
  }
}

// ------------------------------------------------------------------ nueva issue

export function abrirNuevaIssue(repoInicial) {
  app.cajon = { tipo: 'nueva', detalle: true };
  mostrar('Nueva issue');
  const repos = app.estado?.reposInstalados?.length ? app.estado.reposInstalados : Object.keys(app.estado?.repos ?? {});
  const repo = h('select', { 'aria-label': 'Repositorio', id: 'nueva-repo' }, repos.map((r) => h('option', { value: r }, r)));
  if (repoInicial && repos.includes(repoInicial)) repo.value = repoInicial;
  const titulo = h('input', { type: 'text', id: 'nueva-titulo', placeholder: 'Qué hay que hacer', maxlength: '256', 'aria-label': 'Título' });
  const texto = h('textarea', { id: 'nueva-cuerpo', placeholder: 'Contexto, criterios de aceptación… (markdown)', 'aria-label': 'Descripción', rows: '8' });
  const planificar = h('input', { type: 'checkbox', id: 'nueva-planificar', checked: true });
  const etiquetas = h('div', { class: 'etiquetas' });
  const elegidas = new Set();
  const pintarEtiquetas = async () => {
    const pedido = repo.value;
    rellenar(etiquetas, h('span', { class: 'nota' }, 'Cargando etiquetas…'));
    try {
      const todas = (await etiquetasDe(pedido)).filter((l) => !l.sistema && !l.soloPr && !l.arranca);
      // Si mientras tanto se eligió otro repo, esta respuesta ya no vale.
      if (repo.value !== pedido) return;
      rellenar(etiquetas, todas.map((l) => h('label', { class: 'etiqueta seleccionable' },
        h('input', { type: 'checkbox', onchange: (ev) => (ev.target.checked ? elegidas.add(l.nombre) : elegidas.delete(l.nombre)) }), l.nombre)));
    } catch (e) {
      rellenar(etiquetas, h('span', { class: 'nota' }, e.message));
    }
  };
  repo.addEventListener('change', () => { elegidas.clear(); pintarEtiquetas(); });
  rellenar(cuerpo(),
    h('form', { class: 'bloque formulario', onsubmit: async (ev) => {
      ev.preventDefault();
      const boton = ev.target.querySelector('button[type=submit]');
      const r = await hacer(boton, '/api/issue/crear', { repo: repo.value, titulo: titulo.value, cuerpo: texto.value, etiquetas: [...elegidas], planificar: planificar.checked },
        (x) => `Creada #${x.numero} en ${corto(repo.value)}${planificar.checked ? ': el jefe de proyecto prepara el plan' : ''}.`);
      if (r?.numero) abrirIssue(repo.value, r.numero);
    } },
    h('label', {}, 'Repositorio', repo),
    h('label', {}, 'Título', titulo),
    h('label', {}, 'Descripción', texto),
    h('div', {}, h('span', { class: 'nota' }, 'Etiquetas'), etiquetas),
    h('label', { class: 'casilla' }, planificar, ' Pedir el plan al jefe de proyecto al crearla'),
    h('div', { class: 'acciones' }, h('button', { type: 'submit', class: 'boton' }, 'Crear issue'), h('button', { type: 'button', class: 'boton secundario', onclick: cerrarCajon }, 'Cancelar'))));
  pintarEtiquetas();
  titulo.focus();
}
