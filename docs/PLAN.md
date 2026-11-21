# Enjambre: plan de proyecto (equipo de agentes IA de Claude para desarrollo de software)

> Plan aprobado el 21-11-2026. **Vía elegida: A → C** (ver [ADR 0001](decisiones/0001-via-y-arranque.md)). Estado (21-11-2026): **F1 cerrada por decisión; F2 y F3 en marcha** ([ADR 0005](decisiones/0005-cierre-f1-y-ci-cd.md)). Equipo de 7 agentes ([ADR 0003](decisiones/0003-equipo-ampliado-y-paralelo.md)); riesgos actualizados en [riesgos y soluciones](riesgos-y-soluciones.md).
> Este documento es el plan original tal como se aprobó; las decisiones posteriores se registran en `docs/decisiones/` y prevalecen sobre el texto del plan.
> Convención en todo el documento: **[PEDISTE]** = lo que planteaste tú · **[SUGIERO]** = lo que propongo añadir, cambiar o quitar · **[VERIFICADO]** = comprobado en documentación o en tus entornos · **[POR CONFIRMAR]** = no lo he podido comprobar.

## Índice

| Documento | Contenido |
|---|---|
| Este fichero | 0 Decidir rápido · 1 Resumen y supuestos · 2 Recomendaciones y discrepancias · 4 Vías · 7 Roadmap · 9 Riesgos · 11 Interpretaciones |
| [Decisiones](decisiones/) | Registro de decisiones (ADR) |
| [Anexo A: inventario](anexos/A-inventario.md) | 3 Lo que tenemos y lo que falta |
| [Anexo B: arquitectura](anexos/B-arquitectura.md) | 5 Arquitectura y especificaciones · 6 Seguridad y gobernanza |
| [Anexo C: fichas de agentes](anexos/C-fichas-agentes.md) | 5.2 Fichas de agentes y RACI |
| [Anexo D: backlog](anexos/D-backlog.md) | 8 Backlog inicial (CSV en `backlog/`) |
| [Anexo E: referencias](anexos/E-referencias.md) | 10 Fuentes con URL |

## 0. Decidir rápido

### 0.1 Preguntas abiertas (contéstalas de una vez)

| # | Pregunta | Por qué importa | Mi propuesta si no contestas |
|---|---|---|---|
| P1 | ¿Tienes sitio de **Atlassian Cloud / Jira** (y eres administrador)? ¿Qué plan (Free, Standard…)? | El conector Atlassian exige un sitio Cloud; Jira Free solo da 150 pasos de automatización al mes y no incluye Rovo. | Empezar con **GitHub Issues + Projects** y añadir Jira en la fase 2 si lo quieres (ver D13). |
| P2 | ¿Jira es requisito por sí mismo (aprender Jira, portfolio, simular empresa) o te basta un tablero? | Decide si Jira es el «bus» de trabajo o solo un espejo. | Jira como espejo de planificación; GitHub como bus de ejecución. |
| P3 | ¿Qué **plan de Claude** tienes (Pro, Max 5x, Max 20x/Ultra) y si tienes **cuenta de API (Console)** con método de pago? | La vía A usa la suscripción; la B y las GitHub Actions pueden usar API (pago por uso). El Agent SDK **no permite** usar la suscripción en productos propios. | Suscripción para trabajo interactivo + `claude_code_oauth_token` en Actions; API solo si hace falta. |
| P4 | **Presupuesto mensual máximo** (suscripción + API + otros). | Fija límites de gasto, modelos y nivel de autonomía. | 100–150 €/mes en régimen normal; tope duro de API 50 €/mes. |
| P5 | **Horas semanales** que puedes dedicar a montar y supervisar. | El roadmap está en horas; las fechas dependen de esto. | 6–8 h/semana. |
| P6 | ¿Qué **proyectos** trabajará Enjambre? ¿Solo los tuyos (lobby, finance_tracker, nuevos) o también de terceros/clientes? | Cambia seguridad, privacidad y gobernanza. | Solo los tuyos; piloto en **lobby**. |
| P7 | ¿Plan de **GitHub**: Free o Pro? | En repos **privados**, las reglas de protección de rama/rulesets y los entornos con aprobación necesitan Pro (4 $/mes) o superior. | Pasar a GitHub Pro o hacer públicos los repos que no tengan datos sensibles. |
| P8 | ¿Aceptas una **identidad separada para los agentes** (GitHub App «enjambre-bot» o cuenta máquina) en lugar de usar tu `gh` actual? | Tu token actual tiene `delete_repo` y `workflow`: excesivo para agentes. | Sí, GitHub App con permisos mínimos. |
| P9 | ¿Puedo usar **WSL2 o Docker/devcontainers** para ejecutar agentes? | El *sandbox* de Claude Code **no funciona en Windows nativo**. | Devcontainer con Docker (ya tienes Docker 29.1.5). |
| P10 | ¿Quieres trazabilidad de agentes en commits (p. ej. trailer `Agente: implementador`)? Tu regla actual prohíbe líneas de atribución a Claude. | Auditoría de quién hizo qué. | Sin `Co-Authored-By`; autor = bot + trailer `Enjambre-Agente:` (no menciona a Claude). |
| P11 | ¿Hay **datos sensibles** (finanzas personales de finance_tracker, credenciales TCG) que los agentes **nunca** deban leer? | Regla de dos / tríada letal. | Sí: `datos/`, `.env`, `.dev.vars`, exportaciones; denegados en permisos. |
| P12 | ¿Quieres la parte **Datos/BI** desde el principio o cuando haya un proyecto de datos concreto? | Evita construir roles sin trabajo. | Cuando haya proyecto (fase 4). |
| P13 | ¿Te interesa que el **panel de Enjambre** (coste, tareas, métricas) viva dentro de **Lobby**? | Reutiliza Worker + D1 que ya tienes. | Sí, como módulo de Lobby en la fase 5. |

