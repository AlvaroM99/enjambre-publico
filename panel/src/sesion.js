// Sesión del panel (ADR 0015): cookie opaca, token de GitHub cifrado con AES-GCM y defensa anti-CSRF.

const enc = new TextEncoder();
const dec = new TextDecoder();

const aBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const deBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const aBase64Url = (bytes) => aBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function idAleatorio(bytes = 32) {
  return aBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Huella SHA-256 de un id de sesión: en el almacén se guarda la huella, nunca el id de la cookie. */
export async function huella(texto) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(texto)));
  return aBase64Url(h);
}

/** CLAVE_SESION: 32 bytes en base64 (npm run clave). */
export async function importarClave(base64) {
  let bytes;
  try {
    bytes = deBase64(base64 ?? '');
  } catch {
    bytes = new Uint8Array();
  }
  if (bytes.length !== 32) throw new Error(`CLAVE_SESION debe ser de 32 bytes en base64 (tiene ${bytes.length}); genera una con npm run clave en panel/`);
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function cifrar(clave, texto) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, enc.encode(texto)));
  const todo = new Uint8Array(iv.length + ct.length);
  todo.set(iv);
  todo.set(ct, iv.length);
  return aBase64(todo);
}

export async function descifrar(clave, b64) {
  const todo = deBase64(b64);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: todo.slice(0, 12) }, clave, todo.slice(12));
  return dec.decode(pt);
}

export function leerCookies(cabecera) {
  const m = new Map();
  for (const parte of (cabecera ?? '').split(';')) {
    const i = parte.indexOf('=');
    if (i > 0) m.set(parte.slice(0, i).trim(), parte.slice(i + 1).trim());
  }
  return m;
}

export function cookie(nombre, valor, { maxAge, sameSite = 'Strict', path = '/' } = {}) {
  const partes = [`${nombre}=${valor}`, `Path=${path}`, 'HttpOnly', 'Secure', `SameSite=${sameSite}`];
  if (maxAge !== undefined) partes.push(`Max-Age=${maxAge}`);
  return partes.join('; ');
}

/** La petición viene de la propia página: Origin igual al del panel. */
export function mismoOrigen(request) {
  const origen = request.headers.get('origin');
  return Boolean(origen) && origen === new URL(request.url).origin;
}

export function esPropietario(env, login) {
  const lista = (env.PROPIETARIOS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return Boolean(login) && lista.includes(String(login).toLowerCase());
}
