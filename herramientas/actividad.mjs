// Resume actividad.jsonl (hook registrar-actividad): ejecuciones, duración y tokens por agente. Historia S25.
// Uso: node herramientas/actividad.mjs [ruta/actividad.jsonl]
// Sin ruta, busca en la carpeta temporal de Enjambre; con el plugin instalado, la ruta está en la carpeta de datos
// del plugin (variable CLAUDE_PLUGIN_DATA dentro de Claude Code).
import { readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function resumirActividad(lineas) {
  const abiertos = new Map();
  const agentes = {};
  for (const linea of lineas) {
    let r;
    try { r = JSON.parse(linea); } catch { continue; }
    if (!r?.agente) continue;
    const a = (agentes[r.agente] ??= { ejecuciones: 0, segundos: 0, tokens_entrada: 0, tokens_salida: 0, tokens_cache: 0 });
    const clave = r.agent_id ?? `${r.sesion}:${r.agente}`;
    if (r.evento === 'inicio') {
      abiertos.set(clave, Date.parse(r.fecha));
      continue;
    }
    a.ejecuciones += 1;
    if (abiertos.has(clave)) {
      a.segundos += Math.max(0, Math.round((Date.parse(r.fecha) - abiertos.get(clave)) / 1000));
      abiertos.delete(clave);
    }
    if (r.tokens) {
      a.tokens_entrada += r.tokens.entrada ?? 0;
      a.tokens_salida += r.tokens.salida ?? 0;
      a.tokens_cache += (r.tokens.cache_lectura ?? 0) + (r.tokens.cache_escritura ?? 0);
    }
  }
  return agentes;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const ruta = process.argv[2] ?? join(tmpdir(), 'enjambre', 'actividad.jsonl');
  if (!existsSync(ruta)) {
    console.error(`No existe ${ruta}. Pasa la ruta de actividad.jsonl como argumento.`);
    process.exit(1);
  }
  const resumen = resumirActividad(readFileSync(ruta, 'utf8').split(/\r?\n/));
  console.table(Object.fromEntries(Object.entries(resumen).map(([k, v]) => [k, { ...v, minutos: +(v.segundos / 60).toFixed(1) }])));
}
