// F4, historia S60: extrae de GitHub lo necesario para medir Enjambre en un proyecto.
// - Issues: cuándo se crearon y cerraron, y las etiquetas que puso el propietario.
// - PR de agentes (ramas enjambre/<issue>-…).
// - Veredictos del revisor y de seguridad.
// - Ejecuciones de los workflows de agentes, con turnos, coste y permisos denegados de su transcripción mientras
//   exista: el artefacto dura 7 días (ADR 0012).
// Sin contenido de los repos: solo números, fechas, identificadores y nombres de agente. Los títulos se usan para
// enlazar ejecuciones con issues y PR, y no se guardan.
// Usa la CLI `gh` con la sesión de quien lo ejecuta (lectura). Plan: docs/fases/F4-datos-y-bi.md.
//
// Uso: node herramientas/extraer.mjs --repo AlvaroM99/lobby [--repo AlvaroM99/finance_tracker] [--desde AAAA-MM-DD]
//                                    [--salida .metricas] [--sin-transcripciones]
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BOT = 'github-actions[bot]';
const TITULOS = { 'Revisión de Enjambre': 'revisor', 'Revisión de seguridad de Enjambre': 'seguridad' };

/** Número de issue de una rama de agente: enjambre/12-slug o enjambre/issue-12-slug. */
export function issueDeRama(rama) {
  // Con sufijo de carril (enjambre/16a-…), como en finance_tracker#16.
  const m = /^enjambre\/(?:issue-)?(\d+)[a-z]?-/.exec(rama ?? '');
  return m ? Number(m[1]) : null;
}

/** Tipo y veredicto de un comentario del bot, o null si no es una revisión de Enjambre. */
export function veredictoDe(cuerpo) {
  const titulo = /^## ([^\n]+)/.exec(cuerpo ?? '')?.[1]?.trim();
  const tipo = TITULOS[titulo];
  if (!tipo) return null;
  const v = [...cuerpo.matchAll(/\*\*Veredicto:\*\*\s*([A-ZÁÉÍÓÚ]+)/g)].pop()?.[1] ?? null;
  return { tipo, veredicto: v };
}

/** Resumen numérico de una transcripción de claude-code-action (lista de mensajes; el último «result» manda). */
export function resumenTranscripcion(mensajes) {
  const r = (Array.isArray(mensajes) ? mensajes : []).filter((m) => m?.type === 'result').pop();
  if (!r) return null;
  return {
    turnos: r.num_turns ?? null,
    coste_usd: typeof r.total_cost_usd === 'number' ? Math.round(r.total_cost_usd * 10000) / 10000 : null,
    duracion_ms: r.duration_ms ?? null,
    permisos_denegados: Array.isArray(r.permission_denials) ? r.permission_denials.length : null,
    error: r.is_error === true,
  };
}

