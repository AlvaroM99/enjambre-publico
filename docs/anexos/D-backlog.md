# Anexo D: backlog inicial

> Enjambre · [Plan principal](../PLAN.md) · [A Inventario](A-inventario.md) · [B Arquitectura](B-arquitectura.md) · [C Fichas](C-fichas-agentes.md) · [D Backlog](D-backlog.md) · [E Referencias](E-referencias.md)

## 8. Backlog inicial

Prioridades: Highest / High / Medium / Low. Proyecto Jira `ENJ` (o etiquetas en GitHub). CSV para importar ([`backlog/enjambre-backlog.csv`](../../backlog/enjambre-backlog.csv)):

```csv
Work item ID,Work type,Summary,Parent,Priority,Description
E1,Epic,Enjambre - Fundaciones y decisiones,,Highest,Cuentas, repo enjambre, línea base y decisiones de vía.
S1,Story,Registrar decisiones de vía y respuestas P1-P13,E1,Highest,"AC: Dado el plan aprobado, cuando se registran las decisiones, entonces existe docs/decisiones/0001-via.md con vía, presupuesto y alcance."
S2,Story,Crear repositorio enjambre con docs del plan divididos en anexos,E1,Highest,"AC: repo privado AlvaroM99/enjambre; docs/PLAN.md y anexos A-E enlazados; sin datos reales."
S3,Story,Instalar Claude CLI y verificar plan y límites,E1,High,"AC: claude --version funciona en el devcontainer y en Windows; uso y plan anotados en docs/operacion.md."
S4,Story,Medir línea base de lobby,E1,High,"AC: npm run check y prueba.mjs pasan; tiempos y número de comprobaciones registrados."
E2,Epic,Enjambre - Seguridad base y aislamiento,,Highest,Devcontainer, hooks, permisos.
S5,Story,Devcontainer base enjambre,E2,Highest,"AC: contenedor con Node 24, wrangler, Playwright y Chrome; lobby arranca con wrangler dev dentro; sandbox activo."
S6,Story,Hook proteger-secretos,E2,Highest,"AC: intentos de leer .env, .dev.vars o datos/** se bloquean con salida 2 y quedan registrados; prueba automatizada del hook."
S7,Story,Hook bloquear-comandos,E2,Highest,"AC: wrangler deploy sin --env preview, d1 execute --remote, push --force y gh repo delete se bloquean; prueba automatizada."
S8,Story,Settings de permisos del plugin (deny/ask/allow),E2,High,"AC: settings.json del plugin con reglas deny de §6.2; documentado en docs/operacion.md."
E3,Epic,Enjambre - Agentes MVP,,Highest,Jefe de proyecto, Implementador, Revisor, Verificador.
S9,Story,Agente jefe-proyecto y plantilla de plan,E3,Highest,"AC: dado un issue, produce plan con AC Dado/Cuando/Entonces, ficheros, pruebas, riesgos y estimación; 2 planes aceptados sin reescritura."
S10,Story,Agente implementador y skills backend-workers/frontend-web/pruebas/git-enjambre,E3,Highest,"AC: dado un plan aprobado, abre PR en borrador < 400 líneas con pruebas y CI verde."
S11,Story,Agente revisor con veredicto estructurado,E3,High,"AC: comenta APROBAR/CAMBIOS/BLOQUEAR con hallazgos fichero:línea y severidad; sin permisos de edición."
S12,Story,Agente verificador reutilizando prueba.mjs,E3,High,"AC: informe PASA/FALLA por criterio con evidencias; arranca servidor local; no despliega."
S13,Story,Skill reglas-enjambre y documentar,E3,High,"AC: reglas comunes cargadas por todos los agentes; cada PR actualiza docs afectadas."
E4,Epic,Enjambre - CI/CD y GitHub,,High,CI, rulesets, GitHub App, preview.
S14,Story,CI básico en lobby,E4,High,"AC: workflow por PR con npm run check y pruebas; permisos read-only; acciones fijadas. HECHO en lobby#1 (CI verde)."
S15,Story,Ruleset de main y CODEOWNERS,E4,High,"AC: PR obligatorio, 1 aprobación de Álvaro, checks obligatorios, sin force push; CODEOWNERS protege .github, .claude, wrangler.toml y migrations."
S16,Story,GitHub App enjambre-bot con permisos mínimos,E4,High,"AC: App instalada solo en repos elegidos; contents/PR/issues rw; sin admin; secreto en Actions."
S17,Story,Entorno preview en Cloudflare,E4,Medium,"AC: lobby-preview Worker y D1 de pruebas; despliegue automático por PR; enlace en el PR."
S18,Story,Entorno production con aprobación,E4,Medium,"AC: despliegue solo tras aprobación de Álvaro; prueba de humo; procedimiento de rollback documentado y probado."
E5,Epic,Enjambre - Orquestación por eventos,,High,claude-code-action y tablero.
S19,Story,Workflow enjambre-planificar por etiqueta,E5,High,"AC: etiqueta enjambre:planificar en issue genera comentario de plan; solo usuarios con escritura; presupuesto y max-turns. HECHO en lobby#1; falta el secreto."
S20,Story,Workflow enjambre-implementar,E5,High,"AC: etiqueta enjambre:implementar crea rama enjambre/* y PR en borrador; concurrency 1 por issue; WIP global configurable (ENJAMBRE_WIP, 3 por defecto, máx. 6; ADR 0003). HECHO en lobby#1; falta el secreto. Reserva WIP sin carreras y liberación del hueco (ADR 0008)."
S21,Story,Workflow enjambre-revisar y verificar en PR,E5,Medium,"AC: al marcar PR listo, ejecuta revisor y verificador y comenta veredictos. HECHO en lobby#1 (revisar); verificar sigue en local. Primera ejecución real en lobby#1: CAMBIOS con 10 hallazgos (ADR 0008)."
S22,Story,Integración Jira (opcional),E5,Medium,"AC: proyecto Jira con estados de §5.3; app GitHub for Jira enlaza ramas y PR; CSV importado; 2 reglas de automatización."
E6,Epic,Enjambre - Piloto en lobby,,High,Cinco historias reales completadas por el equipo.
S23,Story,Seleccionar 5 historias reales de lobby y refinarlas,E6,High,"AC: 5 issues en Listo con plan aprobado; mezcla back/front/bug."
S24,Story,Ejecutar ciclo completo y medir métricas MVP,E6,High,"AC: informe con lead time, ciclos de revisión, coste por historia y tasa sin retrabajo."
E7,Epic,Enjambre - Observabilidad y FinOps,,Medium,Coste y trazas.
S25,Story,Hook registrar-coste y coste en PR,E7,Medium,"AC: cada ejecución registra agente, tokens y total_cost_usd; comentario de coste en el PR. HECHO: tokens por agente en actividad.jsonl."
S26,Story,Alertas de presupuesto,E7,Medium,"AC: aviso al superar 70 % del presupuesto mensual; bloqueo de tarea al agotar su presupuesto."
S27,Story,Telemetría OpenTelemetry de Claude Code,E7,Low,"AC: métricas de coste y tokens exportadas a destino elegido; contenido de prompts redactado."
E8,Epic,Enjambre - Calidad de agentes (evals),,Medium,Banco de evaluaciones.
S28,Story,Banco de 20 tareas de evaluación,E8,Medium,"AC: 20 tareas con verificador ejecutable sacadas del historial real; script que ejecuta y puntúa pass@1. HECHO: evals/ con 20 tareas y fixtures; falta la primera ejecución. Workflow evals.yml para ejecutarlo en Actions (ADR 0008)."
S29,Story,Proceso de lecciones aprendidas,E8,Low,"AC: cada defecto escapado crea prueba, entrada en docs/lecciones.md y tarea de eval."
E9,Epic,Enjambre - Ampliación del equipo,,Medium,Plataforma, Seguridad, finance_tracker.
S30,Story,Agente plataforma,E9,Medium,"AC: mantiene workflows y wrangler.toml; despliega solo a preview; CI < 10 min. Definición HECHA (ADR 0003)."
S31,Story,Agente seguridad y escáneres,E9,Medium,"AC: CodeQL, secret scanning, Dependabot y Scorecard activos; revisión de PRs sensibles con checklist ASVS L1. Agente HECHO (ADR 0003); en GitHub Free privado sin CodeQL ni secret scanning: gitleaks y npm audit en CI."
S32,Story,Incorporar finance_tracker (Rust en CI),E9,Medium,"AC: skill rust-worker; CI con cargo test; una historia completada. HECHO en finance_tracker#1 (CI verde)."
E10,Epic,Enjambre - Datos y BI,,Low,Agente Datos y panel.
S33,Story,Modelo de datos de ejecuciones de agentes,E10,Low,"AC: tablas hecho/dimensiones documentadas con contrato; datos de 4 semanas cargados."
S34,Story,Panel de Enjambre,E10,Low,"AC: panel con coste por tarea, lead time y tasa sin retrabajo, actualizado a diario."
S35,Story,Agente datos,E10,Low,"AC: pipeline idempotente con pruebas dbt; sin acceso a datos reales."
E11,Epic,Enjambre - Equipo ampliado y paralelo (ADR 0003-0005),,Highest,"Hasta 6 carriles, QA investigador, Bash por agente y CI/CD en GitHub Free."
S36,Story,Hook limitar-bash con lista blanca por agente,E11,Highest,"AC: dado un agente de solo lectura, cuando ejecuta un comando fuera de su lista o redirige a un fichero, entonces el hook sale con 2; 53 pruebas. HECHO (ADR 0004)."
S37,Story,Agente investigador (QA exploratorio),E11,High,"AC: dado un alcance, abre como máximo 5 issues enjambre:propuesta reproducibles y devuelve tabla de retroalimentación para los implementadores. HECHO (definición); falta ejecución real."
S38,Story,Carriles en paralelo con worktrees y límite WIP,E11,High,"AC: el jefe devuelve tabla de carriles independientes; implementador y plataforma con isolation worktree; WIP configurable 1-6 (ENJAMBRE_WIP). HECHO (definición)."
S39,Story,CI del repo enjambre y Dependabot de Actions,E11,High,"AC: npm test en Linux y Windows con Node 22 y 24; gitleaks verificado por SHA-256; Dependabot semanal. HECHO; falta primera ejecución."
S40,Story,Plantillas de workflows (skill ci-cd),E11,High,"AC: ci, planificar, implementar, revisar, investigar y produccion con SHA fijados, permisos mínimos, concurrency, timeouts y solo el propietario; comprobado por npm test. HECHO."
S41,Story,Prueba de humo en sesión real,E11,Highest,"AC: comprobados agent_type, isolation en agentes de plugin, prefijo de skills, CLAUDE_SKILL_DIR y --agent en claude -p; resultados en docs/operacion.md. Puerta de F2."
S42,Story,Credenciales sintéticas para las pruebas de lobby,E11,High,"AC: prueba.mjs funciona en CI y en el devcontainer sin .dev.vars ni datos/ reales. Por PR en lobby. HECHO en CI de lobby (credenciales sintéticas + humo.mjs)."
S43,Story,Perfil seccomp propio para el devcontainer,E11,Low,"AC: el sandbox funciona sin seccomp=unconfined; solo se permiten unshare y clone de espacios de nombres."
S44,Story,Decidir visibilidad de enjambre o GitHub App para Actions,E11,High,"AC: el runner de un proyecto instala el plugin enjambre desde el marketplace. Decide Álvaro."
E12,Epic,Enjambre - Repo público y organigrama completo (ADR 0006),,High,"Repo público, analista, gobernanza, coordinador, actividad y ecosistema."
S45,Story,Repo público enjambre-publico y script de publicación,E12,Highest,"AC: instantánea sin historial firmada con noreply; el script se niega con correos, tokens o claves. HECHO."
S46,Story,Agente analista (estado del arte),E12,High,"AC: dada una petición, informe con estándar, bibliotecas, repos, competencia y recomendación construir/reutilizar/integrar con fuentes. HECHO (definición)."
S47,Story,Agente de gobernanza de código y datos,E12,High,"AC: informe con nota 0-3 en 8 áreas y máx. 5 propuestas; sin mover ficheros. HECHO (definición)."
S48,Story,Coordinador como sesión principal,E12,High,"AC: claude --agent enjambre:enjambre-coordinador lanza solo agentes de Enjambre y respeta las dos puertas. HECHO (definición); falta prueba real."
S49,Story,Hook registrar-actividad,E12,Medium,"AC: inicio y fin de cada agente en actividad.jsonl sin contenido de la conversación; nunca bloquea. HECHO."
S50,Story,Oficina de agentes con Pixel Agents,E12,Low,"AC: Álvaro instala Pixel Agents; un personaje por rol y cuatro áreas. Pasos en docs/operacion.md."
S51,Story,Secreto CLAUDE_CODE_OAUTH_TOKEN en lobby,E12,High,"AC: secreto creado por Álvaro con claude setup-token; ENJAMBRE_WIP=3 ya creado. HECHO el 22-11-2026 en lobby y finance_tracker (ADR 0008)."
S52,Story,Agentes de Enjambre en finance_tracker,E12,High,"AC: workflows de agentes, settings con deny de tracker/datos, .dev.vars y _origen, etiquetas y ENJAMBRE_WIP. HECHO en finance_tracker#2 (ADR 0008)."
S53,Story,Banco de evaluaciones en GitHub Actions,E12,High,"AC: workflow manual del propietario con CLI fijada, tabla en el resumen y artefacto JSON. HECHO; primera ejecución cuando exista el secreto en enjambre. Primera ejecución: pass@1 100 % (20/20), 1,23 USD."
S54,Story,Mejoras de la primera revisión real (M9 y M10),E12,Medium,"AC: el revisor cita líneas del fichero; proteger-secretos no bloquea rutas en el cuerpo de un comentario; .claude/ desde la rama base. Lo aprueba Álvaro."
S55,Story,Cerrar escrituras por la API de GitHub y fijar el marketplace (M11),E12,High,"AC: bloquear-comandos bloquea gh api con POST, -f/-F/--field/--input y /merges, con pruebas; plugin_marketplaces fijado a etiqueta o SHA. Reglas deny ya aplicadas en lobby y finance_tracker. Cambio de hook: lo aprueba Álvaro. HECHO (ADR 0009): hook gh-api-escritura y plugin fijado por SHA con ENJAMBRE_VERSION."
S56,Story,Primera historia por eventos en lobby (#2),E12,Highest,"AC: plan por enjambre:planificar, aprobado por Álvaro, PR por enjambre:implementar y veredicto por enjambre:revisar sin sesión local. Plan publicado y aprobado el 22-11-2026. Primer intento del implementador sin PR (ADR 0010); reintento tras fusionar lobby#4."
S57,Story,Banco de evaluaciones más difícil (M12),E8,Medium,"AC: al menos 10 tareas nuevas ambiguas sacadas de historias reales; el pass@1 deja de ser 100 % y separa versiones."
S58,Story,Respaldo cuando un revisor no comenta,E5,High,"AC: si el agente termina sin comentar, el workflow publica su respuesta final desde execution_file. HECHO (ADR 0009)."
```
