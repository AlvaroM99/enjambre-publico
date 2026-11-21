// Hook SubagentStart / SubagentStop: registra cuándo empieza y termina cada agente de Enjambre, y al terminar
// los tokens que ha gastado (historia S25), en actividad.jsonl (carpeta de datos del plugin). Sirve para el tablero de carriles, métricas de tiempo por agente
// y visores como Pixel Agents. Nunca bloquea: sale siempre con 0 (en SubagentStop, un 2 impediría parar).
// Campos de entrada: https://code.claude.com/docs/en/hooks («Common input fields»: agent_id, agent_type).
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { esPrincipal } from './lib/comun.mjs';

// Suma los tokens de la transcripción del subagente (líneas JSONL con message.usage). Historia S25.
// El formato de la transcripción no está documentado como API estable [POR CONFIRMAR]: si no se puede leer, null.
export function contarTokens(ruta, leer = (r) => readFileSync(r, 'utf8')) {
  if (!ruta) return null;
  let texto;
  try { texto = leer(ruta); } catch { return null; }
  const total = { entrada: 0, salida: 0, cache_lectura: 0, cache_escritura: 0 };
  const vistos = new Set();
  for (const linea of texto.split(/\r?\n/)) {
    if (!linea.trim()) continue;
    let d;
    try { d = JSON.parse(linea); } catch { continue; }
    const u = d?.message?.usage;
    if (!u) continue;
    // Una misma respuesta puede aparecer en varias líneas (una por bloque): se cuenta una vez por id de mensaje.
    const id = d.message.id ?? d.uuid;
    if (id && vistos.has(id)) continue;
    if (id) vistos.add(id);
    total.entrada += u.input_tokens ?? 0;
    total.salida += u.output_tokens ?? 0;
    total.cache_lectura += u.cache_read_input_tokens ?? 0;
    total.cache_escritura += u.cache_creation_input_tokens ?? 0;
  }
  return total;
}

// Solo lo que hace falta para medir; nunca el contenido de la conversación ni la salida de herramientas.
export function evento(entrada, fecha = new Date(), leer) {
  const agente = String(entrada?.agent_type ?? '');
  if (!/^(enjambre:)?enjambre-[a-z-]+$/.test(agente)) return null;
  const fin = entrada.hook_event_name === 'SubagentStop';
  const registro = {
    fecha: fecha.toISOString(),
    evento: fin ? 'fin' : 'inicio',
    agente: agente.replace(/^enjambre:/, ''),
    agent_id: entrada.agent_id ?? null,
    sesion: entrada.session_id ?? null,
  };
  if (fin) registro.tokens = contarTokens(entrada.agent_transcript_path, leer);
  return registro;
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
