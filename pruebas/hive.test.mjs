// Pruebas de Hive, el panel en vivo (ADR 0015, ampliación del 23-11-2026): vistas derivadas del estado
// (panel/public/js/datos.js) y acciones nuevas sobre GitHub (panel/src/acciones.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarLectura, aplicarWebhook, estadoVacio, podar } from '../panel/src/estado.js';
import { GitHub, traducir } from '../panel/src/github.js';
import * as datos from '../panel/public/js/datos.js';
import * as acciones from '../panel/src/acciones.js';

const R = 'AlvaroM99/lobby';
const repo = { full_name: R };
const SHA = 'a'.repeat(40);
const AHORA = '2026-11-23T18:00:00Z';
const issue = (n, titulo, etiquetas = []) => ({
  number: n, title: titulo, state: 'open', labels: etiquetas.map((name) => ({ name })), user: { login: 'AlvaroM99' },
  html_url: `https://github.com/${R}/issues/${n}`, updated_at: AHORA,
});
const pr = (n, rama, extra = {}) => ({
  number: n, title: `PR ${n}`, state: 'open', draft: false, head: { ref: rama, sha: SHA }, base: { ref: 'main' },
  user: { login: 'github-actions[bot]' }, labels: [], requested_reviewers: [], html_url: `https://github.com/${R}/pull/${n}`, updated_at: AHORA, ...extra,
});
const run = (id, name, extra = {}) => ({
  id, name, display_title: 'x', event: 'issues', status: 'in_progress', conclusion: null, head_branch: 'main', actor: { login: 'AlvaroM99' },
  html_url: `https://github.com/${R}/actions/runs/${id}`, run_started_at: '2026-11-23T16:00:00Z', updated_at: AHORA, pull_requests: [], ...extra,
});

function estadoHive() {
  const e = estadoVacio();
  aplicarWebhook(e, 'issues', { action: 'opened', issue: issue(32, 'Atajos'), repository: repo }, AHORA);
  aplicarWebhook(e, 'issue_comment', { action: 'created', repository: repo, issue: { number: 32 }, comment: { user: { login: 'github-actions[bot]' }, body: '## Plan de Enjambre · #32', created_at: AHORA, html_url: 'p' } }, AHORA);
  aplicarWebhook(e, 'pull_request', { action: 'opened', pull_request: pr(40, 'enjambre/30-csv'), repository: repo }, AHORA);
  aplicarWebhook(e, 'status', { sha: SHA, context: 'ci (Enjambre)', state: 'success', repository: repo }, AHORA);
  aplicarWebhook(e, 'issue_comment', { action: 'created', repository: repo, issue: { number: 40, pull_request: {} }, comment: { user: { login: 'github-actions[bot]' }, body: '## Revisión de Enjambre\n**Veredicto:** APROBAR', created_at: AHORA } }, AHORA);
  aplicarWebhook(e, 'workflow_run', { action: 'completed', workflow_run: run(900, 'enjambre-implementar', { status: 'completed', conclusion: 'failure', updated_at: '2026-11-23T17:00:00Z', display_title: 'Otra' }), repository: repo }, AHORA);
  aplicarWebhook(e, 'workflow_run', { action: 'in_progress', workflow_run: run(901, 'enjambre-planificar', { display_title: 'Atajos' }), repository: repo }, AHORA);
  return e;
}
const ahora = Date.parse(AHORA);

test('Hive: la bandeja reúne lo que espera de Álvaro (PR para revisar, fallo) y no pide aprobar un plan a medias', () => {
  const e = estadoHive();
  const tipos = datos.bandeja(e, { ahora }).map((x) => x.tipo);
  assert.ok(tipos.includes('revisar-pr'), 'PR con APROBAR y CI verde');
  assert.ok(!tipos.includes('aprobar-plan'), 'el jefe sigue trabajando en #32');
  assert.ok(!tipos.includes('fallo'), 'el fallo es sobre una issue que no está abierta: no cuenta');
  const r = datos.resumen(e, { ahora });
  assert.equal(r.agentes, 1);
  assert.equal(r.paraTi, 1);
});

test('Hive: con el plan publicado y nadie trabajando, pide aprobarlo; un PR aprobado y verde va primero', () => {
  const e = estadoHive();
  aplicarWebhook(e, 'workflow_run', { action: 'completed', workflow_run: run(901, 'enjambre-planificar', { status: 'completed', conclusion: 'success', display_title: 'Atajos' }), repository: repo }, AHORA);
  e.repos[R].prs[40].aprobado = true;
  const tipos = datos.bandeja(e, { ahora }).map((x) => x.tipo);
  assert.equal(tipos[0], 'fusionar');
  assert.ok(tipos.includes('aprobar-plan'));
});

