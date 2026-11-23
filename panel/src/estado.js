// Estado del panel (ADR 0015): lo que sabe GitHub de issues, PR y ejecuciones de agentes, por repo.
// Funciones puras: un evento de GitHub (webhook o lectura de la API) entra y el estado cambia. Sin E/S.

export const BOT = 'github-actions[bot]';
export const MAX_EVENTOS = 500;
const MAX_EJECUCIONES = 60;
const DIA = 24 * 3600 * 1000;

export function estadoVacio() {
  return { repos: {}, eventos: [], ultimoWebhook: null, ultimaConciliacion: null, correcciones: 0, error: null };
}

export function repoDe(estado, nombre) {
  return (estado.repos[nombre] ??= { issues: {}, prs: {}, ejecuciones: {} });
}

// ------------------------------------------------------------------ agentes

// Job de cada workflow que es un agente; el resto de jobs del workflow son pasos automáticos («sistema»).
const AGENTES = {
  'enjambre-planificar': { planificar: 'jefe-proyecto' },
  'enjambre-implementar': { implementar: 'implementador' },
  'enjambre-revisar': { revisor: 'revisor', seguridad: 'seguridad' },
  'enjambre-analizar': { analizar: 'analista' },
  'enjambre-investigar': { investigar: 'investigador' },
  'enjambre-gobernanza': { auditar: 'gobernanza' },
};

export function agenteDe(workflow, job) {
  if (workflow === 'ci') return 'ci';
  if (workflow === 'produccion') return 'despliegue';
  const mapa = AGENTES[workflow];
  if (!mapa) return 'otro';
  return mapa[job] ?? 'sistema';
}

/** Agente principal de un workflow (para la ejecución entera). */
export function agenteDeWorkflow(workflow) {
  if (workflow === 'ci') return 'ci';
  if (workflow === 'produccion') return 'despliegue';
  const mapa = AGENTES[workflow];
  return mapa ? Object.values(mapa)[0] : 'otro';
}

/** Número de issue de una rama de agente: enjambre/12-slug o enjambre/issue-12-slug (igual que herramientas/extraer.mjs). */
export function issueDeRama(rama) {
  // Con sufijo de carril (enjambre/16a-…), como en finance_tracker#16.
  const m = /^enjambre\/(?:issue-)?(\d+)[a-z]?-/.exec(rama ?? '');
  return m ? Number(m[1]) : null;
}

const TITULOS = { 'Revisión de Enjambre': 'revisor', 'Revisión de seguridad de Enjambre': 'seguridad' };

/** Tipo y veredicto de un comentario de revisión de Enjambre, o null (mismo formato que herramientas/extraer.mjs). */
export function veredictoDe(cuerpo) {
  const titulo = /^## ([^\n]+)/.exec(cuerpo ?? '')?.[1]?.trim();
  const tipo = TITULOS[titulo];
  if (!tipo) return null;
  const v = [...cuerpo.matchAll(/\*\*Veredicto:\*\*\s*([A-ZÁÉÍÓÚ]+)/g)].pop()?.[1] ?? null;
  return { tipo, veredicto: v };
}

/**
 * Comentario de un agente en una issue: { plan: bool, titulo }. El implementador sigue el comentario que empieza por
 * «## Plan» publicado por el bot o por el propietario (plugins/enjambre/skills/ci-cd/workflows/enjambre-implementar.yml).
 */
export function notaDe(cuerpo, autor, propietario) {
  const titulo = /^## ([^\n]+)/.exec(cuerpo ?? '')?.[1]?.trim();
  if (!titulo) return null;
  const deAgente = autor === BOT;
  const plan = /^Plan\b/.test(titulo) && (deAgente || (propietario && autor?.toLowerCase() === propietario.toLowerCase()));
  if (!deAgente && !plan) return null;
  return { plan, titulo };
}