### 0.2 Recomendaciones y discrepancias principales (detalle en §2)

1. **Menos agentes, más habilidades.** Tu propuesta tiene 8 roles; la evidencia (Cognition 2025-2026, Anthropic, paper MAST) dice que en código funciona **un único agente que escribe** por tarea y varios agentes que **asesoran** (planificar, revisar, verificar). Propongo **MVP con 4 agentes** y llegar a 7–8 de forma gradual.
2. **Fusionar Software/Backend/Frontend** en un **Implementador** con *skills* por especialidad.
3. **Fusionar Data Engineer + BI** en un agente **Datos** y aplazarlo hasta que haya un proyecto de datos.
4. **Separar Data Platform de DevOps**: la plataforma de datos va con el agente Datos; DevOps queda como **Plataforma y Entrega**.
5. **Añadir Revisor de código** (independiente del que escribe) y **Seguridad** (como revisor y hooks, no como agente que escribe).
6. **El Jefe de proyecto no «gestiona» a los agentes en tiempo real**: planifica y descompone; la orquestación la hacen reglas deterministas (etiquetas, estados, hooks, Actions). Decide el humano en los puntos de aprobación.
7. **FinOps, documentación y evaluación de agentes** no como agentes: como automatismos, *skills* y un banco de evaluaciones.
8. **GitHub como bus de ejecución; Jira como tablero de planificación** (o solo GitHub en el MVP).

### 0.3 Vía recomendada

**Vía A → C progresiva («local primero, eventos después»):**
- **Fase MVP (vía A):** equipo de subagentes de Claude Code definido en el repositorio (`.claude/agents`, *skills*, hooks, MCP), ejecutado por ti en sesiones locales dentro de un devcontainer, con tu suscripción. Aprobación humana en cada PR.
- **Fase 2 (vía C):** los mismos agentes se activan por eventos con `anthropics/claude-code-action@v1` en GitHub Actions (etiquetas/estados de Issues o Jira), abren PRs en borrador y tú apruebas y despliegas.
- **Vía B (orquestador propio con Agent SDK) o Managed Agents:** solo si la C se queda corta (necesidad de colas largas, paralelismo grande o ejecución 24/7 fuera de GitHub).

Por qué: aprovecha lo que ya tienes (Claude Code, `gh`, Cloudflare, el patrón de sesiones de finance_tracker), cuesta poco, tiene la mayor madurez y el mayor control humano, y las definiciones de agentes (`.claude/agents/*.md`) son **portables** a las vías C, B y Managed Agents, así que no se tira trabajo.

### 0.4 Resumen de media página

**Enjambre** es un equipo de agentes de Claude que toma tareas de un tablero (GitHub Issues o Jira), las planifica, implementa, revisa, prueba y deja listas para desplegar, con aprobación humana en los puntos críticos. Se construye primero como subagentes de Claude Code en un repositorio `enjambre` reutilizable (plugin propio) y se pilota en **lobby**; después se automatiza con GitHub Actions.

- **Coste estimado [estimación, a medir en fase 0]:** suscripción Claude Max 5x 100 $/mes (o Pro 20 $ al principio, con riesgo de topar límites) + API 0–50 $/mes si se usa clave de API en Actions + GitHub Pro 4 $/mes + Jira Free 0 $ + Cloudflare gratis. **Total: 25–155 $/mes.** Coste por historia pequeña a precio de API: ~2–8 $ (cálculo en §5.10).
- **Esfuerzo estimado:** ~100–130 h hasta fase 3 (equipo completo de 6 agentes, automatizado, en lobby y finance_tracker); ~160–200 h hasta fase 5. Con 6–8 h/semana: MVP en 4 semanas, fase 3 en ~4 meses.
- **3 riesgos principales:**
  1. **Seguridad / inyección de instrucciones**: agentes que leen issues, webs o PRs y pueden escribir código y llamar a servicios. Mitigación: regla de dos por agente, *sandbox* en contenedor, mínimos privilegios, nada de despliegue sin humano.
  2. **Coste y límites de uso**: los sistemas multiagente consumen ~4–15× más tokens que un chat; con suscripción se topan los límites de 5 h/semana. Mitigación: equipo pequeño, modelos por rol, presupuestos por ejecución (`--max-budget-usd`, `maxTurns`), métricas de coste por tarea.
  3. **Deriva de calidad / coordinación**: PRs plausibles pero incorrectos, retrabajo, agentes que se contradicen. Mitigación: un solo escritor por tarea, verificación ejecutable (pruebas + Playwright), revisor independiente, banco de evaluaciones y revisión humana por muestreo.