test('Hive: un fallo deja de contar si después el mismo workflow fue bien sobre lo mismo', () => {
  const e = estadoHive();
  aplicarWebhook(e, 'workflow_run', { action: 'completed', workflow_run: run(902, 'enjambre-implementar', { status: 'completed', conclusion: 'success', display_title: 'Otra', run_started_at: '2026-11-23T17:30:00Z' }), repository: repo }, AHORA);
  assert.equal(datos.bandeja(e, { ahora }).some((x) => x.tipo === 'fallo'), false);
});

test('Hive: tablero con búsqueda, rendimiento por agente y estado de la CI', () => {
  const e = estadoHive();
  assert.equal(datos.tablero(e, { busqueda: 'atajos' }).planificar.length, 1);
  assert.equal(datos.tablero(e, { busqueda: 'nada' }).planificar.length, 0);
  assert.deepEqual(datos.porAgente(e, { ahora }).map((x) => [x.agente, x.total, x.fallos]), [['implementador', 1, 1]]);
  assert.equal(datos.estadoCi({ checks: { a: 'success', b: 'skipped' } }), 'success');
  assert.equal(datos.estadoCi({ ci: { 'ci (Enjambre)': { estado: 'error' } } }), 'failure');
  assert.equal(datos.estadoCi({}), null);
});

function ghAcciones(rutas = {}) {
  const respuestas = { 'GET /repos/AlvaroM99/lobby/labels': [{ name: 'enjambre:planificar' }, { name: 'bug' }], ...rutas };
  return {
    llamadas: [],
    async pedir(metodo, ruta, cuerpo) { this.llamadas.push({ metodo, ruta, cuerpo }); return respuestas[`${metodo} ${ruta.split('?')[0]}`] ?? {}; },
    get(r) { return this.pedir('GET', r); },
    post(r, c) { return this.pedir('POST', r, c); },
    put(r, c) { return this.pedir('PUT', r, c); },
    patch(r, c) { return this.pedir('PATCH', r, c); },
    delete(r) { return this.pedir('DELETE', r); },
    async graphql(consulta, variables) { this.llamadas.push({ metodo: 'GRAPHQL', cuerpo: variables }); return {}; },
    async texto() { return '2026-11-23T10:00:00.1234567Z \u001b[36;1mhola\u001b[0m\n\n2026-11-23T10:00:01Z adiós'; },
  };
}

test('acciones: crear issue con «planificar» pone la etiqueta aparte, para que salte el evento', async () => {
  const gh = ghAcciones({ 'POST /repos/AlvaroM99/lobby/issues': { number: 50, html_url: 'u' } });
  const [estado, cuerpo] = await acciones.crearIssue(gh, R, { titulo: '  Nueva cosa ', cuerpo: 'x', etiquetas: ['bug'], planificar: true });
  assert.equal(estado, 200);
  assert.equal(cuerpo.numero, 50);
  assert.deepEqual(gh.llamadas.filter((l) => l.metodo === 'POST').map((l) => [l.ruta, l.cuerpo]), [
    ['/repos/AlvaroM99/lobby/issues', { title: 'Nueva cosa', body: 'x', labels: ['bug'] }],
    ['/repos/AlvaroM99/lobby/issues/50/labels', { labels: ['enjambre:planificar'] }],
  ]);
  assert.equal((await acciones.crearIssue(ghAcciones(), R, { titulo: '' }))[0], 400);
  assert.equal((await acciones.crearIssue(ghAcciones(), R, { titulo: 'x', etiquetas: ['inventada'] }))[0], 400);
  assert.equal((await acciones.crearIssue(ghAcciones(), R, { titulo: 'x', etiquetas: ['enjambre:en-curso'] }))[0], 400);
});

test('acciones: reseñas sobre el commit visto; pedir cambios exige texto', async () => {
  const gh = ghAcciones();
  assert.equal((await acciones.resena(gh, R, { numero: 40, sha: SHA, evento: 'cambios', comentario: '' }))[0], 400);
  assert.equal((await acciones.resena(gh, R, { numero: 40, sha: 'corto', evento: 'aprobar' }))[0], 400);
  assert.equal((await acciones.resena(gh, R, { numero: 40, sha: SHA, evento: 'otro' }))[0], 400);
  assert.equal((await acciones.resena(gh, R, { numero: 40, sha: SHA, evento: 'cambios', comentario: 'Falta X' }))[0], 200);
  assert.deepEqual(gh.llamadas.at(-1).cuerpo, { event: 'REQUEST_CHANGES', commit_id: SHA, body: 'Falta X' });
});

