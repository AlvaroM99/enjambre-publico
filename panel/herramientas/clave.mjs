// Genera una CLAVE_SESION (32 bytes aleatorios en base64) para `npx wrangler secret put CLAVE_SESION`.
// Se imprime una sola vez en tu terminal; no la guardes en ningún fichero del repo.
import { randomBytes } from 'node:crypto';

console.log(randomBytes(32).toString('base64'));