## 1. Resumen y supuestos

### 1.1 Resumen ejecutivo

Enjambre convierte trabajo descrito en un tablero en *pull requests* revisados, probados y listos para desplegar. Lo hace un equipo pequeño de agentes de Claude con funciones separadas (planificar, implementar, revisar, verificar, operar), coordinado por reglas explícitas y con el humano (Álvaro) como **propietario de producto y aprobador final**. Todo vive en Git: definiciones de agentes, *skills*, hooks, plantillas, decisiones y métricas. Empieza local y barato; escala a ejecución por eventos cuando el MVP demuestre que los PRs se aceptan sin mucho retrabajo.

### 1.2 Supuestos

| # | Supuesto | Base |
|---|---|---|
| S1 | Usuario único (tú), sin equipo humano; los proyectos son personales. | Inventario: repos personales; [POR CONFIRMAR] P6. |
| S2 | Plataforma objetivo de los proyectos: Cloudflare Workers + D1 (y Rust/JS), como lobby y finance_tracker. | [VERIFICADO] Workers `lobby` y `tracker`, D1 `lobby` y `tracker`. |
| S3 | Trabajas en Windows 11 con la app de escritorio de Claude Code. | [VERIFICADO] Entorno; `claude` CLI **no** está en PATH. |
| S4 | «Hive» y «Enjambre» son el mismo proyecto; nombre oficial **Enjambre** (repos, agentes, backlog). | Tu mensaje. |
| S5 | Se mantienen tus reglas: español de España en documentación, commits en inglés sin atribución a Claude, despliegue solo cuando lo pidas, Claude no ve contraseñas. | CLAUDE.md de lobby y finance_tracker; memoria. |
| S6 | Presupuesto bajo, prioridad a planes gratuitos. | Lobby y tracker en plan gratuito de Cloudflare. |
| S7 | Los precios citados son de lista en USD a 21-11-2026. | Páginas de precios de Anthropic, GitHub, Atlassian, Cloudflare. |

## 2. Mis recomendaciones y discrepancias

Ordenadas por impacto. Columna «Cuándo»: **Ya** (aplicar desde el MVP), **Después** (fase posterior), **Descartar**.

