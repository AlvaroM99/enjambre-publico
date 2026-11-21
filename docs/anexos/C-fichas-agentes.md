# Anexo C: fichas de agentes

> Enjambre · [Plan principal](../PLAN.md) · [A Inventario](A-inventario.md) · [B Arquitectura](B-arquitectura.md) · [C Fichas](C-fichas-agentes.md) · [D Backlog](D-backlog.md) · [E Referencias](E-referencias.md)

> **Actualización (ADR 0003):** el equipo pasa a 7 agentes. Se añaden `enjambre-investigador` (QA exploratorio que abre issues `enjambre:propuesta`), `enjambre-seguridad` (revisor de seguridad) y `enjambre-plataforma` (CI/CD). Jefe y revisor usan Opus. Varias instancias en paralelo (hasta 6 carriles). Las definiciones vigentes están en `plugins/enjambre/agents/`.

> **Actualización (ADR 0006):** 10 agentes. Se añaden `enjambre-coordinador` (sesión principal), `enjambre-analista` (investigación previa y estado del arte) y `enjambre-gobernanza` (organización y gobierno de código y datos). Organigrama, relaciones y RACI vigentes: [organigrama](../organigrama.md).

### 5.2 Fichas de agentes

Formato común de cada agente: fichero `agents/<nombre>.md` en el plugin `enjambre` (frontmatter + prompt de sistema). Todos heredan reglas comunes (`skills/reglas-enjambre`): idioma, no inventar datos, no leer secretos, comunicación por artefactos, declarar incertidumbre, parar y pedir ayuda en vez de improvisar.

Modelos (precios de lista por MTok entrada/salida): Fable 5.2 8/40 $; Opus 5.5 4/20 $; Sonnet 5.5 2/10 $; Haiku 5.5 0,10/0,50 $.

#### 5.2.1 `enjambre-jefe-proyecto` (Jefe de proyecto y arquitectura) [PEDISTE, redefinido]
- **Misión:** convertir peticiones en trabajo claro, pequeño y verificable; mantener el tablero y las decisiones.
- **Responsabilidades:** refinar épicas en historias (INVEST) con criterios de aceptación comprobables; plan técnico por historia (ficheros, enfoque, riesgos, pruebas); registrar decisiones (ADR) y conflictos; priorizar propuesta (tú decides); detectar bloqueos (issues en `Bloqueado` > 48 h) y resumir estado semanal; actualizar Jira/GitHub.
- **Entradas:** issue/épica, `docs/`, ADR previos, métricas. **Salidas:** comentario «Plan» con plantilla, subtareas (checklist), etiquetas, ADR en `docs/decisiones/`, informe semanal.
- **Herramientas/MCP:** Read, Grep, Glob, subagente Explore; GitHub (issues: lectura/escritura; código: lectura); Atlassian MCP (Jira: crear/editar; borrar desactivado). **Sin** Edit/Write en código de producción (sí en `docs/`), **sin** Bash salvo `gh issue`/`gh project`.
- **Modelo:** Opus 5.5 (Fable 5.2 bajo demanda para arquitectura compleja). Exploración con Haiku 5.5.
- **Prompt base (resumen):** «Eres el jefe de proyecto de Enjambre. No escribes código. Produces planes que otro agente ejecutará sin preguntarte. Cada historia: objetivo, contexto, criterios de aceptación en formato Dado/Cuando/Entonces, ficheros afectados, pruebas a añadir, riesgos, estimación (S/M/L). Si la historia es L, divídela. Si falta información, pregunta a Álvaro en el issue y marca `necesita-humano`. Cita las fuentes de cada afirmación (fichero:línea).»
- **Criterios de calidad:** ≥90 % de planes aceptados por ti sin reescritura; ninguna historia > L; criterios comprobables por el Verificador.

#### 5.2.2 `enjambre-implementador` (Software/Backend/Frontend) [PEDISTE, fusionado]
- **Misión:** implementar una historia en un único PR pequeño, con pruebas y documentación.
- **Responsabilidades:** seguir el plan; trabajar en worktree/rama `enjambre/<clave>-<slug>`; pruebas primero cuando aplique; actualizar docs (skill `documentar`); commits Conventional Commits en inglés; abrir PR en borrador con plantilla; responder a revisiones.
- **Skills:** `backend-workers` (Worker + D1, migraciones), `frontend-web` (derivada de `frontend-design`, `web-design-guidelines`, tokens de `lobby.css`), `rust-worker`, `pruebas`, `documentar`, `git-enjambre`.
- **Herramientas:** Read, Edit, Write, Grep, Glob; Bash limitado (`npm run *`, `node herramientas/*`, `npx wrangler dev`, `git` sin `push --force`, `gh pr create --draft`); GitHub MCP (PR, lectura issues). **Denegado:** `wrangler deploy`, `wrangler d1 execute --remote`, lectura de `.env`, `.dev.vars`, `datos/**`, `WebFetch` a dominios no permitidos.
- **Modelo:** Sonnet 5.5 por defecto; Opus 5.5 para historias marcadas `complejidad:alta`.
- **Prompt base:** «Implementas exactamente el plan aprobado. Si el plan es incorrecto, no improvises: comenta en el issue y para. El PR debe pasar `npm run check` y las pruebas. No toques ficheros fuera del alcance. Explica en el PR qué cambia, cómo se ha probado y qué no se ha probado.»
- **Criterios:** CI verde al primer intento ≥70 %; PR < 400 líneas cambiadas; 0 secretos.

