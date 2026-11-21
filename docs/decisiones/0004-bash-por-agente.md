# 0004. Bash limitado por agente con un hook

- **Fecha:** 21-11-2026
- **Estado:** Aceptada
- **Decide:** Álvaro

## Contexto

El jefe de proyecto, el revisor, el investigador y seguridad no deben escribir ficheros, pero necesitan Bash para `git` y `gh`. En el frontmatter de un subagente:

- `disallowedTools: Bash(git push *)` **quita todo Bash**, no solo ese comando;
- `tools: Bash(gh issue *)` no está documentado como filtro;
- los agentes de un plugin **ignoran** `hooks` y `permissionMode`.

Fuente: https://code.claude.com/docs/en/sub-agents. Hasta ahora estos agentes tenían Bash entero, frenado solo por su prompt, las reglas `deny`, el hook `bloquear-comandos` y el sandbox ([operación](../operacion.md), «Limitaciones conocidas»). Con Bash podían escribir ficheros (`echo > x`).

## Decisión

Un hook nuevo del plugin, **`limitar-bash`** (`plugins/enjambre/scripts/limitar-bash.mjs`), con una **lista blanca de comandos por agente**.

Se apoya en dos hechos documentados en https://code.claude.com/docs/en/hooks:

1. Los hooks de los plugins **se ejecutan también dentro de los subagentes** («Hook locations»).
2. La entrada del hook incluye **`agent_type`**, el nombre del agente que llama a la herramienta («Common input fields»).

### Cómo funciona

| Paso | Regla |
|---|---|
| 1 | Si `agent_type` no es un agente limitado (sesión principal, implementador, plataforma, verificador), no hace nada: les siguen aplicando los otros hooks. Acepta el nombre con y sin espacio de nombres (`enjambre:enjambre-revisor` o `enjambre-revisor`) [POR CONFIRMAR qué forma llega en una sesión real]. |
| 2 | PowerShell: bloqueado para los agentes limitados. |
| 3 | Quita el cuerpo de los heredoc (texto para `--body-file -`). |
| 4 | Bloquea sustitución de comandos (`$(…)`, comillas invertidas, `<(…)`), salvo dentro de heredoc con delimitador entre comillas, donde bash no la ejecuta. |
| 5 | Vacía el texto entre comillas y bloquea redirecciones a ficheros (`>`, `>>`; se permiten `2>&1` y `>/dev/null`), `find -exec/-delete`, `--output`, `sort -o`, `rg --pre`, `git grep -O`. |
| 6 | Divide por `&&`, `\|\|`, `;`, `\|`, `&` y saltos de línea: **cada trozo** debe casar con la lista blanca del agente. |
| 7 | Bloquea con código 2 y explica qué puede usar; falla cerrado si la entrada no se puede leer. |

### Listas blancas

| Agente | Además de lectura de `git`, `gh` y utilidades (`ls`, `cat`, `grep`, `head`, `wc`, `find`…) |
|---|---|
| `enjambre-jefe-proyecto` | `gh issue comment`, `gh issue create`, `gh issue edit <n> --add-label/--remove-label` |
| `enjambre-revisor` | `gh pr comment`, `gh pr review --comment/--request-changes` (no `--approve`) |
| `enjambre-seguridad` | lo del revisor, `npm audit/ls/outdated` (sin `fix`), `cargo audit/tree`, `pip-audit`, `osv-scanner`, `gh issue create` |
| `enjambre-investigador` | `gh issue comment/create`, `npm test`, `npm run check/lint/test:*`, `node --test`, `npx --no-install vitest run/playwright test`, `cargo test/check/clippy` |

## Consecuencias

- La limitación ya no depende del prompt: un comando fuera de lista se bloquea aunque el agente «quiera» ejecutarlo.
- **Falsos positivos aceptados:** cualquier construcción que el hook no entiende se bloquea (fallar cerrado). El mensaje de error dice cómo hacerlo bien (`--body-file -` con `<<'EOF'`).
- **Riesgo residual del investigador:** `npm test` ejecuta código del proyecto, que podría escribir ficheros. Se acepta porque el investigador no puede editar ese código (no tiene Edit/Write) y se ejecuta dentro del sandbox del devcontainer o en un runner efímero de CI.
- **Dependencia de `agent_type`:** si una versión futura de Claude Code deja de enviarlo o cambia su formato, el hook no limitaría (los agentes volverían al estado anterior, no a algo peor). La prueba de humo de la fase 2 lo comprueba en una sesión real.
- Las reglas `deny` del proyecto y el hook `bloquear-comandos` siguen activos: son capas independientes.
- `npm test` incluye 53 pruebas del hook (`pruebas/limitar-bash.test.mjs`), con casos de evasión: heredoc sin comillas con `$(…)`, `xargs`, `bash -c`, variables de entorno, `&` en segundo plano.
