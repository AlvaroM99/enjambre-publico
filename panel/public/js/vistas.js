// Vistas del panel (ADR 0015): En vivo, Bandeja, Issues, PR, Actividad y Repos.
import { api, q } from './api.js';
import { app } from './app-estado.js';
import {
  NOMBRES, INICIALES, COLUMNAS, agentesActivos, terminadas, bandeja, resumen, tablero, prsAbiertos, ejecuciones, porAgente,
} from './datos.js';
import { abrirIssue, abrirPr, abrirEjecucion, abrirNuevaIssue, editorEtiquetas } from './cajones.js';
import { h, rellenar, enlace, corto, duracion, hace, hora, fecha, aviso, est, resultado, insigniaCi, insigniaVeredicto, avatar, icono } from './ui.js';

export const VISTAS = {
  vivo: { titulo: 'En vivo', icono: 'vivo', pintar: vivo },
  bandeja: { titulo: 'Bandeja', icono: 'bandeja', pintar: vistaBandeja },
  issues: { titulo: 'Issues', icono: 'issues', pintar: issues },
  prs: { titulo: 'Pull requests', icono: 'prs', pintar: prs },
  actividad: { titulo: 'Actividad', icono: 'actividad', pintar: actividad },
  repos: { titulo: 'Repos', icono: 'repos', pintar: reposVista },
};

const opciones = () => ({ filtro: app.filtro, busqueda: app.busqueda, propietario: app.login });
const vacio = (texto) => h('p', { class: 'vacio' }, texto);
const seccion = (titulo, cuenta, ...hijos) => h('section', { class: 'seccion' },
  h('div', { class: 'cab' }, h('h2', {}, titulo), cuenta !== null && cuenta !== undefined && h('span', { class: 'contador' }, String(cuenta))), hijos);

function objetivoDe(repo, vinculo) {
  if (!vinculo) return null;
  const r = app.estado.repos[repo];
  if (vinculo.pr && r.prs[vinculo.pr]) return { texto: `#${vinculo.pr} ${r.prs[vinculo.pr].titulo ?? ''}`, abrir: () => abrirPr(repo, vinculo.pr) };
  if (vinculo.issue && r.issues[vinculo.issue]) return { texto: `#${vinculo.issue} ${r.issues[vinculo.issue].titulo}`, abrir: () => abrirIssue(repo, vinculo.issue) };
  const n = vinculo.pr ?? vinculo.issue;
  return n ? { texto: `#${n}`, abrir: vinculo.pr ? () => abrirPr(repo, n) : () => abrirIssue(repo, n) } : null;
}

// ------------------------------------------------------------------ En vivo

