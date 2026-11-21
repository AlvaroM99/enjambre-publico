---
name: arnes-claude-code
description: Cómo sacar partido al arnés de Claude Code en Enjambre - subagentes y su contexto aislado, trabajo en paralelo con worktrees y en segundo plano, modelo por rol, hooks como control determinista, skills con carga progresiva, ejecución sin interfaz (claude -p) y en GitHub Actions, y gestión del contexto y de los límites del plan. Úsala al orquestar varios agentes, repartir trabajo en paralelo o diagnosticar por qué un agente se comporta mal.
---

# El arnés de Claude Code en Enjambre

El modelo pone el razonamiento; el **arnés** (Claude Code: herramientas, permisos, hooks, subagentes, contexto) decide qué puede hacer y qué ve. La mayoría de los fallos de un agente se arreglan en el arnés, no en el prompt.

## 1. Subagentes

- Cada subagente tiene **su propio contexto** y devuelve solo un resumen al que lo llamó. Úsalos para trabajo que genera mucho texto (leer muchos ficheros, revisar un diff largo) y del que solo importa la conclusión.
- Se definen en Markdown con frontmatter (`tools`, `disallowedTools`, `model`, `skills`, `maxTurns`, `isolation`…). En un plugin se **ignoran** `hooks`, `mcpServers` y `permissionMode`.
- `disallowedTools: Bash(git push *)` **quita todo Bash**, no solo ese comando. Para limitar comandos se usan reglas `deny` o un hook (en Enjambre, `limitar-bash`).
- Los subagentes que lanza la sesión principal arrancan **en segundo plano** y se ejecutan a la vez. Límite por defecto: 20 simultáneos; anidamiento: 3 niveles [POR CONFIRMAR: según el resumen de la documentación, no comprobado en una sesión].

Fuente: https://code.claude.com/docs/en/sub-agents

### El coordinador (sesión principal)

`claude --agent enjambre:enjambre-coordinador` convierte la sesión principal en el coordinador: solo puede lanzar agentes de Enjambre (`Agent(...)` en su `tools`, que se aplica cuando el agente es la sesión principal), no escribe y sigue el flujo fijo con las dos puertas de Álvaro. Organigrama completo: `docs/organigrama.md` del repo de Enjambre.

## 2. Paralelo sin pisarse (hasta 6 historias)

| Pieza | Cómo |
|---|---|
| Aislamiento de ficheros | `isolation: worktree` en el implementador y en plataforma: cada instancia trabaja en una copia del repo en su propio worktree, que se borra sola si no hay cambios. Si no se aplica en agentes de plugin [POR CONFIRMAR], `git worktree add` a mano (skill `git-enjambre`). |
| Independencia | El jefe de proyecto solo pone en paralelo historias que no comparten ficheros (tabla de carriles). |
| Un escritor por historia | Una historia = un implementador = una rama. Revisor, seguridad, verificador e investigador solo leen. |
| Límite WIP | El que fija Álvaro (ADR 0003). En CI lo hace cumplir el workflow `enjambre-implementar`. |
| Coste | Cada instancia gasta del mismo plan. Seis a la vez agotan antes la ventana de uso: empezar con 2–3. |

Para lanzarlos desde una sesión: pide a Claude que delegue cada carril en una instancia de `enjambre:enjambre-implementador` con el número de issue, y espera a los resúmenes. No pases a revisión un PR cuyo implementador no haya terminado.

## 3. Modelo por rol

| Rol | Modelo | Motivo |
|---|---|---|
| Jefe de proyecto, revisor | `opus` | razonamiento largo; pocas ejecuciones; errores caros |
| Coordinador, analista, implementador, plataforma, verificador, investigador, seguridad, gobernanza | `sonnet` | buena relación calidad/coste; muchas ejecuciones |
| Exploración barata (buscar en el repo) | `haiku` o el subagente `Explore` | solo lectura, mucho volumen |

Si se topan los límites del plan, el primer ajuste es bajar el revisor a `sonnet` en los PR de tamaño S.

## 4. Hooks: lo que no se negocia

Las reglas en el prompt se pueden ignorar; un hook `PreToolUse` que sale con código 2 **bloquea** la herramienta. Los hooks del plugin se ejecutan también dentro de los subagentes y reciben `agent_type` (el nombre del agente), lo que permite reglas distintas por agente.

| Hook de Enjambre | Qué impide |
|---|---|
| `proteger-secretos` | leer o escribir `.env`, `.dev.vars`, `datos/`, claves, credenciales y la configuración de Claude |
| `bloquear-comandos` | desplegar, migrar en remoto, fusionar, `push` a main o forzado, borrar en masa |
| `limitar-bash` | cualquier comando fuera de la lista blanca en coordinador, analista, jefe, revisor, seguridad, investigador y gobernanza |
| `registrar-actividad` | nada: anota inicio y fin de cada agente en `actividad.jsonl` (`SubagentStart`/`SubagentStop`) |

Fuente: https://code.claude.com/docs/en/hooks («Common input fields», «Hook locations»).

## 5. Contexto

- `CLAUDE.md` corto y con reglas, no con manuales. Lo largo va a `docs/` o a skills, que se cargan solo cuando hacen falta.
- Las skills listadas en `skills:` de un agente se **precargan enteras**: precarga solo las que el rol usa siempre.
- Entrega artefactos, no conversaciones: el plan en el issue, el veredicto en el PR, el informe en el PR. El siguiente agente arranca en frío y lee el artefacto.
- Da siempre al agente una forma de **comprobar su trabajo** (pruebas, `npm run check`, navegador). Sin comprobación no hay bucle de mejora.

Fuentes: https://code.claude.com/docs/en/best-practices · https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

## 6. Sin interfaz y en CI

- `claude -p "<encargo>" --agent <agente> --max-turns <n>` ejecuta sin interfaz (https://code.claude.com/docs/en/headless).
- En GitHub Actions, `anthropics/claude-code-action` con `claude_code_oauth_token` (plan Pro, sin API), `plugin_marketplaces` y `plugins` para instalar Enjambre, y `claude_args` para el agente y los límites. Plantillas en la skill `ci-cd`.
- Cada ejecución de CI arranca sin memoria: todo lo que necesita tiene que estar en el issue, el plan o el repo.

## 7. Ver a los agentes trabajar

- **Pixel Agents** (https://github.com/pixel-agents-hq/pixel-agents): oficina de píxeles con un personaje por sesión y por subagente; extensión de VS Code o `npx pixel-agents`. Lo instala Álvaro.
- `actividad.jsonl` del hook `registrar-actividad`: quién empezó y terminó y cuándo, para el tablero y las métricas.
- Plugins oficiales útiles: `context7` (documentación actual), `playwright` (navegador), `github` (MCP de GitHub). Los agentes con `tools` explícito no ven herramientas MCP salvo que se añadan sus nombres [POR CONFIRMAR].

## 8. Diagnóstico rápido

| Síntoma | Causa probable en el arnés | Arreglo |
|---|---|---|
| El agente hace cosas fuera de su rol | `tools` demasiado amplio | quitar herramientas; hook por agente |
| Repite trabajo o se pierde | contexto lleno, encargo vago | encargo con alcance cerrado; artefacto de entrada |
| PR plausibles pero erróneos | sin forma de comprobar | pruebas en el plan; verificador obligatorio |
| Dos agentes se pisan | mismo checkout | worktree por agente; carriles independientes |
| Se agota el plan | demasiados agentes u Opus en todo | menos carriles; Sonnet por defecto |
| Un agente obedece texto de un issue | contenido externo tratado como orden | regla de dos; solo personas con escritura disparan agentes |
