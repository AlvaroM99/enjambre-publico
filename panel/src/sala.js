// Durable Object «Sala» (ADR 0015): una sola instancia guarda el estado, las sesiones y las entregas de webhooks,
// atiende el login y las acciones, y empuja cada cambio a los navegadores conectados por WebSocket (con hibernación).

import {
  aplicarJobs, aplicarLectura, aplicarWebhook, enCurso, estadoVacio, notasDeComentarios, podar,
} from './estado.js';
import {
  bases, canjearCodigo, ErrorGitHub, firmaValida, GitHub, numeroValido, renovarToken, repoValido, shaValido, urlAutorizar,
} from './github.js';
import {
  cifrar, cookie, descifrar, esPropietario, huella, idAleatorio, importarClave, leerCookies, mismoOrigen,
} from './sesion.js';

const SESION = 'panel_sesion';
const ESTADO_LOGIN = 'panel_login';
const DURACION_SESION = 7 * 24 * 3600 * 1000;
const PASOS_MS = 10_000; // consulta de pasos mientras hay jobs en marcha y alguien mira
const REPOSO_MS = 60_000;
const CONCILIAR_MS = 5 * 60_000;
const ETIQUETAS_QUE_ARRANCAN = ['enjambre:planificar', 'enjambre:implementar', 'enjambre:analizar', 'enjambre:investigar', 'enjambre:revisar'];
// Etiquetas que no se ponen a mano: en-curso la gestiona el workflow (WIP) y revisar solo sirve en un PR.
export const ETIQUETAS_DE_SISTEMA = ['enjambre:en-curso'];
const ETIQUETAS_SOLO_PR = ['enjambre:revisar'];
const ETIQUETAS_DE_TRABAJO = ['enjambre:planificar', 'enjambre:implementar', 'enjambre:analizar'];

/**
 * Acciones del flujo (ADR 0015 y 0014). Cada una pone la etiqueta que arranca a un agente; si ya estaba, la quita y la
 * vuelve a poner, porque los workflows arrancan con el evento «labeled» y no con que la etiqueta exista.
 *   planificar  → jefe de proyecto escribe el plan (issue)
 *   analizar    → analista deja un informe (issue)
 *   implementar → puerta 1: Álvaro aprueba el plan y el implementador abre el PR (issue con plan)
 *   revisar     → revisor y seguridad vuelven a revisar (PR)
 */
export const ACCIONES = {
  planificar: { etiqueta: 'enjambre:planificar', en: 'issue' },
  analizar: { etiqueta: 'enjambre:analizar', en: 'issue' },
  implementar: { etiqueta: 'enjambre:implementar', en: 'issue', limpiar: ['enjambre:planificar', 'enjambre:analizar', 'enjambre:revisar'] },
  revisar: { etiqueta: 'enjambre:revisar', en: 'pr' },
};

const json = (datos, estado = 200, cabeceras = {}) =>
  new Response(JSON.stringify(datos), { status: estado, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cabeceras } });