/** Plan y última nota de agente de una issue a partir de sus comentarios (API). */
export function notasDeComentarios(comentarios, propietario) {
  let plan = null;
  let nota = null;
  for (const c of comentarios ?? []) {
    const n = notaDe(c.body, c.user?.login, propietario);
    if (!n) continue;
    const dato = { titulo: n.titulo, fecha: c.created_at, url: c.html_url ?? null };
    if (n.plan && (!plan || plan.fecha <= dato.fecha)) plan = dato;
    if (!nota || nota.fecha <= dato.fecha) nota = dato;
  }
  return { plan, nota };
}

// ------------------------------------------------------------------ normalización (API y webhooks comparten forma)

const nombresEtiquetas = (ls) => (ls ?? []).map((l) => (typeof l === 'string' ? l : l.name)).filter(Boolean).sort();

export function issueDesdeApi(i, previo = {}) {
  return {
    numero: i.number,
    titulo: i.title,
    estado: i.state,
    etiquetas: nombresEtiquetas(i.labels),
    autor: i.user?.login ?? null,
    url: i.html_url,
    actualizado: i.updated_at,
    plan: previo?.plan ?? null,
    nota: previo?.nota ?? null,
  };
}

export function prDesdeApi(p, previo = {}) {
  const sha = p.head?.sha ?? previo.sha ?? null;
  return {
    numero: p.number,
    titulo: p.title,
    estado: p.merged_at || p.merged ? 'merged' : p.state,
    borrador: Boolean(p.draft),
    rama: p.head?.ref ?? previo.rama ?? null,
    base: p.base?.ref ?? previo.base ?? null,
    sha,
    autor: p.user?.login ?? null,
    etiquetas: nombresEtiquetas(p.labels),
    revisores: (p.requested_reviewers ?? []).map((u) => u.login),
    issue: issueDeRama(p.head?.ref ?? previo.rama),
    url: p.html_url,
    actualizado: p.updated_at,
    // Los estados y checks son del commit: si cambia la cabeza, se empieza de cero.
    ci: previo.sha === sha ? previo.ci ?? {} : {},
    checks: previo.sha === sha ? previo.checks ?? {} : {},
    veredictos: previo.veredictos ?? {},
    aprobado: previo.sha === sha ? previo.aprobado ?? false : false,
  };
}

export function ejecucionDesdeApi(r, previo = {}) {
  return {
    id: r.id,
    workflow: r.name,
    agente: agenteDeWorkflow(r.name),
    titulo: r.display_title ?? previo.titulo ?? null,
    evento: r.event,
    estado: r.status,
    conclusion: r.conclusion ?? null,
    rama: r.head_branch ?? null,
    actor: r.triggering_actor?.login ?? r.actor?.login ?? null,
    url: r.html_url,
    inicio: r.run_started_at ?? r.created_at ?? previo.inicio ?? null,
    actualizado: r.updated_at ?? null,
    intento: r.run_attempt ?? 1,
    prs: (r.pull_requests ?? []).map((p) => p.number),
    vinculo: previo.vinculo ?? null,
    jobs: previo.jobs ?? {},
  };
}

export function jobDesdeApi(j, workflow) {
  return {
    id: j.id,
    nombre: j.name,
    agente: agenteDe(workflow ?? j.workflow_name, j.name),
    estado: j.status,
    conclusion: j.conclusion ?? null,
    inicio: j.started_at ?? null,
    fin: j.completed_at ?? null,
    url: j.html_url,
    pasos: (j.steps ?? []).map((s) => ({ numero: s.number, nombre: s.name, estado: s.status, conclusion: s.conclusion ?? null })),
  };
}