function tarjetaAgente({ repo, ejecucion: e, jobs, activo, agente }) {
  const objetivo = objetivoDe(repo, e.vinculo);
  const pasos = activo?.pasos ?? [];
  const actual = pasos.find((p) => p.estado === 'in_progress') ?? pasos.find((p) => p.estado === 'queued');
  const hechos = pasos.filter((p) => p.estado === 'completed').length;
  return h('article', { class: `agente${activo ? ' activo' : ''}`, dataset: { agente } },
    h('div', { class: 'fila' },
      h('span', { class: 'quien' }, avatar(agente, INICIALES[agente] ?? '··', Boolean(activo)), h('span', { class: 'insignia' }, NOMBRES[agente] ?? agente)),
      h('span', { class: 'reloj', dataset: { desde: e.inicio ?? '' } }, e.inicio ? duracion(Date.now() - Date.parse(e.inicio)) : '')),
    h('div', { class: 'objetivo' }, objetivo ? h('button', { type: 'button', class: 'enlace-titulo', onclick: objetivo.abrir }, objetivo.texto) : (e.titulo ?? e.workflow)),
    h('div', { class: 'donde' }, `${corto(repo)} · ${e.workflow}${e.intento > 1 ? ` · intento ${e.intento}` : ''}`),
    activo
      ? h('div', { class: 'paso' },
        h('div', {}, `Job ${activo.nombre} · `, actual ? `paso ${actual.numero}/${pasos.length}: ${actual.nombre}` : `${hechos}/${pasos.length} pasos`),
        h('div', { class: 'barra-pasos', 'aria-hidden': 'true' },
          pasos.map((p) => h('i', { class: p.estado === 'completed' ? (p.conclusion === 'failure' ? 'mal' : 'hecho') : p.estado === 'in_progress' ? 'ahora' : '' }))))
      : h('div', { class: 'paso' }, e.estado === 'queued' || e.estado === 'requested' ? 'En cola en GitHub' : 'Arrancando (sin datos de jobs aún)'),
    jobs.length > 1 && h('div', { class: 'jobs' }, jobs.map((j) => h('span', { class: `job ${j.estado === 'completed' ? j.conclusion : j.estado}`, dataset: { agente: j.agente }, title: NOMBRES[j.agente] ?? j.agente }, j.nombre))),
    h('div', { class: 'pie' },
      h('button', { type: 'button', class: 'enlace', onclick: () => abrirEjecucion(repo, e.id) }, icono('log'), 'Pasos y registro'),
      enlace(e.url, 'GitHub ↗', 'suave')));
}

function kpis() {
  const r = resumen(app.estado, opciones());
  const kpi = (valor, texto, vista, tono) => h('a', { class: `kpi ${tono ?? ''}`, href: `#${vista}` }, h('b', {}, String(valor)), h('span', {}, texto));
  return h('div', { class: 'kpis' },
    kpi(r.agentes, r.agentes === 1 ? 'agente trabajando' : 'agentes trabajando', 'vivo', r.agentes ? 'vivo' : ''),
    kpi(r.paraTi, 'PR esperan tu revisión', 'bandeja', r.paraTi ? 'miel' : ''),
    kpi(r.planes, r.planes === 1 ? 'plan por aprobar' : 'planes por aprobar', 'bandeja', r.planes ? 'miel' : ''),
    kpi(r.fallos, 'fallos que mirar', 'bandeja', r.fallos ? 'mal' : ''),
    kpi(r.abiertas, 'issues abiertas', 'issues'),
    kpi(r.prs, 'PR abiertos', 'prs'));
}

function vivo(cont) {
  const activos = agentesActivos(app.estado, app.filtro);
  const hechos = terminadas(app.estado, app.filtro);
  const b = bandeja(app.estado, opciones());
  rellenar(cont,
    kpis(),
    seccion('Agentes trabajando ahora', activos.length,
      activos.length ? h('div', { class: 'agentes' }, activos.map(tarjetaAgente)) : vacio('Ningún agente trabajando ahora mismo. Crea una issue o aprueba un plan para ponerlos en marcha.')),
    h('div', { class: 'dos-columnas' },
      seccion('Lo que espera de ti', b.length, b.length ? h('ol', { class: 'bandeja' }, b.slice(0, 6).map(elementoBandeja)) : vacio('Nada pendiente.'),
        b.length > 6 && h('a', { class: 'enlace', href: '#bandeja' }, `Ver las ${b.length}`)),
      seccion('Terminado en las últimas 2 horas', hechos.length,
        hechos.length ? h('ol', { class: 'recientes' }, hechos.slice(0, 10).map(filaTerminada)) : vacio('Nada en las últimas 2 horas.'))),
    seccion('Cronología', null, cronologia(25)));
}