| # | Lo que proponías [PEDISTE] | Lo que propongo [SUGIERO] | Por qué (evidencia) | Ganamos / perdemos | Cuándo |
|---|---|---|---|---|---|
| D1 | 8 roles como agentes desde el inicio. | **MVP con 4 agentes**: Jefe de proyecto (planificador), Implementador, Revisor, Verificador QA. Crecer a 6–8. | Paper MAST: 41–86,7 % de fallos en 7 sistemas multiagente, la mayoría por diseño y desalineación entre agentes. Cognition (2025 y abril 2026): funciona «un escritor + agentes que asesoran». Anthropic: multiagente cuesta ~15× tokens y «encaja mal en la mayoría de tareas de código». | **Ganamos** menos coste, menos coordinación, más calidad medible. **Perdemos** la sensación de «empresa completa» al principio. | Ya |
| D2 | Software Engineers, Backend Engineers y Frontend Engineers como roles distintos. | **Un agente Implementador** con *skills* `backend-workers`, `frontend-web`, `rust-worker`, que carga según la tarea. | «Software Engineer» engloba a los otros dos. Un PR suele tocar back y front; repartirlo entre agentes rompe el contexto compartido (Cognition: «las acciones llevan decisiones implícitas»). Las *skills* se cargan bajo demanda (divulgación progresiva). | **Ganamos** coherencia por PR y menos traspasos. **Perdemos** paralelismo entre front y back (que en proyectos personales casi nunca compensa). | Ya |
| D3 | Data Engineers y BI Engineers separados. | **Un agente Datos** (ingeniería + BI), aplazado a fase 4. | No hay hoy un proyecto de datos activo (WEATHER_PIPELINE_ETL es académico y no está en Cloudflare). Un rol sin trabajo solo consume mantenimiento. | **Ganamos** foco. **Perdemos** nada inmediato. | Después |
| D4 | «DevOps y Data Platform» juntos. | **Plataforma y Entrega** (CI/CD, IaC, entornos, observabilidad) y la plataforma de datos dentro del agente Datos. | Son dominios distintos (pipelines de despliegue frente a almacenes, contratos de datos, calidad). Juntarlos mezcla permisos sensibles (despliegue) con acceso a datos. | **Ganamos** mínimo privilegio. **Perdemos** un agente «todoterreno». | Ya (Plataforma en fase 3) |
| D5 | Project Leaders que gestionan a los demás agentes (asignan, siguen, desbloquean). | **Jefe de proyecto = planificador + gestor de tablero**. La asignación y el encadenamiento los hacen **reglas deterministas** (estados, etiquetas, hooks, Actions). El jefe no arranca ni detiene agentes de forma libre. | Anthropic «Building effective agents»: preferir *workflows* predefinidos cuando el camino es conocido; el ciclo de vida de una tarea lo es. Un orquestador LLM que gestiona a otros añade coste y es un punto único de fallo (MAST: fallos de verificación y terminación). | **Ganamos** previsibilidad, auditoría, coste. **Perdemos** flexibilidad «creativa» del jefe. | Ya |
| D6 | Plural («Project Leaders», «Engineers»…). | **Una instancia por rol**, en paralelo solo para tareas independientes (máx. 2–3 PRs a la vez). | Kanban: límite WIP explícito. Agent teams de Claude Code recomiendan 3–5 compañeros y cuestan ~7× tokens. | Ganamos control de coste y de conflictos de *merge*. | Ya |
| D7 | — (no estaba) | **Añadir Revisor de código** independiente del Implementador (otro prompt, idealmente otro modelo). | GitHub Copilot coding agent: quien pidió el PR no puede aprobarlo; SLSA Source L4: revisión por dos partes. Cognition 2026: el agente de revisión es de lo que mejor funciona. | Ganamos calidad. Coste adicional moderado. | Ya |
| D8 | — | **Añadir Seguridad** como revisor + hooks + escáneres (CodeQL, secret scanning, Dependabot, Scorecard), **no** como agente que escribe. | OWASP Top 10 LLM 2025 (LLM01, LLM06), OWASP Agentic 2026, NIST SSDF. La seguridad se hace cumplir mejor de forma determinista. | Ganamos control. | Ya (hooks y escáneres) / Después (agente) |
| D9 | — | **Arquitectura** como modo del Jefe de proyecto (diseño técnico + registro de decisiones ADR), con modelo más capaz bajo demanda. No como agente separado en MVP. | Tu patrón de finance_tracker (`docs/decisiones/`) ya funciona. | Reutilizamos lo que ya tienes. | Ya |
| D10 | — | **Documentación**: *skill* `documentar` que ejecuta el Implementador en cada PR y comprobación en el Revisor. No agente. | Mantener docs junto al cambio es más fiable que un agente aparte que llega tarde. | Menos agentes. | Ya |
| D11 | — | **FinOps**: hooks y métricas automáticas (coste por ejecución, presupuestos, alertas). No agente. | FinOps Foundation (tokenomics): etiquetar cada llamada y presupuestos con dueño; mejor automatizado. | Coste cero de tokens. | Ya |
| D12 | — | **Evaluación de agentes**: banco de 20–50 tareas reales con criterios comprobables y ejecución periódica. No agente. | Anthropic «Demystifying evals for AI agents»: empezar con 20–50 tareas. | Detectamos regresiones al cambiar prompts o modelos. | Después (fase 3) |
| D13 | Jira gestiona los proyectos y es el centro. | **GitHub Issues/Projects como bus de ejecución**; Jira como tablero de planificación sincronizado (app *GitHub for Jira*) si lo quieres. | `claude-code-action` reacciona nativamente a eventos de GitHub. Jira Free: 150 pasos de automatización/mes, sin Rovo; el MCP de Atlassian usa OAuth de usuario (difícil sin interfaz en CI). | **Ganamos** simplicidad y coste 0. **Perdemos** experiencia Jira completa en el MVP. | Ya (decide P1–P2) |
| D14 | Ejecutar agentes en tu máquina. | **Siempre dentro de devcontainer/WSL2** para modos autónomos; nunca `bypassPermissions` en Windows anfitrión. | Docs de Claude Code: *sandbox* no soportado en Windows nativo; Anthropic «How we contain Claude»: contención en el entorno primero. | Seguridad real. Algo de fricción inicial. | Ya |
| D15 | Usar tus credenciales. | **Identidad propia de agentes** (GitHub App con permisos mínimos; token de API de Cloudflare solo para *preview*, sin producción). | Tu `gh` tiene `delete_repo` y `workflow`; OWASP ASI03 (abuso de identidad y privilegios). | Mínimo privilegio. | Ya |
| D16 | Despliegue como paso del flujo del agente. | **Despliegue a producción siempre humano** (aprobación en entorno `production` de GitHub o `npm run deploy` tuyo). | Tu regla 7 de lobby; DORA 2025: la IA aumenta inestabilidad; necesidad de rollback rápido. | Mantenemos control. | Ya |
| D17 | «Q&A». | **QA (aseguramiento de calidad) = Verificador**: ejecuta pruebas y verificación de extremo a extremo con navegador; no escribe código de producción. | Separar quien construye de quien evalúa (Anthropic, *harness design*: generador + evaluador). | Ganamos independencia de juicio. | Ya |
| D18 | — | **Descartar** agentes que «hablan entre sí» por chat libre. La comunicación es por artefactos: issue, plan, PR, comentarios estructurados. | MetaGPT: comunicación por documentos estructurados; OWASP ASI07 (comunicación insegura entre agentes). | Trazabilidad. | Ya |
| D19 | — | **Descartar** por ahora *agent teams* experimentales de Claude Code y frameworks de rol (MetaGPT/ChatDev/CrewAI). | Agent teams: experimental, no funciona en `-p` ni SDK; frameworks de rol con baja corrección (ChatDev ~33 % en MAST). | Estabilidad. | Descartar (reevaluar en fase 5) |

