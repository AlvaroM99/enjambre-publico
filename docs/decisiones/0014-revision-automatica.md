# 0014. La revisión arranca sola; Álvaro solo confirma y fusiona

- **Fecha:** 23-11-2026
- **Estado:** **Aceptada.** Álvaro lo pidió el 23-11-2026: «no quiero tener que aprobar yo el workflow de revisión. Eso sí, quiero ser el último confirmador de la revisión sobre el total de la PR que se encargue de confirmar y mergear manualmente la PR». Aplicada en las plantillas del plugin `v0.6.3`; llega a lobby y finance_tracker por PR, que fusiona Álvaro.
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

## Sin comprobar

Este flujo no se ha ejecutado aún en una historia real. La primera historia que pase por `enjambre:implementar` después de fusionar los PR de los workflows lo comprobará. Hay que mirar cuatro cosas:

- que `ci` y `enjambre-revisar` arrancan sin el aviso;
- que el actor del `workflow_dispatch` es `github-actions[bot]`;
- que el PR pasa a listo con la revisión pedida a Álvaro;
- que los checks de la CI se ven en el PR.
