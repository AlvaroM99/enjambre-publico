# Auditoría de las fases 1, 2 y 3 (22-11-2026)

Este documento compara lo que pedía el [plan](PLAN.md) (§7) con lo que hay hoy, con evidencias, y lista lo que falta. Las decisiones de [docs/decisiones/](decisiones/) prevalecen sobre el plan: cuando un entregable cambió por un ADR, se indica.

## Cómo se ha probado (22-11-2026)

| Prueba | Resultado |
|---|---|
| `npm test` (hooks, agentes, skills, workflows, evaluaciones y publicación) | 326/326 |
| `claude plugin validate .` y `./plugins/enjambre` (CLI 2.1.330) | Validación superada |
| `node evals/ejecutar.mjs --simular` | 20 tareas válidas |
| YAML de los 10 workflows | Válido |
| Banco de evaluaciones en Actions con el plugin `v0.4.2` | **20/20** (1,26 USD). Segunda vez seguida al 100 % |
| CI del repo privado y del público | Verde |
| Agentes estrenados en GitHub en esta auditoría (lobby) | Analista, investigador QA y gobernanza (ver «Hallazgos») |

## F1 · MVP local

| Entregable del plan | Estado | Evidencia |
|---|---|---|
| Plugin con 4 agentes, 6 skills y 3 hooks | **Superado**: 10 agentes, 13 skills y 4 hooks | `plugins/enjambre/`, ADR 0003–0006 |
| Devcontainer | Hecho | `plantillas/devcontainer`, `.devcontainer/` en lobby (bubblewrap con `seccomp=unconfined`, S43 pendiente) |
| Plantillas (plan, PR, ADR, QA, investigación, gobernanza) | Hecho | `plantillas/` |
| CI básico en lobby | Hecho | lobby `ci.yml`: sintaxis, auditoría, humo 8/8 y `npm test` 17/17 |
| 5 historias reales completadas | **1 de 5** | lobby#2 → lobby#5 fusionado |
| **Criterio:** ≥ 3 de 5 PR fusionados con ≤ 1 ciclo de cambios; 0 incidentes; coste medido | **Parcial.** 1/1 fusionado con 1 ciclo; 0 incidentes por agentes; coste medido por ejecución | F1 se cerró por decisión (ADR 0005) para pasar a F2 sin las 5 historias |

## F2 · Automatización por eventos

| Entregable del plan | Estado | Evidencia |
|---|---|---|
| GitHub App `enjambre-bot` | **Sustituido** por `GITHUB_TOKEN` y solo el propietario dispara (ADR 0001 y 0005). La App sigue como opción (S16) | Workflows `enjambre-*` |
| Workflows `enjambre-*` | Hecho: 6 en lobby y finance_tracker | Plantillas de la skill `ci-cd`, fijadas por SHA (ADR 0009) |
| Rulesets | **No disponible** en GitHub Free (repos privados). Compensado con hooks, solo el propietario dispara, CODEOWNERS y el job `aprobaciones` (ADR 0011) | — |
| Entorno preview | **Pendiente** (S17) | — |
| Jira | **Aplazado** (ADR 0001) | — |
| **Criterio:** una historia de «Listo» a PR verificado sin sesión local | **Cumplido** el 22-11-2026, con dos pasos manuales por límites de GitHub que ya están resueltos (ADR 0010 y 0011) | lobby#2: planificar → implementar → CI → revisar → fusionado |

## F3 · Ampliación del equipo

| Entregable del plan | Estado | Evidencia |
|---|---|---|
| Agentes `plataforma` y `seguridad` | Hechos. Seguridad ha revisado 6 PR reales (lobby#3, #4, #5 y #7; finance_tracker#2 y #3); plataforma solo ha corrido en evaluaciones | ADR 0003, 0008–0011 |
| CI/CD completo en lobby y finance_tracker | Hecho: CI en los dos (Rust en finance_tracker) y producción manual en lobby | lobby#1, finance_tracker#1 |
| Banco de 20 evaluaciones | Hecho: 100 % en Actions dos veces | `evals/`, `evals.yml` |
| Ampliado por ADR: analista, investigador QA, gobernanza, coordinador, carriles WIP, `limitar-bash` | Hechos. Analista, QA y gobernanza **estrenados hoy** con fallos (ver abajo); coordinador solo en evaluaciones (necesita sesión local) | ADR 0003–0006 |
| **Criterio:** lead time mediano < 2 días; ≥ 60 % de PR sin retrabajo | **Sin datos suficientes.** Una historia: 4 h 31 min de issue a fusión (lobby#2, 11:58 → 16:29 UTC). Medirlo de forma continua es el objetivo de F4 | API de GitHub |

## Hallazgos de la prueba real del 22-11-2026

| # | Hallazgo | Gravedad | Acción |
|---|---|---|---|
| H1 | **El analista** (22 turnos, 0,46 USD) terminó bien pero **no publicó su informe** en lobby#8 | Alta | Respaldo: el workflow publica la respuesta final ([lobby#11](https://github.com/AlvaroM99/lobby/pull/11)) |
| H2 | **El investigador QA** (12 turnos, 0,17 USD) no abrió issues ni dejó su tabla | Alta | El workflow abre siempre el issue «Informe de investigación QA» (lobby#11) |
| H3 | **Gobernanza** falló por usar 41 turnos con un límite de 20. Sí abrió 2 propuestas útiles (lobby#9 y #10), pero no su informe | Media | 45 turnos y respaldo del informe (lobby#11) |
| H4 | Muchos **permisos denegados** (2, 4 y 12) sin forma de ver cuáles | Alta | La transcripción del agente queda como artefacto del run (lobby#11). Con ella se ajustan `limitar-bash` y los prompts (F5) |
| H5 | El verificador no corre en CI (S21: «verificar sigue en local») | Media | F5: job de verificación tras revisar |
| H6 | Plataforma y coordinador no se han probado en real | Media | F5: una historia de plataforma y una sesión con dos carriles |
| H7 | Entorno preview y procedimiento de rollback sin hacer (S17, S18) | Media | F5 |
| H8 | Dos commits con `Co-Authored-By: Claude` en `main` de lobby (lobby#5 fusionado sin squash) | Baja | Corregida la causa (lobby#6). Solo squash: M17 |
| H9 | Un PR de agente no puede tocar `.github/workflows/` | Por diseño | El jefe debe planificarlo como paso manual (M15) |

## Conclusión

- **F1:** cerrada por decisión (ADR 0005). El código y la seguridad superan el plan, pero solo hay 1 historia real de 5. Las 4 que faltan se harán en F5, con el sistema ya automático.
- **F2:** cumplida.
- **F3:** cumplida en entregables. Su criterio de salida (lead time y retrabajo) necesita más historias y el panel de F4.