/** Issue o PR al que trabaja una ejecución, con lo que dice GitHub; null si aún no se sabe. */
export function vinculoDe(repo, e) {
  if (e.prs?.length) return { pr: e.prs[0], issue: repo.prs[e.prs[0]]?.issue ?? null };
  const n = issueDeRama(e.rama);
  if (n) {
    const pr = Object.values(repo.prs).find((p) => p.rama === e.rama);
    return { issue: n, pr: pr?.numero ?? null };
  }
  if (e.evento === 'issues' && e.titulo) {
    const i = Object.values(repo.issues).find((x) => x.titulo === e.titulo);
    if (i) return { issue: i.numero, pr: null };
  }
  if ((e.evento === 'pull_request' || e.evento === 'pull_request_target') && e.titulo) {
    const p = Object.values(repo.prs).find((x) => x.titulo === e.titulo);
    if (p) return { pr: p.numero, issue: p.issue };
  }
  return e.vinculo ?? null;
}

/**
 * Las revisiones lanzadas con workflow_dispatch (ADR 0014) no dicen su PR. Cuando el bot publica un veredicto en un PR,
 * se enlaza con la ejecución de enjambre-revisar sin vínculo que estaba en marcha (o acababa de terminar).
 */
function vincularRevision(repo, pr, fecha) {
  const t = Date.parse(fecha);
  for (const e of Object.values(repo.ejecuciones)) {
    if (e.workflow !== 'enjambre-revisar' || e.vinculo?.pr) continue;
    const inicio = Date.parse(e.inicio ?? 0);
    const fin = e.estado === 'completed' ? Date.parse(e.actualizado ?? 0) + 60_000 : Infinity;
    if (t >= inicio && t <= fin) e.vinculo = { pr, issue: repo.prs[pr]?.issue ?? null };
  }
}

// ------------------------------------------------------------------ webhooks

export function anadirEvento(estado, evento) {
  estado.eventos.unshift(evento);
  if (estado.eventos.length > MAX_EVENTOS) estado.eventos.length = MAX_EVENTOS;
}

const RESENAS = { approved: 'aprobó', changes_requested: 'pidió cambios en', commented: 'comentó la revisión de', dismissed: 'descartó la revisión de' };
const RESULTADOS = { success: 'bien', failure: 'falló', cancelled: 'cancelado', skipped: 'omitido', timed_out: 'agotó el tiempo', action_required: 'espera aprobación', neutral: 'neutral' };
export const resultado = (c) => RESULTADOS[c] ?? c ?? 'sin resultado';

/**
 * Aplica un webhook de GitHub al estado. Devuelve true si algo cambió.
 * `ahora` es la hora de llegada (ISO); el evento de la cronología usa la hora del propio objeto si la trae.
 */
