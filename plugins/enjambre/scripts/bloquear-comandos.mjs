// Hook PreToolUse (Bash y PowerShell): bloquea comandos reservados a Álvaro.
// Despliegue y migraciones de producción, fusiones, pushes a main, borrados y gestión de secretos.
// Ver docs/anexos/B-arquitectura.md §6.2 y docs/decisiones/0001-via-y-arranque.md.
import { execFileSync } from 'node:child_process';
import { leerEntrada, bloquear, permitir, comandoDe, esPrincipal } from './lib/comun.mjs';

// Cada regla: [nombre, expresión, motivo]. Se evalúan sobre cada subcomando.
export const REGLAS = [
  ['wrangler-deploy-produccion', /\bwrangler\b.*\b(deploy|publish)\b(?!.*--env[= ]+preview\b)/i,
    'desplegar fuera del entorno preview (usa `wrangler deploy --env preview`)'],
  ['wrangler-remoto', /\bwrangler\b.*\bd1\b.*(--remote\b)/i,
    'ejecutar o migrar D1 en remoto'],
  ['wrangler-secretos', /\bwrangler\b.*\bsecret\b/i, 'gestionar secretos del Worker'],
  ['wrangler-destructivo', /\bwrangler\b.*\b(delete|rollback)\b/i, 'borrar o revertir Workers o recursos'],
  ['npm-reservado', /\bnpm\s+(run\s+)?(deploy|subir|clave|token|migrar)(?![:\w-])/i,
    'ejecutar scripts reservados (deploy, subir, clave, token, migrar remoto)'],
  ['git-push-forzado', /\bgit\b.*\bpush\b.*(\s--force(-with-lease)?\b|\s-[a-z]*f[a-z]*\b|\s\+\S)/i,
    'hacer push forzado'],
  ['git-push-main', /\bgit\b.*\bpush\b.*\s(\S+:)?(refs\/heads\/)?(main|master)(\s|$)/i,
    'hacer push directo a main/master (trabaja en ramas enjambre/* y abre un PR)'],
  ['gh-merge', /\bgh\s+pr\s+merge\b/i, 'fusionar PRs (lo hace Álvaro)'],
  ['gh-repo-admin', /\bgh\s+repo\s+(delete|archive|rename|edit)\b/i, 'administrar o borrar repositorios'],
  ['gh-secretos', /\bgh\s+(secret|variable|ruleset|auth)\b/i, 'gestionar secretos, reglas o credenciales de GitHub'],
  ['gh-api-borrado', /\bgh\s+api\b.*(-X\s*|--method[= ]\s*)(DELETE|PUT|PATCH)\b/i, 'modificar o borrar recursos por la API de GitHub'],
  ['borrado-masivo', /\brm\s+-[a-z]*r[a-z]*\s+(-[a-z]+\s+)*(\/|~|\$HOME|\.\.?)(\s|\/?$)|Remove-Item\b.*-Recurse\b.*\s([A-Za-z]:\\?|~|\$HOME|\.\.?)(\s|$)/i,
    'borrar de forma recursiva una carpeta raíz, el home o el proyecto'],
  ['descarga-ejecutada', /\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^|]*\|\s*(ba|z)?sh\b|\b(irm|iwr|Invoke-RestMethod|Invoke-WebRequest)\b[^|]*\|\s*(iex|Invoke-Expression)\b/i,
    'descargar y ejecutar scripts'],
  ['configuracion-claude', /(\.claude[\\/](settings(\.local)?\.json|hooks)|managed-settings\.json)/i,
    'cambiar permisos o hooks de Claude Code desde una tarea'],
];

// Divide por operadores de shell; suficiente para detección (no es un parser completo).
export function subcomandos(comando) {
  return comando.split(/&&|\|\||;|\r?\n|\|(?!\s*(?:ba|z)?sh\b|\s*iex\b|\s*Invoke-Expression\b)/).map((s) => s.trim()).filter(Boolean);
}

function ramaActual(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

export function evaluar(entrada, { rama = ramaActual } = {}) {
  const comando = comandoDe(entrada);
  for (const sub of [comando, ...subcomandos(comando)]) {
    for (const [nombre, expresion, motivo] of REGLAS) {
      if (expresion.test(sub)) return { nombre, motivo };
    }
  }
  // `git push` sin rama explícita estando en main/master.
  for (const sub of subcomandos(comando)) {
    if (/^\s*git\b.*\bpush\b/i.test(sub) && !/\bpush\s+\S+\s+\S+/i.test(sub)) {
      const actual = rama(entrada.cwd);
      if (actual === 'main' || actual === 'master') {
        return { nombre: 'git-push-main', motivo: 'hacer push estando en main/master (trabaja en ramas enjambre/* y abre un PR)' };
      }
    }
  }
  return null;
}

if (esPrincipal(import.meta.url)) {
  const entrada = await leerEntrada();
  const resultado = evaluar(entrada);
  if (resultado) {
    bloquear(resultado.nombre, `Enjambre (bloquear-comandos): no está permitido ${resultado.motivo}. Es una acción reservada a Álvaro; déjala indicada en el issue o en el PR.`, entrada);
  }
  permitir();
}
