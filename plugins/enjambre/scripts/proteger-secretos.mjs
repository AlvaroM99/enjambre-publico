// Hook PreToolUse: impide que los agentes lean, escriban o busquen en ficheros con secretos o datos reales.
// Cubre herramientas de ficheros (rutas) y comandos de shell (texto del comando).
import { leerEntrada, bloquear, permitir, comandoDe, esPrincipal } from './lib/comun.mjs';

// Cada regla: nombre y expresión que se busca en rutas normalizadas (con «/»).
export const PROTEGIDOS = [
  ['env', /(^|[\/\s"'=:])\.env(?!\.example\b|\.sample\b|\.template\b)(\.[\w-]+)?(?=$|[\/\s"';|&)<>*])/i],
  ['dev-vars', /(^|[\/\s"'=:])\.dev\.vars\b/i],
  ['datos', /(^|[\/\s"'=:])datos(\/|$|[\s"';|&)])/i],
  ['clave-local', /\.clave-local\b/i],
  ['credenciales-claude', /\.credentials\.json\b/i],
  ['ssh', /(^|[\/\s"'=:~])\.ssh(\/|$|[\s"'])/i],
  ['estado-wrangler', /\.wrangler\/state\b/i],
  ['claves-privadas', /\b(id_rsa|id_ed25519)\b|\.pem\b|\.p12\b|\.pfx\b/i],
];

// Configuración que solo cambia Álvaro (permisos, hooks, políticas gestionadas).
const CONFIGURACION = /(\.claude\/(settings(\.local)?\.json|hooks\/)|managed-settings\.json$|(^|\/)hooks\/hooks\.json$)/i;

// En Grep, «pattern» es el texto buscado (no una ruta); en Glob sí es un patrón de rutas.
const CAMPOS_RUTA = {
  Read: ['file_path'], Edit: ['file_path'], Write: ['file_path'], NotebookEdit: ['notebook_path'],
  Grep: ['path', 'glob'], Glob: ['path', 'pattern'],
};

export function evaluar(entrada) {
  const herramienta = entrada?.tool_name ?? '';
  const textos = [];
  if (herramienta === 'Bash' || herramienta === 'PowerShell') {
    textos.push(comandoDe(entrada));
  } else {
    for (const campo of CAMPOS_RUTA[herramienta] ?? ['file_path', 'path']) {
      const valor = entrada?.tool_input?.[campo];
      if (typeof valor === 'string') textos.push(valor);
    }
  }
  // Los agentes no cambian sus propios permisos ni hooks (OWASP ASI: agentes que se reconfiguran).
  if (['Edit', 'Write', 'NotebookEdit'].includes(herramienta)) {
    for (const texto of textos) {
      if (CONFIGURACION.test(texto.replace(/\\/g, '/'))) return 'configuracion-claude';
    }
  }
  for (const texto of textos) {
    const normal = texto.replace(/\\/g, '/');
    for (const [regla, expresion] of PROTEGIDOS) {
      if (expresion.test(normal)) return regla;
    }
  }
  return null;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/').replace(/^(?=[A-Za-z]:)/, '/')}`) {
  const entrada = await leerEntrada();
  const regla = evaluar(entrada);
  if (regla) {
    bloquear(regla, `Enjambre (proteger-secretos): acceso bloqueado a un recurso protegido (${regla}). Los secretos y datos reales solo los gestiona Álvaro. Si necesitas un valor, pídeselo en el issue sin incluirlo en el código.`, entrada);
  }
  permitir();
}