export function aplicarWebhook(estado, tipo, p, ahora = new Date().toISOString()) {
  estado.ultimoWebhook = ahora;
  const nombre = p?.repository?.full_name;
  if (!nombre) return false;
  const repo = repoDe(estado, nombre);
  const actor = p.sender?.login ?? null;
  let texto = null;
  let url = null;
  let t = ahora;
  let numero = null;

  switch (tipo) {
    case 'issues': {
      if (p.issue?.pull_request) break;
      repo.issues[p.issue.number] = issueDesdeApi(p.issue, repo.issues[p.issue.number]);
      numero = p.issue.number;
      url = p.issue.html_url;
      const acciones = {
        opened: `abrió #${numero}`,
        closed: `cerró #${numero}`,
        reopened: `reabrió #${numero}`,
        labeled: `puso «${p.label?.name}» en #${numero}`,
        unlabeled: `quitó «${p.label?.name}» de #${numero}`,
        edited: `editó #${numero}`,
      };
      texto = acciones[p.action] ?? null;
      break;
    }
    case 'pull_request': {
      const n = p.pull_request.number;
      repo.prs[n] = prDesdeApi(p.pull_request, repo.prs[n]);
      numero = n;
      url = p.pull_request.html_url;
      const acciones = {
        opened: `abrió el PR #${n}`,
        reopened: `reabrió el PR #${n}`,
        closed: p.pull_request.merged ? `fusionó #${n}` : `cerró el PR #${n} sin fusionar`,
        ready_for_review: `#${n} listo para revisar`,
        converted_to_draft: `#${n} vuelve a borrador`,
        synchronize: `nuevo commit en #${n}`,
        review_requested: `pidió revisión a ${p.requested_reviewer?.login ?? 'alguien'} en #${n}`,
        labeled: `puso «${p.label?.name}» en #${n}`,
        unlabeled: `quitó «${p.label?.name}» de #${n}`,
      };
      texto = acciones[p.action] ?? null;
      // Las ejecuciones que esperaban a este PR (por la rama) ya se pueden enlazar.
      for (const e of Object.values(repo.ejecuciones)) if (!e.vinculo?.pr) e.vinculo = vinculoDe(repo, e);
      break;
    }
    case 'issue_comment': {
      if (p.action !== 'created') break;
      const n = p.issue.number;
      numero = n;
      url = p.comment.html_url;
      t = p.comment.created_at ?? ahora;
      const v = p.comment.user?.login === BOT ? veredictoDe(p.comment.body) : null;
      if (p.issue.pull_request && v) {
        const pr = (repo.prs[n] ??= { numero: n, titulo: p.issue.title, estado: p.issue.state, url: p.issue.html_url, ci: {}, checks: {}, veredictos: {}, etiquetas: [], revisores: [] });
        pr.veredictos = { ...pr.veredictos, [v.tipo]: { veredicto: v.veredicto, fecha: t, url } };
        vincularRevision(repo, n, t);
        texto = `${v.tipo}: ${v.veredicto ?? 'sin veredicto'} en #${n}`;
      } else if (!p.issue.pull_request) {
        const nota = notaDe(p.comment.body, p.comment.user?.login, nombre.split('/')[0]);
        const issue = repo.issues[n];
        if (nota && issue) {
          const dato = { titulo: nota.titulo, fecha: t, url };
          issue.nota = dato;
          if (nota.plan) issue.plan = dato;
        }
        texto = nota ? (nota.plan ? `plan listo en #${n}: espera tu aprobación` : `${nota.titulo}`) : `comentó en #${n}`;
      } else {
        texto = `comentó en #${n}`;
      }
      break;
    }
    case 'pull_request_review': {
      if (p.action !== 'submitted') break;
      const n = p.pull_request.number;
      repo.prs[n] = prDesdeApi(p.pull_request, repo.prs[n]);
      const st = p.review.state?.toLowerCase();
      if (st === 'approved' && p.review.commit_id === repo.prs[n].sha) repo.prs[n].aprobado = true;
      numero = n;
      url = p.review.html_url;
      texto = `${RESENAS[st] ?? 'revisó'} #${n}`;
      break;
    }
    case 'workflow_run': {
      const r = p.workflow_run;
      const e = (repo.ejecuciones[r.id] = ejecucionDesdeApi(r, repo.ejecuciones[r.id]));
      e.vinculo = vinculoDe(repo, e);
      numero = e.vinculo?.pr ?? e.vinculo?.issue ?? null;
      url = r.html_url;
      const quien = e.agente === 'otro' ? e.workflow : e.agente;
      if (p.action === 'requested') texto = `${quien}: ${e.workflow} en cola`;
      else if (p.action === 'in_progress') texto = `${quien}: ${e.workflow} en marcha`;
      else if (p.action === 'completed') texto = `${quien}: ${e.workflow} terminó (${resultado(e.conclusion)})`;
      break;
    }
    case 'workflow_job': {
      const j = p.workflow_job;
      const e = (repo.ejecuciones[j.run_id] ??= {
        id: j.run_id, workflow: j.workflow_name, agente: agenteDeWorkflow(j.workflow_name), titulo: null, evento: null,
        estado: 'in_progress', conclusion: null, rama: j.head_branch, actor: null, url: j.run_url?.replace('api.github.com/repos', 'github.com') ?? null,
        inicio: j.started_at ?? j.created_at, actualizado: ahora, intento: j.run_attempt ?? 1, prs: [], vinculo: null, jobs: {},
      });
      const job = jobDesdeApi(j, e.workflow ?? j.workflow_name);
      e.jobs[j.id] = job;
      if (j.status === 'in_progress' && e.estado !== 'completed') e.estado = 'in_progress';
      e.vinculo = vinculoDe(repo, e);
      numero = e.vinculo?.pr ?? e.vinculo?.issue ?? null;
      url = j.html_url;
      const relevante = job.agente !== 'sistema' || job.conclusion === 'failure';
      if (relevante && p.action === 'in_progress') texto = `${job.agente}: job ${job.nombre} en marcha`;
      if (relevante && p.action === 'completed') texto = `${job.agente}: job ${job.nombre} ${resultado(job.conclusion)}`;
      break;
    }
    case 'status': {
      for (const pr of Object.values(repo.prs)) {
        if (pr.sha !== p.sha) continue;
        pr.ci = { ...pr.ci, [p.context]: { estado: p.state, url: p.target_url ?? null, descripcion: p.description ?? null } };
        numero = pr.numero;
      }
      url = p.target_url ?? null;
      if (p.state !== 'pending') texto = `${p.context}: ${p.state}${numero ? ` en #${numero}` : ''}`;
      break;
    }
    case 'check_run': {
      const c = p.check_run;
      for (const pr of Object.values(repo.prs)) {
        if (pr.sha !== c.head_sha) continue;
        pr.checks = { ...pr.checks, [c.name]: c.conclusion ?? c.status };
      }
      break;
    }
    default:
      return false;
  }
  if (texto) anadirEvento(estado, { t, repo: nombre, tipo, actor, texto, numero, url });
  return true;
}

