# F4 · Datos y BI: plan

- **Estado:** propuesta (22-11-2026). Las decisiones marcadas como **D-F4-n** las toma Álvaro antes de empezar.
- **Objetivo del plan (§7):** «Panel con coste/tarea y DORA actualizado a diario».
- **Por qué ahora:** la auditoría de F1–F3 ([auditoria-f1-f3.md](../auditoria-f1-f3.md)) no puede medir el criterio de salida de F3 (lead time y retrabajo) sin estos datos. F4 es el instrumento de medida de F3 y F5.

## 1. Qué se mide

| Métrica | Definición | Fuente |
|---|---|---|
| **Lead time de cambio** (DORA) | De issue con plan aprobado a PR fusionado (mediana por semana) | API de GitHub: issues, comentarios «Puerta 1» y PR |
| **Frecuencia de despliegue** (DORA) | Ejecuciones correctas de `produccion.yml` por semana | API de GitHub: workflow runs |
| **Tasa de fallo de cambios** (DORA) | Despliegues que necesitan arreglo o rollback / despliegues | Runs de `produccion.yml` + issues con etiqueta `incidente` (nueva) |
| **Tiempo de recuperación de un despliegue fallido** (DORA) | De despliegue fallido al siguiente correcto | Runs de `produccion.yml` |
| **Tasa de retrabajo de despliegue** (DORA) | Despliegues no planificados causados por un incidente | Ídem |
| **PR sin retrabajo** | PR de agentes fusionados con ≤ 1 ciclo de CAMBIOS | Comentarios «Veredicto» de revisor y seguridad |
| **Coste por historia** | Suma de `total_cost_usd` de todos los runs de agentes de una historia | Transcripciones de los runs (artefacto, ADR 0012) |
| **Turnos, permisos denegados y paradas sin respuesta** por agente | De cada ejecución | Transcripciones |
| **pass@1** del banco | Global y por agente, por versión del plugin | Artefacto `evals-resultados` |
| **Minutos de Actions** | Por repo y por workflow | API de GitHub (`/timing`; el endpoint está en proceso de cierre, ver fuentes) |

Las definiciones DORA siguen la guía actual, con cinco métricas que separan rendimiento e inestabilidad: https://dora.dev/guides/dora-metrics-four-keys/ (actualizada el 5-1-2026).

## 2. Modelo de datos

Esquema en estrella, sin datos personales ni contenido de los repos: solo identificadores, fechas, números y nombres de agente.

| Tabla | Grano | Columnas principales |
|---|---|---|
| `hechos_ejecucion` | Un run de un agente | repo, workflow, run_id, agente, modelo, inicio, fin, turnos, coste_usd, tokens, permisos_denegados, resultado, historia (issue) |
| `hechos_historia` | Una historia (issue) | repo, issue, creada, plan_aprobado, pr, pr_abierto, fusionado, ciclos_cambios, coste_total |
| `hechos_despliegue` | Un run de `produccion.yml` | repo, run_id, fecha, resultado, incidente |
| `hechos_eval` | Una tarea en una ejecución del banco | versión_plugin, tarea, agente, pasa, turnos, coste |
| `dim_agente`, `dim_repo`, `dim_fecha` | — | Rol, modelo, sala de la oficina; repo y lenguaje; calendario |

## 3. Arquitectura propuesta

```
GitHub API + artefactos (transcripciones, evals)
        │  workflow «datos» en el repo enjambre (diario, cron + manual)
        ▼
  extraer.mjs (Node, sin dependencias) ──► ficheros JSON por día
        ▼
  dbt-duckdb (en memoria en el runner) ──► modelos + pruebas dbt
        ▼
  metricas.json (agregados, sin contenido) ──► panel (D-F4-1)
```