function filaTerminada({ repo, ejecucion: e }) {
  const [t, c] = resultado(e.conclusion);
  const objetivo = objetivoDe(repo, e.vinculo);
  return h('li', { dataset: { agente: e.agente } },
    avatar(e.agente, INICIALES[e.agente] ?? '··'),
    h('span', { class: 'que' }, h('span', { class: 'insignia' }, NOMBRES[e.agente] ?? e.workflow), ' ', `${corto(repo)} · `,
      objetivo ? h('button', { type: 'button', class: 'enlace', onclick: objetivo.abrir }, objetivo.texto) : (e.titulo ?? e.workflow),
      ` · ${duracion(Date.parse(e.actualizado) - Date.parse(e.inicio))}`),
    h('span', { class: 'fin' }, est(t, c), h('button', { type: 'button', class: 'enlace', title: 'Pasos y registro', onclick: () => abrirEjecucion(repo, e.id) }, icono('log'))));
}

// ------------------------------------------------------------------ Bandeja

const BOTON_BANDEJA = {
  fusionar: 'Fusionar', 'revisar-pr': 'Revisar', cambios: 'Ver revisión', 'ci-roja': 'Ver CI', 'aprobar-plan': 'Leer y aprobar', fallo: 'Ver fallo',
};
const TONO = { fusionar: 'bien', 'revisar-pr': 'miel', 'aprobar-plan': 'miel', cambios: 'espera', 'ci-roja': 'mal', fallo: 'mal' };

