# 0011. Solo Álvaro aprueba PR; los agentes llegan hasta el PR

- **Fecha:** 22-11-2026
- **Estado:** Aceptada
- **Decide:** Álvaro

## Contexto

Álvaro fusionó lobby#5 (primera historia), lobby#6 y finance_tracker#4. **F2 queda cerrada**: [lobby#2](https://github.com/AlvaroM99/lobby/issues/2) pasó de Listo a PR verificado y fusionado. Lo que pide ahora:
- que los agentes hagan todo el trabajo hasta el punto en que él aprueba y fusiona;
- que **nadie más que él apruebe PR**, tampoco desde Actions.

En GitHub, el ajuste *Allow GitHub Actions to create and approve pull requests* concede **a la vez** crear PR y aprobarlos. Sin él, el implementador no puede abrir su PR (ADR 0010). Con él, el `GITHUB_TOKEN` de cualquier job con `pull-requests: write` podría aprobar.

## Decisión

Se activa el ajuste para que los agentes abran PR, y la parte de aprobar se cierra con **dos barreras independientes**:

| Barrera | Dónde | Qué hace |
|---|---|---|
| 1. Hook | `bloquear-comandos`, regla `gh-pr-aprobar` (plugin `v0.4.2`, fijado por SHA en `ENJAMBRE_VERSION`) | Bloquea `gh pr review --approve`, `-a` y grupos de banderas cortas como `-ab`. Las aprobaciones por API (`reviews` con `event=APPROVE`) y por GraphQL (`addPullRequestReview`) ya las bloquea `gh-api-escritura` (ADR 0009) |
| 2. Job `aprobaciones` | `enjambre-revisar` y `enjambre-implementar` | Job aparte, en otra máquina, sin checkout y solo con `pull-requests: write`. Recorre **todos** los PR abiertos (API paginada) y retira cualquier aprobación cuyo autor no sea el propietario. Falla cerrado (`set -euo pipefail`): si no puede leer las revisiones, o si retira alguna, el job falla |

**Cobertura:** solo `implementar`, `revisor` y `seguridad` tienen agente y `pull-requests: write`, y `aprobaciones` los espera a los tres. Los agentes de `analizar`, `planificar`, `investigar` y `gobernanza` no tienen ese permiso, así que su token no puede aprobar. Una prueba de `pruebas/workflows.test.mjs` exige que cualquier job futuro con agente y `pull-requests: write` vaya seguido de `aprobaciones`.

**Cómo se llegó aquí:** tres rondas de revisión de Enjambre sobre lobby#7.

| Ronda | Revisor | Seguridad | Qué se corrigió |
|---|---|---|---|
| 1 | CAMBIOS | CAMBIOS | La barrera corría en el job del agente (podía alterarla con `PATH` o `BASH_ENV`), fallaba abierta y solo miraba el PR del evento. Se pasó a un job aparte, cerrado y con todos los PR |
| 2 | APROBAR | CAMBIOS | Límite de 200 PR, login interpolado en jq y guardia dependiente de `limite-wip`. Ahora la API va paginada, el login va por `env` y la condición es propia |
| 3 | APROBAR | APROBAR | Notas: el bloque está duplicado en dos workflows (mejora M16: `workflow_call`) y la barrera actúa a posteriori, aceptable porque fusionar sigue siendo manual |

## Consecuencias

- Álvaro fusionó [lobby#7](https://github.com/AlvaroM99/lobby/pull/7) y [finance_tracker#5](https://github.com/AlvaroM99/finance_tracker/pull/5), y el ajuste quedó **activado** en los dos repos el 22-11-2026 con `gh api -X PUT repos/AlvaroM99/<repo>/actions/permissions/workflow`. Los permisos por defecto del token siguen siendo de solo lectura. Desde entonces, el flujo es: etiqueta → plan → **puerta 1** (Álvaro) → implementador abre PR en borrador → CI → revisor y seguridad → **puerta 2** (Álvaro aprueba y fusiona).
- Los cambios en `.github/workflows/` nunca los puede subir un agente, porque el `GITHUB_TOKEN` no tiene permiso `workflows`. Quedan como paso de Álvaro o de su sesión (M15).
- **Atribución:** lobby#5 se fusionó con commit de fusión, no con squash. Por eso dos commits con `Co-Authored-By: Claude` quedaron en `main` de lobby (`d8a8d1f` y `f56c202`). Corregirlo exigiría un push forzado a `main`, que está prohibido; queda anotado. Desde lobby#6 los agentes ya no añaden esa línea. Para que no se repita, se propone dejar solo «squash merge» en los ajustes de los repos, lo que decide Álvaro.