// ------------------------------------------------------------------ conciliación con la API

const clave = (x) => JSON.stringify(x);
const resumenIssue = (i) => [i.titulo, i.estado, i.etiquetas];
const resumenPr = (p) => [p.titulo, p.estado, p.borrador, p.sha, p.etiquetas, p.revisores];

/**
 * Aplica una lectura completa de un repo y cuenta lo que no coincidía (webhooks perdidos).
 * `lectura`: { issues: [api], prs: [api], ejecuciones: [api], detalles: { [pr]: { estados:[], checks:[], comentarios:[] } },
 *              completa: true si issues y prs son TODOS los abiertos del repo (solo entonces se cierran los que faltan),
 *              comentariosIssues: { [issue]: [api] } para sacar el plan y la última nota de agente,
 *              contar: false si es una lectura puntual (abrir un PR), que no indica webhooks perdidos }
 * Devuelve { correcciones, pendientes } (ids de ejecuciones que el estado cree en curso y GitHub ya no lista).
 */
export function aplicarLectura(estado, nombre, lectura, ahora = new Date().toISOString()) {
  const repo = repoDe(estado, nombre);
  let correcciones = 0;

  const abiertas = new Set();
  for (const i of lectura.issues ?? []) {
    if (i.pull_request) continue;
    const viejo = repo.issues[i.number];
    const nuevo = issueDesdeApi(i, viejo);
    abiertas.add(nuevo.numero);
    const notas = lectura.comentariosIssues?.[i.number];
    if (notas) Object.assign(nuevo, notasDeComentarios(notas, nombre.split('/')[0]));
    if (viejo && clave(resumenIssue(viejo)) !== clave(resumenIssue(nuevo))) correcciones++;
    if (!viejo && Object.keys(repo.issues).length && estado.ultimaConciliacion) correcciones++;
    repo.issues[nuevo.numero] = nuevo;
  }
  if (lectura.completa) for (const i of Object.values(repo.issues)) {
    if (i.estado === 'open' && !abiertas.has(i.numero)) { i.estado = 'closed'; i.actualizado = ahora; correcciones++; }
  }

  const abiertos = new Set();
  for (const p of lectura.prs ?? []) {
    const previo = repo.prs[p.number];
    const nuevo = prDesdeApi(p, previo);
    abiertos.add(nuevo.numero);
    if (previo?.sha && clave(resumenPr(previo)) !== clave(resumenPr(nuevo))) correcciones++;
    const d = lectura.detalles?.[p.number];
    if (d) {
      nuevo.ci = Object.fromEntries((d.estados ?? []).map((s) => [s.context, { estado: s.state, url: s.target_url ?? null, descripcion: s.description ?? null }]));
      nuevo.checks = Object.fromEntries((d.checks ?? []).map((c) => [c.name, c.conclusion ?? c.status]));
      const veredictos = { ...nuevo.veredictos };
      for (const c of d.comentarios ?? []) {
        const v = c.user?.login === BOT ? veredictoDe(c.body) : null;
        if (v && (!veredictos[v.tipo] || veredictos[v.tipo].fecha <= c.created_at)) {
          veredictos[v.tipo] = { veredicto: v.veredicto, fecha: c.created_at, url: c.html_url };
        }
      }
      nuevo.veredictos = veredictos;
      if (d.resenas) nuevo.aprobado = d.resenas.some((r) => r.state === 'APPROVED' && r.commit_id === nuevo.sha);
    }
    repo.prs[nuevo.numero] = nuevo;
  }
  if (lectura.completa) for (const p of Object.values(repo.prs)) {
    if (p.estado === 'open' && !abiertos.has(p.numero)) { p.estado = 'closed'; p.actualizado = ahora; correcciones++; }
  }

  const listadas = new Set();
  for (const r of lectura.ejecuciones ?? []) {
    const previo = repo.ejecuciones[r.id];
    if (previo && previo.estado !== r.status) correcciones++;
    const e = (repo.ejecuciones[r.id] = ejecucionDesdeApi(r, previo));
    e.vinculo = vinculoDe(repo, e);
    listadas.add(e.id);
  }
  const pendientes = Object.values(repo.ejecuciones)
    .filter((e) => e.estado !== 'completed' && !listadas.has(e.id))
    .map((e) => e.id);

  if (lectura.contar === false) correcciones = 0;
  estado.correcciones = (estado.correcciones ?? 0) + correcciones;
  return { correcciones, pendientes };
}