/** Issue sin contenido: fechas y etiquetas que puso el propietario (de su línea de tiempo). */
export function normalizarIssue(issue, eventos, propietario) {
  const etiquetas = eventos
    .filter((e) => e.event === 'labeled' && e.actor?.login === propietario)
    .map((e) => ({ etiqueta: e.label?.name, fecha: e.created_at }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  return {
    numero: issue.number,
    creado: issue.created_at,
    cerrado: issue.closed_at ?? null,
    autor: issue.user?.login === propietario ? 'propietario' : issue.user?.login === BOT ? 'bot' : 'otro',
    etiquetas_propietario: etiquetas,
    inicio: etiquetas[0]?.fecha ?? null,
  };
}

export function normalizarPr(pr, propietario) {
  return {
    numero: pr.number,
    issue: issueDeRama(pr.head?.ref),
    autor: pr.user?.login === propietario ? 'propietario' : /\[bot\]$|^app\//.test(pr.user?.login ?? '') ? 'bot' : 'otro',
    creado: pr.created_at,
    fusionado: pr.merged_at ?? null,
    cerrado: pr.closed_at ?? null,
  };
}

/** Enlaza una ejecución con su issue o PR por el título mostrado, sin guardar el título. */
export function normalizarEjecucion(run, titulosIssues, titulosPr) {
  const issue = run.event === 'issues' ? titulosIssues.get(run.display_title) ?? null : null;
  const pr = run.event === 'pull_request' ? titulosPr.get(run.display_title) ?? null : null;
  return {
    id: run.id,
    workflow: run.name,
    evento: run.event,
    actor: run.actor?.login ?? null,
    inicio: run.run_started_at ?? run.created_at,
    fin: run.updated_at,
    resultado: run.conclusion ?? run.status,
    issue,
    pr,
    agentes: [],
  };
}

/**
 * Las revisiones lanzadas con workflow_dispatch (ADR 0014) no llevan el título del PR. Se enlazan con el PR del
 * veredicto que el bot publicó mientras duraba la ejecución.
 */
export function enlazarRevisiones(ejecuciones, veredictos) {
  for (const e of ejecuciones) {
    if (e.pr !== null || e.issue !== null || e.workflow !== 'enjambre-revisar') continue;
    const v = veredictos.find((x) => x.fecha >= e.inicio && x.fecha <= e.fin);
    if (v) e.pr = v.pr;
  }
  return ejecuciones;
}

// ---------------------------------------------------------------- acceso a GitHub (gh)

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const lista = (ruta) => gh(['api', '--paginate', ruta, '--jq', '.[] | @json']).split('\n').filter(Boolean).map((l) => JSON.parse(l));
const listaDe = (ruta, campo) => gh(['api', '--paginate', ruta, '--jq', `.${campo}[] | @json`]).split('\n').filter(Boolean).map((l) => JSON.parse(l));

function transcripciones(repo, run) {
  const nombres = listaDe(`repos/${repo}/actions/runs/${run}/artifacts?per_page=100`, 'artifacts')
    .filter((a) => a.name.startsWith('transcripcion-') && !a.expired).map((a) => a.name);
  const salida = [];
  for (const nombre of nombres) {
    const dir = mkdtempSync(join(tmpdir(), 'enjambre-transcripcion-'));
    try {
      gh(['run', 'download', String(run), '-R', repo, '-n', nombre, '-D', dir]);
      for (const f of readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith('.json'))) {
        const r = resumenTranscripcion(JSON.parse(readFileSync(join(dir, f), 'utf8')));
        if (r) salida.push({ agente: nombre.replace(/^transcripcion-/, ''), ...r });
      }
    } catch (e) {
      salida.push({ agente: nombre.replace(/^transcripcion-/, ''), error_descarga: String(e.message).split('\n')[0] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  return salida;
}

export function extraerRepo(repo, { desde, conTranscripciones = true } = {}) {
  const propietario = repo.split('/')[0];
  const crudos = lista(`repos/${repo}/issues?state=all&per_page=100&since=${desde}T00:00:00Z`);
  const issuesCrudos = crudos.filter((i) => !i.pull_request);
  const issues = issuesCrudos.map((i) => normalizarIssue(i, lista(`repos/${repo}/issues/${i.number}/timeline?per_page=100`), propietario));
  const prsCrudos = lista(`repos/${repo}/pulls?state=all&per_page=100`).filter((p) => p.created_at >= desde);
  const prs = prsCrudos.map((p) => normalizarPr(p, propietario));
  const veredictos = [];
  for (const pr of prs.filter((p) => p.issue !== null)) {
    for (const c of lista(`repos/${repo}/issues/${pr.numero}/comments?per_page=100`)) {
      if (c.user?.login !== BOT) continue;
      const v = veredictoDe(c.body);
      if (v) veredictos.push({ pr: pr.numero, ...v, fecha: c.created_at });
    }
  }
  const titulosIssues = new Map(issuesCrudos.map((i) => [i.title, i.number]));
  const titulosPr = new Map(prsCrudos.map((p) => [p.title, p.number]));
  const ejecuciones = listaDe(`repos/${repo}/actions/runs?per_page=100&created=>=${desde}`, 'workflow_runs')
    .filter((r) => r.name?.startsWith('enjambre-'))
    .map((r) => normalizarEjecucion(r, titulosIssues, titulosPr));
  enlazarRevisiones(ejecuciones, veredictos);
  if (conTranscripciones) for (const e of ejecuciones) e.agentes = transcripciones(repo, e.id);
  return { repo, extraido: new Date().toISOString(), desde, issues, prs, veredictos, ejecuciones };
}

function argumentos(argv) {
  const o = { repos: [], desde: '2026-11-01', salida: '.metricas', conTranscripciones: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--repo') o.repos.push(argv[++i]);
    else if (argv[i] === '--desde') o.desde = argv[++i];
    else if (argv[i] === '--salida') o.salida = argv[++i];
    else if (argv[i] === '--sin-transcripciones') o.conTranscripciones = false;
    else throw new Error(`Argumento desconocido: ${argv[i]}`);
  }
  if (!o.repos.length) throw new Error('Falta --repo dueño/nombre');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.desde)) throw new Error('--desde debe ser AAAA-MM-DD');
  for (const r of o.repos) if (!/^[\w.-]+\/[\w.-]+$/.test(r)) throw new Error(`Repo no válido: ${r}`);
  return o;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const o = argumentos(process.argv.slice(2));
    mkdirSync(o.salida, { recursive: true });
    for (const repo of o.repos) {
      const datos = extraerRepo(repo, o);
      const fichero = join(o.salida, `${repo.replace('/', '__')}.json`);
      writeFileSync(fichero, JSON.stringify(datos, null, 2) + '\n');
      console.log(`${repo}: ${datos.issues.length} issues, ${datos.prs.length} PR, ${datos.veredictos.length} veredictos, ${datos.ejecuciones.length} ejecuciones → ${fichero}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
