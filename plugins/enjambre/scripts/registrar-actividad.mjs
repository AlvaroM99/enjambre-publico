// Hook SubagentStart / SubagentStop: registra cuándo empieza y termina cada agente de Enjambre en
// actividad.jsonl (carpeta de datos del plugin). Sirve para el tablero de carriles, métricas de tiempo por agente
// y visores como Pixel Agents. Nunca bloquea: sale siempre con 0 (en SubagentStop, un 2 impediría parar).
// Campos de entrada: https://code.claude.com/docs/en/hooks («Common input fields»: agent_id, agent_type).
import { appendFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { esPrincipal } from './lib/comun.mjs';

// Solo lo que hace falta para medir; nunca el contenido de la conversación ni la salida de herramientas.
export function evento(entrada, fecha = new Date()) {
  const agente = String(entrada?.agent_type ?? '');
  if (!/^(enjambre:)?enjambre-[a-z-]+$/.test(agente)) return null;
  return {
    fecha: fecha.toISOString(),
    evento: entrada.hook_event_name === 'SubagentStop' ? 'fin' : 'inicio',
    agente: agente.replace(/^enjambre:/, ''),
    agent_id: entrada.agent_id ?? null,
    sesion: entrada.session_id ?? null,
  };
}

export function rutaRegistro(env = process.env) {
  return join(env.CLAUDE_PLUGIN_DATA || join(tmpdir(), 'enjambre'), 'actividad.jsonl');
}

if (esPrincipal(import.meta.url)) {
  try {
    let texto = '';
    for await (const trozo of process.stdin) texto += trozo;
    const registro = evento(JSON.parse(texto));
    if (registro) {
      const ruta = rutaRegistro();
      mkdirSync(join(ruta, '..'), { recursive: true });
      appendFileSync(ruta, JSON.stringify(registro) + '\n');
    }
  } catch {
    // El registro es informativo: un fallo nunca debe parar a un agente.
  }
  process.exit(0);
}