- **dbt-duckdb:** adaptador de dbt para DuckDB, que lee CSV, JSON y Parquet directamente y puede ejecutarse en memoria en CI (`pip install dbt-duckdb`). Fuente: https://github.com/duckdb/dbt-duckdb. Encaja con GitHub Free: sin servidor ni base de datos que mantener.
- **Coste del runner:** un run diario de unos 3 minutos son unos 90 minutos al mes. La cuota de minutos de Free para repos privados está [POR CONFIRMAR] en la documentación de facturación de GitHub.
- **Telemetría de Claude Code (opcional, D-F4-3):**
  - Claude Code exporta métricas OpenTelemetry con `CLAUDE_CODE_ENABLE_TELEMETRY=1`: `claude_code.cost.usage`, `claude_code.token.usage`, `claude_code.pull_request.count` y otras, con las dimensiones `agent.name` y `model`.
  - Los prompts van redactados por defecto.
  - Necesita un destino OTLP, y el `.claude/settings.json` del repo no sirve para configurarlo.
  - Fuente: https://code.claude.com/docs/en/monitoring-usage.
  - Las transcripciones ya dan coste, turnos y tokens por run, así que OpenTelemetry solo aporta algo para las sesiones locales.

## 4. Decisiones para Álvaro

| # | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| D-F4-1 | ¿Dónde vive el panel? | A) Módulo «Enjambre» en Lobby (Worker y D1 que ya tienes; idea M7 y P13). B) Página estática regenerada como artefacto de Claude. C) GitHub Pages (exige repo público) | **A**. Ya tienes Lobby con contraseña, D1 y CI; los agregados no tienen datos personales |
| D-F4-2 | ¿Cómo llegan los datos al panel? | A) El workflow «datos» los sube a Lobby con un token propio de escritura limitada. B) Lobby lee `metricas.json` de un artefacto. C) Solo una tabla en el resumen del run | **A**, con un secreto nuevo en `enjambre` que creas tú (nada se crea sin que lo pidas) |
| D-F4-3 | ¿Telemetría OpenTelemetry? | A) No por ahora. B) Destino gratuito externo (cuenta nueva) | **A**: las transcripciones ya bastan para los runs en Actions |
| D-F4-4 | ¿Agente `datos`? | A) Agente nuevo con skill `datos` (dbt, contratos y pruebas). B) Lo hace el implementador con una skill | **B** primero. El agente propio, cuando haya un proyecto de datos real (riesgo del plan: «rol sin proyecto real») |

## 5. Historias (épica E10)

| Id | Historia | Criterio de aceptación | Talla |
|---|---|---|---|
| S33 | Modelo de datos de ejecuciones | Tablas de §2 documentadas con contrato; 4 semanas cargadas | M |
| S60 | `herramientas/extraer.mjs` | Dado un repo y un rango de fechas, escribe JSON por día de runs, issues, PR y veredictos. Sin contenido de los repos; pruebas con datos de ejemplo | M |
| S61 | Modelos dbt-duckdb con pruebas | `dbt build` en memoria en el runner; pruebas `not_null`, `unique` y de rangos; DORA y coste por historia | M |
| S62 | Workflow `datos.yml` en enjambre | Diario y manual, solo el propietario, SHA fijados; deja `metricas.json` como artefacto y una tabla en el resumen | S |
| S34 | Panel de Enjambre | Según D-F4-1: coste por tarea, lead time, retrabajo, pass@1 por versión y permisos denegados por agente; actualizado a diario | M |
| S63 | Etiqueta `incidente` y registro de despliegues fallidos | Tasa de fallo y tiempo de recuperación calculables | S |
| S35 | Skill o agente `datos` | Según D-F4-4; pipeline idempotente, sin datos reales | M |

**Criterio de salida de F4 (del plan):** panel con coste por tarea y DORA actualizado a diario durante 2 semanas seguidas.

**Esfuerzo:** 20–25 h según el plan; con D-F4-1 = A, unas 15–20 h, porque el panel aprovecha Lobby.