## 4. Vías posibles de ejecución

### Vía A — Subagentes en Claude Code (local, en el repositorio)
- **Descripción:** agentes definidos como `.claude/agents/*.md` (frontmatter: `name`, `description`, `tools`, `disallowedTools`, `model`, `permissionMode`, `skills`, `hooks`, `mcpServers`, `maxTurns`, `isolation: worktree`), *skills* (`SKILL.md`), hooks y MCP, empaquetados como **plugin** `enjambre` en un *marketplace* propio. Tú abres una sesión, el agente principal actúa como coordinador y delega en subagentes.
- **Arquitectura:** sesión de Claude Code (app o CLI) → subagentes con contexto aislado (devuelven solo un resumen) → git worktrees por tarea → `gh`/MCP GitHub → PR.
- **Ventajas:** madura y documentada; coste fijo (suscripción); máximo control humano; cero infraestructura; reutiliza patrón de finance_tracker.
- **Inconvenientes:** necesita que tú abras la sesión (no 24/7); sin *sandbox* en Windows nativo (requiere devcontainer/WSL2); los límites de la suscripción marcan el ritmo.
- **Coste:** 20–200 $/mes (suscripción). **Complejidad:** baja. **Madurez:** alta. **Autonomía:** baja-media. **Control humano:** muy alto.
- **Riesgos:** dependencia de tu tiempo; permisos mal configurados en la máquina anfitriona.

### Vía B — Orquestador propio con Claude Agent SDK / API
- **Descripción:** servicio propio (TypeScript `@anthropic-ai/claude-agent-sdk`) que recibe eventos, crea sesiones por tarea, aplica permisos con `canUseTool`/hooks, presupuestos (`maxBudgetUsd`) y guarda estado.
- **Arquitectura:** webhook (Jira/GitHub) → cola → contenedor por sesión (1 GiB RAM, 5 GiB disco, 1 CPU recomendados por agente) → SDK (lanza el CLI como subproceso) → GitHub. **No cabe en un Worker de Cloudflare** (necesita subproceso y sistema de ficheros): requiere Cloudflare Containers, un VPS o GitHub Actions como ejecutor.
- **Ventajas:** control total, colas, reintentos, paralelismo, métricas propias.
- **Inconvenientes:** **no puede usar la suscripción** (solo API: pago por token); construir y mantener un orquestador; superficie de seguridad propia.
- **Coste:** API 50–400 $/mes según volumen + infraestructura (~0,05 $/h por contenedor). **Complejidad:** alta. **Madurez:** media (SDK en 0.x). **Autonomía:** alta. **Control humano:** el que programes.
- **Riesgos:** sobreingeniería para un usuario único; costes variables.

### Vía C — Híbrido por eventos: Jira/GitHub como bus de trabajo + Claude Code Action
- **Descripción:** el tablero es el bus. Un cambio de estado o etiqueta (`enjambre:planificar`, `enjambre:implementar`, `enjambre:revisar`) dispara un workflow con `anthropics/claude-code-action@v1`, que ejecuta Claude Code *headless* con el agente correspondiente del plugin. Comentarios `@claude` para interacción.
- **Arquitectura:** Jira (opcional) ↔ app *GitHub for Jira* ↔ GitHub Issues → Actions (`issues.labeled`, `pull_request`, `issue_comment`, `workflow_dispatch`, `schedule`) → claude-code-action (agente + `--max-turns` + `--max-budget-usd` + reglas de permisos) → rama `enjambre/*` → PR en borrador → CI → revisión → humano → despliegue.
- **Ventajas:** asíncrono (trabaja sin ti delante), trazable (todo en issues/PR/logs), infraestructura gestionada, autenticación con suscripción u OIDC/API, reutiliza las definiciones de la vía A.
- **Inconvenientes:** cada paso arranca en frío (sin memoria salvo lo escrito en repo/issue); minutos de Actions; depurar en CI es más lento; la integración de Jira por MCP en CI requiere token de API.
- **Coste:** suscripción o API + minutos de Actions (2.000 gratis/mes en privados [POR CONFIRMAR]). **Complejidad:** media. **Madurez:** alta (Action v1). **Autonomía:** media-alta. **Control humano:** alto (aprobaciones en PR y entornos).
- **Riesgos:** inyección por contenido de issues/PR; bucles de eventos (bot que dispara bot). Mitigación: solo usuarios con escritura disparan; `allowed_bots` vacío salvo el propio; `concurrency`.

