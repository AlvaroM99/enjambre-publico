# Riesgos y retos de Enjambre: soluciones

> Actualiza el §9 del [plan](PLAN.md) con lo aprendido al construir la fase 1 y con las decisiones [0003](decisiones/0003-equipo-ampliado-y-paralelo.md), [0004](decisiones/0004-bash-por-agente.md) y [0005](decisiones/0005-cierre-f1-y-ci-cd.md). Fecha: 21-11-2026.
>
> Estado: **Resuelto** (hecho y probado) · **Mitigado** (hecho, queda riesgo residual) · **Planificado** (con historia o paso concreto) · **Abierto** (decide Álvaro).

## Retos técnicos encontrados al construir

| # | Reto | Solución | Estado |
|---|---|---|---|
| R1 | **Puntos sin comprobar en una sesión real:** forma de `agent_type` para agentes de plugin, `isolation: worktree` en agentes de plugin, skills con prefijo `enjambre:`, `${CLAUDE_SKILL_DIR}` en subagentes y `--agent enjambre:…` en `claude -p`. | **Prueba de humo** (S41), 30 min con la CLI con sesión iniciada: 1) instalar el plugin en un repo de prueba; 2) pedir al revisor `echo x > y` y comprobar que `limitar-bash` lo bloquea (si no, mirar `bloqueos.jsonl` y el `agent_type` real); 3) lanzar un implementador y comprobar `git worktree list`; 4) pedir al jefe que cite su plantilla de plan; 5) `claude -p --agent enjambre:enjambre-jefe-proyecto "di tu nombre"`. Anotar resultados en `docs/operacion.md`. | Planificado |
| R2 | **Bash sin límite por comando en subagentes.** | Hook `limitar-bash` con lista blanca por agente, usando `agent_type` (ADR 0004). 53 pruebas, incluidas evasiones. | Resuelto (pendiente R1) |
| R3 | **GitHub Free sin protección de rama ni entornos.** | Solo el propietario dispara agentes; hooks que bloquean fusión, push a main y despliegue; producción solo manual con confirmación escrita; reglas de workflows comprobadas por `npm test` (ADR 0005). Revisión prevista: hacer público `enjambre` si hace falta protección real en ese repo. | Mitigado |
| R4 | **PR de agentes con `GITHUB_TOKEN` no disparan la CI.** | CI también con `labeled` y `ready_for_review`; el implementador pasa pruebas antes de abrir el PR. Solución completa: GitHub App `enjambre-bot` (S16). | Mitigado |
| R5 | **Plugin privado no instalable desde Actions.** | Repositorio público `AlvaroM99/enjambre-publico` con instantáneas sin historial (el historial privado lleva el correo personal), publicadas por `herramientas/publicar.mjs`, que se niega si detecta correos, tokens o claves (ADR 0006). | Resuelto |
| R6 | **`seccomp=unconfined` en el devcontainer** para que funcione el sandbox. | Perfil seccomp propio que solo permita `unshare`/`clone` de espacios de nombres (S43). En CI no aplica: los runners son efímeros. | Planificado (F5) |
| R7 | **`prueba.mjs` de lobby lee `.dev.vars` y `datos/.clave-local`.** | En CI, credenciales sintéticas generadas en el runner con las propias herramientas de lobby (`clave.mjs --local`, `token.mjs --solo-local`) y prueba de humo independiente de los datos (`humo.mjs`), en verde en lobby#1. La prueba completa necesita una semilla sintética (M8). | Mitigado |
| R8 | **F1 cerrada sin el piloto en lobby.** | Puerta de F2: prueba de humo (R1) y 2 historias de lobby de punta a punta antes de activar workflows de agentes (ADR 0005). | Planificado |

## Riesgos del plan (§9.1), con la solución actual

