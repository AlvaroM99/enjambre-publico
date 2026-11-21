# Panorama: competencia, alternativas y recursos públicos

> Investigación con el método de la skill `investigar-estado-del-arte`, a 21-11-2026. Estrellas, fecha del último push, licencia y si el repositorio está archivado salen de la API de GitHub (`gh api repos/<repo>`) ese día. Las descripciones de productos comerciales salen de sus webs públicas y no se han probado. Lo no comprobado va marcado **[POR CONFIRMAR]**.

## 1. La pregunta

¿Hay algo público que ya haga lo que hace Enjambre (equipo de agentes que lleva issues a PR revisados, con control humano) o partes de ello, para reutilizarlo en lugar de construirlo?

**Respuesta corta:** nadie cubre las cuatro cosas que Enjambre junta: **un escritor por historia**, **puertas humanas**, **seguridad aplicada por hooks** y **coste fijo con el plan Pro**. Pero hay piezas muy maduras que conviene **reutilizar** (MCP, plugins oficiales, observabilidad de uso, revisión de seguridad en CI, formatos como AGENTS.md) y métodos de los que **copiar ideas** (BMAD, Spec Kit, Superpowers).

## 2. Sistemas multiagente para desarrollo (competencia directa)

| Proyecto | ★ | Último push | Licencia | Qué es | Qué tomamos | Qué no |
|---|---|---|---|---|---|---|
| [obra/superpowers](https://github.com/obra/superpowers) | 323 637 | 2026-11-03 | MIT | Biblioteca de skills y método (lluvia de ideas, TDD, desarrollo dirigido por subagentes) | Ideas para skills de TDD y de depuración sistemática | Sustituir nuestras skills: duplicaría reglas |
| [github/spec-kit](https://github.com/github/spec-kit) | 150 929 | 2026-11-20 | MIT | Desarrollo guiado por especificaciones (spec → plan → tareas) | Para épicas grandes: el analista y el jefe pueden producir una spec al estilo Spec Kit | Adoptarlo entero: solapa con plan.md |
| [ruvnet/ruflo](https://github.com/ruvnet/ruflo) (antes claude-flow) | 82 222 | 2026-11-21 | MIT | «Enjambres» de agentes con coordinación autónoma | Nada por ahora | Choca con un escritor por historia y con el coste del plan Pro |
| [FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT) | 71 374 | 2026-01-21 | MIT | «Empresa de software» con roles (PM, arquitecto, ingeniero, QA) | Documentos estructurados entre roles (ya lo hacemos) | Roles que se hablan; baja corrección en MAST |
| [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | 58 526 | 2026-11-21 | — | Lista curada de recursos de Claude Code | Fuente para el analista | — |
| [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | 55 604 | 2026-11-21 | — | Método ágil con agentes analista, PM, arquitecto, scrum master, dev y QA | Confirma nuestro reparto (analista → plan → dev → QA); su «historia con contexto completo» se parece a nuestro plan | Más roles de planificación de los que necesita un usuario único |
| [wshobson/agents](https://github.com/wshobson/agents) | 42 778 | 2026-11-21 | MIT | Cientos de agentes, skills y comandos para Claude Code y otros | Ideas de prompts por especialidad (backend, frontend) para futuras skills | Instalar cientos de agentes: contexto y superficie de ataque |
| [OpenBMB/ChatDev](https://github.com/OpenBMB/ChatDev) | 34 834 | 2026-11-06 | Apache-2.0 | Empresa virtual de agentes que conversan | — | Agentes que conversan (D18) |
| [gastownhall/beads](https://github.com/gastownhall/beads) | 28 893 | 2026-11-21 | MIT | Gestor de tareas y memoria pensado para agentes | Revisar si GitHub Issues se queda corto como memoria | Hoy GitHub Issues es el bus (ADR 0001) |
| [eyaltoledano/claude-task-master](https://github.com/eyaltoledano/claude-task-master) | 28 512 | 2026-04-28 | — | Convierte un PRD en tareas con dependencias | La idea de dependencias explícitas (ya en la tabla de carriles) | Otra fuente de tareas además de Issues |
| [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | 26 718 | 2026-11-02 | MIT | Más de 100 subagentes por especialidad | Referencia para skills por stack | Igual que wshobson |
| [coleam00/Archon](https://github.com/coleam00/Archon) | 23 978 | 2026-11-21 | MIT | Constructor de arneses para programar con IA de forma repetible | Comparar su enfoque de flujos deterministas con nuestro coordinador | — |
| [SuperClaude-Org/SuperClaude_Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework) | 23 951 | 2026-09-27 | MIT | Comandos y «personas» para Claude Code | — | Personas sin límites de herramientas |
| [gastownhall/gastown](https://github.com/gastownhall/gastown) | 18 861 | 2026-11-14 | MIT | Gestor de espacios de trabajo multiagente | Ver cómo reparte trabajo en paralelo | [POR CONFIRMAR] madurez |
| [humanlayer/humanlayer](https://github.com/humanlayer/humanlayer) | 12 924 | 2026-11-16 | Apache-2.0 | Herramientas para agentes en bases de código complejas, con humano en el bucle | Patrones de aprobación humana | — |

**Productos comerciales** (sin repositorio; descripción pública, no probados): Devin (Cognition), GitHub Copilot coding agent, OpenAI Codex en la nube, agentes en segundo plano de Cursor, Google Jules, Amazon Kiro (orientado a specs), Factory. De Copilot coding agent copiamos las salvaguardas: rama propia, PR en borrador y el agente no aprueba su PR (https://docs.github.com/en/copilot/concepts/agents/coding-agent/risks-and-mitigations).

## 3. Agentes de código individuales (lo que va dentro de cada carril)

| Proyecto | ★ | Último push | Licencia | Nota |
|---|---|---|---|---|
| [anthropics/claude-code](https://github.com/anthropics/claude-code) | 156 563 | 2026-11-21 | — | El motor de Enjambre |
| [openai/codex](https://github.com/openai/codex) | 136 054 | 2026-11-21 | Apache-2.0 | Alternativa; lee AGENTS.md |
| [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) | 108 974 | 2026-11-21 | Apache-2.0 | Alternativa; lee AGENTS.md [POR CONFIRMAR] |
| [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands) | 93 964 | 2026-11-21 | MIT | Agente de desarrollo autónomo, autoalojable |
| [cline/cline](https://github.com/cline/cline) | 71 805 | 2026-11-21 | Apache-2.0 | Agente en el editor, SDK o CLI |
| [aaif-goose/goose](https://github.com/aaif-goose/goose) | 56 855 | 2026-11-20 | Apache-2.0 | Agente extensible con MCP |
| [Aider-AI/aider](https://github.com/Aider-AI/aider) | 50 213 | 2026-05-22 | Apache-2.0 | Programación en pareja en terminal; sin push desde mayo |
| [continuedev/continue](https://github.com/continuedev/continue) | 36 535 | 2026-11-20 | Apache-2.0 | Agente de código abierto |
| [Kilo-Org/kilocode](https://github.com/Kilo-Org/kilocode) | 28 074 | 2026-11-21 | MIT | Plataforma de ingeniería con agentes |
| [SWE-agent/SWE-agent](https://github.com/SWE-agent/SWE-agent) | 20 848 | 2026-11-16 | MIT | De issue a arreglo; referencia académica |
| [RooCodeInc/Roo-Code](https://github.com/RooCodeInc/Roo-Code) | 24 236 | 2026-05-15 | Apache-2.0 | **Archivado** |

**Conclusión:** Claude Code sigue siendo la mejor base para Enjambre por plugins, subagentes, hooks y el plan Pro. Escribir `AGENTS.md` en cada proyecto mantendría las reglas portables a Codex o Gemini si algún día hiciera falta (formato abierto: [agentsmd/agents.md](https://github.com/agentsmd/agents.md), ★ 25 640, MIT).

## 4. Trabajo en paralelo y visualización

| Proyecto | ★ | Último push | Licencia | Para qué | Decisión |
|---|---|---|---|---|---|
| [BloopAI/vibe-kanban](https://github.com/BloopAI/vibe-kanban) | 28 773 | 2026-11-15 | Apache-2.0 | Tablero kanban que lanza agentes en worktrees paralelos | **Alternativa seria** al coordinador local para ver y lanzar carriles; probar en F3 |
| [pixel-agents-hq/pixel-agents](https://github.com/pixel-agents-hq/pixel-agents) | 10 328 | 2026-11-20 | MIT | Oficina de píxeles con los agentes | **Adoptado** (S50) |
| [smtg-ai/claude-squad](https://github.com/smtg-ai/claude-squad) | 8 846 | 2026-11-13 | **AGPL-3.0** | Varias sesiones en tmux y worktrees | Uso local posible; **no** copiar su código en proyectos |
| [stravu/crystal](https://github.com/stravu/crystal) | 3 129 | 2026-02-26 | MIT | Sesiones paralelas en worktrees (ahora Nimbalyst) | Sin actividad desde febrero |
| [disler/claude-code-hooks-multi-agent-observability](https://github.com/disler/claude-code-hooks-multi-agent-observability) | 1 573 | 2026-02-08 | — | Panel en tiempo real con eventos de hooks | Idea para un panel sobre `actividad.jsonl`; sin licencia: no copiar código |

## 5. Frameworks de agentes (vía B, si algún día hace falta)

| Proyecto | ★ | Último push | Licencia | Nota |
|---|---|---|---|---|
| [microsoft/autogen](https://github.com/microsoft/autogen) | 61 956 | 2026-11-12 | CC-BY-4.0 | **Archivado** |
| [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) | 61 147 | 2026-11-21 | MIT | Roles que colaboran |
| [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | 45 234 | 2026-11-20 | MIT | Grafos de estado; bueno para flujos deterministas |
| [openai/openai-agents-python](https://github.com/openai/openai-agents-python) | 30 801 | 2026-11-21 | MIT | Traspasos entre agentes |
| [anthropics/claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript) | 1 894 | 2026-11-20 | — | Base natural de la vía B (necesita API, no Pro) |
| [cloudflare/agents](https://github.com/cloudflare/agents) | 6 022 | 2026-11-21 | MIT | Agentes en Workers con estado (Durable Objects); encaja con el stack de Álvaro para un panel o un orquestador |

**Conclusión:** ninguno aporta lo que falta hoy (lo que falta es probar en real). Si la vía C se queda corta, el orden sería Claude Agent SDK y después Cloudflare Agents, por stack.

## 6. Plugins, skills y MCP

| Pieza | ★ | Licencia | Uso en Enjambre |
|---|---|---|---|
| [anthropics/skills](https://github.com/anthropics/skills) | 198 435 | — | Formato y ejemplos oficiales de skills |
| [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | 47 909 | Apache-2.0 | `context7` y `playwright` activados; `github`, `security-guidance`, `code-review`, `feature-dev`, `plugin-dev`, `skill-creator` opcionales |
| [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | 92 143 | — | Servidores MCP de referencia |
| [upstash/context7](https://github.com/upstash/context7) | 65 238 | MIT | Documentación actual de bibliotecas |
| [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | 39 978 | Apache-2.0 | Navegador para verificador e investigador |
| [github/github-mcp-server](https://github.com/github/github-mcp-server) | 34 657 | MIT | Alternativa a `gh` con permisos por conjunto de herramientas |
| [cloudflare/mcp-server-cloudflare](https://github.com/cloudflare/mcp-server-cloudflare) | 4 486 | Apache-2.0 | Consultar Workers y D1 en solo lectura (con cuidado: producción) |

## 7. Coste, observabilidad y seguridad

| Pieza | ★ | Licencia | Uso |
|---|---|---|---|
| [ccusage/ccusage](https://github.com/ccusage/ccusage) | 19 536 | MIT | **Adoptar:** `npx ccusage` lee los registros locales de Claude Code y muestra uso por día y por bloque de 5 h; complementa `actividad.jsonl` para vigilar los límites de Pro |
| [langfuse/langfuse](https://github.com/langfuse/langfuse) | 37 706 | — (núcleo MIT y parte empresarial) | Trazas y evaluaciones; demasiado para F3 |
| [anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review) | 7 047 | MIT | **Adoptar en F3:** Action oficial que revisa la seguridad de cada PR; complementa al agente de seguridad [POR CONFIRMAR si funciona con OAuth de Pro] |
| [gitleaks/gitleaks](https://github.com/gitleaks/gitleaks) | 31 242 | MIT | **Adoptado** en la CI de Enjambre |
| [ossf/scorecard](https://github.com/ossf/scorecard) | 5 856 | Apache-2.0 | Medir el repo público (F5) |

## 8. Bibliotecas del stack de los proyectos

| Biblioteca | ★ | Último push | Licencia | Para qué |
|---|---|---|---|---|
| [microsoft/playwright](https://github.com/microsoft/playwright) | 100 735 | 2026-11-21 | Apache-2.0 | Pruebas de extremo a extremo (ya en lobby) |
| [colinhacks/zod](https://github.com/colinhacks/zod) | 44 377 | 2026-11-20 | MIT | Validar entradas de la API |
| [drizzle-team/drizzle-orm](https://github.com/drizzle-team/drizzle-orm) | 36 336 | 2026-11-20 | Apache-2.0 | Acceso tipado a D1 |
| [honojs/hono](https://github.com/honojs/hono) | 33 008 | 2026-11-20 | MIT | Rutas HTTP en Workers |
| [vitest-dev/vitest](https://github.com/vitest-dev/vitest) | 17 420 | 2026-11-20 | MIT | Pruebas unitarias (con el pool de Workers) |
| [cloudflare/workers-sdk](https://github.com/cloudflare/workers-sdk) | 4 738 | 2026-11-21 | Apache-2.0 | Wrangler |
| [cloudflare/templates](https://github.com/cloudflare/templates) | 2 182 | 2026-11-20 | MIT | Plantillas oficiales de Workers |
| [duckdb/duckdb](https://github.com/duckdb/duckdb) · [dbt-labs/dbt](https://github.com/dbt-labs/dbt) | 43 223 · 14 199 | 2026-11 | MIT · Apache-2.0 | Fase 4 (datos) |

### Ejemplo: «no hagas un editor de texto desde cero»

| Editor | ★ | Último push | Licencia | Estado |
|---|---|---|---|---|
| [ueberdosis/tiptap](https://github.com/ueberdosis/tiptap) | 39 107 | 2026-11-20 | MIT | Activo; sin interfaz propia (headless) sobre ProseMirror |
| [meta/lexical](https://github.com/meta/lexical) | 24 039 | 2026-11-20 | MIT | Activo |
| [slab/quill](https://github.com/slab/quill) | 47 380 | 2025-07-25 | BSD-3-Clause | Sin push desde julio de 2025 |
| [codemirror/dev](https://github.com/codemirror/dev) | 7 803 | 2026-04-15 | — | Repositorio de GitHub **archivado**; web en codemirror.net [POR CONFIRMAR dónde sigue el desarrollo] |
| [ProseMirror/prosemirror](https://github.com/ProseMirror/prosemirror) | 8 691 | 2026-04-01 | MIT | Repositorio de GitHub **archivado**; web en prosemirror.net [POR CONFIRMAR] |

Para una web de notas en Workers, la recomendación del analista sería **Tiptap o Lexical**: MIT, activos y de solo cliente. Este es el tipo de comprobación que el analista hace antes de que nadie escriba código: dos de los cinco editores más conocidos tienen hoy el repositorio de GitHub archivado.

## 9. Mejoras propuestas para Enjambre

| # | Mejora | De dónde | Esfuerzo | Prioridad |
|---|---|---|---|---|
| M1 | `AGENTS.md` en cada proyecto, generado desde `CLAUDE.md` | agentsmd/agents.md | S | Media |
| M2 | `npx ccusage` en la rutina semanal para vigilar los límites de Pro | ccusage | S | Alta |
| M3 | `anthropics/claude-code-security-review` como paso de CI en PR sensibles | Anthropic | S | Media |
| M4 | Probar vibe-kanban como tablero visual de carriles frente al coordinador | BloopAI | M | Media |
| M5 | Spec al estilo Spec Kit para épicas (analista + jefe) | GitHub | M | Baja |
| M6 | Skills de TDD y depuración inspiradas en Superpowers | obra/superpowers | M | Baja |
| M7 | Panel de actividad y tokens sobre `actividad.jsonl` (como módulo de Lobby, P13) | disler (idea) | M | Baja |
| M8 | Semilla sintética de lobby para que `prueba.mjs` completa corra en CI | — | M | Media |