### Vía D — Claude Managed Agents (beta)
- **Descripción:** agentes alojados por Anthropic (Agente + Entorno de *sandbox* + Sesión + eventos SSE), con herramientas integradas, MCP y despliegues programados.
- **Ventajas:** sin infraestructura, *sandbox* gestionado, sesiones largas.
- **Inconvenientes:** beta; API (no suscripción); 0,08 $/hora de sesión además de tokens; menos ecosistema que Claude Code.
- **Coste:** tokens + 0,08 $/h. **Complejidad:** media. **Madurez:** baja-media. **Autonomía:** alta.
- **Uso recomendado:** alternativa a la vía B en fase 5 si la C se queda corta.

### Vía E — Agent teams de Claude Code (experimental)
- **Descripción:** un líder y compañeros (instancias de Claude Code) con lista de tareas compartida y buzones.
- **Inconvenientes:** experimental, desactivado por defecto, no funciona en `-p` ni en el SDK, ~7× tokens.
- **Uso:** experimentos puntuales de investigación en paralelo; **no** como base.

### Vía F — Agentes de terceros conectados a Jira/GitHub
- GitHub Copilot coding agent (asignable desde Jira), OpenAI Codex cloud, OpenHands, Devin.
- **Ventajas:** producto terminado con buenas salvaguardas (Copilot: ramas `copilot/*`, PR en borrador, no puede aprobar).
- **Inconvenientes:** no es un equipo de Claude; coste de licencias adicionales; menos personalización de roles.
- **Uso:** referencia de buenas prácticas de seguridad que copiamos.

### Tabla comparativa ponderada (puntuación 1–5; 5 = mejor)

| Criterio | Peso | A | B | C | D | E | F |
|---|---|---|---|---|---|---|---|
| Coste bajo y predecible | 20 % | 5 | 2 | 4 | 2 | 2 | 3 |
| Control humano y seguridad | 20 % | 5 | 3 | 4 | 3 | 3 | 4 |
| Madurez / soporte | 15 % | 5 | 3 | 4 | 2 | 1 | 4 |
| Complejidad de montaje (5 = simple) | 15 % | 5 | 1 | 3 | 3 | 3 | 4 |
| Autonomía (trabaja sin ti) | 10 % | 2 | 5 | 4 | 5 | 2 | 4 |
| Encaje con Claude y tus entornos | 10 % | 5 | 4 | 5 | 4 | 4 | 1 |
| Escalabilidad y trazabilidad | 10 % | 3 | 5 | 5 | 4 | 2 | 4 |
| **Total ponderado** | 100 % | **4,60** | 3,00 | **4,05** | 3,10 | 2,35 | 3,45 |

**Recomendación razonada:** A como MVP (mejor puntuación, mínimo riesgo) y evolución a **A+C** (las mismas definiciones activadas por eventos), que suma autonomía y trazabilidad sin perder control. B o D solo si se cumple alguna condición de §9.2.

**MVP mínimo:** 4 agentes (Jefe de proyecto, Implementador, Revisor, Verificador) en el plugin `enjambre`, usados en lobby con GitHub Issues, desde una sesión local en devcontainer. **Escalado:** (1) misma lógica en Actions; (2) añadir Plataforma y Seguridad; (3) segundo proyecto (finance_tracker); (4) Jira; (5) Datos/BI; (6) panel y evaluaciones continuas.

## 7. Roadmap

Esfuerzo en horas tuyas (supervisión incluida). Fechas orientativas con 6–8 h/semana, empezando la semana del 23-11-2026.

| Fase | Objetivo | Entregables | Criterio de salida | Dependencias | Esfuerzo | Riesgos |
|---|---|---|---|---|---|---|
| **F0 Descubrimiento y decisiones** (sem. 1) | Decidir vía, cuentas y línea base | Respuestas a P1–P13; repo `enjambre`; CLI instalado; línea base de lobby (pruebas pasan, tiempos) | Vía aprobada; cuentas confirmadas | Tus respuestas | 6–8 h | Indecisión de alcance |
| **F1 MVP local (vía A)** (sem. 2–4) | 4 agentes producen PRs útiles en lobby | Plugin v0.1 (4 agentes, 6 skills, 3 hooks), devcontainer, plantillas, CI básico en lobby, 5 historias reales completadas | ≥ 3 de 5 PRs fusionados con ≤ 1 ciclo de cambios; 0 incidentes de seguridad; coste medido | F0 | 20–25 h | Límites de suscripción; prompts inmaduros |
| **F2 Automatización por eventos (vía C)** (sem. 5–8) | Trabajo asíncrono desde el tablero | GitHub App, workflows `enjambre-*`, rulesets, entorno preview, (Jira + app GitHub for Jira + CSV importado si P1) | Una historia pasa de «Listo» a PR verificado sin abrir sesión local | F1, GitHub Pro (P7) | 20–25 h | Inyección vía issues; bucles de eventos |
| **F3 Ampliación del equipo** (sem. 9–14) | Plataforma + Seguridad; segundo proyecto | Agentes `plataforma` y `seguridad`; CI/CD completo lobby y finance_tracker (Rust en CI); banco de 20 evaluaciones | Lead time mediano < 2 días; tasa sin retrabajo ≥ 60 % | F2 | 30–40 h | Rust solo en CI; coste |
| **F4 Datos y BI** (sem. 15–18, si P12) | Primer pipeline y panel | Agente `datos`; modelo de datos de ejecuciones; dbt+DuckDB; panel | Panel con coste/tarea y DORA actualizado a diario | F3, datos de telemetría | 20–25 h | Rol sin proyecto real |
| **F5 Endurecimiento y operación** (continuo, desde sem. 19) | Fiabilidad, seguridad, mejora continua | OTel, alertas de coste, Scorecard, evaluaciones semanales (Batch), runbooks, revisión trimestral de permisos; reevaluar vías B/D/E | 3 meses con métricas en objetivo | F3 | 4–6 h/mes | Deriva de calidad; cambios de proveedor |