test('acciones: borrar la rama solo tras cerrar el PR, nunca main ni ramas de otro repo', async () => {
  const conPr = (extra) => ghAcciones({ 'GET /repos/AlvaroM99/lobby/pulls/40': { state: 'closed', head: { ref: 'enjambre/30-csv', repo: { full_name: R } }, base: { repo: { default_branch: 'main' } }, ...extra } });
  const gh = conPr({});
  assert.equal((await acciones.borrarRama(gh, R, { numero: 40 }))[0], 200);
  assert.equal(gh.llamadas.at(-1).ruta, '/repos/AlvaroM99/lobby/git/refs/heads/enjambre/30-csv');
  assert.equal((await acciones.borrarRama(conPr({ state: 'open' }), R, { numero: 40 }))[0], 409);
  assert.equal((await acciones.borrarRama(conPr({ head: { ref: 'main', repo: { full_name: R } } }), R, { numero: 40 }))[0], 409);
  assert.equal((await acciones.borrarRama(conPr({ head: { ref: 'x', repo: { full_name: 'otro/fork' } } }), R, { numero: 40 }))[0], 409);
});

test('acciones: marcar listo usa GraphQL solo si es borrador', async () => {
  const borrador = ghAcciones({ 'GET /repos/AlvaroM99/lobby/pulls/40': { draft: true, node_id: 'PR_x' } });
  await acciones.marcarListo(borrador, R, { numero: 40 });
  assert.deepEqual(borrador.llamadas.at(-1), { metodo: 'GRAPHQL', cuerpo: { id: 'PR_x' } });
  const listo = ghAcciones({ 'GET /repos/AlvaroM99/lobby/pulls/40': { draft: false } });
  assert.equal((await acciones.marcarListo(listo, R, { numero: 40 }))[1].yaEstaba, true);
});

test('acciones: ejecuciones, investigador, cerrar issue y registro sin colores ni horas', async () => {
  const gh = ghAcciones({ 'GET /repos/AlvaroM99/lobby': { default_branch: 'main' } });
  assert.equal((await acciones.ejecucion(gh, R, { id: 45232925905, accion: 'reintentar-fallidos' }))[0], 200);
  assert.equal(gh.llamadas.at(-1).ruta, '/repos/AlvaroM99/lobby/actions/runs/45232925905/rerun-failed-jobs');
  assert.equal((await acciones.ejecucion(gh, R, { id: 900, accion: 'borrar' }))[0], 400);
  await acciones.investigar(gh, R, { alcance: 'src/' });
  assert.deepEqual(gh.llamadas.at(-1), { metodo: 'POST', ruta: '/repos/AlvaroM99/lobby/actions/workflows/enjambre-investigar.yml/dispatches', cuerpo: { ref: 'main', inputs: { alcance: 'src/' } } });
  await acciones.estadoIssue(gh, R, { numero: 9, estado: 'cerrar', motivo: 'descartada' });
  assert.deepEqual(gh.llamadas.at(-1).cuerpo, { state: 'closed', state_reason: 'not_planned' });
  assert.deepEqual((await acciones.registro(gh, R, { job: 137896975655 }))[1].lineas, ['hola', 'adiós']);
});

test('github: los 403 de permisos de la app se explican y el registro no manda el token al almacén', async () => {
  assert.match(traducir(403, 'Resource not accessible by integration'), /Actions: Read and write/);
  const vistas = [];
  const f = async (url, init = {}) => {
    vistas.push({ url, auth: init.headers?.authorization ?? null });
    if (url.startsWith('http://api')) return new Response(null, { status: 302, headers: { location: 'https://almacen.example/log?firma=x' } });
    return new Response('linea 1\nlinea 2');
  };
  const gh = new GitHub({ token: 'ghu_x', api: 'http://api', fetch: f });
  assert.equal(await gh.texto('/repos/a/b/actions/jobs/1/logs'), 'linea 1\nlinea 2');
  assert.equal(vistas[0].auth, 'Bearer ghu_x');
  assert.equal(vistas[1].auth, null);
});

test('Hive: las ejecuciones «omitidas» (workflows que no tocaban) no cuentan como trabajo de agentes', () => {
  const e = estadoHive();
  aplicarWebhook(e, 'workflow_run', { action: 'completed', workflow_run: run(903, 'enjambre-analizar', { status: 'completed', conclusion: 'skipped', display_title: 'Atajos' }), repository: repo }, AHORA);
  assert.equal(datos.porAgente(e, { ahora }).some((x) => x.agente === 'analista'), false);
  assert.equal(datos.ejecuciones(e, { ahora }).some((x) => x.ejecucion.id === 903), false);
  assert.equal(datos.ejecuciones(e, { ahora, incluirOmitidas: true }).some((x) => x.ejecucion.id === 903), true);
  assert.equal(datos.terminadas(e, 'todos', ahora).some((x) => x.ejecucion.id === 903), false);
});

