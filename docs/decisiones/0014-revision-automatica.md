# 0014. La revisión arranca sola; Álvaro solo confirma y fusiona

- **Fecha:** 23-11-2026
- **Estado:** **Aceptada.** Álvaro lo pidió el 23-11-2026: «no quiero tener que aprobar yo el workflow de revisión. Eso sí, quiero ser el último confirmador de la revisión sobre el total de la PR que se encargue de confirmar y mergear manualmente la PR». Aplicada en las plantillas del plugin `v0.6.3` y corregida en `v0.6.4` y `v0.6.5` tras las dos primeras historias; llega a lobby y finance_tracker por PR, que fusiona Álvaro.
- **Decide:** Álvaro

## Contexto

En las dos historias en paralelo de finance_tracker (#11 → #18 y #15 → #19), entre el PR abierto por el implementador y la fusión hubo tres pasos a mano:

| Paso | Quién lo hizo | Por qué hacía falta |
|---|---|---|
| Pulsar «Approve workflows to run» para que corriera la CI | Álvaro | Cuando un workflow abre un PR con `GITHUB_TOKEN`, GitHub crea las ejecuciones de `pull_request` (`opened`, `synchronize`, `reopened`) **pendientes de aprobación**. Las de `labeled`, `edited` y similares ni se crean |
| Poner `enjambre:revisar` | La sesión, con la cuenta de Álvaro | `enjambre-revisar` solo arrancaba con esa etiqueta y solo si la ponía el propietario |
| Marcar el PR como listo | La sesión, con la cuenta de Álvaro | El implementador abre el PR en borrador, y un borrador no se puede fusionar |

Fuente del primer punto: https://docs.github.com/en/actions/concepts/security/github_token («When `GITHUB_TOKEN` triggers workflow runs»). La misma página dice que `workflow_dispatch` y `repository_dispatch` **siempre** crean ejecuciones. En finance_tracker se ve en las ejecuciones 45135681862 y 45135983601 de `ci`: `actor` es `github-actions[bot]` y `triggering_actor` es `AlvaroM99`, que es quien las aprobó.

## Decisión

1. **El implementador pide la revisión.** `enjambre-implementar` tiene un job nuevo, `pedir-revision`, que va detrás del job del agente. No tiene checkout ni agente, y sus permisos son `actions: write` y `pull-requests: read`. Hace tres cosas:
   - busca el PR de la historia y borra las ejecuciones del commit del PR que estén pendientes de aprobación (no llegaron a correr), y con ellas el aviso;
   - lanza `ci.yml` en la rama del PR con `workflow_dispatch`;
   - lanza `enjambre-revisar.yml` con `workflow_dispatch` y el número del PR.
2. **`enjambre-revisar` acepta `workflow_dispatch`**, con un job `preparar` que valida quién lo pide y qué PR es:
   - la etiqueta `enjambre:revisar` sigue valiendo, solo la de Álvaro, para repetir una revisión;
   - por `workflow_dispatch`, solo `github-actions[bot]` (el implementador) o Álvaro;
   - el número de PR tiene que ser un número, el PR tiene que estar abierto y venir de este repositorio, y el bot solo puede pedirlo para ramas `enjambre/`;
   - revisor y seguridad hacen checkout del commit exacto del PR que devuelve `preparar`.
3. **Con APROBAR, el PR llega listo a Álvaro.** Job `listo`, sin agente: si el último veredicto del revisor publicado por el bot es APROBAR, y también el de seguridad cuando le tocaba, ejecuta `gh pr ready` y pide la revisión de Álvaro (`requested_reviewers`). Con CAMBIOS, o sin veredicto, el PR se queda en borrador.
4. **No cambia quién aprueba y fusiona:** solo Álvaro (ADR 0011).
   - Ningún workflow ejecuta `gh pr merge`, `--approve` ni `event=APPROVE`, y hay una prueba que lo comprueba.
   - El job `aprobaciones` sigue retirando cualquier aprobación que no sea suya, y ahora va también detrás de `listo`.

## Flujo resultante

`enjambre:planificar` (Álvaro) → plan → `enjambre:implementar` (Álvaro, **puerta 1**) → PR en borrador → CI y revisión sin intervención → PR listo con la revisión pedida a Álvaro → Álvaro revisa el PR entero, aprueba y fusiona (**puerta 2**).

## Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| Que cualquiera lance revisiones con `workflow_dispatch` | Solo pueden lanzarlo cuentas con permiso de escritura, y `preparar` además exige el bot o el propietario |
| Que el bot pida revisar un PR ajeno | `preparar` exige una rama `enjambre/` y un PR de este repositorio |
| Que el agente del implementador use `actions: write` | Ese permiso está solo en `pedir-revision`, que es un job aparte, en otra máquina y sin checkout. El job del agente sigue con `contents`, `pull-requests` e `issues` |
| Borrar ejecuciones que sí importan | Solo borra las del commit del PR en estado `action_required`, que nunca corrieron |
| Que la CI lanzada a mano no salga en el PR | La ejecución va sobre el commit de la rama, y GitHub asocia los checks al commit [POR CONFIRMAR en la primera historia con este flujo] |

## Primera historia con este flujo: lobby#10 → lobby#20 (23-11-2026)

| Paso | Resultado |
|---|---|
| Implementador | Abrió [lobby#20](https://github.com/AlvaroM99/lobby/pull/20) solo |
| Aviso «Approve workflows to run» | `pedir-revision` borró la ejecución pendiente (45164478136) |
| CI lanzada por el bot | Corrió en verde. Actor `github-actions[bot]`, como espera `preparar` |
| Revisión lanzada por el bot | **Falló.** Sin `--ref`, `gh workflow run` pide la rama por defecto por GraphQL, y el token del job no puede leerla. Arreglado: `--ref` con `github.event.repository.default_branch`. Esa vez la lanzó la sesión con la cuenta de Álvaro |
| Revisor | APROBAR; seguridad omitida (solo documentación) |
| `listo` | Pidió la revisión de Álvaro, pero **no** quitó el borrador. `markPullRequestReadyForReview` necesita `contents: write` además de `pull-requests: write`. Se comprobó con un experimento en el repo de Enjambre (job con solo `pull-requests: write`: falla; con `contents: write`: funciona). `listo` lleva ahora los dos permisos y ya no oculta el error |
| Checks en el PR | **No se veían.** GitHub no asocia al PR las ejecuciones de `workflow_dispatch`. Arreglado: `pedir-revision` pone el estado `ci (Enjambre)` en «pendiente» en el commit del PR, y el job nuevo `estado-en-el-pr` de `ci.yml` lo cierra con el resultado. Los estados de commit sí salen en el PR |

Los tres arreglos van en el plugin `v0.6.4`. Llegan a los proyectos por PR, porque tocan workflows.

## Segunda historia: lobby#9 → lobby#22 (23-11-2026), sin ninguna intervención

| Paso | Resultado |
|---|---|
| Implementador | Abrió [lobby#22](https://github.com/AlvaroM99/lobby/pull/22) (+286/−13) |
| `pedir-revision` | Borró la ejecución pendiente de aprobación, lanzó la CI y lanzó la revisión con `--ref` (arreglo de v0.6.4). **Funcionó** |
| CI | En verde. El estado `ci (Enjambre): success` **sale en el PR** (arreglo de v0.6.4) |
| `preparar` | Aceptó el `workflow_dispatch` de `github-actions[bot]` |
| Revisor | **No arrancó.** `claude-code-action` rechaza por defecto los runs iniciados por un bot: «Workflow initiated by non-human actor: github-actions (type: Bot). Add bot to allowed_bots list». Arreglado en `v0.6.5`: `allowed_bots: github-actions[bot]` solo en revisor y seguridad, nunca `'*'`, con una prueba que lo exige. Fuente: `action.yml` y `src/github/validation/actor.ts` de la Action en `acfe799` |
| `listo` | No corrió, porque falló el revisor |
| Puerta 2 | Álvaro fusionó #22 a las 12:31:27 UTC, diez segundos antes que el arreglo (lobby#23). Al volver a lanzar `pedir-revision` (12:32:58) ya no había PR abierto: «No encuentro el PR de la historia #9.» y paró sin hacer nada, como debe |

**Resultado:** lead time 34 min, coste ≈ 1,18 USD (parcial), **sin veredicto del revisor**. Es la única historia medida que entró sin revisión de agente; la revisó solo Álvaro.

## Sin comprobar

Comprobado en lobby#9: la CI arranca sin el aviso, el actor del `workflow_dispatch` es `github-actions[bot]` y los checks se ven en el PR. Falta comprobarlo de principio a fin con `v0.6.5` en la próxima historia:

- que el revisor arranca con el `workflow_dispatch` del bot y deja su veredicto;
- que, con APROBAR, el PR pasa a listo con la revisión pedida a Álvaro.

## Cambio del 23-11-2026 (v0.7.0): el PR se abre listo para revisión

Lo pidió Álvaro: «la PR debe abrirse ya lista para review (no la abras en draft)».

- **El implementador abre el PR listo**, sin `--draft`. Lo dicen el prompt de `enjambre-implementar.yml`, el agente `enjambre-implementador`, `enjambre-plataforma` y las skills `git-enjambre`, `ci-cd` y `reglas-enjambre`.
- **Si aun así lo abre en borrador**, `pedir-revision` lo marca listo. Por eso este job pasa a tener `contents: write` y `pull-requests: write`, lo mismo que pide `gh pr ready` en el experimento de arriba. Sigue sin checkout ni agente.
- **`listo`** ya no saca el PR de borrador salvo que aún lo esté. Con APROBAR solo pide la revisión de Álvaro.
- **Ramas con sufijo de carril.** En finance_tracker#16 el implementador abrió la rama `enjambre/16a-iguales-longitud`, como proponía el plan. El job `implementar` buscaba `enjambre/16-…`, no la encontró y liberó el hueco WIP. `pedir-revision` no corrió, así que no se lanzaron ni la CI ni la revisión.
  - **Arreglo:** el patrón ahora es `^enjambre/(issue-)?<n>[a-z]?-`, en los workflows, el panel y `extraer.mjs`, con pruebas.
- **Plan dividido en carriles.** El prompt ahora pide hacer el plan entero en un solo PR, salvo que el plan diga expresamente lo contrario. En #16 el implementador solo hizo el carril A.
