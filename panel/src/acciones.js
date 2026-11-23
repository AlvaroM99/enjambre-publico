// Acciones del panel sobre GitHub que no son del flujo de etiquetas (ADR 0015, ampliación del 23-11-2026):
// crear issues, comentar, cerrar y reabrir, reseñas, ramas, ejecuciones, investigador y registros de un job.
// Cada función recibe el cliente de GitHub con el token de Álvaro y los datos ya leídos del cuerpo, y devuelve
// [estado HTTP, cuerpo]. Todo lo que llega del navegador se valida aquí.

import { idValido, numeroValido, shaValido } from './github.js';

const ETIQUETAS_QUE_NO_SE_PONEN = ['enjambre:en-curso'];
const RAMAS_PROTEGIDAS = /^(main|master|develop|production|produccion|release(\/.*)?)$/;
const texto = (x, max) => (typeof x === 'string' ? x.slice(0, max) : '');
const mal = (mensaje, estado = 400) => [estado, { error: mensaje }];

export async function crearIssue(gh, repo, d) {
  const titulo = texto(d.titulo, 256).trim();
  if (!titulo) return mal('El título no puede estar vacío');
  const cuerpo = texto(d.cuerpo, 20_000);
  const pedidas = Array.isArray(d.etiquetas) ? d.etiquetas.filter((x) => typeof x === 'string').slice(0, 20) : [];
  if (pedidas.some((e) => ETIQUETAS_QUE_NO_SE_PONEN.includes(e))) return mal('enjambre:en-curso la pone el workflow');
  if (pedidas.length || d.planificar) {
    const existentes = new Set((await gh.get(`/repos/${repo}/labels?per_page=100`)).map((l) => l.name));
    const faltan = pedidas.filter((e) => !existentes.has(e));
    if (faltan.length) return mal(`No existen en ${repo}: ${faltan.join(', ')}`);
    if (d.planificar && !existentes.has('enjambre:planificar')) return mal(`${repo} no tiene la etiqueta enjambre:planificar`);
  }
  const etiquetas = pedidas.filter((e) => e !== 'enjambre:planificar');
  const issue = await gh.post(`/repos/${repo}/issues`, { title: titulo, body: cuerpo, ...(etiquetas.length ? { labels: etiquetas } : {}) });
  // planificar va aparte y después: el workflow arranca con el evento «labeled», que así sale seguro.
  if (d.planificar || pedidas.includes('enjambre:planificar')) {
    await gh.post(`/repos/${repo}/issues/${issue.number}/labels`, { labels: ['enjambre:planificar'] });
  }
  return [200, { ok: true, numero: issue.number, url: issue.html_url }];
}

export async function comentar(gh, repo, d) {
  const n = Number(d.numero);
  if (!numeroValido(n)) return mal('Número no válido');
  const cuerpo = texto(d.cuerpo, 20_000).trim();
  if (!cuerpo) return mal('El comentario está vacío');
  const c = await gh.post(`/repos/${repo}/issues/${n}/comments`, { body: cuerpo });
  return [200, { ok: true, url: c?.html_url ?? null }];
}

export async function estadoIssue(gh, repo, d) {
  const n = Number(d.numero);
  if (!numeroValido(n)) return mal('Número no válido');
  const MOTIVOS = { completada: 'completed', descartada: 'not_planned' };
  if (d.estado === 'cerrar') {
    await gh.patch(`/repos/${repo}/issues/${n}`, { state: 'closed', state_reason: MOTIVOS[d.motivo] ?? 'completed' });
  } else if (d.estado === 'reabrir') {
    await gh.patch(`/repos/${repo}/issues/${n}`, { state: 'open', state_reason: 'reopened' });
  } else {
    return mal('Estado no válido');
  }
  return [200, { ok: true }];
}

/** Reseña de un PR sobre el commit que se está viendo: aprobar, pedir cambios o comentar. */
export async function resena(gh, repo, d) {
  const n = Number(d.numero);
  if (!numeroValido(n)) return mal('Número no válido');
  if (!shaValido(d.sha)) return mal('Falta el commit que estás revisando');
  const EVENTOS = { aprobar: 'APPROVE', cambios: 'REQUEST_CHANGES', comentar: 'COMMENT' };
  const evento = EVENTOS[d.evento];
  if (!evento) return mal('Tipo de reseña no válido');
  const cuerpo = texto(d.comentario, 20_000).trim();
  if (evento !== 'APPROVE' && !cuerpo) return mal('Para pedir cambios o comentar hace falta un texto');
  const r = await gh.post(`/repos/${repo}/pulls/${n}/reviews`, { event: evento, commit_id: d.sha, ...(cuerpo ? { body: cuerpo } : {}) });
  return [200, { ok: true, url: r?.html_url ?? null }];
}

