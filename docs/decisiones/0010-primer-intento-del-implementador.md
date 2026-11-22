# 0010. Primer intento del implementador: sin PR y sin rastro

- **Fecha:** 22-11-2026
- **Estado:** Aceptada
- **Decide:** Álvaro

## Contexto

Álvaro aprobó el plan de [lobby#2](https://github.com/AlvaroM99/lobby/issues/2) («Aprobado, implementa», puerta 1) y fusionó lobby#3 y finance_tracker#3, con el plugin fijado por SHA. Se puso `enjambre:implementar`:

| Paso | Resultado |
|---|---|
| `limite-wip` | Correcto: reservó el hueco y puso `enjambre:en-curso` |
| Instalación del plugin | Desde el SHA de `ENJAMBRE_VERSION` (`$RUNNER_TEMP/enjambre-plugin`), modelo `claude-sonnet-5-5` |
| Implementador | `success` en **5 turnos y 30 s**, 0,11 USD, sin permisos denegados |
| PR | **Ninguno**. No se creó la rama `enjambre/2-…` |
| `liberar` | No se ejecutó, porque el job terminó «bien». El hueco WIP se quedó ocupado |

La Action oculta la salida del agente (`full output hidden for security`), así que no se sabe por qué paró. La causa probable está **[POR CONFIRMAR]**. El agente tiene dos reglas que encajan con lo ocurrido:
- «Sin plan aprobado por Álvaro, no empieces». El prompt del workflow decía «último comentario con el plan», pero el último comentario era ya la aprobación, no el plan.
- «Si el plan es incorrecto o incompleto, no improvises: para». El plan tiene varios [POR CONFIRMAR]: el comportamiento de `node --test` con carpetas, el ICU y `mock.timers`.

## Decisión

Se cambia el **workflow** (plantilla `enjambre-implementar.yml`, versión `v0.3.3`), no el agente. Los cambios de agentes los aprueba Álvaro (regla 5).

1. **Resumen en el issue:** la respuesta final del implementador, sacada del `execution_file` de la Action, se publica siempre en el issue. Si abrió PR, lo enlaza; si paró, se ve por qué.
2. **Sin PR, el job falla:** si no hay un PR abierto desde una rama `enjambre/<issue>-*`, el job falla y `liberar` suelta el hueco WIP.
3. **`display_report: true`** en el implementador.
4. **Prompt más claro:**
   - el plan es el comentario «## Plan»;
   - la etiqueta `enjambre:implementar` es la aprobación, porque solo la pone Álvaro;
   - termina en esta ejecución, sin pedir confirmación, con `git push` y `gh pr create --draft`.

En lobby#2 se quitó a mano `enjambre:en-curso` y se dejó un comentario. El plan y su aprobación siguen vigentes.

## Consecuencias

- Para reintentar hay que fusionar [lobby#4](https://github.com/AlvaroM99/lobby/pull/4), porque los workflows de issues solo corren desde `main`, y volver a poner `enjambre:implementar`. finance_tracker recibe lo mismo en [finance_tracker#4](https://github.com/AlvaroM99/finance_tracker/pull/4).
- Si la respuesta del implementador confirma que para por los [POR CONFIRMAR] del plan, hay dos opciones, y las dos tocan prompts de agentes, así que decide Álvaro:
  - el jefe resuelve los [POR CONFIRMAR] antes de publicar el plan;
  - el implementador los comprueba ejecutando y lo cuenta en el PR.
- Lección: cualquier paso de un agente en CI tiene que dejar rastro visible. El revisor ya lo tenía con el respaldo del ADR 0009; ahora también el implementador.

## Segundo intento (tras fusionar lobby#4)

La respuesta del implementador ya aparece en el issue, así que la causa queda clara. El agente hizo su trabajo en 8 turnos y 0,12 USD:
- `pruebas/ui.test.mjs` con 17 pruebas que cubren las 10 funciones del alcance;
- el script `npm test`;
- la línea en el README.

Subió la rama `enjambre/2-npm-test`, pero chocó con dos límites de GitHub:

| Límite | Causa | Qué se hizo |
|---|---|---|
| `gh pr create` rechazado: «GitHub Actions is not permitted to create or approve pull requests» | El repo tiene desactivado *Allow GitHub Actions to create and approve pull requests* (`can_approve_pull_request_reviews: false`) | La sesión de Álvaro abrió el PR en borrador ([lobby#5](https://github.com/AlvaroM99/lobby/pull/5)). Activar el ajuste lo decide Álvaro. Antes conviene bloquear `gh pr review --approve` en `bloquear-comandos`, porque el ajuste también deja aprobar |
| Push de `.github/workflows/ci.yml` rechazado | El `GITHUB_TOKEN` nunca tiene permiso `workflows` | La sesión añadió el paso `npm test`. Es una barrera útil, porque los agentes no pueden cambiar la CI. El jefe debe planificar los cambios de workflows como paso manual (mejora M15) |

En lobby#5:
- **CI en verde**, con `npm test` 17/17 en el runner y en Windows.
- **Seguridad: APROBAR.**
- **Revisor: CAMBIOS.** Los commits del implementador llevaban `Co-Authored-By: Claude`, que la regla 6 de lobby prohíbe.
  - Causa: Claude Code añade esa atribución por defecto.
  - Solución: entrada `settings` con `attribution` vacía en todos los workflows de agentes y en `.claude/settings.json` ([lobby#6](https://github.com/AlvaroM99/lobby/pull/6), finance_tracker#4, plantillas `v0.3.5`).
  - Para lobby#5: fusionar con squash y un mensaje limpio. Reescribir la rama con push forzado quedó bloqueado por el modo automático, y es decisión de Álvaro.

**Criterio de salida de F2:**
- La historia fue de Listo a PR verificado sin sesión local en planificar, implementar, CI y revisar.
- Dos pasos los hizo la sesión por límites de GitHub: abrir el PR y el paso de CI.
- Se cierra cuando Álvaro fusione lobby#5 (puerta 2).
