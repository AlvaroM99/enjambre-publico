// Pruebas del panel en vivo (ADR 0015): reductor de estado, firma, sesión y la Sala con un GitHub simulado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agenteDe, aplicarJobs, aplicarLectura, aplicarWebhook, enCurso, estadoVacio, podar, vinculoDe,
} from '../panel/src/estado.js';
import { bases, firmaValida, firmar, GitHub, repoValido } from '../panel/src/github.js';
import { cifrar, cookie, descifrar, esPropietario, importarClave, leerCookies, mismoOrigen } from '../panel/src/sesion.js';
import { Sala } from '../panel/src/sala.js';
import { conCabeceras, CSP } from '../panel/src/cabeceras.js';

const R = 'AlvaroM99/lobby';
const repo = { full_name: R };
const SHA = 'a'.repeat(40);
const SHA2 = 'b'.repeat(40);
const issue = (n, titulo, etiquetas = [], estado = 'open') => ({
  number: n, title: titulo, state: estado, labels: etiquetas.map((name) => ({ name })), user: { login: 'AlvaroM99' },
  html_url: `https://github.com/${R}/issues/${n}`, updated_at: '2026-11-23T10:00:00Z',
});
const pr = (n, rama, sha = SHA, extra = {}) => ({
  number: n, title: `PR ${n}`, state: 'open', draft: true, head: { ref: rama, sha }, base: { ref: 'main' },
  user: { login: 'github-actions[bot]' }, labels: [], requested_reviewers: [], html_url: `https://github.com/${R}/pull/${n}`,
  updated_at: '2026-11-23T10:00:00Z', ...extra,
});
const run = (id, name, extra = {}) => ({
  id, name, display_title: 'x', event: 'issues', status: 'in_progress', conclusion: null, head_branch: 'main',
  actor: { login: 'AlvaroM99' }, html_url: `https://github.com/${R}/actions/runs/${id}`, run_started_at: '2026-11-23T10:00:00Z',
  updated_at: '2026-11-23T10:00:00Z', pull_requests: [], ...extra,
});

// ------------------------------------------------------------------ reductor

test('agentes: cada job de agente tiene su nombre y los demás son «sistema»', () => {
  assert.equal(agenteDe('enjambre-implementar', 'implementar'), 'implementador');
  assert.equal(agenteDe('enjambre-implementar', 'pedir-revision'), 'sistema');
  assert.equal(agenteDe('enjambre-revisar', 'revisor'), 'revisor');
  assert.equal(agenteDe('enjambre-revisar', 'seguridad'), 'seguridad');
  assert.equal(agenteDe('enjambre-gobernanza', 'auditar'), 'gobernanza');
  assert.equal(agenteDe('ci', 'e2e'), 'ci');
  assert.equal(agenteDe('otro-workflow', 'x'), 'otro');
});

