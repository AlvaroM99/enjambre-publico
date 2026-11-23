// Llamadas a la API del panel con la cookie de sesión y la cabecera anti-CSRF (ADR 0015).

export const sesion = { login: null, csrf: null, alSalir: null };

export async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const r = await fetch(ruta, {
    method: metodo,
    credentials: 'same-origin',
    headers: metodo === 'GET' ? {} : { 'content-type': 'application/json', 'x-panel-csrf': sesion.csrf },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) sesion.alSalir?.();
  if (!r.ok) throw new Error(d.error ?? `Error ${r.status}`);
  return d;
}

export const q = (o) => new URLSearchParams(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)]))).toString();
