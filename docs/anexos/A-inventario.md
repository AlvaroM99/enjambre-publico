# Anexo A: inventario

> Enjambre · [Plan principal](../PLAN.md) · [A Inventario](A-inventario.md) · [B Arquitectura](B-arquitectura.md) · [C Fichas](C-fichas-agentes.md) · [D Backlog](D-backlog.md) · [E Referencias](E-referencias.md)

## 3. Inventario

### 3.1 Lo que ya tenemos [VERIFICADO]

**Herramientas locales**

| Herramienta | Versión | Uso en Enjambre |
|---|---|---|
| Node.js / npm | 24.12.0 / 11.6.2 | Hooks, scripts, Playwright, Agent SDK TS (si vía B). |
| Git | 2.52.0 | Flujo Git. |
| GitHub CLI | 2.103.3, sesión como **AlvaroM99** (`repo`, `workflow`, `read:org`, `gist`, `delete_repo`) | Configurar repos; **no** para agentes (demasiados permisos). |
| Wrangler | 4.164.0 (en node_modules del proyecto) | Despliegues *preview* y migraciones D1. |
| Python | 3.14.2 | Herramientas de datos (fase 4). |
| Docker | 29.1.5 | **Devcontainer para aislar agentes.** |
| Claude Code | App de escritorio; `claude` CLI no está en PATH | Instalar CLI para modo *headless* local. |
| Rust / cargo / make | **No instalados** | finance_tracker no se compila aquí: CI o devcontainer. |

**Cloudflare** (conector conectado en esta sesión)
- Workers: `lobby` (modificado 21-11-2026), `tracker`.
- D1: `lobby` (~9,8 MB), `tracker` (~1,5 MB).
- KV: ninguno. **R2: no activado** (error 10042 «enable R2 through the Dashboard»).
- Plan: gratuito (según CLAUDE.md de lobby). [POR CONFIRMAR] si tienes Workers Paid.

**GitHub** (16 repos): privados `lobby`, `finance_tracker`; públicos de portfolio (Power BI, SQL, Tableau, Excel, Python, `WEATHER_PIPELINE_ETL`…). El remoto `AlvaroM99/stockprediction` de una carpeta local **no aparece** en tu cuenta (borrado o renombrado).

**Proyectos y activos reutilizables**

| Activo | Dónde | Cómo se reutiliza |
|---|---|---|
| **Patrón de sesiones maestra / FRONTEND / DEVOPS** con documentos de contexto por área, `docs/decisiones/` (plantilla + 13 decisiones), `CONFLICTOS.md`, etiquetas de certeza (Confirmado/Documentado/Inferido/Propuesta/Pendiente) | `finance_tracker/docs/SESIONES.md` y `docs/` | Base directa de las fichas de agentes, del registro de decisiones (ADR) y de la resolución de conflictos. |
| *Skills* generales: `frontend-design`, `playwright-cli`, `taste-skill`, `web-design-guidelines` | `finance_tracker/.claude/skills/` | Pasan al plugin `enjambre` (Implementador y Verificador). |
| Verificación con Playwright (43 comprobaciones contra la BD local) | `lobby/herramientas/prueba.mjs` | Núcleo del Verificador QA en lobby. |
| Comprobación de sintaxis | `lobby/herramientas/comprobar.mjs` (`npm run check`) | Paso de CI y hook. |
| `launch.json` (servidor local) | `lobby/.claude/launch.json`, `finance_tracker/.claude/launch.json` | El Verificador arranca el servidor de vista previa. |
| **7 workflows de GitHub Actions** (ci, pr-validation, cd-development, cd-production, docker-build, data-quality, scheduled-tests) | `Academia/Master/WEATHER_PIPELINE_ETL/.github/workflows` | Plantillas de CI/CD para lobby y finance_tracker (que hoy **no tienen CI**). |
| Pruebas Python organizadas (unit, integration, e2e, performance) | `WEATHER_PIPELINE_ETL/tests` | Plantilla para el agente Datos. |
| CLAUDE.md con reglas claras (idioma, datos reales fuera del repo, secretos, despliegue) | lobby, finance_tracker | Se convierten en reglas comunes del plugin + hooks que las hacen cumplir. |
| Paquetes de traspaso (`HANDOFF*.md`, `TRASPASO.md`) | `Desktop/Proyectos/*` | Candidatos de backlog para Enjambre (proyectos nuevos: Habit Tracker, Recetas, Imperia…). |
| Portfolio de BI (Power BI, Tableau, SQL) | Repos públicos | Indica tu perfil: el agente Datos/BI debe hablar tu idioma (modelo en estrella, DAX/SQL). |