/** Jobs leídos de la API para una ejecución (consulta de pasos mientras corre). */
export function aplicarJobs(estado, nombre, idEjecucion, jobs) {
  const repo = repoDe(estado, nombre);
  const e = repo.ejecuciones[idEjecucion];
  if (!e) return false;
  const antes = clave(e.jobs);
  for (const j of jobs) e.jobs[j.id] = jobDesdeApi(j, e.workflow);
  return clave(e.jobs) !== antes;
}

export function enCurso(estado) {
  const salida = [];
  for (const [nombre, repo] of Object.entries(estado.repos)) {
    for (const e of Object.values(repo.ejecuciones)) if (e.estado !== 'completed') salida.push({ repo: nombre, id: e.id });
  }
  return salida;
}

/** Quita lo cerrado hace más de un día y limita las ejecuciones por repo. */
export function podar(estado, ahora = Date.now()) {
  for (const repo of Object.values(estado.repos)) {
    for (const [n, i] of Object.entries(repo.issues)) if (i.estado !== 'open' && ahora - Date.parse(i.actualizado ?? 0) > DIA) delete repo.issues[n];
    for (const [n, p] of Object.entries(repo.prs)) if (p.estado !== 'open' && ahora - Date.parse(p.actualizado ?? 0) > DIA) delete repo.prs[n];
    const terminadas = Object.values(repo.ejecuciones)
      .filter((e) => e.estado === 'completed')
      .sort((a, b) => (b.actualizado ?? '').localeCompare(a.actualizado ?? ''));
    terminadas.forEach((e, i) => {
      if (i >= MAX_EJECUCIONES || ahora - Date.parse(e.actualizado ?? 0) > DIA) delete repo.ejecuciones[e.id];
    });
  }
}