test('CI: cuenta el último intento de cada check y no se fía del «pending» de GitHub sin estados (finance_tracker#25)', async () => {
  const { estadoGlobalCi, ultimosChecks } = await import('../panel/src/estado.js');
  const checks = [
    { name: 'rust', conclusion: 'cancelled', started_at: '2026-11-23T17:53:31Z' },
    { name: 'rust', conclusion: 'success', started_at: '2026-11-23T17:55:48Z' },
    { name: 'estado-en-el-pr', conclusion: 'skipped', started_at: '2026-11-23T17:55:48Z' },
  ];
  assert.deepEqual(ultimosChecks(checks).map((c) => c.conclusion).sort(), ['skipped', 'success']);
  assert.equal(estadoGlobalCi([], checks), 'success');
  assert.equal(estadoGlobalCi([{ state: 'pending' }], checks), 'pending');
  assert.equal(estadoGlobalCi([{ state: 'success' }], [{ name: 'x', conclusion: 'failure' }]), 'failure');
  assert.equal(estadoGlobalCi([], []), null);
});

test('orden de los avisos: un «completed/skipped» que llega antes que su «requested» no deja la ejecución en marcha (finance_tracker#17)', () => {
  const e = estadoVacio();
  const base = { display_title: 'Informe QA', run_started_at: '2026-11-23T19:29:20Z' };
  aplicarWebhook(e, 'workflow_run', { action: 'completed', workflow_run: run(45249452072, 'enjambre-analizar', { ...base, status: 'completed', conclusion: 'skipped', updated_at: '2026-11-23T19:29:22Z' }), repository: repo }, AHORA);
  podar(e, ahora);
  aplicarWebhook(e, 'workflow_run', { action: 'requested', workflow_run: run(45249452072, 'enjambre-analizar', { ...base, status: 'queued', updated_at: '2026-11-23T19:29:20Z' }), repository: repo }, AHORA);
  aplicarWebhook(e, 'workflow_job', { action: 'queued', workflow_job: { id: 1, run_id: 45249452072, name: 'analizar', workflow_name: 'enjambre-analizar', status: 'queued', steps: [] }, repository: repo }, AHORA);
  assert.equal(datos.agentesActivos(e).length, 0);
});

test('orden de los avisos: una ejecución terminada no vuelve a «en marcha», salvo que sea un reintento', () => {
  const e = estadoVacio();
  aplicarWebhook(e, 'workflow_run', { action: 'completed', workflow_run: run(7, 'enjambre-planificar', { status: 'completed', conclusion: 'success', updated_at: '2026-11-23T19:40:00Z' }), repository: repo }, AHORA);
  aplicarWebhook(e, 'workflow_run', { action: 'in_progress', workflow_run: run(7, 'enjambre-planificar', { status: 'in_progress', updated_at: '2026-11-23T19:35:00Z' }), repository: repo }, AHORA);
  assert.equal(e.repos[R].ejecuciones[7].estado, 'completed');
  aplicarWebhook(e, 'workflow_run', { action: 'requested', workflow_run: run(7, 'enjambre-planificar', { status: 'queued', run_attempt: 2, updated_at: '2026-11-23T19:45:00Z' }), repository: repo }, AHORA);
  assert.equal(e.repos[R].ejecuciones[7].estado, 'queued');
});

test('conciliación: una «skipped» que un aviso desordenado dejó en marcha se quita al leer la API', () => {
  const e = estadoVacio();
  aplicarWebhook(e, 'workflow_run', { action: 'requested', workflow_run: run(8, 'enjambre-implementar', { status: 'queued' }), repository: repo }, AHORA);
  assert.equal(datos.agentesActivos(e).length, 1);
  aplicarLectura(e, R, { ejecuciones: [run(8, 'enjambre-implementar', { status: 'completed', conclusion: 'skipped' })] });
  assert.equal(datos.agentesActivos(e).length, 0);
});

test('bandeja: un fallo sobre una issue cerrada o sin objetivo conocido no pide nada', () => {
  const e = estadoHive();
  // run 900 falló sobre «Otra», que no está abierta: ya no cuenta.
  assert.equal(datos.bandeja(e, { ahora }).some((x) => x.tipo === 'fallo'), false);
  aplicarWebhook(e, 'issues', { action: 'opened', issue: issue(55, 'Otra'), repository: repo }, AHORA);
  aplicarWebhook(e, 'workflow_run', { action: 'completed', workflow_run: run(900, 'enjambre-implementar', { status: 'completed', conclusion: 'failure', updated_at: '2026-11-23T17:00:00Z', display_title: 'Otra' }), repository: repo }, AHORA);
  assert.equal(datos.bandeja(e, { ahora }).some((x) => x.tipo === 'fallo'), true, 'con la issue abierta, sí');
});
