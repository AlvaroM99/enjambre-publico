// Cabeceras de seguridad de todo lo que sale del panel (ADR 0015). Aparte de index.js: un módulo de Worker solo
// puede exportar manejadores y clases.

export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function conCabeceras(respuesta) {
  const r = new Response(respuesta.body, respuesta);
  r.headers.set('content-security-policy', CSP);
  r.headers.set('x-content-type-options', 'nosniff');
  r.headers.set('referrer-policy', 'no-referrer');
  r.headers.set('x-frame-options', 'DENY');
  r.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  r.headers.set('strict-transport-security', 'max-age=31536000');
  return r;
}
