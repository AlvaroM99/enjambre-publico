// Acceso a GitHub del panel (ADR 0015): firma de webhooks, login de la GitHub App y cliente mínimo de la API.

export const API = 'https://api.github.com';
export const WEB = 'https://github.com';
const enc = new TextEncoder();

/**
 * Bases de la API y la web. Solo se pueden cambiar a localhost (pruebas e2e con un GitHub falso): así, aunque alguien
 * pusiera una variable mal, el secreto de la app y los tokens nunca salen hacia otro servidor.
 */
export function bases(env = {}) {
  const local = (u) => typeof u === 'string' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(u);
  return { api: local(env.GITHUB_API) ? env.GITHUB_API : API, web: local(env.GITHUB_WEB) ? env.GITHUB_WEB : WEB };
}

function hexABytes(hex) {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
  const b = new Uint8Array(32);
  for (let i = 0; i < 32; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return b;
}

/** X-Hub-Signature-256 = HMAC-SHA256 del cuerpo con el secreto del webhook. crypto.subtle.verify compara en tiempo constante. */
export async function firmaValida(secreto, cuerpo, cabecera) {
  if (!secreto || typeof cabecera !== 'string' || !cabecera.startsWith('sha256=')) return false;
  const firma = hexABytes(cabecera.slice(7));
  if (!firma) return false;
  const clave = await crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', clave, firma, typeof cuerpo === 'string' ? enc.encode(cuerpo) : cuerpo);
}

/** Firma para pruebas y para el emisor de webhooks sintéticos. */
export async function firmar(secreto, cuerpo) {
  const clave = await crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const f = new Uint8Array(await crypto.subtle.sign('HMAC', clave, enc.encode(cuerpo)));
  return 'sha256=' + [...f].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------------ login (token de usuario de la GitHub App)

export function urlAutorizar(web, clientId, redirect, estado) {
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, state: estado });
  return `${web}/login/oauth/authorize?${q}`;
}

async function pedirToken(web, cuerpo, f) {
  const r = await f(`${web}/login/oauth/access_token`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'enjambre-panel' },
    body: JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error || !d.access_token) {
    const pista = d.error === 'incorrect_client_credentials' ? ' (revisa GITHUB_CLIENT_ID y GITHUB_CLIENT_SECRET: el secret es el «client secret» de la app, no la clave privada)' : '';
    throw new Error(`GitHub no dio el token: ${d.error ?? r.status}${pista}`);
  }
  const ahora = Date.now();
  return {
    token: d.access_token,
    expira: d.expires_in ? ahora + d.expires_in * 1000 : null,
    refresh: d.refresh_token ?? null,
    expiraRefresh: d.refresh_token_expires_in ? ahora + d.refresh_token_expires_in * 1000 : null,
  };
}

export function canjearCodigo({ web, clientId, clientSecret, codigo, redirect, fetch: f = fetch }) {
  return pedirToken(web, { client_id: clientId, client_secret: clientSecret, code: codigo, redirect_uri: redirect }, f);
}

export function renovarToken({ web, clientId, clientSecret, refresh, fetch: f = fetch }) {
  return pedirToken(web, { client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: refresh }, f);
}

// ------------------------------------------------------------------ API

export class ErrorGitHub extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
}

/**
 * Cliente mínimo con presupuesto de peticiones: un Worker gratuito tiene un tope de subpeticiones por invocación
 * (https://developers.cloudflare.com/workers/platform/limits/), así que cada tarea dice cuántas puede gastar.
 */
export class GitHub {
  constructor({ token, api = API, limite = 40, fetch: f = fetch }) {
    this.token = token;
    this.api = api;
    this.limite = limite;
    this.usadas = 0;
    this.f = f;
  }

  quedan() {
    return this.limite - this.usadas;
  }