const texto = (t, estado) => new Response(t, { status: estado, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export class Sala {
  constructor(ctx, env, { fetch: f = (...a) => fetch(...a), ahora = () => Date.now() } = {}) {
    this.ctx = ctx;
    this.env = env;
    this.f = f;
    this.ahora = ahora;
    this.estado = null;
    this.difusion = null;
    const { api, web } = bases(env);
    this.api = api;
    this.web = web;
    // El navegador hace ping cada 25 s; se responde sin despertar al objeto.
    if (typeof WebSocketRequestResponsePair === 'function') {
      ctx.setWebSocketAutoResponse?.(new WebSocketRequestResponsePair('ping', 'pong'));
    }
  }

  // ---------------------------------------------------------------- estado

  async cargar() {
    if (!this.estado) this.estado = (await this.ctx.storage.get('estado')) ?? estadoVacio();
    return this.estado;
  }

  async guardar() {
    podar(this.estado, this.ahora());
    await this.ctx.storage.put('estado', this.estado);
  }

  difundir() {
    clearTimeout(this.difusion);
    this.difusion = setTimeout(() => {
      const mensaje = JSON.stringify({ tipo: 'estado', estado: this.estado });
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(mensaje);
        } catch {
          // conexión cerrada: la limpia el runtime
        }
      }
    }, 150);
  }

  async programar(ms) {
    const actual = await this.ctx.storage.getAlarm();
    const cuando = this.ahora() + ms;
    if (actual === null || actual > cuando) await this.ctx.storage.setAlarm(cuando);
  }

  // ---------------------------------------------------------------- sesiones

  async clave() {
    return (this._clave ??= await importarClave(this.env.CLAVE_SESION));
  }

  async sesionDe(request) {
    const id = leerCookies(request.headers.get('cookie')).get(SESION);
    if (!id) return null;
    const k = 'sesion:' + (await huella(id));
    const s = await this.ctx.storage.get(k);
    if (!s || s.caduca < this.ahora() || !esPropietario(this.env, s.login)) return null;
    return { ...s, k };
  }

  /** Token vigente de la sesión; lo renueva si caduca en menos de 5 min. */
  async tokenDe(s) {
    const clave = await this.clave();
    if (s.expira && s.expira - this.ahora() < 5 * 60_000) {
      if (!s.refresh) throw new ErrorGitHub(401, 'La sesión de GitHub ha caducado: vuelve a entrar');
      const nuevo = await renovarToken({
        web: this.web, clientId: this.env.GITHUB_CLIENT_ID, clientSecret: this.env.GITHUB_CLIENT_SECRET,
        refresh: await descifrar(clave, s.refresh), fetch: this.f,
      });
      s.token = await cifrar(clave, nuevo.token);
      s.refresh = nuevo.refresh ? await cifrar(clave, nuevo.refresh) : s.refresh;
      s.expira = nuevo.expira;
      const { k, ...guardar } = s;
      await this.ctx.storage.put(k, guardar);
      return nuevo.token;
    }
    return descifrar(clave, s.token);
  }

  async github(s, limite = 40) {
    return new GitHub({ token: await this.tokenDe(s), api: this.api, limite, fetch: this.f });
  }

  // ---------------------------------------------------------------- entrada

  async fetch(request) {
    const url = new URL(request.url);
    const ruta = url.pathname;
    try {
      if (ruta === '/webhook' && request.method === 'POST') return await this.webhook(request);
      if (ruta === '/login' && request.method === 'GET') return this.login(url);
      if (ruta === '/callback' && request.method === 'GET') {
        // Los fallos del login suelen ser de configuración (client secret, CLAVE_SESION): se dicen tal cual.
        // Los mensajes solo llevan el código de error de GitHub o el nombre del secreto, nunca su valor.
        try {
          return await this.callback(request, url);
        } catch (e) {
          console.error('callback', e.message);
          return texto(`No se pudo entrar: ${e.message}`, 502);
        }
      }
      if (ruta === '/ws') return await this.conectar(request);
      if (ruta.startsWith('/api/') || ruta === '/salir') return await this.apiProtegida(request, url);
      return texto('No encontrado', 404);
    } catch (e) {
      console.error(ruta, e.message);
      if (e instanceof ErrorGitHub) return json({ error: e.message, github: e.estado }, e.estado === 401 ? 401 : 502);
      return json({ error: 'Error interno del panel' }, 500);
    }
  }

  async webhook(request) {
    if (!this.env.WEBHOOK_SECRET) return texto('Falta WEBHOOK_SECRET', 500);
    const cuerpo = await request.arrayBuffer();
    if (!(await firmaValida(this.env.WEBHOOK_SECRET, cuerpo, request.headers.get('x-hub-signature-256')))) {
      return texto('Firma no válida', 401);
    }
    const entrega = request.headers.get('x-github-delivery') ?? '';
    const tipo = request.headers.get('x-github-event') ?? '';
    if (entrega) {
      const k = 'entrega:' + entrega.slice(0, 80);
      if (await this.ctx.storage.get(k)) return texto('Repetida', 200);
      await this.ctx.storage.put(k, this.ahora());
    }
    let p;
    try {
      p = JSON.parse(new TextDecoder().decode(cuerpo));
    } catch {
      return texto('JSON no válido', 400);
    }
    await this.cargar();
    const cambio = aplicarWebhook(this.estado, tipo, p, new Date(this.ahora()).toISOString());
    await this.guardar();
    this.difundir();
    if (cambio && (tipo === 'workflow_job' || tipo === 'workflow_run')) await this.programar(2000);
    if (Math.random() < 0.02) await this.limpiarEntregas();
    return texto('OK', 200);
  }

  async limpiarEntregas() {
    const limite = this.ahora() - 24 * 3600 * 1000;
    const viejas = [...(await this.ctx.storage.list({ prefix: 'entrega:' })).entries()].filter(([, t]) => t < limite).map(([k]) => k);
    for (let i = 0; i < viejas.length; i += 128) await this.ctx.storage.delete(viejas.slice(i, i + 128));
  }

  login(url) {
    if (!this.env.GITHUB_CLIENT_ID || !this.env.GITHUB_CLIENT_SECRET || !this.env.CLAVE_SESION) {
      return texto('El panel aún no está configurado: faltan GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET o CLAVE_SESION (docs/panel.md).', 500);
    }
    const estado = idAleatorio(24);
    return new Response(null, {
      status: 302,
      headers: {
        location: urlAutorizar(this.web, this.env.GITHUB_CLIENT_ID, `${url.origin}/callback`, estado),
        'set-cookie': cookie(ESTADO_LOGIN, estado, { maxAge: 600, sameSite: 'Lax', path: '/callback' }),
        'cache-control': 'no-store',
      },
    });
  }

  async callback(request, url) {
    const esperado = leerCookies(request.headers.get('cookie')).get(ESTADO_LOGIN);
    const recibido = url.searchParams.get('state');
    const codigo = url.searchParams.get('code');
    if (!esperado || !recibido || esperado !== recibido || !codigo) return texto('Login no válido: vuelve a empezar desde el panel.', 400);
    const t = await canjearCodigo({
      web: this.web, clientId: this.env.GITHUB_CLIENT_ID, clientSecret: this.env.GITHUB_CLIENT_SECRET,
      codigo, redirect: `${url.origin}/callback`, fetch: this.f,
    });
    const yo = await new GitHub({ token: t.token, api: this.api, limite: 1, fetch: this.f }).get('/user');
    if (!esPropietario(this.env, yo?.login)) return texto(`La cuenta ${yo?.login ?? '?'} no tiene acceso a este panel.`, 403);
    const clave = await this.clave();
    const id = idAleatorio();
    await this.ctx.storage.put('sesion:' + (await huella(id)), {
      login: yo.login,
      token: await cifrar(clave, t.token),
      refresh: t.refresh ? await cifrar(clave, t.refresh) : null,
      expira: t.expira,
      caduca: this.ahora() + DURACION_SESION,
      csrf: idAleatorio(24),
    });
    const h = new Headers({ location: '/', 'cache-control': 'no-store' });
    h.append('set-cookie', cookie(SESION, id, { maxAge: DURACION_SESION / 1000 }));
    h.append('set-cookie', cookie(ESTADO_LOGIN, '', { maxAge: 0, sameSite: 'Lax', path: '/callback' }));
    return new Response(null, { status: 302, headers: h });
  }

  async conectar(request) {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return texto('Se espera WebSocket', 426);
    if (!mismoOrigen(request)) return texto('Origen no permitido', 403);
    const s = await this.sesionDe(request);
    if (!s) return texto('Sin sesión', 401);
    const par = new WebSocketPair();
    const [cliente, servidor] = Object.values(par);
    this.ctx.acceptWebSocket(servidor, [s.k]);
    await this.cargar();
    servidor.send(JSON.stringify({ tipo: 'estado', estado: this.estado }));
    // Al abrir el panel se concilia enseguida con GitHub.
    this.estado.conciliarYa = true;
    await this.programar(500);
    return new Response(null, { status: 101, webSocket: cliente });
  }

  async webSocketMessage(ws, mensaje) {
    if (mensaje === 'ping') ws.send('pong');
  }

  async webSocketClose(ws, codigo) {
    try {
      ws.close(codigo, 'cerrado');
    } catch {
      // ya cerrado
    }
  }

  // ---------------------------------------------------------------- API protegida

  async apiProtegida(request, url) {
    const s = await this.sesionDe(request);
    // La página pregunta quién es antes de entrar: sin sesión responde «nadie» en vez de un error.
    if (!s && url.pathname === '/api/yo' && request.method === 'GET') return json({ login: null });
    if (!s) return json({ error: 'Sin sesión' }, 401);
    const escritura = request.method !== 'GET';
    if (escritura && (!mismoOrigen(request) || request.headers.get('x-panel-csrf') !== s.csrf)) {
      return json({ error: 'Petición rechazada (origen o CSRF)' }, 403);
    }
    const ruta = url.pathname;
    if (ruta === '/salir' && request.method === 'POST') {
      await this.ctx.storage.delete(s.k);
      return json({ ok: true }, 200, { 'set-cookie': cookie(SESION, '', { maxAge: 0 }) });
    }
    if (ruta === '/api/yo') return json({ login: s.login, csrf: s.csrf });
    if (ruta === '/api/estado') return json(await this.cargar());

    const datos = escritura ? await request.json().catch(() => ({})) : Object.fromEntries(url.searchParams);
    if (ruta === '/api/conciliar' && escritura) {
      await this.cargar();
      this.estado.conciliarYa = true;
      await this.programar(100);
      return json({ ok: true });
    }

    const repo = datos.repo;
    if (!repoValido(repo)) return json({ error: 'Repo no válido' }, 400);
    const gh = await this.github(s, 20);

    if (ruta === '/api/etiquetas' && !escritura) {
      const ls = await gh.get(`/repos/${repo}/labels?per_page=100`);
      return json(ls.map((l) => ({
        nombre: l.name, color: l.color, descripcion: l.description ?? '', arranca: ETIQUETAS_QUE_ARRANCAN.includes(l.name),
        sistema: ETIQUETAS_DE_SISTEMA.includes(l.name), soloPr: ETIQUETAS_SOLO_PR.includes(l.name),
      })));
    }

    const numero = Number(datos.numero);
    if (!numeroValido(numero)) return json({ error: 'Número no válido' }, 400);

    if (ruta === '/api/pr' && !escritura) return json(await this.detallePr(gh, repo, numero));
    if (ruta === '/api/issue' && !escritura) return json(await this.detalleIssue(gh, repo, numero));
    if (ruta === '/api/accion' && escritura) return this.accion(gh, repo, numero, String(datos.accion ?? ''));

    if (ruta === '/api/etiqueta' && escritura) {
      const etiqueta = String(datos.etiqueta ?? '');
      if (!etiqueta || etiqueta.length > 100) return json({ error: 'Etiqueta no válida' }, 400);
      if (datos.accion === 'poner' && ETIQUETAS_DE_SISTEMA.includes(etiqueta)) {
        return json({ error: `«${etiqueta}» la pone y la quita el propio workflow; no se pone a mano` }, 400);
      }
      if (datos.accion === 'poner') {
        const existentes = await gh.get(`/repos/${repo}/labels?per_page=100`);
        if (!existentes.some((l) => l.name === etiqueta)) return json({ error: `La etiqueta «${etiqueta}» no existe en ${repo}` }, 400);
        await gh.post(`/repos/${repo}/issues/${numero}/labels`, { labels: [etiqueta] });
      } else if (datos.accion === 'quitar') {
        await gh.delete(`/repos/${repo}/issues/${numero}/labels/${encodeURIComponent(etiqueta)}`);
      } else {
        return json({ error: 'Acción no válida' }, 400);
      }
      return json({ ok: true });
    }

    if (ruta === '/api/aprobar' && escritura) {
      if (!shaValido(datos.sha)) return json({ error: 'Falta el commit que estás aprobando' }, 400);
      const cuerpo = String(datos.comentario ?? '').slice(0, 5000);
      const r = await gh.post(`/repos/${repo}/pulls/${numero}/reviews`, { event: 'APPROVE', commit_id: datos.sha, ...(cuerpo ? { body: cuerpo } : {}) });
      return json({ ok: true, url: r?.html_url ?? null });
    }

    if (ruta === '/api/fusionar' && escritura) {
      if (!shaValido(datos.sha)) return json({ error: 'Falta el commit que estás fusionando' }, 400);
      const metodo = ['squash', 'merge', 'rebase'].includes(datos.metodo) ? datos.metodo : 'squash';
      // Con `sha`, GitHub rechaza la fusión si la cabeza del PR ya no es la que viste.
      const r = await gh.put(`/repos/${repo}/pulls/${numero}/merge`, { sha: datos.sha, merge_method: metodo });
      return json({ ok: Boolean(r?.merged), sha: r?.sha ?? null, mensaje: r?.message ?? null });
    }

    return json({ error: 'No encontrado' }, 404);
  }

  async accion(gh, repo, n, nombre) {
    const a = ACCIONES[nombre];
    if (!a) return json({ error: 'Acción no válida' }, 400);
    const issue = await gh.get(`/repos/${repo}/issues/${n}`);
    const esPr = Boolean(issue.pull_request);
    if (a.en === 'pr' && !esPr) return json({ error: 'Esa acción es para un PR' }, 400);
    if (a.en === 'issue' && esPr) return json({ error: 'Esa acción es para una issue' }, 400);
    if (issue.state !== 'open') return json({ error: `#${n} está cerrada` }, 409);
    const etiquetas = (issue.labels ?? []).map((l) => l.name);
    if (nombre === 'implementar') {
      if (etiquetas.includes('enjambre:en-curso')) return json({ error: `Ya hay un implementador trabajando en #${n}` }, 409);
      const comentarios = await gh.get(`/repos/${repo}/issues/${n}/comments?per_page=100`);
      const { plan } = notasDeComentarios(comentarios, repo.split('/')[0]);
      if (!plan) return json({ error: `#${n} no tiene plan: pulsa «Planificar» y espera al jefe de proyecto` }, 409);
    }
    // Lo que sobra o confunde (p. ej. planificar puesto a la vez que implementar) se quita antes; quitar no arranca nada.
    for (const sobra of [...(a.limpiar ?? []), a.etiqueta]) {
      if (etiquetas.includes(sobra)) await gh.delete(`/repos/${repo}/issues/${n}/labels/${encodeURIComponent(sobra)}`);
    }
    await gh.post(`/repos/${repo}/issues/${n}/labels`, { labels: [a.etiqueta] });
    return json({ ok: true, etiqueta: a.etiqueta });
  }

  async detalleIssue(gh, repo, n) {
    const [issue, comentarios] = await Promise.all([
      gh.get(`/repos/${repo}/issues/${n}`),
      gh.get(`/repos/${repo}/issues/${n}/comments?per_page=100`),
    ]);
    if (issue.pull_request) return { error: 'Es un PR', esPr: true };
    await this.cargar();
    aplicarLectura(this.estado, repo, { issues: [issue], comentariosIssues: { [n]: comentarios }, contar: false }, new Date(this.ahora()).toISOString());
    await this.guardar();
    this.difundir();
    const { plan } = notasDeComentarios(comentarios, repo.split('/')[0]);
    return {
      numero: n,
      titulo: issue.title,
      cuerpo: issue.body ?? '',
      estado: issue.state,
      etiquetas: (issue.labels ?? []).map((l) => l.name),
      autor: issue.user?.login,
      url: issue.html_url,
      plan,
      comentarios: comentarios.map((c) => ({
        autor: c.user?.login, fecha: c.created_at, cuerpo: c.body ?? '', url: c.html_url,
        esPlan: Boolean(plan && plan.url === c.html_url),
      })),
    };
  }

  async detallePr(gh, repo, n) {
    const pr = await gh.get(`/repos/${repo}/pulls/${n}`);
    const sha = pr.head.sha;
    const [ficheros, comentarios, resenas, estados, checks] = await Promise.all([
      gh.get(`/repos/${repo}/pulls/${n}/files?per_page=100`),
      gh.get(`/repos/${repo}/issues/${n}/comments?per_page=100`),
      gh.get(`/repos/${repo}/pulls/${n}/reviews?per_page=100`),
      gh.get(`/repos/${repo}/commits/${sha}/status`),
      gh.get(`/repos/${repo}/commits/${sha}/check-runs?per_page=100`),
    ]);
    // De paso, el estado del panel se pone al día con esta lectura.
    await this.cargar();
    aplicarLectura(this.estado, repo, {
      prs: [pr],
      contar: false,
      detalles: { [n]: { estados: estados.statuses, checks: checks.check_runs, comentarios, resenas } },
    }, new Date(this.ahora()).toISOString());
    await this.guardar();
    this.difundir();
    const MAX_PATCH = 20_000;
    return {
      numero: n,
      titulo: pr.title,
      cuerpo: pr.body ?? '',
      estado: pr.merged ? 'merged' : pr.state,
      borrador: pr.draft,
      autor: pr.user?.login,
      rama: pr.head.ref,
      base: pr.base.ref,
      sha,
      url: pr.html_url,
      fusionable: pr.mergeable,
      estadoFusion: pr.mergeable_state,
      adiciones: pr.additions,
      borrados: pr.deletions,
      ficheros: ficheros.map((f) => ({
        nombre: f.filename, estado: f.status, adiciones: f.additions, borrados: f.deletions,
        parche: f.patch ? f.patch.slice(0, MAX_PATCH) : null, recortado: (f.patch?.length ?? 0) > MAX_PATCH,
      })),
      comentarios: comentarios.map((c) => ({ autor: c.user?.login, fecha: c.created_at, cuerpo: c.body ?? '', url: c.html_url })),
      resenas: resenas.map((r) => ({ autor: r.user?.login, estado: r.state, fecha: r.submitted_at, sha: r.commit_id, cuerpo: r.body ?? '' })),
      estados: estados.statuses.map((x) => ({ contexto: x.context, estado: x.state, url: x.target_url })),
      combinado: estados.state,
      checks: checks.check_runs.map((c) => ({ nombre: c.name, estado: c.status, conclusion: c.conclusion, url: c.html_url })),
    };
  }

  // ---------------------------------------------------------------- alarma: pasos en vivo y conciliación

  async sesionActiva() {
    for (const ws of this.ctx.getWebSockets()) {
      for (const k of this.ctx.getTags?.(ws) ?? []) {
        const s = await this.ctx.storage.get(k);
        if (s && s.caduca > this.ahora() && esPropietario(this.env, s.login)) return { ...s, k };
      }
    }
    return null;
  }

  async alarm() {
    await this.cargar();
    if (!this.ctx.getWebSockets().length) return; // nadie mira: los webhooks bastan
    const s = await this.sesionActiva();
    if (!s) return;
    let cambio = false;
    try {
      const gh = await this.github(s, 40);
      cambio = (await this.actualizarPasos(gh)) || cambio;
      const ultima = Date.parse(this.estado.ultimaConciliacion ?? 0);
      if (this.estado.conciliarYa || this.estado.cursor || this.ahora() - ultima > CONCILIAR_MS) {
        cambio = (await this.conciliarSiguiente(gh)) || cambio;
      }
      if (this.estado.error) {
        this.estado.error = null;
        cambio = true;
      }
    } catch (e) {
      this.estado.error = e instanceof ErrorGitHub ? e.message : 'Error al leer GitHub';
      cambio = true;
    }
    if (cambio) {
      await this.guardar();
      this.difundir();
    }
    await this.ctx.storage.setAlarm(this.ahora() + (enCurso(this.estado).length || this.estado.cursor ? PASOS_MS : REPOSO_MS));
  }

  /** Pasos de los jobs en marcha: GitHub no manda un webhook por paso. */
  async actualizarPasos(gh) {
    let cambio = false;
    for (const { repo, id } of enCurso(this.estado).slice(0, 6)) {
      const r = await gh.get(`/repos/${repo}/actions/runs/${id}/jobs?per_page=50`);
      cambio = aplicarJobs(this.estado, repo, id, r.jobs ?? []) || cambio;
    }
    return cambio;
  }

  /** Concilia un repo por tic para no pasar del presupuesto de peticiones. Devuelve true si cambió algo. */
  async conciliarSiguiente(gh) {
    let cursor = this.estado.cursor ?? 0;
    if (cursor === 0 || !this.estado.reposInstalados?.length) {
      const inst = await gh.get('/user/installations?per_page=100');
      const repos = [];
      for (const i of inst.installations ?? []) {
        const r = await gh.get(`/user/installations/${i.id}/repositories?per_page=100`);
        for (const x of r.repositories ?? []) repos.push(x.full_name);
      }
      this.estado.reposInstalados = repos.sort();
      cursor = 0;
    }
    const nombre = this.estado.reposInstalados[cursor];
    if (!nombre) {
      this.estado.cursor = 0;
      this.estado.conciliarYa = false;
      this.estado.ultimaConciliacion = new Date(this.ahora()).toISOString();
      return true;
    }
    const [issues, prs, recientes, corriendo] = await Promise.all([
      gh.get(`/repos/${nombre}/issues?state=open&per_page=100`),
      gh.get(`/repos/${nombre}/pulls?state=open&per_page=50`),
      gh.get(`/repos/${nombre}/actions/runs?per_page=20`),
      gh.get(`/repos/${nombre}/actions/runs?status=in_progress&per_page=30`),
    ]);
    const detalles = {};
    for (const pr of prs.slice(0, 8)) {
      if (gh.quedan() < 6) break;
      const [estados, checks, comentarios] = await Promise.all([
        gh.get(`/repos/${nombre}/commits/${pr.head.sha}/status`),
        gh.get(`/repos/${nombre}/commits/${pr.head.sha}/check-runs?per_page=100`),
        gh.get(`/repos/${nombre}/issues/${pr.number}/comments?per_page=100`),
      ]);
      detalles[pr.number] = { estados: estados.statuses, checks: checks.check_runs, comentarios };
    }
    // Plan y última nota de agente de las issues en el flujo (las que tienen una etiqueta de trabajo).
    const comentariosIssues = {};
    for (const i of issues.filter((x) => !x.pull_request && (x.labels ?? []).some((l) => ETIQUETAS_DE_TRABAJO.includes(l.name))).slice(0, 6)) {
      if (gh.quedan() < 6) break;
      comentariosIssues[i.number] = await gh.get(`/repos/${nombre}/issues/${i.number}/comments?per_page=100`);
    }
    const porId = new Map([...(recientes.workflow_runs ?? []), ...(corriendo.workflow_runs ?? [])].map((r) => [r.id, r]));
    const { pendientes } = aplicarLectura(this.estado, nombre, {
      issues, prs, ejecuciones: [...porId.values()], detalles, comentariosIssues, completa: true,
    }, new Date(this.ahora()).toISOString());
    // Ejecuciones que el panel cree en marcha y GitHub ya no lista entre las recientes: se leen una a una.
    const leidas = [];
    for (const id of pendientes.slice(0, 5)) {
      if (gh.quedan() < 1) break;
      leidas.push(await gh.get(`/repos/${nombre}/actions/runs/${id}`));
    }
    if (leidas.length) aplicarLectura(this.estado, nombre, { ejecuciones: leidas }, new Date(this.ahora()).toISOString());
    this.estado.cursor = cursor + 1;
    if (this.estado.cursor >= this.estado.reposInstalados.length) {
      this.estado.cursor = 0;
      this.estado.conciliarYa = false;
      this.estado.ultimaConciliacion = new Date(this.ahora()).toISOString();
    }
    return true;
  }
}