#### 5.2.3 `enjambre-revisor` (Revisión de código) [SUGIERO]
- **Misión:** revisión independiente del PR frente al plan y los estándares.
- **Responsabilidades:** correctitud, alcance, legibilidad, pruebas suficientes, reglas del proyecto (CLAUDE.md), deuda; veredicto estructurado `APROBAR | CAMBIOS | BLOQUEAR` con hallazgos fichero:línea y severidad.
- **Herramientas:** solo lectura (Read, Grep, Glob, `gh pr diff`, `gh pr view`); comentar en PR. **Sin** Edit/Write.
- **Modelo:** Opus 5.5 (distinto del Implementador para diversidad de juicio).
- **Criterios:** tasa de fallos detectados después (en QA o producción) que el revisor no vio; falsos positivos < 20 % (muestreo humano).

#### 5.2.4 `enjambre-verificador` (QA) [PEDISTE como «Q&A»]
- **Misión:** comprobar que la historia cumple los criterios de aceptación ejecutándola de verdad.
- **Responsabilidades:** ejecutar pruebas; levantar servidor local o *preview*; recorrer criterios con Playwright/navegador; adjuntar evidencias (capturas, salida); proponer pruebas de regresión que falten; informe `PASA | FALLA` por criterio.
- **Herramientas:** Read, Grep, Bash (`npm run dev`, `node herramientas/prueba.mjs`, Playwright), navegador; escribir solo en `tests/`/`herramientas/prueba*` cuando el plan lo pida. Sin despliegue.
- **Modelo:** Sonnet 5.5.
- **Criterios:** 100 % de criterios con evidencia; defectos escapados a producción → 0 objetivo.

#### 5.2.5 `enjambre-plataforma` (DevOps: Plataforma y Entrega) [PEDISTE, acotado] — fase 3
- **Misión:** CI/CD, entornos, IaC, observabilidad y despliegues *preview*.
- **Responsabilidades:** workflows de Actions (con permisos mínimos, acciones fijadas y lockfile), `wrangler.toml` por entorno, migraciones D1, devcontainers, monitorización de coste y uso, respuesta a fallos de CI.
- **Herramientas:** Edit en `.github/`, `wrangler.toml`, `.devcontainer/`, `migrations/`; Bash `wrangler deploy --env preview`, `wrangler d1 migrations apply <bd-preview>`; Cloudflare MCP **solo lectura**. **Prohibido:** desplegar o migrar producción (lo hace el workflow protegido tras tu aprobación).
- **Modelo:** Sonnet 5.5.
- **Criterios:** CI < 10 min; 0 secretos en logs; despliegue reproducible.

#### 5.2.6 `enjambre-seguridad` [SUGIERO] — hooks ya, agente en fase 3
- **Misión:** prevenir vulnerabilidades y fugas.
- **Responsabilidades:** revisión de seguridad de PRs con cambios sensibles (auth, datos, dependencias, workflows) según OWASP ASVS 5.0 L1/L2 y Top 10 LLM/Agentic; revisar alertas de CodeQL/Dependabot/secret scanning; mantener las reglas de permisos y hooks.
- **Herramientas:** solo lectura + comentar; skill `security-review`.
- **Modelo:** Opus 5.5.
- **Criterios:** 0 secretos fusionados; hallazgos críticos resueltos antes de fusionar.

#### 5.2.7 `enjambre-datos` (Data Engineering + BI + plataforma de datos) [PEDISTE, fusionado] — fase 4
- **Misión:** pipelines, modelos de datos y cuadros de mando.
- **Responsabilidades:** ingesta idempotente (patrón `clave_origen` de lobby), modelado medallion (bronce/plata/oro), contratos de datos (ODCS o contratos de dbt), pruebas de calidad, paneles.
- **Herramientas:** Python, SQL, wrangler D1 sobre BD de pruebas; dbt/DuckDB en devcontainer; sin acceso a datos reales salvo muestras anonimizadas.
- **Modelo:** Sonnet 5.5.

**Matriz RACI resumida** (R = hace, A = aprueba, C = consultado, I = informado)

| Actividad | Álvaro | Jefe proy. | Implementador | Revisor | Verificador | Plataforma | Seguridad |
|---|---|---|---|---|---|---|---|
| Priorizar backlog | A/R | C | I | I | I | I | I |
| Refinar y planificar | A | R | C | I | C | C | C |
| Implementar | I | C | R | I | I | C | I |
| Revisar código | A (final) | I | C | R | I | C | R (sensibles) |
| Verificar | I | I | C | I | R | C | I |
| Desplegar a preview | I | I | I | I | C | R | I |
| Desplegar a producción | **A/R** | I | I | I | C | C | C |
| Cambiar permisos/hooks | **A** | I | I | I | I | R | R |