  async pedir(metodo, ruta, cuerpo) {
    if (this.usadas >= this.limite) throw new ErrorGitHub(0, 'Presupuesto de peticiones agotado');
    this.usadas++;
    const r = await this.f(this.api + ruta, {
      method: metodo,
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'enjambre-panel',
        ...(cuerpo ? { 'content-type': 'application/json' } : {}),
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    this.anotarLimite(r);
    const texto = await r.text();
    let datos = null;
    try {
      datos = texto ? JSON.parse(texto) : null;
    } catch {
      datos = null;
    }
    if (!r.ok) throw new ErrorGitHub(r.status, traducir(r.status, datos?.message ?? `GitHub respondió ${r.status}`));
    return datos;
  }

  /** Límite de la API que queda (cabeceras x-ratelimit-*), para enseñarlo en la salud del panel. */
  anotarLimite(r) {
    const quedan = Number(r.headers?.get?.('x-ratelimit-remaining'));
    if (Number.isFinite(quedan) && r.headers.get('x-ratelimit-remaining') !== null) {
      this.limiteApi = { quedan, total: Number(r.headers.get('x-ratelimit-limit')) || null, reinicio: Number(r.headers.get('x-ratelimit-reset')) || null };
    }
  }

  get(ruta) {
    return this.pedir('GET', ruta);
  }
  post(ruta, cuerpo) {
    return this.pedir('POST', ruta, cuerpo ?? {});
  }
  put(ruta, cuerpo) {
    return this.pedir('PUT', ruta, cuerpo ?? {});
  }
  patch(ruta, cuerpo) {
    return this.pedir('PATCH', ruta, cuerpo ?? {});
  }
  delete(ruta) {
    return this.pedir('DELETE', ruta);
  }

  /** GraphQL (lo que la API REST no tiene, p. ej. marcar un PR listo para revisión). */
  async graphql(consulta, variables) {
    const d = await this.post('/graphql', { query: consulta, variables });
    if (d?.errors?.length) throw new ErrorGitHub(422, traducir(403, d.errors.map((e) => e.message).join('; ')));
    return d?.data;
  }

  /**
   * Texto de un recurso que GitHub sirve con una redirección (registros de un job). La redirección va a un almacén
   * firmado: se sigue a mano y sin el token, para no mandarlo a otro dominio.
   */
  async texto(ruta, maxBytes = 200_000) {
    if (this.usadas + 2 > this.limite) throw new ErrorGitHub(0, 'Presupuesto de peticiones agotado');
    this.usadas += 2;
    const r = await this.f(this.api + ruta, {
      headers: { authorization: `Bearer ${this.token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'enjambre-panel' },
      redirect: 'manual',
    });
    this.anotarLimite(r);
    let final = r;
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      final = await this.f(r.headers.get('location'), { headers: { 'user-agent': 'enjambre-panel' } });
    }
    if (!final.ok) throw new ErrorGitHub(final.status, traducir(final.status, `GitHub respondió ${final.status} al pedir ${ruta}`));
    const t = await final.text();
    return t.length > maxBytes ? t.slice(-maxBytes) : t;
  }
}

/** Mensajes de GitHub que, sin contexto, no dicen qué hacer. */
export function traducir(estado, mensaje) {
  if (estado === 403 && /not accessible by integration/i.test(mensaje)) {
    return 'La GitHub App no tiene permiso para esto. En la app, sube el permiso que haga falta (p. ej. «Actions: Read and write») y acepta los permisos nuevos en la instalación (docs/panel.md).';
  }
  if (estado === 405 && /merge/i.test(mensaje)) return `GitHub no deja fusionarlo: ${mensaje}`;
  return mensaje;
}

/** Valida «dueño/repo». */
export const repoValido = (r) =>
  typeof r === 'string' && /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(r) && !r.split('/').some((s) => /^\.+$/.test(s));
export const numeroValido = (n) => Number.isInteger(n) && n > 0 && n < 1e9;
// Ids de ejecuciones y jobs de GitHub Actions: pasan de 10^10 (p. ej. 45232925905 y 137896975655, finance_tracker 23-11-2026).
export const idValido = (n) => Number.isSafeInteger(n) && n > 0;
export const shaValido = (s) => typeof s === 'string' && /^[0-9a-f]{40}$/.test(s);