### 7.1 Primeros 30 días en detalle

| Día | Tarea | Resultado |
|---|---|---|
| 1 | Responder preguntas P1–P13; decidir vía | Decisiones en `docs/decisiones/0001-via.md` |
| 2 | Crear repo `enjambre` privado; copiar este plan a `docs/` dividido en anexos | Repo con docs |
| 3 | Instalar Claude CLI; `claude --version`; confirmar plan y límites (`/usage`) | Entorno listo |
| 4 | Ejecutar línea base de lobby (`npm run check`, `node herramientas/prueba.mjs`) y anotar tiempos | Línea base |
| 5–6 | Devcontainer base (Node 24, wrangler, Playwright, Chrome) y prueba de *sandbox* | Contenedor funcional |
| 7 | Skill `reglas-enjambre` + hooks `proteger-secretos` y `bloquear-comandos` + pruebas de los hooks (intentos de leer `.env`, `deploy`) | Hooks bloquean lo prohibido |
| 8–9 | Agente `jefe-proyecto` + plantilla de plan; probar con 2 issues reales de lobby | 2 planes aceptados |
| 10–11 | Agente `implementador` + skills `backend-workers`, `frontend-web`, `pruebas`, `git-enjambre` | Primer PR en borrador |
| 12 | Agente `revisor` + plantilla de veredicto | Primera revisión |
| 13 | Agente `verificador` reutilizando `prueba.mjs` + skill `verificar-e2e` | Primer informe QA con evidencias |
| 14 | Retro 1: ajustar prompts; ADR de lo aprendido | Lecciones |
| 15–16 | CI básico en lobby (adaptar `ci.yml`/`pr-validation.yml` de WEATHER_PIPELINE_ETL): check + pruebas | CI verde |
| 17 | Hook `registrar-coste` + plantilla de PR con coste | Coste por tarea |
| 18–24 | Ciclo completo con 5 historias reales de lobby (backlog §8, épica ENJ-E6) | 5 PRs |
| 25 | Medir métricas MVP; decidir paso a F2 | Informe F1 |
| 26–27 | Crear GitHub App `enjambre-bot`; ruleset de `main`; CODEOWNERS | Protección activa |
| 28–29 | Primer workflow `enjambre-planificar` con claude-code-action (etiqueta → plan en issue) | Planificación por eventos |
| 30 | Retro 2 y plan de F2 | Decisión F2 |

### 7.2 Hitos medibles y métricas de éxito

| Métrica | Fuente | Objetivo F1 | Objetivo F3 | Objetivo F5 |
|---|---|---|---|---|
| Lead time de cambio (Listo → fusionado) | GitHub/Jira | < 5 días | < 2 días | < 1 día |
| Frecuencia de despliegue | Actions | semanal | 2/semana | según demanda |
| Tasa de fallo de cambios (DORA) | incidentes/rollback | < 30 % | < 15 % | < 10 % |
| Tiempo de recuperación de despliegue fallido | Actions | < 1 día | < 2 h | < 1 h |
| Tasa de retrabajo de despliegue (DORA) | despliegues no planificados | medir | < 15 % | < 10 % |
| PRs aceptados sin retrabajo (≤ 1 ciclo de cambios) | PR | ≥ 50 % | ≥ 60 % | ≥ 75 % |
| Cobertura de pruebas (líneas, módulos tocados) | CI | medir | ≥ 60 % | ≥ 70 % |
| Coste IA por historia | logs | medir | ≤ 6 $ | ≤ 4 $ |
| Evaluaciones pass@1 | evals | — | ≥ 60 % | ≥ 75 % |
| Incidentes de seguridad por agentes | auditoría | 0 | 0 | 0 |

## 9. Riesgos y alternativas

### 9.1 Matriz de riesgos (P = probabilidad, I = impacto; 1–5)

