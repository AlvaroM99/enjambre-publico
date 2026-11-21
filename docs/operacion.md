# Operación de Enjambre

## Línea base de lobby (21-11-2026, antes de Enjambre)

| Comprobación | Resultado | Tiempo |
|---|---|---|
| `npm run check` | 31 ficheros sin errores de sintaxis | < 5 s |
| `node herramientas/prueba.mjs` (contra `wrangler dev` local en 127.0.0.1:8787) | **60/60 correctas**, sin errores en la página | 61 s |

**Nota:** el README de lobby dice «43 comprobaciones», pero hoy son 60. Hay que corregirlo en lobby.

lobby no tiene CI todavía; se añade en la historia S14.

## Entorno

| Elemento | Estado |
|---|---|
| Claude | Plan Pro, sin API (ADR 0001) |
| Claude CLI | **2.1.330**, con instalador nativo, en `C:\Users\User\.local\bin\claude.exe`. **Esa carpeta aún no está en el PATH del usuario**: hay que añadirla (Variables de entorno → PATH de usuario) |
| GitHub | Plan Free; `gh` con la sesión de Álvaro (no se usa para los agentes) |
| Docker | Docker Desktop 29.9.3 (se actualizó solo durante la sesión). Imagen `enjambre-base` construida desde `plantillas/devcontainer`: **4 GB** según `docker images` (`enjambre-base:prueba`). El 1,2 GB que se anotó antes era el tamaño comprimido |
| Node / Python | 24.12.0 / 3.14.2 |
| Cloudflare | Workers `lobby` y `tracker`, D1 `lobby` y `tracker`, sin KV, R2 sin activar |

## Verificación de la fase 1 (21-11-2026)

| Comprobación | Resultado |
|---|---|
| `npm test` (hooks) en Windows | 89/89 |
| `npm test` (hooks) dentro del contenedor Linux | 89/89 |
| `claude plugin validate .` y `./plugins/enjambre` | Validación superada (aviso: sin icono, irrelevante en un plugin privado) |
| Contenedor: Node, Chrome, Claude Code, gh, Python | v24, Chrome 158, Claude Code 2.1.330, gh 2.23, Python 3.11 |
| bubblewrap con seccomp por defecto | **Falla**: no puede crear espacios de nombres |
| bubblewrap con `seccomp=unconfined` | Funciona, con `/proc` propio |

**Sin comprobar todavía:**
- Claude Code con el sandbox activo dentro del contenedor, de punta a punta. Hace falta iniciar sesión en Claude dentro del contenedor, y lo hace Álvaro.
- Los hooks cargados de verdad por Claude Code al instalar el plugin en un proyecto. Las pruebas ejecutan los scripts con la misma entrada JSON que documenta Claude Code, pero no a través de Claude Code.

## Fases 2 y 3: cierre técnico (ADR 0007, 21-11-2026)

