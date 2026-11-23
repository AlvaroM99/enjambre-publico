// GitHub falso para la prueba e2e del panel (ADR 0015): la API justa que usa Hive, con datos sintéticos, y que
// además envía al panel los webhooks firmados que mandaría GitHub después de cada acción.
import { createServer } from 'node:http';
import { firmar } from '../src/github.js';

const SHA_A = 'a1'.repeat(20);
const SHA_B = 'b2'.repeat(20);

export function crearGithubFalso({ puerto = 8791, panel = 'http://localhost:8790', secretoWebhook }) {
  const ahora = () => new Date().toISOString();
  const usuario = { login: 'AlvaroM99' };
  const bot = { login: 'github-actions[bot]' };
  const repos = {
    'AlvaroM99/lobby': {
      etiquetas: ['enjambre:propuesta', 'enjambre:planificar', 'enjambre:implementar', 'enjambre:en-curso', 'enjambre:revisar', 'gobernanza', 'bug'],
      issues: [
        { number: 30, title: 'Exportar tareas a CSV', state: 'open', labels: ['enjambre:implementar'], body: 'Exportar.' },
        { number: 31, title: 'Modo oscuro en el calendario', state: 'open', labels: ['enjambre:propuesta'], body: '' },
        { number: 32, title: 'Atajos de teclado', state: 'open', labels: [], body: '' },
      ],
      prs: [
        { number: 40, title: 'feat: export tasks as CSV', state: 'open', draft: false, labels: [], head: { ref: 'enjambre/30-exportar-csv', sha: SHA_A }, base: { ref: 'main' }, user: bot, body: 'Closes #30\n\nAñade la exportación a CSV con pruebas.', additions: 120, deletions: 4, mergeable: true, mergeable_state: 'clean' },
      ],
      comentarios: {
        40: [{ user: bot, body: '## Revisión de Enjambre\n\nTodo correcto.\n\n**Veredicto:** APROBAR', created_at: '2026-11-23T12:00:00Z', html_url: 'https://github.com/AlvaroM99/lobby/pull/40#issuecomment-1' }],
        32: [],
      },
      estados: { [SHA_A]: [{ context: 'ci (Enjambre)', state: 'success', target_url: 'https://github.com/AlvaroM99/lobby/actions/runs/1' }] },
      runs: [],
      jobs: {},
    },
    'AlvaroM99/finance_tracker': {
      etiquetas: ['enjambre:propuesta', 'enjambre:planificar', 'enjambre:implementar', 'enjambre:revisar', 'plataforma'],
      issues: [{ number: 16, title: 'La CI no ejecuta api', state: 'open', labels: ['enjambre:planificar'], body: '' }],
      prs: [
        { number: 25, title: 'ci: run the api tests', state: 'open', draft: true, labels: [], head: { ref: 'enjambre/16-ci-api', sha: SHA_B }, base: { ref: 'main' }, user: bot, body: 'Closes #16', additions: 10, deletions: 1, mergeable: true, mergeable_state: 'draft' },
      ],
      comentarios: {},
      estados: { [SHA_B]: [{ context: 'ci (Enjambre)', state: 'pending' }] },
      runs: [],
      jobs: {},
    },
  };
  const registro = []; // acciones de escritura que recibió el GitHub falso

  const url = (repo, tipo, n) => `https://github.com/${repo}/${tipo}/${n}`;
  const issueApi = (repo, i) => ({ ...i, labels: i.labels.map((name) => ({ name })), user: usuario, html_url: url(repo, 'issues', i.number), updated_at: ahora() });
  const prApi = (repo, p) => ({
    ...p, node_id: `PR_${p.number}`, labels: (p.labels ?? []).map((name) => ({ name })), requested_reviewers: [], html_url: url(repo, 'pull', p.number), updated_at: ahora(),
    merged: p.state === 'merged', merged_at: p.state === 'merged' ? ahora() : null, state: p.state === 'merged' ? 'closed' : p.state,
    head: { ...p.head, repo: { full_name: repo } }, base: { ...p.base, repo: { full_name: repo, default_branch: 'main' } },
  });
  const runApi = (repo, r) => ({ ...r, html_url: url(repo, 'actions/runs', r.id), updated_at: ahora(), pull_requests: [], actor: usuario, triggering_actor: usuario });

  let entrega = 0;
  async function webhook(tipo, payload) {
    const cuerpo = JSON.stringify({ ...payload, sender: payload.sender ?? usuario });
    const r = await fetch(`${panel}/webhook`, {
      method: 'POST',
      body: cuerpo,
      headers: { 'content-type': 'application/json', 'x-github-event': tipo, 'x-github-delivery': `e2e-${++entrega}`, 'x-hub-signature-256': await firmar(secretoWebhook, cuerpo) },
    });
    if (!r.ok) throw new Error(`El panel rechazó el webhook ${tipo}: ${r.status}`);
  }
  const luego = (fn) => setTimeout(() => fn().catch((e) => console.error('webhook falso:', e.message)), 50);

  const leer = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => { d += c; }); req.on('end', () => ok(d ? JSON.parse(d) : {})); });

  const servidor = createServer(async (req, res) => {
    const u = new URL(req.url, `http://localhost:${puerto}`);
    const p = u.pathname;
    const responder = (d, s = 200, cab = {}) => { res.writeHead(s, { 'content-type': 'application/json', 'x-ratelimit-remaining': '4990', 'x-ratelimit-limit': '5000', ...cab }); res.end(d === null ? '' : JSON.stringify(d)); };
    try {
      if (p === '/login/oauth/authorize') {
        const destino = new URL(u.searchParams.get('redirect_uri'));
        destino.searchParams.set('code', 'codigo-e2e');
        destino.searchParams.set('state', u.searchParams.get('state'));
        res.writeHead(302, { location: destino.toString() });
        return res.end();
      }
      if (p === '/login/oauth/access_token') return responder({ access_token: 'ghu_e2e_sintetico', expires_in: 28800, refresh_token: 'ghr_e2e_sintetico', refresh_token_expires_in: 15897600 });
      if (p === '/almacen/log') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('2026-11-23T10:00:00.0000000Z ##[group]Run agente\n2026-11-23T10:00:01.0000000Z Leyendo el plan de #32\n2026-11-23T10:00:02.0000000Z Escribiendo el plan'); }
      if (req.headers.authorization !== 'Bearer ghu_e2e_sintetico') return responder({ message: 'Bad credentials' }, 401);
      if (p === '/user') return responder(usuario);
      if (p === '/user/installations') return responder({ installations: [{ id: 1, app_slug: 'hive-e2e' }] });
      if (p === '/user/installations/1/repositories') return responder({ repositories: Object.keys(repos).map((full_name) => ({ full_name })) });
      if (p === '/graphql' && req.method === 'POST') {
        const { variables } = await leer(req);
        registro.push({ accion: 'graphql', variables });
        for (const [nombre, r] of Object.entries(repos)) {
          const pr = r.prs.find((x) => `PR_${x.number}` === variables.id);
          if (pr) { pr.draft = false; luego(() => webhook('pull_request', { action: 'ready_for_review', pull_request: prApi(nombre, pr), repository: { full_name: nombre } })); }
        }
        return responder({ data: { markPullRequestReadyForReview: { pullRequest: { isDraft: false } } } });
      }

      const m = /^\/repos\/([^/]+\/[^/]+)(\/.*)?$/.exec(p);
      if (!m) return responder({ message: 'Not Found' }, 404);
      const [, nombre, resto = ''] = m;
      const r = repos[nombre];
      if (!r) return responder({ message: 'Not Found' }, 404);
      const completo = { full_name: nombre };
      let x;
      if (resto === '') return responder({ full_name: nombre, default_branch: 'main' });
      if (resto === '/issues' && req.method === 'GET') return responder(r.issues.filter((i) => i.state === 'open').map((i) => issueApi(nombre, i)));
      if (resto === '/issues' && req.method === 'POST') {
        const c = await leer(req);
        const n = 100 + r.issues.length;
        const issue = { number: n, title: c.title, body: c.body ?? '', state: 'open', labels: c.labels ?? [] };
        r.issues.push(issue);
        registro.push({ accion: 'crear', repo: nombre, numero: n, cuerpo: c });
        luego(() => webhook('issues', { action: 'opened', issue: issueApi(nombre, issue), repository: completo }));
        return responder(issueApi(nombre, issue), 201);
      }
      if (resto === '/pulls') return responder(r.prs.filter((pr) => pr.state === 'open').map((pr) => prApi(nombre, pr)));
      if (resto === '/labels') return responder(r.etiquetas.map((name) => ({ name, color: 'ededed', description: '' })));
      if ((x = /^\/pulls\/(\d+)$/.exec(resto))) return responder(prApi(nombre, r.prs.find((pr) => pr.number === Number(x[1]))));
      if ((x = /^\/pulls\/(\d+)\/files$/.exec(resto))) return responder([{ filename: 'src/exportar.js', status: 'added', additions: 3, deletions: 0, patch: '@@ -0,0 +1,3 @@\n+export function aCsv(filas) {\n+  return filas.map((f) => f.join(",")).join("\\n");\n+}' }]);
      if ((x = /^\/pulls\/(\d+)\/reviews$/.exec(resto))) {
        const pr = r.prs.find((y) => y.number === Number(x[1]));
        pr.resenas ??= [];
        if (req.method === 'POST') {
          const cuerpo = await leer(req);
          registro.push({ accion: 'resena', repo: nombre, numero: pr.number, cuerpo });
          const estado = { APPROVE: 'APPROVED', REQUEST_CHANGES: 'CHANGES_REQUESTED', COMMENT: 'COMMENTED' }[cuerpo.event];
          const resena = { id: pr.resenas.length + 1, user: usuario, state: estado, commit_id: cuerpo.commit_id, body: cuerpo.body ?? '', submitted_at: ahora(), html_url: `${url(nombre, 'pull', pr.number)}#review` };
          pr.resenas.push(resena);
          luego(() => webhook('pull_request_review', { action: 'submitted', review: { ...resena, state: estado.toLowerCase() }, pull_request: prApi(nombre, pr), repository: completo }));
          return responder(resena);
        }
        return responder(pr.resenas);
      }
      if ((x = /^\/pulls\/(\d+)\/merge$/.exec(resto)) && req.method === 'PUT') {
        const pr = r.prs.find((y) => y.number === Number(x[1]));
        const cuerpo = await leer(req);
        registro.push({ accion: 'fusionar', repo: nombre, numero: pr.number, cuerpo });
        if (cuerpo.sha !== pr.head.sha) return responder({ message: 'Head branch was modified. Review and try the merge again.' }, 409);
        pr.state = 'merged';
        luego(() => webhook('pull_request', { action: 'closed', pull_request: prApi(nombre, pr), repository: completo }));
        return responder({ merged: true, sha: 'f'.repeat(40), message: 'Pull Request successfully merged' });
      }
      if ((x = /^\/pulls\/(\d+)\/update-branch$/.exec(resto)) && req.method === 'PUT') {
        registro.push({ accion: 'actualizar-rama', repo: nombre, numero: Number(x[1]), cuerpo: await leer(req) });
        return responder({ message: 'Updating pull request branch.' }, 202);
      }
      if ((x = /^\/git\/refs\/heads\/(.+)$/.exec(resto)) && req.method === 'DELETE') {
        registro.push({ accion: 'borrar-rama', repo: nombre, rama: decodeURIComponent(x[1]) });
        return responder(null, 204);
      }
      if ((x = /^\/issues\/(\d+)$/.exec(resto))) {
        const n = Number(x[1]);
        const issue = r.issues.find((i) => i.number === n);
        if (req.method === 'PATCH') {
          const c = await leer(req);
          registro.push({ accion: 'estado-issue', repo: nombre, numero: n, cuerpo: c });
          issue.state = c.state;
          luego(() => webhook('issues', { action: c.state === 'closed' ? 'closed' : 'reopened', issue: issueApi(nombre, issue), repository: completo }));
          return responder(issueApi(nombre, issue));
        }
        if (issue) return responder(issueApi(nombre, issue));
        const pr = r.prs.find((y) => y.number === n);
        if (pr) return responder({ ...prApi(nombre, pr), pull_request: {}, state: pr.state === 'merged' ? 'closed' : pr.state });
        return responder({ message: 'Not Found' }, 404);
      }
      if ((x = /^\/issues\/(\d+)\/comments$/.exec(resto))) {
        const n = Number(x[1]);
        if (req.method === 'POST') {
          const c = await leer(req);
          const com = { user: usuario, body: c.body, created_at: ahora(), html_url: `${url(nombre, 'issues', n)}#issuecomment-${Date.now()}` };
          (r.comentarios[n] ??= []).push(com);
          registro.push({ accion: 'comentar', repo: nombre, numero: n, cuerpo: c });
          const destino = r.issues.find((i) => i.number === n);
          luego(() => webhook('issue_comment', { action: 'created', issue: destino ? issueApi(nombre, destino) : { number: n, pull_request: {} }, comment: com, repository: completo }));
          return responder(com, 201);
        }
        return responder(r.comentarios[n] ?? []);
      }
      if ((x = /^\/issues\/(\d+)\/labels$/.exec(resto)) && req.method === 'POST') {
        const n = Number(x[1]);
        const destino = r.issues.find((i) => i.number === n) ?? r.prs.find((y) => y.number === n);
        const { labels } = await leer(req);
        registro.push({ accion: 'poner', repo: nombre, numero: n, labels });
        destino.labels ??= [];
        for (const l of labels) if (!destino.labels.includes(l)) destino.labels.push(l);
        const esIssue = r.issues.includes(destino);
        luego(() => webhook(esIssue ? 'issues' : 'pull_request', { action: 'labeled', label: { name: labels[0] }, [esIssue ? 'issue' : 'pull_request']: esIssue ? issueApi(nombre, destino) : prApi(nombre, destino), repository: completo }));
        return responder(destino.labels.map((name) => ({ name })));
      }
      if ((x = /^\/issues\/(\d+)\/labels\/(.+)$/.exec(resto)) && req.method === 'DELETE') {
        const n = Number(x[1]);
        const destino = r.issues.find((i) => i.number === n) ?? r.prs.find((y) => y.number === n);
        const etiqueta = decodeURIComponent(x[2]);
        registro.push({ accion: 'quitar', repo: nombre, numero: n, etiqueta });
        destino.labels = (destino.labels ?? []).filter((l) => l !== etiqueta);
        if (r.issues.includes(destino)) luego(() => webhook('issues', { action: 'unlabeled', label: { name: etiqueta }, issue: issueApi(nombre, destino), repository: completo }));
        return responder({});
      }
      if ((x = /^\/commits\/([0-9a-f]+)\/status$/.exec(resto))) {
        const est = r.estados[x[1]] ?? [];
        const combinado = est.some((s) => s.state === 'failure') ? 'failure' : est.length && est.every((s) => s.state === 'success') ? 'success' : 'pending';
        return responder({ state: combinado, statuses: est });
      }
      if (/^\/commits\/[0-9a-f]+\/check-runs$/.test(resto)) return responder({ check_runs: [] });
      if (resto === '/actions/runs') {
        const estado = u.searchParams.get('status');
        return responder({ workflow_runs: r.runs.filter((y) => !estado || y.status === estado).map((y) => runApi(nombre, y)) });
      }
      if ((x = /^\/actions\/runs\/(\d+)$/.exec(resto))) return responder(runApi(nombre, r.runs.find((y) => y.id === Number(x[1]))));
      if ((x = /^\/actions\/runs\/(\d+)\/jobs$/.exec(resto))) return responder({ jobs: r.jobs[x[1]] ?? [] });
      if ((x = /^\/actions\/runs\/(\d+)\/(rerun|rerun-failed-jobs|cancel)$/.exec(resto)) && req.method === 'POST') {
        registro.push({ accion: x[2], repo: nombre, id: Number(x[1]) });
        return responder(null, 201);
      }
      if ((x = /^\/actions\/workflows\/([^/]+)\/dispatches$/.exec(resto)) && req.method === 'POST') {
        registro.push({ accion: 'dispatch', repo: nombre, workflow: x[1], cuerpo: await leer(req) });
        return responder(null, 204);
      }
      if (/^\/actions\/jobs\/\d+\/logs$/.test(resto)) {
        res.writeHead(302, { location: `http://localhost:${puerto}/almacen/log` });
        return res.end();
      }
      return responder({ message: 'Not Found' }, 404);
    } catch (e) {
      return responder({ message: String(e.message) }, 500);
    }
  });

  /** Un agente arranca: crea la ejecución y su job con pasos, y manda los webhooks como GitHub. */
  async function arrancarAgente(nombre, { id, workflow, job, titulo, evento = 'issues', rama = 'main', pasos }) {
    const r = repos[nombre];
    const run = { id, name: workflow, display_title: titulo, event: evento, status: 'in_progress', conclusion: null, head_branch: rama, run_started_at: ahora(), created_at: ahora(), run_attempt: 1 };
    r.runs.unshift(run);
    const j = { id: id * 3 + 7, run_id: id, name: job, workflow_name: workflow, status: 'in_progress', conclusion: null, started_at: ahora(), html_url: url(nombre, 'actions/runs', id), steps: pasos };
    r.jobs[id] = [j];
    await webhook('workflow_run', { action: 'in_progress', workflow_run: runApi(nombre, run), repository: { full_name: nombre } });
    await webhook('workflow_job', { action: 'in_progress', workflow_job: j, repository: { full_name: nombre } });
  }

  /** Avanza un paso sin webhook: el panel lo ve consultando los jobs mientras corre. */
  function avanzarPaso(nombre, id) {
    const j = repos[nombre].jobs[id][0];
    const i = j.steps.findIndex((s) => s.status === 'in_progress');
    j.steps[i] = { ...j.steps[i], status: 'completed', conclusion: 'success' };
    if (j.steps[i + 1]) j.steps[i + 1] = { ...j.steps[i + 1], status: 'in_progress' };
  }

  async function terminarAgente(nombre, id, conclusion = 'success') {
    const r = repos[nombre];
    const run = r.runs.find((y) => y.id === id);
    run.status = 'completed';
    run.conclusion = conclusion;
    const j = r.jobs[id][0];
    j.status = 'completed';
    j.conclusion = conclusion;
    j.completed_at = ahora();
    j.steps = j.steps.map((s) => ({ ...s, status: 'completed', conclusion: 'success' }));
    await webhook('workflow_job', { action: 'completed', workflow_job: j, repository: { full_name: nombre } });
    await webhook('workflow_run', { action: 'completed', workflow_run: runApi(nombre, run), repository: { full_name: nombre } });
  }

  /** El jefe de proyecto publica su plan en la issue (comentario «## Plan…» del bot) y GitHub avisa al panel. */
  async function publicarPlan(nombre, n) {
    const c = {
      user: bot, created_at: ahora(), html_url: `${url(nombre, 'issues', n)}#issuecomment-plan`,
      body: `## Plan de Enjambre · #${n} (jefe de proyecto)\n\n**Talla:** S\n\n### Pasos\n- Añadir los atajos\n- Pruebas\n\n| Fichero | Cambio |\n|---|---|\n| \`src/atajos.js\` | nuevo |\n\n\`\`\`\nnpm test\n\`\`\``,
    };
    (repos[nombre].comentarios[n] ??= []).push(c);
    const issue = repos[nombre].issues.find((i) => i.number === n);
    await webhook('issue_comment', { action: 'created', issue: { ...issueApi(nombre, issue) }, comment: c, repository: { full_name: nombre } });
  }

  return {
    registro,
    repos,
    webhook,
    publicarPlan,
    arrancarAgente,
    avanzarPaso,
    terminarAgente,
    iniciar: () => new Promise((ok) => servidor.listen(puerto, 'localhost', ok)),
    parar: () => new Promise((ok) => servidor.close(ok)),
    SHA_A,
  };
}
