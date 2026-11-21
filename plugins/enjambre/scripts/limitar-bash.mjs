// Hook PreToolUse (Bash y PowerShell): lista blanca de comandos para los agentes de Enjambre que no escriben código.
// Claude Code no deja limitar Bash por comando en el frontmatter de un subagente, pero los hooks del plugin se
// ejecutan también dentro de los subagentes y reciben `agent_type` con el nombre del agente
// (https://code.claude.com/docs/en/hooks, «Common input fields» y «Hook locations»).
// Los agentes que no aparecen en POLITICAS (sesión principal sin --agent, implementador, plataforma, verificador) no se limitan
// aquí; les siguen aplicando bloquear-comandos, proteger-secretos, las reglas deny y el sandbox.
// Ver docs/decisiones/0004-bash-por-agente.md.
import { leerEntrada, bloquear, permitir, comandoDe, esPrincipal } from './lib/comun.mjs';

// ---------- bloques de comandos permitidos (cada subcomando debe casar con alguno) ----------

const NAVEGAR = /^cd(\s+\S+)?$/;
const UTILIDADES = /^(ls|pwd|wc|head|tail|cat|sort|uniq|grep|rg|cut|tr|date|which|echo|printf|jq|true)(\s|$)/;
const BUSCAR = /^find(\s|$)/;
const GIT_WORKTREES = /^git\s+worktree\s+list(\s|$)/;
const GIT_LECTURA = /^git\s+(log|show|diff|status|ls-files|blame|grep|rev-parse|shortlog|describe|merge-base|branch\s+(--list|-a|-r|-v|--show-current)|remote\s+-v)(\s|$)/;
const GH_LECTURA = /^gh\s+(pr\s+(view|diff|checks|list|status)|issue\s+(view|list|status)|label\s+list|run\s+(view|list)|search\s+(issues|prs|code|commits)|repo\s+view|release\s+(view|list))(\s|$)/;
const GH_ISSUE_COMENTAR = /^gh\s+issue\s+comment(\s|$)/;
const GH_ISSUE_CREAR = /^gh\s+issue\s+create(\s|$)/;
const GH_ISSUE_ETIQUETAR = /^gh\s+issue\s+edit\s+\S+(\s+--(add|remove)-label\s+\S+)+$/;
const GH_PR_COMENTAR = /^gh\s+pr\s+comment(\s|$)/;
const GH_PR_PEDIR_CAMBIOS = /^gh\s+pr\s+review\s+\S+\s+(--comment|--request-changes|-c|-r)(\s|$)/;
const AUDITAR = /^(npm\s+(audit|ls|outdated)(?!.*\bfix\b)|cargo\s+(audit|tree)|pip-audit|osv-scanner)(\s|$)/;
const PROBAR = /^(npm\s+(test|run\s+(check|lint|test(:[\w-]+)?))|node\s+--test|npx\s+(--no-install\s+)?(vitest\s+run|playwright\s+test)|cargo\s+(test|check|clippy))(\s|$)/;

export const POLITICAS = {
  'enjambre-jefe-proyecto': [NAVEGAR, UTILIDADES, BUSCAR, GIT_LECTURA, GH_LECTURA, GH_ISSUE_COMENTAR, GH_ISSUE_CREAR, GH_ISSUE_ETIQUETAR],
  'enjambre-revisor': [NAVEGAR, UTILIDADES, BUSCAR, GIT_LECTURA, GH_LECTURA, GH_PR_COMENTAR, GH_PR_PEDIR_CAMBIOS],
  'enjambre-seguridad': [NAVEGAR, UTILIDADES, BUSCAR, GIT_LECTURA, GH_LECTURA, GH_PR_COMENTAR, GH_PR_PEDIR_CAMBIOS, AUDITAR, GH_ISSUE_CREAR],
  'enjambre-investigador': [NAVEGAR, UTILIDADES, BUSCAR, GIT_LECTURA, GH_LECTURA, GH_ISSUE_COMENTAR, GH_ISSUE_CREAR, PROBAR],
  'enjambre-analista': [NAVEGAR, UTILIDADES, BUSCAR, GIT_LECTURA, GH_LECTURA, GH_ISSUE_COMENTAR],
  'enjambre-gobernanza': [NAVEGAR, UTILIDADES, BUSCAR, GIT_LECTURA, GH_LECTURA, AUDITAR, GH_ISSUE_COMENTAR, GH_ISSUE_CREAR],
  'enjambre-coordinador': [NAVEGAR, UTILIDADES, BUSCAR, GIT_LECTURA, GIT_WORKTREES, GH_LECTURA, GH_ISSUE_COMENTAR, GH_ISSUE_ETIQUETAR, GH_PR_COMENTAR],
};

