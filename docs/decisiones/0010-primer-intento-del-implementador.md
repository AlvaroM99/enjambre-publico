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