| Riesgo | P | I | Solución | Indicador | Estado |
|---|---|---|---|---|---|
| **Límites del plan Pro con hasta 6 carriles** | 4 | 4 | WIP 3 por defecto (máx. 6, variable `ENJAMBRE_WIP`); Opus solo en jefe y revisor; `maxTurns` ≤ 30; sin ejecuciones programadas; registrar bloqueos. Subir WIP tras 2 semanas sin bloqueos; Max 5x si hay > 2 bloqueos/semana durante 2 semanas. | bloqueos por límite/semana | Mitigado |
| **Coste descontrolado** | 3 | 4 | Coste fijo (Pro 20 $/mes); minutos de Actions medidos por historia; `timeout-minutes` en todos los jobs; `concurrency` con cancelación en CI. Hook `registrar-coste` (S25). | coste/historia, minutos/mes | Mitigado |
| **Conflictos entre carriles** | 3 | 3 | Carriles independientes decididos por el jefe; worktree por implementador; PR < 400 líneas; ramas < 2 días; actualizar con `git merge origin/main`; Álvaro decide el orden de fusión. | conflictos/semana | Mitigado |
| **Cuello de botella en la revisión humana** | 4 | 3 | Revisor + seguridad + verificador filtran antes; veredicto estructurado; Álvaro revisa el 100 % hasta llegar a 60 % sin retrabajo y luego por muestreo; WIP limita la cola. | PR esperando a Álvaro > 5 | Mitigado |
| **Avalancha de issues de QA** | 3 | 2 | Investigador: máx. 5 issues por encargo, solo reproducibles, búsqueda de duplicados, etiqueta `enjambre:propuesta` que tría el jefe y acepta Álvaro. | propuestas cerradas sin hacer > 50 % | Mitigado |
| **Inyección de instrucciones** (issues, PR, código) | 3 | 5 | Solo el propietario dispara agentes; regla de dos (los agentes que leen contenido externo no escriben código); `limitar-bash` en agentes de solo lectura; prompts que tratan el contenido como dato y lo reportan como hallazgo crítico; sandbox y runners efímeros. | intentos detectados en `bloqueos.jsonl` y veredictos | Mitigado |
| **Fuga de secretos o datos personales** | 2 | 5 | `proteger-secretos` + reglas deny + gitleaks en CI + secretos solo en `env:` de pasos concretos + credenciales sintéticas en pruebas (R7). Los agentes no gestionan secretos (`gh secret` bloqueado). | alertas de gitleaks | Mitigado |
| **Despliegue erróneo en producción** | 2 | 4 | Solo manual (`produccion.yml` o `npm run deploy` de Álvaro); pruebas antes de desplegar; rollback documentado (`wrangler rollback`) en el resumen de la ejecución. | rollbacks | Mitigado |
| **Alucinaciones** (APIs, versiones, datos inventados) | 3 | 4 | Regla «no inventar» con citas; skill `referencias-estandar` (versiones consultadas, no de memoria); skill `pedir-detalles`; pruebas ejecutables; investigador buscando desvíos. | defectos por «inventado» | Mitigado |
| **Deriva de calidad** | 3 | 4 | Retroalimentación del verificador e investigador sobre patrones; banco de 20 evaluaciones (S28) antes de cambiar prompts o modelos. | pass@1, tasa sin retrabajo | Planificado (F3) |
| **Complejidad de coordinación** | 3 | 3 | Flujo determinista por etiquetas; artefactos (plan, veredicto, informe) en lugar de conversación; un escritor por historia. | tareas en bucle | Mitigado |
| **Cambios de versión de herramientas** | 4 | 2 | Actions fijadas por SHA y actualizadas por Dependabot; versión de Claude Code fijada en el devcontainer; `npm test` en CI tras cada cambio. | fallos tras actualizar | Mitigado |
| **Dependencia del proveedor** | 3 | 3 | Agentes y skills en Markdown portables; hooks en Node sin dependencias; flujo en GitHub (exportable). | cambios de condiciones | Aceptado |
| **El analista lee la web (inyección indirecta)** | 3 | 3 | Único agente con web; sin Edit/Write ni acceso a secretos; Bash en lista blanca; su informe es dato para el jefe; búsquedas sin datos privados (ADR 0006). | fuentes marcadas como sospechosas | Mitigado |
| **Desorden y documentación desfasada al crecer** | 3 | 2 | Agente de gobernanza con lista de 8 áreas y nota 0–3; auditoría mensual (`enjambre-gobernanza.yml`). | nota global < 18/24 | Mitigado |
| **El repo público expone el entorno de Álvaro** | 2 | 2 | Sin historial ni correo; filtro de publicación; el anexo A nombra repos y el alcance del token de `gh` (sin secretos). Álvaro decide si se resume. | — | Aceptado |
| **Tiempo de supervisión de Álvaro** | 4 | 3 | WIP limitado; informes estructurados; propuestas de QA filtradas; muestreo en F3+. | horas/semana > 8 | Mitigado |

## Decisiones pendientes de Álvaro

1. Visibilidad de `enjambre`: **resuelto** con el repo público (ADR 0006). Pendiente: el secreto `CLAUDE_CODE_OAUTH_TOKEN` en lobby (pasos en `docs/operacion.md`).
2. **GitHub App `enjambre-bot`** (S16): resuelve R4 y R5 y separa la identidad de los agentes de la de Álvaro. No se crea sin que Álvaro lo pida.
3. **Valor inicial de `ENJAMBRE_WIP`**: se propone 3.
4. **Datos/BI (F4)**: sin cambios; sigue condicionado a un proyecto real.