// ---------- construcciones prohibidas para los agentes limitados ----------

// Se buscan en el texto con las comillas ya vaciadas (salvo SUSTITUCION, que se busca en el texto original
// porque "$(…)" se ejecuta aunque esté entre comillas dobles).
const SUSTITUCION = /\$\(|`|<\(|>\(/;
const PROHIBIDAS = [
  ['redireccion', />/, 'redirigir la salida a un fichero'],
  ['find-con-acciones', /\bfind\b.*\s-(exec|execdir|ok|okdir|delete|fprint\w*|fls)\b/, 'usar find con acciones (-exec, -delete…)'],
  ['escribe-fichero', /\s--output\b|\bsort\b.*\s-o\b|\brg\b.*\s--pre\b|\bgit\s+grep\b.*\s(-O|--open-files-in-pager)\b/, 'escribir ficheros o lanzar programas desde opciones'],
];
// Los prefijos (`env`, `xargs`, `sudo`, `FOO=1 …`, `bash -c`) no hace falta buscarlos aquí: un trozo que empieza
// por ellos no casa con ninguna lista blanca y se bloquea igual.

// Quita el contenido de los heredoc (`<<'EOF' … EOF`): es texto para --body-file -, no comandos.
// Devuelve también el texto en el que bash sí expande `$(…)`: todo salvo el cuerpo de los heredoc con
// delimitador entre comillas (en `<<EOF` sin comillas, `$(…)` se ejecuta).
export function quitarHeredocs(comando) {
  const lineas = comando.split(/\r?\n/);
  const comandos = [];
  const expandible = [];
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const m = linea.match(/<<-?\s*(['"]?)([A-Za-z_][\w-]*)\1/);
    comandos.push(m ? linea.replace(m[0], '') : linea);
    expandible.push(linea);
    if (m) {
      const fin = m[2];
      while (i + 1 < lineas.length && lineas[i + 1].trim() !== fin) {
        i++;
        if (!m[1]) expandible.push(lineas[i]);
      }
      i++; // salta la línea de cierre
    }
  }
  return { comandos: comandos.join('\n'), expandible: expandible.join('\n') };
}

// Sustituye el contenido entre comillas por una marca vacía, para que `|`, `;` o `>` dentro de un texto no cuenten.
export function vaciarComillas(comando) {
  return comando.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, "''");
}

// Divide por operadores de control y tuberías (cada trozo es un comando que debe estar permitido).
export function trozos(comando) {
  return comando.split(/&&|\|\||;|\|&?|&|\r?\n/).map((s) => s.trim()).filter(Boolean);
}

// `enjambre:enjambre-revisor` (nombre con espacio de nombres del plugin) o `enjambre-revisor`.
export function nombreAgente(agentType) {
  const nombre = String(agentType ?? '');
  return nombre.startsWith('enjambre:') ? nombre.slice('enjambre:'.length) : nombre;
}

export function evaluar(entrada) {
  const agente = nombreAgente(entrada?.agent_type);
  const politica = POLITICAS[agente];
  if (!politica) return null;

  if (entrada?.tool_name === 'PowerShell') {
    return { nombre: 'powershell', motivo: 'usar PowerShell (este agente solo usa Bash con comandos de lectura)', agente };
  }
  const { comandos: original, expandible } = quitarHeredocs(comandoDe(entrada));
  if (SUSTITUCION.test(expandible)) {
    return { nombre: 'sustitucion', motivo: 'usar sustitución de comandos ($(…), `…`, <(…))', agente };
  }
  // Redirecciones inofensivas: descartar errores o unir stderr con stdout.
  const limpio = vaciarComillas(original).replace(/\d?>\s*\/dev\/null|2>&1/g, ' ');
  for (const [nombre, expresion, motivo] of PROHIBIDAS) {
    if (expresion.test(limpio)) return { nombre, motivo, agente };
  }
  for (const trozo of trozos(limpio)) {
    if (!politica.some((permitido) => permitido.test(trozo))) {
      return { nombre: 'fuera-de-lista', motivo: `ejecutar «${trozo.slice(0, 80)}»`, agente };
    }
  }
  return null;
}

if (esPrincipal(import.meta.url)) {
  const entrada = await leerEntrada();
  const resultado = evaluar(entrada);
  if (resultado) {
    bloquear(resultado.nombre,
      `Enjambre (limitar-bash): el agente ${resultado.agente} no puede ${resultado.motivo}. ` +
      'Solo tiene comandos de lectura (git log/show/diff, gh … view/diff/list) y los de su ficha. ' +
      "Para textos largos usa `--body-file -` con un heredoc entre comillas (<<'EOF'). Si de verdad lo necesitas, déjalo indicado para Álvaro.", entrada);
  }
  permitir();
}