| Comprobación | Resultado |
|---|---|
| `npm test` en Windows | 286/286 |
| `node evals/ejecutar.mjs --simular` | 20 tareas válidas (10 agentes) |
| CI de lobby en [lobby#1](https://github.com/AlvaroM99/lobby/pull/1) | Verde: sintaxis, `npm audit` y prueba de humo 8/8 con credenciales sintéticas |
| CI de finance_tracker en [finance_tracker#1](https://github.com/AlvaroM99/finance_tracker/pull/1) | Verde: `cargo test` (comun, importar) y `cargo check` del Worker para wasm |
| Etiquetas `enjambre:*` en lobby | Creadas |
| Primera ejecución del banco de evaluaciones | **Pendiente**: la CLI no tiene sesión |

Tokens por agente: el hook `registrar-actividad` suma los tokens de la transcripción de cada subagente al terminar (formato de transcripción [POR CONFIRMAR] en sesión real). Resumen:

```bash
node herramientas/actividad.mjs ruta/a/actividad.jsonl
```

Uso del plan Pro por bloques de 5 horas (mejora M2 del panorama, lo ejecuta Álvaro):

```bash
npx ccusage blocks
```

## Repo público, secretos y oficina de agentes (ADR 0006, 21-11-2026)

### Agentes (10)

| Agente | Herramientas | Modelo | `maxTurns` | Aislamiento | Bash |
|---|---|---|---|---|---|
| `enjambre-coordinador` | Agent (solo agentes de Enjambre y Explore), Read, Grep, Glob, Bash | sonnet | 30 | — | lista blanca |
| `enjambre-analista` | Read, Grep, Glob, Bash, **WebSearch, WebFetch** | sonnet | 25 | — | lista blanca |
| `enjambre-gobernanza` | Read, Grep, Glob, Bash | sonnet | 20 | — | lista blanca + auditorías |

Los otros siete, en la sección siguiente. Organigrama, relaciones y RACI: [organigrama](organigrama.md).

| Comprobación | Resultado |
|---|---|
| `npm test` en Windows | 258/258 |
| `claude plugin validate .` y `./plugins/enjambre` | Validación superada |
| Variable `ENJAMBRE_WIP=3` en `AlvaroM99/lobby` | **Creada** el 21-11-2026 con `gh variable set` |
| Secreto `CLAUDE_CODE_OAUTH_TOKEN` en `AlvaroM99/lobby` | **Pendiente: lo crea Álvaro** (pasos abajo) |

### Publicar en el repositorio público

El privado (`AlvaroM99/enjambre`) es la fuente de verdad. Para llevar sus cambios al público (`AlvaroM99/enjambre-publico`), con el árbol limpio y en `main`:

```bash
node herramientas/publicar.mjs --prueba
node herramientas/publicar.mjs
```

La primera orden prepara el commit en una carpeta temporal sin subirlo; la segunda lo publica. El script copia los ficheros de `HEAD`, se niega si encuentra correos personales, tokens o claves, y firma con la dirección noreply de GitHub. No copia el historial privado.

### Crear el secreto `CLAUDE_CODE_OAUTH_TOKEN` (lo hace Álvaro)

Claude no puede hacerlo: el token se genera iniciando sesión con tu cuenta y es una credencial.

1. Abre PowerShell. Si `claude` no se encuentra, usa la ruta completa `C:\Users\User\.local\bin\claude.exe` (o añade esa carpeta al PATH de usuario).
2. Ejecuta `claude setup-token`. Se abre el navegador: inicia sesión con tu cuenta de Claude Pro y autoriza. La terminal muestra un token largo. **No lo pegues en ningún chat ni fichero.**
3. Ejecuta `gh secret set CLAUDE_CODE_OAUTH_TOKEN -R AlvaroM99/lobby`. Cuando pida «Paste your secret», pega el token y pulsa Intro.
   - Alternativa web: GitHub → `lobby` → Settings → Secrets and variables → Actions → **New repository secret** → Name `CLAUDE_CODE_OAUTH_TOKEN` → pega el token → **Add secret**.
4. Comprueba que aparece el nombre (nunca el valor): `gh secret list -R AlvaroM99/lobby`.
5. Cierra la terminal para que el token no quede en pantalla.

El token gasta del mismo plan Pro que tus sesiones. Su caducidad y cómo revocarlo: [POR CONFIRMAR] en https://code.claude.com/docs/en/github-actions.

### Oficina de agentes: Pixel Agents

[Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents) (MIT, unas 10 000 estrellas a 21-11-2026) muestra cada sesión de Claude Code como un personaje de píxeles en una oficina. Los subagentes aparecen como personajes propios. Escriben cuando editan, leen cuando buscan y avisan cuando esperan tu permiso. No modifica Claude Code ni el repositorio. Es código de terceros: lo instalas tú.

- **En VS Code:** Extensiones → busca «Pixel Agents» (editor `pablodelucca`) → Instalar → abre el panel **Pixel Agents** junto a la terminal → **+** → elige la carpeta del proyecto.
- **En el navegador:** `npx pixel-agents` (Node 20 o superior) y abre la URL que imprime. La URL lleva un `?token=`: trátala como una contraseña.

Ajustes recomendados para Enjambre:
- **No actives «Skip Permissions»**: equivale a `--dangerously-skip-permissions`, que Enjambre prohíbe fuera del devcontainer (ADR 0001).
- Crea un personaje por rol (coordinador, analista, jefe, implementador, plataforma, revisor, seguridad, verificador, investigador, gobernanza) y cuatro **Areas** en la oficina: Descubrimiento, Construcción, Calidad y Mejora continua.
- Activa **Watch All Sessions** si lanzas Claude fuera de la extensión. [POR CONFIRMAR] si detecta las sesiones de la app de escritorio.

Además, el hook `registrar-actividad` deja en `actividad.jsonl` (carpeta de datos del plugin) el inicio y el fin de cada agente de Enjambre, para medir tiempos por agente sin depender de herramientas externas.

## Equipo ampliado, Bash por agente y CI/CD (ADR 0003–0005, 21-11-2026)

| Agente | Herramientas | Modelo | `maxTurns` | Aislamiento | Bash |
|---|---|---|---|---|---|
| `enjambre-jefe-proyecto` | Read, Grep, Glob, Bash | opus | 20 | — | lista blanca (`limitar-bash`) |
| `enjambre-implementador` | Read, Edit, Write, Grep, Glob, Bash | sonnet | 30 | worktree | completo (con `bloquear-comandos`) |
| `enjambre-revisor` | Read, Grep, Glob, Bash | opus | 15 | — | lista blanca |
| `enjambre-seguridad` | Read, Grep, Glob, Bash | sonnet | 15 | — | lista blanca |
| `enjambre-verificador` | Read, Grep, Glob, Bash, Write, Edit | sonnet | 25 | — | completo |
| `enjambre-investigador` | Read, Grep, Glob, Bash | sonnet | 25 | — | lista blanca (incluye pruebas) |
| `enjambre-plataforma` | Read, Edit, Write, Grep, Glob, Bash | sonnet | 25 | worktree | completo |

Skills nuevas: `arnes-claude-code`, `tomar-decisiones`, `pedir-detalles`, `referencias-estandar` y `ci-cd` (con las plantillas de workflows en `skills/ci-cd/workflows/`).

| Comprobación | Resultado |
|---|---|
| `npm test` en Windows (hooks, `limitar-bash`, agentes, skills, plantillas y workflows) | 218/218 |
| Prueba de la prueba: quitar el SHA y el `timeout-minutes` de `produccion.yml` | fallan las 2 pruebas que deben |
| `claude plugin validate .` y `./plugins/enjambre` | Validación superada (mismo aviso de icono) |
| CI de GitHub Actions del repo | Sin ejecutar todavía: corre en el primer push |

**Sin comprobar todavía** (prueba de humo, reto R1 de [riesgos y soluciones](riesgos-y-soluciones.md)): la forma exacta de `agent_type` para agentes de plugin, `isolation: worktree` en agentes de plugin, `--agent enjambre:…` en `claude -p` y en la Action, y la instalación del plugin privado desde Actions.

## Agentes y skills del MVP (S9–S13, 21-11-2026)

> Histórico. Lo que cambia después está en la sección anterior y en los ADR 0003–0005.

| Agente | Herramientas | Modelo | `maxTurns` | Skills precargadas |
|---|---|---|---|---|
| `enjambre-jefe-proyecto` | Read, Grep, Glob, Bash (sin Edit/Write) | sonnet | 20 | reglas-enjambre, planificar |
| `enjambre-implementador` | Read, Edit, Write, Grep, Glob, Bash | sonnet | 30 | reglas-enjambre, git-enjambre, pruebas, documentar |
| `enjambre-revisor` | Read, Grep, Glob, Bash (sin Edit/Write) | sonnet | 15 | reglas-enjambre, pruebas, documentar |
| `enjambre-verificador` | Read, Grep, Glob, Bash, Write, Edit | sonnet | 25 | reglas-enjambre, pruebas, verificar-e2e |

Uso dentro de una sesión: `@agent-enjambre:enjambre-jefe-proyecto planifica el issue #12` (o pedir a Claude que delegue en ese agente).

Las plantillas (`plan.md`, `pr.md`, `adr.md`, `informe-qa.md`) están en `plantillas/` y se copian idénticas dentro de las skills que las usan, porque al instalar el plugin en otro proyecto solo viaja `plugins/enjambre/`. Una prueba de `npm test` falla si las copias se desvían.

| Comprobación | Resultado |
|---|---|
| `npm test` (hooks, agentes, skills y plantillas) en Windows | 115/115 |
| Prueba de la prueba: añadir `Edit` a `tools` del revisor | la prueba falla, como debe |
| `claude plugin validate .` y `./plugins/enjambre` | Validación superada; lista 4 agentes y 6 skills (mismo aviso de icono) |

**Limitaciones conocidas (documentadas):**
- **Bash no se puede limitar por comando en un subagente** (resuelto con el hook `limitar-bash`, ADR 0004). Un `disallowedTools` con `Bash(git push *)` quita todo Bash, y la documentación no contempla `tools: Bash(gh issue *)` ([sub-agents](https://code.claude.com/docs/en/sub-agents)). El jefe y el revisor necesitan Bash para `gh` y `git`, así que lo tienen entero. Lo que los frena: la lista de comandos permitidos en su prompt, las reglas `deny` del proyecto (`plantillas/settings.proyecto.json`), el hook `bloquear-comandos` y el sandbox del devcontainer. Con Bash podrían escribir ficheros (`echo > x`); el sandbox no lo impide dentro del proyecto.
- **Los agentes de un plugin ignoran `hooks`, `mcpServers` y `permissionMode`** ([sub-agents](https://code.claude.com/docs/en/sub-agents)). Por eso no se usan; los hooks van en `hooks/hooks.json` para todo el plugin.
- **Sin `memory`** en ningún agente: según la misma página, activarla da Read, Write y Edit automáticamente, y el revisor dejaría de ser de solo lectura. El anexo B §5.8 la preveía para revisor y verificador; queda pendiente de que Álvaro decida.
- **Sin `allowed-tools` en las skills:** los permisos no van en el plugin (ADR 0002, punto 5).

**Sin comprobar todavía:**
- **Opus en el plan Pro** (confirmado por Álvaro; jefe y revisor ya usan `opus`, ADR 0003). La CLI de esta máquina no tiene sesión iniciada (`claude auth status` → `loggedIn: false`), así que no se pudo comprobar con `/model`. Jefe y revisor usan `sonnet` y llevan un comentario en el frontmatter; si Pro permite Opus, basta con cambiar `model: opus` en esos dos ficheros [POR CONFIRMAR].
- **Nombres de skills en `skills:`.** Se usan con espacio de nombres (`enjambre:reglas-enjambre`), que es como las lista `claude plugin validate`. La documentación no dice si un agente de plugin también las encuentra sin prefijo [POR CONFIRMAR en una sesión real].
- **`${CLAUDE_SKILL_DIR}`** en las skills para localizar las plantillas: no se ha comprobado que se sustituya cuando la skill se precarga en un subagente. Si no, el agente ve el nombre del fichero y la carpeta de la skill igualmente [POR CONFIRMAR].
- **Una ejecución real de los cuatro agentes** (plan → PR → revisión → informe QA) en una sesión con el plugin instalado. Es la primera tarea del piloto en lobby (S9–S12, criterio «2 planes aceptados»).
