// Utilidades comunes de los hooks de Enjambre.
// Contrato de Claude Code (PreToolUse): JSON por stdin; salida 0 = continuar; salida 2 = bloquear (motivo por stderr).
// Si la entrada no se puede leer, se bloquea (fallar cerrado).
import { appendFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function leerEntrada() {
  let texto = '';
  for await (const trozo of process.stdin) texto += trozo;
  try {
    return JSON.parse(texto);
  } catch {
    bloquear('entrada-invalida', 'Hook de Enjambre: no se pudo leer la entrada del hook; se bloquea por seguridad.');
  }
}

function registrar(evento) {
  try {
    const dir = process.env.CLAUDE_PLUGIN_DATA || join(tmpdir(), 'enjambre');
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'bloqueos.jsonl'), JSON.stringify({ fecha: new Date().toISOString(), ...evento }) + '\n');
  } catch {
    // El registro nunca debe impedir el bloqueo.
  }
}

export function bloquear(regla, motivo, entrada = {}) {
  registrar({ hook: process.argv[1]?.split(/[\\/]/).pop(), regla, herramienta: entrada.tool_name, sesion: entrada.session_id });
  process.stderr.write(motivo + '\n');
  process.exit(2);
}

export function permitir() {
  process.exit(0);
}

// Texto del comando para Bash y PowerShell.
export function comandoDe(entrada) {
  return String(entrada?.tool_input?.command ?? '');
}

// true si el módulo se ejecuta como script (no importado por las pruebas).
export function esPrincipal(url) {
  return Boolean(process.argv[1]) && pathToFileURL(resolve(process.argv[1])).href === url;
}
