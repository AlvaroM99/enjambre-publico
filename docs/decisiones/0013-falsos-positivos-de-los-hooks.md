# 0013. Falsos positivos de los hooks, vistos en las transcripciones

- **Fecha:** 22-11-2026
- **Estado:** **Propuesta**. Cambia hooks, y eso lo aprueba Álvaro (regla 5). Mientras tanto, los hooks siguen como en `v0.4.2`.
- **Decide:** Álvaro

## Contexto

Con el rastro del ADR 0012 ya fusionado (lobby#11), se repitieron el analista, el investigador QA y gobernanza, y después se planificó lobby#8. Las transcripciones muestran 21 acciones bloqueadas en los cuatro agentes: **17 falsos positivos y 4 bloqueos correctos**.

| Agente | Turnos | Coste | Bloqueos | Resultado |
|---|---|---|---|---|
| Analista (lobby#8) | 18 | 0,33 USD | 4 | El informe llegó por el respaldo |
| Investigador QA | 13 | 0,18 USD | 3 | El informe llegó por el respaldo (lobby#12) |
| Gobernanza | 25 | 0,40 USD | 12 | Informe perdido: el respaldo confundió el de QA con el suyo. Recuperado de la transcripción por la sesión (lobby#14) |
| Jefe de proyecto (lobby#8) | 12 | 1,01 USD | 2 | Plan completo bloqueado. Llegó un resumen por el respaldo, y la sesión recuperó el plan entero de la transcripción |

## Clasificación de los bloqueos

| Tipo | Casos | Hook | ¿Correcto? |
|---|---|---|---|
| Cuerpo de un comentario o issue (`gh … --body-file - <<'EOF'`) que **menciona** `datos/` o el fichero de variables locales | 6 | `proteger-secretos` | **Falso positivo.** El texto es un dato, no un acceso. Impidió publicar el informe del analista, el informe de gobernanza y el plan del jefe. En proyectos en español, la palabra «datos» aparece en casi cualquier texto |
| Leer `.claude/settings.json` para auditarlo, y textos que mencionan esa ruta | 2 | `bloquear-comandos` (`configuracion-claude`) | **Falso positivo.** La regla debería bloquear solo escrituras |
| `sed -n 1,60p fichero` y `sed -E 's/…/…/' fichero` (solo leer) | 7 | `limitar-bash` | **Falso positivo** |
| `for f in …; do grep …; done` | 1 | `limitar-bash` | **Falso positivo.** Los comandos de dentro se pueden revisar uno a uno |
| `printenv ALCANCE` (el prompt de QA le dice que lea esa variable) | 1 | `limitar-bash` | **Falso positivo**, y una incoherencia entre el workflow y la política |
| `xargs … wc`, `find -exec`, redirigir a `/tmp` (para un `node -e`) | 3 | `limitar-bash` | **Correcto**: ejecutan o escriben |
| `Read .env.example` | 1 | reglas `deny` del proyecto | Correcto (conservador) |

## Propuesta (no aplicada)

1. **`proteger-secretos` y `bloquear-comandos`:** ignorar solo el cuerpo de los heredoc **con delimitador entre comillas** que recibe `gh issue|pr comment|create|edit|review --body-file -`.
   - La línea del `<<` se sigue revisando entera.
   - En `<<EOF` sin comillas no cambia nada, porque bash expande `$(…)`.
2. **`bloquear-comandos`, regla `configuracion-claude`:** bloquear solo escrituras sobre esa configuración (`>`, `tee`, `cp`, `mv`, `rm`, `sed -i`, `git checkout`, los cmdlets de PowerShell…), no la lectura.
3. **`limitar-bash`:**
   - `sed` sin `-i`, con guiones de solo lectura: `Np`, `N,Mp`, `$p`, y `s/…/…/` con banderas `g`, `I`, `p` o un número. Nunca `w`, `e`, `r`, `W` ni `R`.
   - Bucles `for … in …; do …; done` cuyos comandos internos estén permitidos.
   - `printenv ALCANCE` solo para el investigador.
4. **Pruebas:** los 21 bloqueos reales pasan a ser casos de prueba (17 permitidos y 4 que siguen bloqueados), más casos límite de seguridad:
   - heredoc sin comillas;
   - `bash <<'EOF'`;
   - `sed -i`, `sed 'w f'` y `sed 's/a/b/e'`;
   - `for … in $(…)`;
   - escritura en `.claude/settings.json`.

   Además, banco de evaluaciones sin regresión.
5. **Despliegue:** versión nueva del plugin. `ENJAMBRE_VERSION` solo cambia cuando Álvaro la aprueba.

El primer intento de aplicarla en esta sesión lo paró el clasificador del modo automático, por relajar barreras de seguridad sin aprobación explícita. Se deshizo sin publicar nada.

## Aplicado ya (no toca hooks)

- **Respaldo de gobernanza y QA con su título exacto** (`TITULO`): corrían a la vez y el de gobernanza tomó el informe de QA por el suyo. Está en la plantilla `v0.5.1`, [lobby#13](https://github.com/AlvaroM99/lobby/pull/13) y [finance_tracker#7](https://github.com/AlvaroM99/finance_tracker/pull/7).
- El informe de gobernanza ([lobby#14](https://github.com/AlvaroM99/lobby/issues/14)) y el plan de lobby#8 se recuperaron de sus transcripciones y se publicaron con una nota. Al informe se le quitó el nombre propio de un tercero.

## Consecuencias

- Hasta aprobar la propuesta, el analista, el jefe y gobernanza no pueden publicar textos que mencionen «datos». El respaldo salva su respuesta final, pero no el documento completo.
- El plan de lobby#8 cambia `.github/workflows/ci.yml` (job `e2e`). El implementador no puede subir ese fichero (ADR 0010), así que ese paso lo hará la sesión tras su PR (M15).