test('webhook de etiqueta: la issue cambia y la cronología lo cuenta', () => {
  const e = estadoVacio();
  aplicarWebhook(e, 'issues', { action: 'labeled', label: { name: 'enjambre:implementar' }, issue: issue(9, 'ADR', ['enjambre:implementar']), repository: repo, sender: { login: 'AlvaroM99' } });
  assert.deepEqual(e.repos[R].issues[9].etiquetas, ['enjambre:implementar']);
  assert.match(e.eventos[0].texto, /puso «enjambre:implementar» en #9/);
  assert.equal(e.eventos[0].actor, 'AlvaroM99');
});

test('una ejecución lanzada por etiqueta se enlaza con su issue por el título', () => {
  const e = estadoVacio();
  aplicarWebhook(e, 'issues', { action: 'labeled', label: { name: 'enjambre:implementar' }, issue: issue(9, 'Registrar ADR'), repository: repo });
  aplicarWebhook(e, 'workflow_run', { action: 'in_progress', workflow_run: run(100, 'enjambre-implementar', { display_title: 'Registrar ADR' }), repository: repo });
  const ej = e.repos[R].ejecuciones[100];
  assert.equal(ej.agente, 'implementador');
  assert.deepEqual(ej.vinculo, { issue: 9, pr: null });
  assert.match(e.eventos[0].texto, /implementador: enjambre-implementar en marcha/);
});

test('jobs y pasos: el paso actual llega con workflow_job y con la consulta de la API', () => {
  const e = estadoVacio();
  aplicarWebhook(e, 'workflow_run', { action: 'in_progress', workflow_run: run(100, 'enjambre-implementar'), repository: repo });
  aplicarWebhook(e, 'workflow_job', {
    action: 'in_progress', repository: repo,
    workflow_job: { id: 7, run_id: 100, name: 'implementar', workflow_name: 'enjambre-implementar', status: 'in_progress', steps: [{ number: 1, name: 'Checkout', status: 'completed', conclusion: 'success' }, { number: 2, name: 'Agente', status: 'in_progress' }] },
  });
  const job = e.repos[R].ejecuciones[100].jobs[7];
  assert.equal(job.agente, 'implementador');
  assert.equal(job.pasos[1].estado, 'in_progress');
  assert.deepEqual(enCurso(e), [{ repo: R, id: 100 }]);
  const cambio = aplicarJobs(e, R, 100, [{ id: 7, name: 'implementar', status: 'in_progress', steps: [{ number: 1, name: 'Checkout', status: 'completed' }, { number: 2, name: 'Agente', status: 'completed' }, { number: 3, name: 'Subir', status: 'in_progress' }] }]);
  assert.equal(cambio, true);
  assert.equal(e.repos[R].ejecuciones[100].jobs[7].pasos.length, 3);
});

test('la CI lanzada en la rama del agente se enlaza con issue y PR', () => {
  const e = estadoVacio();
  aplicarWebhook(e, 'pull_request', { action: 'opened', pull_request: pr(22, 'enjambre/9-adr'), repository: repo });
  aplicarWebhook(e, 'workflow_run', { action: 'requested', workflow_run: run(200, 'ci', { event: 'workflow_dispatch', head_branch: 'enjambre/9-adr' }), repository: repo });
  assert.deepEqual(e.repos[R].ejecuciones[200].vinculo, { issue: 9, pr: 22 });
  assert.equal(e.repos[R].prs[22].issue, 9);
});

test('la revisión por dispatch se enlaza con su PR cuando el bot publica el veredicto', () => {
  const e = estadoVacio();
  aplicarWebhook(e, 'pull_request', { action: 'opened', pull_request: pr(22, 'enjambre/9-adr'), repository: repo });
  aplicarWebhook(e, 'workflow_run', { action: 'in_progress', workflow_run: run(300, 'enjambre-revisar', { event: 'workflow_dispatch', run_started_at: '2026-11-23T10:00:00Z' }), repository: repo });
  assert.equal(e.repos[R].ejecuciones[300].vinculo, null);
  aplicarWebhook(e, 'issue_comment', {
    action: 'created', repository: repo, issue: { number: 22, title: 'PR 22', state: 'open', pull_request: {} },
    comment: { user: { login: 'github-actions[bot]' }, body: '## Revisión de Enjambre\n\n**Veredicto:** APROBAR', created_at: '2026-11-23T10:04:00Z', html_url: 'u' },
  });
  assert.equal(e.repos[R].prs[22].veredictos.revisor.veredicto, 'APROBAR');
  assert.equal(e.repos[R].ejecuciones[300].vinculo.pr, 22);
});

test('un veredicto escrito por una persona no cuenta como veredicto del agente', () => {
  const e = estadoVacio();
  aplicarWebhook(e, 'pull_request', { action: 'opened', pull_request: pr(22, 'enjambre/9-adr'), repository: repo });
  aplicarWebhook(e, 'issue_comment', {
    action: 'created', repository: repo, issue: { number: 22, pull_request: {} },
    comment: { user: { login: 'alguien' }, body: '## Revisión de Enjambre\n\n**Veredicto:** APROBAR', created_at: '2026-11-23T10:04:00Z' },
  });
  assert.deepEqual(e.repos[R].prs[22].veredictos, {});
});

test('estado de commit: va al PR de esa cabeza y se borra si llega un commit nuevo', () => {
  const e = estadoVacio();
  aplicarWebhook(e, 'pull_request', { action: 'opened', pull_request: pr(22, 'enjambre/9-adr'), repository: repo });
  aplicarWebhook(e, 'status', { sha: SHA, context: 'ci (Enjambre)', state: 'success', repository: repo });
  assert.equal(e.repos[R].prs[22].ci['ci (Enjambre)'].estado, 'success');
  aplicarWebhook(e, 'pull_request', { action: 'synchronize', pull_request: pr(22, 'enjambre/9-adr', SHA2), repository: repo });
  assert.deepEqual(e.repos[R].prs[22].ci, {});
});

test('fusión: el PR queda «merged» y la cronología lo dice', () => {
  const e = estadoVacio();
  aplicarWebhook(e, 'pull_request', { action: 'closed', pull_request: pr(22, 'enjambre/9-adr', SHA, { state: 'closed', merged: true, merged_at: '2026-11-23T12:31:27Z' }), repository: repo, sender: { login: 'AlvaroM99' } });
  assert.equal(e.repos[R].prs[22].estado, 'merged');
  assert.match(e.eventos[0].texto, /fusionó #22/);
});

test('eventos sin repo (ping, instalación) solo actualizan la hora del último webhook', () => {
  const e = estadoVacio();
  assert.equal(aplicarWebhook(e, 'ping', { zen: 'x' }, '2026-11-23T10:00:00Z'), false);
  assert.equal(e.ultimoWebhook, '2026-11-23T10:00:00Z');
  assert.deepEqual(e.repos, {});
});

test('conciliación completa: corrige lo que los webhooks perdieron y cierra lo que ya no está abierto', () => {
  const e = estadoVacio();
  aplicarWebhook(e, 'issues', { action: 'opened', issue: issue(1, 'Uno'), repository: repo });
  aplicarWebhook(e, 'issues', { action: 'opened', issue: issue(2, 'Dos'), repository: repo });
  e.ultimaConciliacion = '2026-11-23T09:00:00Z';
  const r = aplicarLectura(e, R, { issues: [issue(1, 'Uno', ['enjambre:planificar'])], prs: [], ejecuciones: [], completa: true });
  assert.equal(e.repos[R].issues[1].etiquetas[0], 'enjambre:planificar');
  assert.equal(e.repos[R].issues[2].estado, 'closed');
  assert.equal(r.correcciones, 2);
});

test('lectura parcial (un solo PR) no cierra los demás', () => {
  const e = estadoVacio();
  aplicarWebhook(e, 'pull_request', { action: 'opened', pull_request: pr(21, 'enjambre/8-a'), repository: repo });
  aplicarWebhook(e, 'pull_request', { action: 'opened', pull_request: pr(22, 'enjambre/9-b'), repository: repo });
  aplicarLectura(e, R, { prs: [pr(22, 'enjambre/9-b')] });
  assert.equal(e.repos[R].prs[21].estado, 'open');
});

test('conciliación: veredictos, checks y aprobación del commit actual salen de los detalles', () => {
  const e = estadoVacio();
  aplicarLectura(e, R, {
    issues: [], prs: [pr(22, 'enjambre/9-b')], completa: true,
    detalles: { 22: {
      estados: [{ context: 'ci (Enjambre)', state: 'success' }],
      checks: [{ name: 'comprobar', status: 'completed', conclusion: 'success' }],
      comentarios: [
        { user: { login: 'github-actions[bot]' }, body: '## Revisión de Enjambre\n**Veredicto:** CAMBIOS', created_at: '2026-11-23T10:00:00Z' },
        { user: { login: 'github-actions[bot]' }, body: '## Revisión de Enjambre\n**Veredicto:** APROBAR', created_at: '2026-11-23T11:00:00Z' },
      ],
      resenas: [{ state: 'APPROVED', commit_id: SHA }],
    } },
  });
  const p = e.repos[R].prs[22];
  assert.equal(p.ci['ci (Enjambre)'].estado, 'success');
  assert.equal(p.checks.comprobar, 'success');
  assert.equal(p.veredictos.revisor.veredicto, 'APROBAR');
  assert.equal(p.aprobado, true);
});

test('conciliación: las ejecuciones que el panel cree en marcha y GitHub no lista quedan pendientes de leer', () => {
  const e = estadoVacio();
  aplicarWebhook(e, 'workflow_run', { action: 'in_progress', workflow_run: run(100, 'enjambre-planificar'), repository: repo });
  const r = aplicarLectura(e, R, { issues: [], prs: [], ejecuciones: [], completa: true });
  assert.deepEqual(r.pendientes, [100]);
  aplicarLectura(e, R, { ejecuciones: [run(100, 'enjambre-planificar', { status: 'completed', conclusion: 'success' })] });
  assert.equal(e.repos[R].ejecuciones[100].conclusion, 'success');
  assert.deepEqual(enCurso(e), []);
});

test('poda: se va lo cerrado hace más de un día; lo abierto se queda', () => {
  const e = estadoVacio();
  aplicarWebhook(e, 'issues', { action: 'closed', issue: { ...issue(1, 'Vieja', [], 'closed'), updated_at: '2026-11-20T00:00:00Z' }, repository: repo });
  aplicarWebhook(e, 'issues', { action: 'opened', issue: { ...issue(2, 'Abierta'), updated_at: '2026-11-20T00:00:00Z' }, repository: repo });
  podar(e, Date.parse('2026-11-23T00:00:00Z'));
  assert.deepEqual(Object.keys(e.repos[R].issues), ['2']);
});

test('vínculo: sin pistas no se inventa nada', () => {
  const repoEstado = { issues: {}, prs: {}, ejecuciones: {} };
  assert.equal(vinculoDe(repoEstado, { evento: 'schedule', rama: 'main', titulo: 'x', prs: [] }), null);
});

// ------------------------------------------------------------------ firma, bases y sesión

test('firma del webhook: válida, alterada, ausente y mal formada', async () => {
  const cuerpo = '{"a":1}';
  const f = await firmar('secreto', cuerpo);
  assert.equal(await firmaValida('secreto', cuerpo, f), true);
  assert.equal(await firmaValida('secreto', '{"a":2}', f), false);
  assert.equal(await firmaValida('otro', cuerpo, f), false);
  assert.equal(await firmaValida('secreto', cuerpo, null), false);
  assert.equal(await firmaValida('secreto', cuerpo, 'sha256=zz'), false);
  assert.equal(await firmaValida('', cuerpo, f), false);
});

test('bases: solo localhost puede sustituir a github.com (el secreto nunca sale a otro sitio)', () => {
  assert.deepEqual(bases({}), { api: 'https://api.github.com', web: 'https://github.com' });
  assert.deepEqual(bases({ GITHUB_API: 'http://localhost:8791', GITHUB_WEB: 'http://127.0.0.1:8791' }), { api: 'http://localhost:8791', web: 'http://127.0.0.1:8791' });
  assert.deepEqual(bases({ GITHUB_API: 'https://malo.example', GITHUB_WEB: 'http://localhost.malo.example' }), { api: 'https://api.github.com', web: 'https://github.com' });
});

test('cliente de GitHub: respeta el presupuesto de peticiones', async () => {
  const gh = new GitHub({ token: 't', limite: 1, fetch: async () => new Response('{}') });
  await gh.get('/x');
  await assert.rejects(gh.get('/y'), /Presupuesto/);
});

test('repos válidos', () => {
  assert.equal(repoValido('AlvaroM99/lobby'), true);
  assert.equal(repoValido('a/b/c'), false);
  assert.equal(repoValido('../x'), false);
});

const CLAVE = Buffer.alloc(32, 7).toString('base64');

test('cifrado de tokens: ida y vuelta, y clave equivocada falla', async () => {
  const k = await importarClave(CLAVE);
  const c = await cifrar(k, 'ghu_token');
  assert.notEqual(c, 'ghu_token');
  assert.equal(await descifrar(k, c), 'ghu_token');
  const otra = await importarClave(Buffer.alloc(32, 8).toString('base64'));
  await assert.rejects(descifrar(otra, c));
  await assert.rejects(importarClave('corta'), /32 bytes/);
});

test('cookies, origen y propietarios', () => {
  assert.equal(leerCookies('a=1; panel_sesion=xyz').get('panel_sesion'), 'xyz');
  assert.match(cookie('panel_sesion', 'v', { maxAge: 10 }), /HttpOnly; Secure; SameSite=Strict; Max-Age=10/);
  const req = (origin) => new Request('https://panel.example/api/x', { method: 'POST', headers: origin ? { origin } : {} });
  assert.equal(mismoOrigen(req('https://panel.example')), true);
  assert.equal(mismoOrigen(req('https://malo.example')), false);
  assert.equal(mismoOrigen(req(null)), false);
  assert.equal(esPropietario({ PROPIETARIOS: 'AlvaroM99' }, 'alvarom99'), true);
  assert.equal(esPropietario({ PROPIETARIOS: 'AlvaroM99' }, 'otro'), false);
  assert.equal(esPropietario({ PROPIETARIOS: '' }, 'AlvaroM99'), false);
});

test('cabeceras: CSP sin scripts de fuera ni marcos', () => {
  const r = conCabeceras(new Response('x'));
  assert.equal(r.headers.get('content-security-policy'), CSP);
  assert.match(CSP, /script-src 'self'/);
  assert.match(CSP, /frame-ancestors 'none'/);
  assert.doesNotMatch(CSP, /unsafe/);
});

// ------------------------------------------------------------------ Sala con almacén y GitHub simulados

function ctxFalso() {
  const datos = new Map();
  let alarma = null;
  return {
    datos,
    storage: {
      get: async (k) => structuredClone(datos.get(k)),
      put: async (k, v) => { datos.set(k, structuredClone(v)); },
      delete: async (k) => { for (const x of [k].flat()) datos.delete(x); },
      list: async ({ prefix }) => new Map([...datos].filter(([k]) => k.startsWith(prefix))),
      getAlarm: async () => alarma,
      setAlarm: async (t) => { alarma = t; },
    },
    getWebSockets: () => [],
    getTags: () => [],
  };
}

function githubFalso(login = 'AlvaroM99', rutas = {}) {
  const llamadas = [];
  const f = async (url, init = {}) => {
    const u = new URL(url);
    llamadas.push({ metodo: init.method ?? 'GET', ruta: u.pathname, cuerpo: init.body ? JSON.parse(init.body) : null, auth: init.headers?.authorization });
    const r = (d, s = 200) => new Response(JSON.stringify(d), { status: s });
    const propia = rutas[`${init.method ?? 'GET'} ${u.pathname}`];
    if (propia) return r(propia);
    if (u.pathname === '/login/oauth/access_token') return r({ access_token: 'ghu_falso', expires_in: 28800, refresh_token: 'ghr_falso', refresh_token_expires_in: 15897600 });
    if (u.pathname === '/user') return r({ login });
    if (u.pathname.endsWith('/labels') && (init.method ?? 'GET') === 'GET') return r([{ name: 'enjambre:implementar', color: 'fff' }]);
    if (u.pathname.endsWith('/merge')) return r({ merged: true, sha: SHA2, message: 'ok' });
    return r({});
  };
  return { f, llamadas };
}

const ENV = { GITHUB_CLIENT_ID: 'Iv1.prueba', GITHUB_CLIENT_SECRET: 's', WEBHOOK_SECRET: 'w', CLAVE_SESION: CLAVE, PROPIETARIOS: 'AlvaroM99', GITHUB_API: 'http://localhost:9', GITHUB_WEB: 'http://localhost:9' };
const BASE = 'https://panel.example';

async function entrar(sala) {
  const l = await sala.fetch(new Request(`${BASE}/login`));
  assert.equal(l.status, 302);
  const estado = new URL(l.headers.get('location')).searchParams.get('state');
  const c = await sala.fetch(new Request(`${BASE}/callback?code=abc&state=${estado}`, { headers: { cookie: `panel_login=${estado}` } }));
  return c;
}

const cookieSesion = (respuesta) => respuesta.headers.getSetCookie().find((c) => c.startsWith('panel_sesion=')).split(';')[0];

test('Sala: webhook sin firma válida → 401; con firma → 200; repetido → no se aplica dos veces', async () => {
  const ctx = ctxFalso();
  const sala = new Sala(ctx, ENV, { fetch: githubFalso().f });
  const cuerpo = JSON.stringify({ action: 'opened', issue: issue(5, 'Cinco'), repository: repo });
  const pedir = async (firma, entrega = 'd1') => sala.fetch(new Request(`${BASE}/webhook`, { method: 'POST', body: cuerpo, headers: { 'x-github-event': 'issues', 'x-github-delivery': entrega, 'x-hub-signature-256': firma } }));
  assert.equal((await pedir('sha256=' + '0'.repeat(64))).status, 401);
  assert.equal((await pedir(await firmar('w', cuerpo))).status, 200);
  assert.equal(await (await pedir(await firmar('w', cuerpo))).text(), 'Repetida');
  assert.equal(ctx.datos.get('estado').repos[R].issues[5].titulo, 'Cinco');
  assert.equal(ctx.datos.get('estado').eventos.length, 1);
});

test('Sala: login con GitHub crea una sesión cifrada solo para el propietario', async () => {
  const ctx = ctxFalso();
  const sala = new Sala(ctx, ENV, { fetch: githubFalso().f });
  const c = await entrar(sala);
  assert.equal(c.status, 302);
  const sesion = [...ctx.datos].find(([k]) => k.startsWith('sesion:'))[1];
  assert.equal(sesion.login, 'AlvaroM99');
  assert.doesNotMatch(JSON.stringify(sesion), /ghu_falso|ghr_falso/);
  const id = cookieSesion(c).split('=')[1];
  assert.equal([...ctx.datos.keys()].some((k) => k.includes(id)), false, 'el id de la cookie no se guarda tal cual');
  const yo = await sala.fetch(new Request(`${BASE}/api/yo`, { headers: { cookie: cookieSesion(c) } }));
  assert.equal((await yo.json()).login, 'AlvaroM99');

  const otra = new Sala(ctxFalso(), ENV, { fetch: githubFalso('intruso').f });
  assert.equal((await entrar(otra)).status, 403);
});

test('Sala: login con state distinto del de la cookie → 400', async () => {
  const sala = new Sala(ctxFalso(), ENV, { fetch: githubFalso().f });
  const r = await sala.fetch(new Request(`${BASE}/callback?code=abc&state=uno`, { headers: { cookie: 'panel_login=dos' } }));
  assert.equal(r.status, 400);
});

test('Sala: sin sesión no hay API; sin CSRF u origen no hay escrituras', async () => {
  const gh = githubFalso();
  const sala = new Sala(ctxFalso(), ENV, { fetch: gh.f });
  assert.equal((await sala.fetch(new Request(`${BASE}/api/estado`))).status, 401);
  const galleta = cookieSesion(await entrar(sala));
  const cuerpo = JSON.stringify({ repo: R, numero: 22, sha: SHA });
  const sinCsrf = await sala.fetch(new Request(`${BASE}/api/fusionar`, { method: 'POST', body: cuerpo, headers: { cookie: galleta, origin: BASE } }));
  assert.equal(sinCsrf.status, 403);
  const { csrf } = await (await sala.fetch(new Request(`${BASE}/api/yo`, { headers: { cookie: galleta } }))).json();
  const otroOrigen = await sala.fetch(new Request(`${BASE}/api/fusionar`, { method: 'POST', body: cuerpo, headers: { cookie: galleta, origin: 'https://malo.example', 'x-panel-csrf': csrf } }));
  assert.equal(otroOrigen.status, 403);
  assert.equal(gh.llamadas.some((l) => l.ruta.endsWith('/merge')), false);
});

test('Sala: fusionar va atado al SHA visto, con squash, y con el token del usuario', async () => {
  const gh = githubFalso();
  const sala = new Sala(ctxFalso(), ENV, { fetch: gh.f });
  const galleta = cookieSesion(await entrar(sala));
  const { csrf } = await (await sala.fetch(new Request(`${BASE}/api/yo`, { headers: { cookie: galleta } }))).json();
  const h = { cookie: galleta, origin: BASE, 'x-panel-csrf': csrf };
  const sinSha = await sala.fetch(new Request(`${BASE}/api/fusionar`, { method: 'POST', body: JSON.stringify({ repo: R, numero: 22 }), headers: h }));
  assert.equal(sinSha.status, 400);
  const ok = await sala.fetch(new Request(`${BASE}/api/fusionar`, { method: 'POST', body: JSON.stringify({ repo: R, numero: 22, sha: SHA }), headers: h }));
  assert.equal((await ok.json()).ok, true);
  const merge = gh.llamadas.find((l) => l.ruta === `/repos/${R}/pulls/22/merge`);
  assert.deepEqual(merge.cuerpo, { sha: SHA, merge_method: 'squash' });
  assert.equal(merge.auth, 'Bearer ghu_falso');
});

test('Sala: aprobar manda APPROVE sobre el commit visto', async () => {
  const gh = githubFalso();
  const sala = new Sala(ctxFalso(), ENV, { fetch: gh.f });
  const galleta = cookieSesion(await entrar(sala));
  const { csrf } = await (await sala.fetch(new Request(`${BASE}/api/yo`, { headers: { cookie: galleta } }))).json();
  const r = await sala.fetch(new Request(`${BASE}/api/aprobar`, { method: 'POST', body: JSON.stringify({ repo: R, numero: 22, sha: SHA, comentario: 'Visto' }), headers: { cookie: galleta, origin: BASE, 'x-panel-csrf': csrf } }));
  assert.equal(r.status, 200);
  assert.deepEqual(gh.llamadas.find((l) => l.ruta.endsWith('/reviews')).cuerpo, { event: 'APPROVE', commit_id: SHA, body: 'Visto' });
});

test('Sala: solo se ponen etiquetas que ya existen en el repo', async () => {
  const gh = githubFalso();
  const sala = new Sala(ctxFalso(), ENV, { fetch: gh.f });
  const galleta = cookieSesion(await entrar(sala));
  const { csrf } = await (await sala.fetch(new Request(`${BASE}/api/yo`, { headers: { cookie: galleta } }))).json();
  const h = { cookie: galleta, origin: BASE, 'x-panel-csrf': csrf };
  const poner = (etiqueta) => sala.fetch(new Request(`${BASE}/api/etiqueta`, { method: 'POST', body: JSON.stringify({ repo: R, numero: 9, etiqueta, accion: 'poner' }), headers: h }));
  assert.equal((await poner('inventada')).status, 400);
  assert.equal((await poner('enjambre:implementar')).status, 200);
  assert.deepEqual(gh.llamadas.find((l) => l.metodo === 'POST' && l.ruta.endsWith('/issues/9/labels')).cuerpo, { labels: ['enjambre:implementar'] });
});

test('Sala: salir borra la sesión', async () => {
  const ctx = ctxFalso();
  const sala = new Sala(ctx, ENV, { fetch: githubFalso().f });
  const galleta = cookieSesion(await entrar(sala));
  const { csrf } = await (await sala.fetch(new Request(`${BASE}/api/yo`, { headers: { cookie: galleta } }))).json();
  await sala.fetch(new Request(`${BASE}/salir`, { method: 'POST', headers: { cookie: galleta, origin: BASE, 'x-panel-csrf': csrf } }));
  assert.equal((await (await sala.fetch(new Request(`${BASE}/api/yo`, { headers: { cookie: galleta } }))).json()).login, null);
  assert.equal((await sala.fetch(new Request(`${BASE}/api/estado`, { headers: { cookie: galleta } }))).status, 401);
});

test('Sala: sin configurar, /login lo dice en vez de fallar a medias', async () => {
  const sala = new Sala(ctxFalso(), { PROPIETARIOS: 'AlvaroM99' }, { fetch: githubFalso().f });
  const r = await sala.fetch(new Request(`${BASE}/login`));
  assert.equal(r.status, 500);
  assert.match(await r.text(), /no está configurado/);
});

// ------------------------------------------------------------------ flujo desde el panel: plan, puerta 1 y re-revisión

import { notaDe, notasDeComentarios } from '../panel/src/estado.js';

const comentarioPlan = { user: { login: 'github-actions[bot]' }, body: '## Plan de Enjambre · #16 (jefe de proyecto)\n\nPasos…', created_at: '2026-11-23T13:54:59Z', html_url: 'u-plan' };
const comentarioInforme = { user: { login: 'github-actions[bot]' }, body: '## Informe del analista · #16\n\n…', created_at: '2026-11-23T17:07:27Z', html_url: 'u-informe' };

test('notas de agente: el plan del bot o del propietario cuenta; el de otra persona no', () => {
  assert.deepEqual(notaDe(comentarioPlan.body, 'github-actions[bot]', 'AlvaroM99'), { plan: true, titulo: 'Plan de Enjambre · #16 (jefe de proyecto)' });
  assert.equal(notaDe('## Plan mío', 'AlvaroM99', 'AlvaroM99').plan, true);
  assert.equal(notaDe('## Plan mío', 'alguien', 'AlvaroM99'), null);
  assert.equal(notaDe('## Planeta', 'github-actions[bot]', 'AlvaroM99').plan, false);
  const { plan, nota } = notasDeComentarios([comentarioPlan, comentarioInforme], 'AlvaroM99');
  assert.equal(plan.url, 'u-plan');
  assert.equal(nota.url, 'u-informe');
});

test('webhook: un plan publicado en una issue la marca «plan listo» y lo dice la cronología', () => {
  const e = estadoVacio();
  const F = 'AlvaroM99/finance_tracker';
  aplicarWebhook(e, 'issues', { action: 'opened', issue: issue(16, 'CI api'), repository: { full_name: F } });
  aplicarWebhook(e, 'issue_comment', { action: 'created', repository: { full_name: F }, issue: { number: 16 }, comment: comentarioPlan });
  assert.equal(e.repos[F].issues[16].plan.url, 'u-plan');
  assert.match(e.eventos[0].texto, /plan listo en #16/);
  // Si la issue cambia (etiqueta), el plan se conserva.
  aplicarWebhook(e, 'issues', { action: 'labeled', label: { name: 'x' }, issue: issue(16, 'CI api', ['x']), repository: { full_name: F } });
  assert.equal(e.repos[F].issues[16].plan.url, 'u-plan');
});

const F16 = '/repos/AlvaroM99/lobby/issues/16';
async function salaConAccion(issue16, comentarios = []) {
  const gh = githubFalso('AlvaroM99', { [`GET ${F16}`]: issue16, [`GET ${F16}/comments`]: comentarios });
  const sala = new Sala(ctxFalso(), ENV, { fetch: gh.f });
  const galleta = cookieSesion(await entrar(sala));
  const { csrf } = await (await sala.fetch(new Request(`${BASE}/api/yo`, { headers: { cookie: galleta } }))).json();
  const accion = (nombre) => sala.fetch(new Request(`${BASE}/api/accion`, { method: 'POST', body: JSON.stringify({ repo: R, numero: 16, accion: nombre }), headers: { cookie: galleta, origin: BASE, 'x-panel-csrf': csrf } }));
  return { gh, accion };
}
const issue16 = (etiquetas, extra = {}) => ({ number: 16, state: 'open', labels: etiquetas.map((name) => ({ name })), ...extra });

test('puerta 1: implementar sin plan se rechaza y no toca etiquetas', async () => {
  const { gh, accion } = await salaConAccion(issue16(['enjambre:propuesta']), []);
  const r = await accion('implementar');
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /no tiene plan/);
  assert.equal(gh.llamadas.some((l) => l.ruta.includes('/labels')), false);
});

test('puerta 1: con plan, quita lo que sobra y vuelve a poner implementar para que salte el evento', async () => {
  // El caso real de finance_tracker#16: implementar y planificar se pusieron a la vez, antes de que hubiera plan.
  const { gh, accion } = await salaConAccion(issue16(['enjambre:implementar', 'enjambre:planificar', 'enjambre:revisar', 'qa']), [comentarioPlan]);
  const r = await accion('implementar');
  assert.equal(r.status, 200);
  const etiquetas = gh.llamadas.filter((l) => l.ruta.includes('/labels'));
  assert.deepEqual(etiquetas.map((l) => `${l.metodo} ${decodeURIComponent(l.ruta.split('/labels')[1] || '')}`), [
    'DELETE /enjambre:planificar', 'DELETE /enjambre:revisar', 'DELETE /enjambre:implementar', 'POST ',
  ]);
  assert.deepEqual(etiquetas.at(-1).cuerpo, { labels: ['enjambre:implementar'] });
});

test('puerta 1: con un implementador ya trabajando (en-curso) no se relanza', async () => {
  const { gh, accion } = await salaConAccion(issue16(['enjambre:en-curso']), [comentarioPlan]);
  assert.equal((await accion('implementar')).status, 409);
  assert.equal(gh.llamadas.some((l) => l.metodo !== 'GET' && l.ruta.includes('/labels')), false);
});

test('acciones: revisar solo en un PR, planificar en una issue, y en-curso no se pone a mano', async () => {
  const { accion } = await salaConAccion(issue16([]), []);
  assert.equal((await accion('revisar')).status, 400);
  assert.equal((await accion('planificar')).status, 200);
  assert.equal((await accion('borrar-todo')).status, 400);
  const gh = githubFalso();
  const sala = new Sala(ctxFalso(), ENV, { fetch: gh.f });
  const galleta = cookieSesion(await entrar(sala));
  const { csrf } = await (await sala.fetch(new Request(`${BASE}/api/yo`, { headers: { cookie: galleta } }))).json();
  const r = await sala.fetch(new Request(`${BASE}/api/etiqueta`, { method: 'POST', body: JSON.stringify({ repo: R, numero: 16, etiqueta: 'enjambre:en-curso', accion: 'poner' }), headers: { cookie: galleta, origin: BASE, 'x-panel-csrf': csrf } }));
  assert.equal(r.status, 400);
});

test('rama con sufijo de carril (enjambre/16a-…) se enlaza con su issue', async () => {
  const { issueDeRama } = await import('../panel/src/estado.js');
  assert.equal(issueDeRama('enjambre/16a-iguales-longitud'), 16);
  assert.equal(issueDeRama('enjambre/issue-9-adr'), 9);
  assert.equal(issueDeRama('enjambre/16ab-x'), null);
});