/** Trae a la rama del PR lo nuevo de la base (botón «Update branch» de GitHub). */
export async function actualizarRama(gh, repo, d) {
  const n = Number(d.numero);
  if (!numeroValido(n)) return mal('Número no válido');
  if (!shaValido(d.sha)) return mal('Falta el commit que estás viendo');
  await gh.put(`/repos/${repo}/pulls/${n}/update-branch`, { expected_head_sha: d.sha });
  return [200, { ok: true }];
}

export async function marcarListo(gh, repo, d) {
  const n = Number(d.numero);
  if (!numeroValido(n)) return mal('Número no válido');
  const pr = await gh.get(`/repos/${repo}/pulls/${n}`);
  if (!pr.draft) return [200, { ok: true, yaEstaba: true }];
  await gh.graphql('mutation($id: ID!) { markPullRequestReadyForReview(input: { pullRequestId: $id }) { pullRequest { isDraft } } }', { id: pr.node_id });
  return [200, { ok: true }];
}

/** Borra la rama de un PR ya fusionado o cerrado. Nunca la rama por defecto ni ramas de otro repo. */
export async function borrarRama(gh, repo, d) {
  const n = Number(d.numero);
  if (!numeroValido(n)) return mal('Número no válido');
  const pr = await gh.get(`/repos/${repo}/pulls/${n}`);
  if (pr.state !== 'closed') return mal('Solo se borra la rama de un PR fusionado o cerrado', 409);
  if (pr.head?.repo?.full_name !== repo) return mal('La rama es de otro repositorio', 409);
  const rama = pr.head.ref;
  if (rama === pr.base?.repo?.default_branch || RAMAS_PROTEGIDAS.test(rama)) return mal(`La rama ${rama} no se borra desde el panel`, 409);
  await gh.delete(`/repos/${repo}/git/refs/heads/${rama.split('/').map(encodeURIComponent).join('/')}`);
  return [200, { ok: true, rama }];
}

export async function ejecucion(gh, repo, d) {
  const id = Number(d.id);
  if (!idValido(id)) return mal('Ejecución no válida');
  const RUTAS = { reintentar: 'rerun', 'reintentar-fallidos': 'rerun-failed-jobs', cancelar: 'cancel' };
  const ruta = RUTAS[d.accion];
  if (!ruta) return mal('Acción no válida');
  await gh.post(`/repos/${repo}/actions/runs/${id}/${ruta}`, {});
  return [200, { ok: true }];
}

/** Lanza al investigador (enjambre-investigar.yml solo arranca con workflow_dispatch). */
export async function investigar(gh, repo, d) {
  const alcance = texto(d.alcance, 300).trim() || 'lo fusionado en main en los últimos 7 días';
  const info = await gh.get(`/repos/${repo}`);
  await gh.post(`/repos/${repo}/actions/workflows/enjambre-investigar.yml/dispatches`, { ref: info.default_branch, inputs: { alcance } });
  return [200, { ok: true }];
}

/** Últimas líneas del registro de un job, sin códigos de color ni marcas de tiempo. */
export async function registro(gh, repo, d) {
  const job = Number(d.job);
  if (!idValido(job)) return mal('Job no válido');
  let crudo;
  try {
    crudo = await gh.texto(`/repos/${repo}/actions/jobs/${job}/logs`);
  } catch (e) {
    // GitHub solo sirve el registro de un job cuando ha terminado: mientras corre responde 404 (finance_tracker#17).
    if (e.estado === 404) return mal('GitHub solo da el registro de un job cuando termina. Mientras tanto, los pasos se ven en vivo aquí.', 409);
    throw e;
  }
  return [200, { lineas: limpiarRegistro(crudo, 400) }];
}

export function limpiarRegistro(crudo, max = 400) {
  return String(crudo ?? '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z ?/, '').replace(/\x1b\[[0-9;]*m/g, ''))
    .filter((l) => l.trim() !== '')
    .slice(-max);
}