function elementoBandeja(x) {
  const abrir = x.tipo === 'fallo' ? () => abrirEjecucion(x.repo, x.id) : x.tipo === 'aprobar-plan' ? () => abrirIssue(x.repo, x.numero) : () => abrirPr(x.repo, x.numero);
  return h('li', { class: `pendiente-${TONO[x.tipo]}`, dataset: { tipo: x.tipo } },
    h('div', {},
      h('div', { class: 'que' }, `${corto(x.repo)}${x.numero ? ` #${x.numero}` : ''} · `, h('strong', {}, x.titulo ?? '')),
      h('div', { class: 'nota' }, x.texto)),
    h('button', { type: 'button', class: 'boton secundario', onclick: abrir }, BOTON_BANDEJA[x.tipo] ?? 'Abrir'));
}

function vistaBandeja(cont) {
  const b = bandeja(app.estado, opciones());
  const grupos = [
    ['Para fusionar', (x) => x.tipo === 'fusionar'],
    ['Para revisar', (x) => x.tipo === 'revisar-pr'],
    ['Planes por aprobar', (x) => x.tipo === 'aprobar-plan'],
    ['Revisiones con cambios', (x) => x.tipo === 'cambios'],
    ['Fallos', (x) => x.tipo === 'fallo' || x.tipo === 'ci-roja'],
  ];
  rellenar(cont,
    h('p', { class: 'intro' }, 'Todo lo que espera una decisión tuya, en orden. Cada botón abre el sitio donde se resuelve, sin salir del panel.'),
    b.length ? grupos.map(([titulo, f]) => {
      const lista = b.filter(f);
      return lista.length > 0 && seccion(titulo, lista.length, h('ol', { class: 'bandeja' }, lista.map(elementoBandeja)));
    }) : vacio('Nada pendiente. Los agentes te avisarán aquí cuando haya algo.'));
}

// ------------------------------------------------------------------ Issues

function tarjetaIssue({ repo, issue: i, agentes }) {
  return h('article', { class: 'issue' },
    h('div', { class: 'donde' }, `${corto(repo)} #${i.numero} `, enlace(i.url, '↗', 'suave')),
    h('button', { type: 'button', class: 'titulo enlace-titulo', onclick: () => abrirIssue(repo, i.numero) }, i.titulo),
    agentes.map((a) => h('div', { class: 'en-marcha', dataset: { agente: a } }, `${NOMBRES[a] ?? a} trabajando`)),
    !agentes.length && i.plan && !i.etiquetas.includes('enjambre:en-curso') && !Object.values(app.estado.repos[repo].prs).some((p) => p.estado === 'open' && p.issue === i.numero)
      && h('button', { type: 'button', class: 'pendiente', onclick: () => abrirIssue(repo, i.numero) }, 'Plan listo: revísalo y apruébalo'),
    !agentes.length && i.nota && !i.nota.titulo.startsWith('Plan') && h('div', { class: 'ultima-nota', title: 'Último comentario de un agente' }, i.nota.titulo),
    editorEtiquetas(repo, i.numero, i.etiquetas));
}

function issues(cont) {
  const g = tablero(app.estado, opciones());
  const nombres = Object.fromEntries([...COLUMNAS.map((c) => [c[0], c[1]]), ['otras', 'Otras abiertas']]);
  const total = Object.values(g).reduce((n, l) => n + l.length, 0);
  rellenar(cont,
    h('div', { class: 'barra-vista' },
      h('span', { class: 'nota' }, `${total} issues abiertas`),
      h('button', { type: 'button', class: 'boton', onclick: () => abrirNuevaIssue(app.filtro !== 'todos' ? app.filtro : null) }, icono('mas'), 'Nueva issue')),
    h('div', { class: 'tablero' }, Object.entries(g).map(([clave, tarjetas]) =>
      h('div', { class: 'columna', dataset: { columna: clave } }, h('h3', {}, h('span', {}, nombres[clave]), h('span', {}, String(tarjetas.length))),
        tarjetas.length ? tarjetas.map(tarjetaIssue) : h('p', { class: 'nota' }, '—')))));
}

// ------------------------------------------------------------------ PR

function prs(cont) {
  const lista = prsAbiertos(app.estado, { ...opciones(), incluirCerrados: app.verCerrados });
  rellenar(cont,
    h('div', { class: 'barra-vista' },
      h('label', { class: 'casilla' }, h('input', { type: 'checkbox', checked: Boolean(app.verCerrados), onchange: (ev) => { app.verCerrados = ev.target.checked; app.repintar(); } }), ' Incluir fusionados y cerrados (24 h)')),
    lista.length ? h('div', { class: 'prs' }, lista.map(({ repo, pr, ci }) => {
      const corriendo = agentesActivos(app.estado, repo).filter((a) => a.ejecucion.vinculo?.pr === pr.numero);
      return h('article', { class: `pr${pr.estado !== 'open' ? ' cerrado' : ''}` },
        h('div', {},
          h('div', { class: 'titulo' }, h('button', { type: 'button', class: 'enlace-titulo', onclick: () => abrirPr(repo, pr.numero) }, `#${pr.numero} ${pr.titulo ?? ''}`)),
          h('div', { class: 'meta' },
            h('span', {}, `${corto(repo)} · ${pr.rama ?? ''} → ${pr.base ?? ''}`),
            pr.estado === 'merged' ? est('fusionado', 'bien') : pr.estado !== 'open' ? est('cerrado', 'neutro') : est(pr.borrador ? 'borrador' : 'abierto', pr.borrador ? 'neutro' : 'bien'),
            pr.estado === 'open' && insigniaCi(ci),
            insigniaVeredicto('revisor', pr.veredictos?.revisor),
            pr.veredictos?.seguridad && insigniaVeredicto('seguridad', pr.veredictos.seguridad),
            pr.aprobado && est('aprobado por ti', 'bien'),
            pr.issue && h('button', { type: 'button', class: 'enlace', onclick: () => abrirIssue(repo, pr.issue) }, `issue #${pr.issue}`),
            corriendo.map((a) => h('span', { class: 'en-marcha', dataset: { agente: a.agente } }, NOMBRES[a.agente])))),
        h('button', { type: 'button', class: 'boton secundario', onclick: () => abrirPr(repo, pr.numero) }, pr.estado === 'open' ? 'Revisar' : 'Ver'));
    })) : vacio(app.busqueda ? 'Ningún PR coincide con la búsqueda.' : 'No hay PR abiertos.'));
}

// ------------------------------------------------------------------ Actividad

export function cronologia(max = 200) {
  const eventos = (app.estado.eventos ?? []).filter((e) => (app.filtro === 'todos' || e.repo === app.filtro) && (!app.busqueda || e.texto.toLowerCase().includes(app.busqueda.toLowerCase()))).slice(0, max);
  app.vistos ??= new Set();
  const primera = app.vistos.size === 0;
  if (!eventos.length) return h('ol', { class: 'cronologia' }, h('li', { class: 'vacio' }, 'Aún no ha llegado ningún evento.'));
  return h('ol', { class: 'cronologia' }, eventos.map((e) => {
    const clave = `${e.t}|${e.repo}|${e.texto}`;
    const nuevo = !primera && !app.vistos.has(clave);
    app.vistos.add(clave);
    const abrir = e.numero ? () => (e.tipo === 'pull_request' || e.tipo === 'pull_request_review' || e.tipo === 'status' ? abrirPr(e.repo, e.numero) : abrirIssue(e.repo, e.numero)) : null;
    return h('li', { class: nuevo ? 'nuevo' : '' },
      h('time', { datetime: e.t }, hora(e.t)),
      h('span', { class: 'repo-evento' }, corto(e.repo)),
      h('span', {}, e.actor ? h('span', { class: 'actor' }, `${e.actor} `) : '', abrir ? h('button', { type: 'button', class: 'enlace', onclick: abrir }, e.texto) : enlace(e.url, e.texto)));
  }));
}

function actividad(cont) {
  const filas = ejecuciones(app.estado, opciones());
  const agentes = porAgente(app.estado, opciones());
  rellenar(cont,
    seccion('Agentes en las últimas 24 h', agentes.length, agentes.length ? h('div', { class: 'tabla' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Agente', 'Ejecuciones', 'Fallos', 'Duración mediana'].map((t) => h('th', {}, t)))),
      h('tbody', {}, agentes.map((a) => h('tr', { dataset: { agente: a.agente } },
        h('td', {}, h('span', { class: 'quien' }, avatar(a.agente, INICIALES[a.agente] ?? '··'), NOMBRES[a.agente] ?? a.agente)),
        h('td', { class: 'num' }, String(a.total)), h('td', { class: `num${a.fallos ? ' rojo' : ''}` }, String(a.fallos)),
        h('td', { class: 'num' }, a.mediana ? duracion(a.mediana) : '—')))))) : vacio('Sin ejecuciones terminadas en 24 h.')),
    seccion('Ejecuciones', filas.length, filas.length ? h('div', { class: 'tabla' }, h('table', {},
      h('thead', {}, h('tr', {}, ['', 'Agente', 'Repo', 'Sobre', 'Inicio', 'Duración', 'Estado', ''].map((t) => h('th', {}, t)))),
      h('tbody', {}, filas.map(({ repo, ejecucion: e }) => {
        const [t, c] = e.estado === 'completed' ? resultado(e.conclusion) : [e.estado === 'in_progress' ? 'en marcha' : 'en cola', 'espera'];
        const objetivo = objetivoDe(repo, e.vinculo);
        return h('tr', { dataset: { agente: e.agente } },
          h('td', {}, avatar(e.agente, INICIALES[e.agente] ?? '··', e.estado !== 'completed')),
          h('td', {}, NOMBRES[e.agente] ?? e.workflow, h('div', { class: 'nota' }, e.workflow)),
          h('td', {}, corto(repo)),
          h('td', { class: 'sobre' }, objetivo ? h('button', { type: 'button', class: 'enlace', onclick: objetivo.abrir }, objetivo.texto) : (e.titulo ?? '—')),
          h('td', { class: 'num' }, fecha(e.inicio)),
          h('td', { class: 'num', dataset: e.estado !== 'completed' ? { desde: e.inicio ?? '' } : {} }, duracion((e.estado === 'completed' ? Date.parse(e.actualizado) : Date.now()) - Date.parse(e.inicio))),
          h('td', {}, est(t, c)),
          h('td', {}, h('button', { type: 'button', class: 'enlace', onclick: () => abrirEjecucion(repo, e.id) }, 'Detalle')));
      })))) : vacio('Sin ejecuciones en 24 h.')),
    seccion('Cronología', null, cronologia(300)));
}

// ------------------------------------------------------------------ Repos

function reposVista(cont) {
  const lista = app.estado.reposInstalados?.length ? app.estado.reposInstalados : Object.keys(app.estado.repos);
  const instalar = app.estado.appSlug ? `https://github.com/apps/${app.estado.appSlug}/installations/new` : null;
  rellenar(cont,
    h('p', { class: 'intro' }, 'Los repos donde está instalada la GitHub App. Para que el equipo trabaje en otro, instálala allí y añade las plantillas de workflows de Enjambre.'),
    instalar && h('p', {}, enlace(instalar, 'Añadir o quitar repos de la app ↗', 'boton secundario')),
    h('div', { class: 'repos' }, lista.map((nombre) => {
      const r = app.estado.repos[nombre] ?? { issues: {}, prs: {}, ejecuciones: {} };
      const abiertas = Object.values(r.issues).filter((i) => i.estado === 'open').length;
      const prsAb = Object.values(r.prs).filter((p) => p.estado === 'open').length;
      const corriendo = Object.values(r.ejecuciones).filter((e) => e.estado !== 'completed').length;
      const alcance = h('input', { type: 'text', placeholder: 'lo fusionado en main en los últimos 7 días', 'aria-label': `Qué investigar en ${nombre}` });
      return h('article', { class: 'repo' },
        h('h3', {}, enlace(`https://github.com/${nombre}`, nombre)),
        h('div', { class: 'meta' }, est(`${abiertas} issues`, 'neutro'), est(`${prsAb} PR`, 'neutro'), est(`${corriendo} en marcha`, corriendo ? 'espera' : 'neutro')),
        h('div', { class: 'acciones' },
          h('button', { type: 'button', class: 'boton secundario', onclick: () => { app.filtro = nombre; location.hash = '#issues'; } }, 'Ver sus issues'),
          h('button', { type: 'button', class: 'boton secundario', onclick: () => abrirNuevaIssue(nombre) }, 'Nueva issue')),
        h('details', { class: 'investigar' }, h('summary', {}, 'Pedir una investigación'),
          h('p', { class: 'nota' }, 'El investigador revisa el código o lo fusionado y propone mejoras como issues.'),
          h('div', { class: 'acciones' }, alcance,
            h('button', { type: 'button', class: 'boton secundario', onclick: async (ev) => {
              ev.target.disabled = true;
              try {
                await api('/api/investigar', { metodo: 'POST', cuerpo: { repo: nombre, alcance: alcance.value } });
                aviso(`Investigador lanzado en ${corto(nombre)}.`);
              } catch (e) { aviso(e.message, true); } finally { ev.target.disabled = false; }
            } }, 'Investigar'))));
    })),
    h('p', { class: 'nota' }, app.estado.limiteApi ? `API de GitHub: quedan ${app.estado.limiteApi.quedan} de ${app.estado.limiteApi.total ?? '?'} peticiones esta hora.` : ''),
    app.estado.appPermisos && h('div', { class: 'bloque permisos-app' },
      h('h3', {}, 'Permisos que GitHub ha aceptado para la app'),
      h('p', { class: 'nota' }, 'Si cambias un permiso en la app y no lo aceptas en la instalación, sigue valiendo el de antes.'),
      h('div', { class: 'etiquetas' }, Object.entries(app.estado.appPermisos).sort().map(([k, v]) =>
        h('span', { class: `etiqueta${v === 'write' ? ' enjambre' : ''}` }, `${k}: ${v === 'write' ? 'escritura' : v === 'read' ? 'lectura' : v}`)))));
}