**Claude Code hoy:** sin agentes, *skills*, comandos, hooks ni servidores MCP a nivel de usuario; sin `.mcp.json` en proyectos. Conectores de claude.ai disponibles en esta sesión: Cloudflare Developer Platform, Claude Docs, tareas programadas; extensión de Chrome y navegador integrado.

### 3.2 Lo que necesito que confirmes [POR CONFIRMAR]
- Plan de Claude y existencia de cuenta de API con límite de gasto (P3, P4).
- Sitio Atlassian/Jira, plan y rol de administrador (P1).
- Plan de GitHub (P7).
- Plan de Cloudflare (gratuito o Workers Paid) y si quieres activar R2.
- Que lobby (`node herramientas/prueba.mjs`) y finance_tracker (`make pruebas`) pasan hoy (no los ejecuté: requieren servidor local y escriben en BD local).
- Si `WEATHER_PIPELINE_ETL` y los paquetes de `Desktop/Proyectos` entran en el alcance.

### 3.3 Lo que falta

| Elemento | Necesario en | Coste | Notas |
|---|---|---|---|
| Repositorio `AlvaroM99/enjambre` (privado) | Fase 0 | 0 $ | Contiene el plugin, docs, evaluaciones. |
| Claude CLI instalado (`npm i -g @anthropic-ai/claude-code` o instalador oficial) | Fase 0 | 0 $ | Para modo *headless* y `claude setup-token`. |
| Devcontainer base `enjambre` (Node 24 + wrangler + Playwright + Chrome; variante Rust) | Fase 1 | 0 $ | Aislamiento (D14). |
| GitHub App `enjambre-bot` (contents, pull requests, issues: lectura/escritura; actions: lectura) | Fase 2 | 0 $ | Identidad de agentes (D15). |
| GitHub Pro (si repos privados) | Fase 1 | 4 $/mes | Rulesets + entornos con aprobación en privados (P7). |
| Token de Claude para Actions (`claude_code_oauth_token` o `ANTHROPIC_API_KEY`) | Fase 2 | Suscripción o API | Como secreto del repo. |
| Token de API de Cloudflare con permisos mínimos (Workers Scripts edit solo en entorno *preview*, D1 de pruebas) | Fase 2 | 0 $ | Producción: token distinto, solo en entorno protegido. |
| Bases D1 de pruebas (`lobby-preview`, `tracker-preview`) | Fase 2 | 0 $ | Límite gratuito: 10 BD. |
| Sitio Jira Cloud (Free) + app *GitHub for Jira* + token de API | Fase 2 (opcional) | 0 $ | Hasta 10 usuarios. |
| Suscripción Claude Max 5x | Fase 1 (recomendado) | 100 $/mes | Pro (20 $) sirve para empezar; límites de 5 h. |
| Presupuesto API con límite en Console (workspace «enjambre») | Fase 2 | Tope 50 $/mes | Opcional si usas OAuth de suscripción. |
| Destino de telemetría (D1 de Lobby o Grafana Cloud gratis) | Fase 5 | 0 $ | OTel de Claude Code. |

### 3.4 Dependencias externas y riesgos

| Dependencia | Riesgo | Mitigación |
|---|---|---|
| Anthropic (modelos, Claude Code, suscripción) | Cambios de precios o límites; cambios de comportamiento entre versiones (p. ej. `-p` arranca en modo manual desde v2.1.302). | Fijar versión de CLI en devcontainer y de la Action; evaluaciones antes de actualizar. |
| GitHub (repos, Actions, App) | Minutos de Actions (2.000/mes gratis en privados [POR CONFIRMAR]), cambios en Actions. | Jobs cortos, caché, `concurrency`. |
| Atlassian (Jira, MCP v2) | Límite de automatización en Free; MCP v1 retirado; OAuth en CI. | Jira como espejo; integración por app oficial y API REST con token. |
| Cloudflare | Límites del plan gratuito (D1 500 MB/BD, 100k escrituras/día). | BD de pruebas separadas; vigilar uso. |
| Servidores MCP de terceros | Cadena de suministro (OWASP ASI04), inyección. | Solo servidores oficiales (GitHub, Atlassian, Cloudflare); modo solo lectura cuando baste. |