| Riesgo | P | I | Mitigación | Indicador |
|---|---|---|---|---|
| Coste descontrolado | 3 | 4 | Presupuestos por ejecución y mes, WIP 2, modelos por rol, alertas | Coste/historia > 8 $ |
| Límites de uso de la suscripción | 4 | 3 | Max 5x; ejecuciones en Actions con API como reserva; Haiku para exploración | Bloqueos por límite > 2/semana |
| Alucinaciones (APIs, datos inventados) | 3 | 4 | Plan con citas fichero:línea; pruebas ejecutables; regla «no inventar datos» + revisión | Defectos por «inventado» |
| Deriva de calidad | 3 | 4 | Evals antes de cambios; muestreo humano; métricas | pass@1 baja > 10 pts |
| Inyección de instrucciones | 3 | 5 | Regla de dos, solo escritores disparan, plan aprobado, contenedor, listas blancas | Intentos bloqueados en logs |
| Fuga de secretos / datos personales | 2 | 5 | Deny + hooks + secret scanning + datos sintéticos | Alertas de secret scanning |
| Despliegue erróneo en producción | 2 | 4 | Solo humano; preview + humo; rollback + Time Travel | Rollbacks |
| Dependencia de proveedor (Anthropic, GitHub, Atlassian) | 3 | 3 | Definiciones en Markdown portables; AGENTS.md; Jira opcional | Cambios de precio/condiciones |
| Complejidad de coordinación | 3 | 3 | Un escritor por tarea; flujo determinista; artefactos | Conflictos de merge, tareas en bucle |
| Cambios de versión de herramientas | 4 | 2 | Fijar versiones; evals al actualizar | Fallos tras actualizar |
| Tu tiempo de supervisión | 4 | 3 | Equipo pequeño; muestreo progresivo; informe semanal | Cola de PRs sin revisar > 5 |

### 9.2 Si una vía falla y cómo se vuelve atrás

| Situación | Señal | Alternativa | Vuelta atrás |
|---|---|---|---|
| MVP A no produce PRs útiles | < 2 de 5 PRs fusionados | Reducir a 2 agentes (Implementador + Revisor) con planes escritos por ti | Desactivar plugin en el repo (`enabledPlugins`); trabajo normal con Claude Code |
| C es frágil (eventos, frío, coste de Actions) | > 30 % ejecuciones fallidas | Volver a A local para implementar y dejar C solo para planificar/revisar | Desactivar workflows; nada se pierde (todo en issues/PR) |
| C se queda corta (colas, 24/7, paralelismo) | Cola > 10 tareas Listo durante semanas | Vía D (Managed Agents) o B (SDK en contenedor) reutilizando agents/skills | Mantener C en paralelo hasta igualar métricas |
| Jira añade fricción | Desincronización frecuente | Solo GitHub Projects | Exportar Jira a CSV; mantener claves en ramas |
| Coste excesivo | > presupuesto 2 meses seguidos | Bajar modelos (Sonnet → Haiku en revisión simple), menos ciclos, más planificación humana | Ajustar frontmatter `model` |
| Incidente de seguridad | Cualquier fuga o acción prohibida | Parar todos los workflows, rotar tokens, revisar logs, ADR de incidente | Revocar GitHub App y tokens |

## 11. Interpretaciones tomadas

1. **«Hive» y «Enjambre»:** el mensaje empieza con «Hive» y luego dice que el nombre del proyecto es «Enjambre». Interpreto que son el mismo y uso **Enjambre** en todo (repo `enjambre`, agentes `enjambre-*`, proyecto Jira `ENJ`).
2. **«Q&A»** = QA (aseguramiento de calidad), como aclaraste; lo materializo como agente **Verificador**.
3. **«Project Leaders» en plural** = rol de jefe de proyecto; propongo **una instancia**.
4. **«Software Engineers» además de Backend y Frontend:** lo interpreto como generalista y lo fusiono en el Implementador (D2).
5. **«Gestionan a los demás agentes»:** lo interpreto como planificar, asignar y hacer seguimiento, no como un agente que controla a otros en tiempo real (D5).
6. **Proyectos objetivo:** tus proyectos personales en GitHub/Cloudflare (lobby, finance_tracker y nuevos); piloto en lobby por tener pruebas E2E y stack JS compilable en Windows.
7. **Jira:** Jira Software Cloud (no Data Center); no he podido comprobar si tienes sitio.
8. **«Mis entornos accesibles»:** revisé carpetas del Escritorio, `~/.claude`, GitHub (`gh`) y Cloudflare (conector). No revisé correo ni cuentas de Atlassian/Anthropic Console (sin acceso).
9. **«Estándar actual»:** fuentes consultadas a 21-11-2026; cuando no había fuente primaria lo marco [POR CONFIRMAR].
10. **Entrega en un fichero:** en modo planificación solo puedo escribir este fichero; la división en documento principal y anexos se hace al aprobar (tabla del índice).
11. **Moneda:** precios de proveedores en USD; tu presupuesto lo expreso en € como supuesto.

## Verificación del plan (al ejecutarlo)

- F0: `claude --version`, `gh auth status`, `npx wrangler whoami`, línea base de lobby (`npm run check`, `node herramientas/prueba.mjs` con `npm run dev`).
- Hooks: pruebas automatizadas que intentan acciones prohibidas y comprueban el bloqueo (código 2).
- MVP: 5 historias reales con métricas de §7.2; revisión humana del 100 % de PRs.
- F2: historia de punta a punta sin sesión local; comprobar que un usuario sin escritura no puede disparar agentes.
- Evals: `evals/run` con pass@1 antes y después de cada cambio de prompt/modelo.

